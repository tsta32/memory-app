'use strict';

const { execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { complete, validate, getCode } = require('./sync-app-templates.cjs');
const { key } = require('../card-overrides');
const { idPattern, fields } = require('../sentence-library');
const { keys, inspect, validateUploadEvidence } = require('../sync-integrity');

const source = 'https://toeic-cloud-sync.tsta32.workers.dev/';
const origins = new Set(['user', 'repository', 'template-default-migration', 'english-derived', 'legacy-import']);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function catalog(snapshot, forbidden = []) {
  if (!complete(snapshot)) throw Error('Worker snapshot failed completeness validation');
  const state = JSON.parse(snapshot.srs_cards_v2);
  const chapters = snapshot.srs_chapters_v1 ? JSON.parse(snapshot.srs_chapters_v1).chapters : [];
  if (!Array.isArray(state.cards) || !Array.isArray(chapters)) throw Error('Malformed sentence profile');
  if (state.identityConflicts?.length) throw Error('Unresolved sentence identity conflicts');
  const names = new Map(chapters.map(chapter => [chapter.id, typeof chapter.name === 'string' ? chapter.name : '']));
  const events = Array.isArray(state.editHistory) ? state.editHistory : [];
  const byId = new Map(events.map(event => [event.id, event]));
  function priorValues(event, convert) {
    const seen = new Set([event.id]), pending = [...(event.parents || [])], values = [];
    while (pending.length) {
      const id = pending.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      const parent = byId.get(id);
      if (!parent) continue;
      if (parent.entity === event.entity && parent.field === event.field) values.push(convert(parent.value));
      else pending.push(...(parent.parents || []));
    }
    return values;
  }
  const byCard = new Map();
  for (const event of events) {
    if (!byCard.has(event.entity)) byCard.set(event.entity, []);
    byCard.get(event.entity).push(event);
  }
  const text = value => typeof value === 'string' ? value : '';
  const category = value => names.get(value) || '';
  const priority = value => ['essential', 'important', 'supplementary'].includes(value) ? value : 'supplementary';
  const unique = new Set();
  const cards = state.cards.map(card => {
    const id = key(card);
    if (!idPattern.test(id) || unique.has(id)) throw Error('Ambiguous sentence identity');
    unique.add(id);
    const history = (byCard.get(id) || []).flatMap(event => {
      const field = event.field === 'chapterId' ? 'category' : event.field === '$presence' ? 'presence' : event.field;
      if (!fields.includes(field) && field !== 'presence') return [];
      const convert = value => value == null ? null : field === 'category' ? category(value) :
        field === 'presence' ? typeof value.present === 'boolean' ? value.present : null :
        field === 'priority' ? priority(value) : text(value);
      const prior = Object.hasOwn(event, 'before') ? [] : priorValues(event, convert);
      const beforeKnown = Object.hasOwn(event, 'before') || prior.length > 0 && prior.every(value => value === prior[0]);
      return [{ id: hash([id, event.id]), field, beforeKnown,
        before: Object.hasOwn(event, 'before') ? convert(event.before) : beforeKnown ? prior[0] : null,
        after: convert(event.value), origin: origins.has(event.origin) ? event.origin : 'unknown',
        userEdited: event.origin === 'user' && typeof event.device === 'string' && event.device !== 'import',
        at: Number.isFinite(event.at) && event.at > 0 && event.at <= 8640000000000000 ? new Date(event.at).toISOString() : null }];
    });
    const result = { id, en: text(card.en), ko: text(card.ko), context: text(card.context),
      priority: priority(card.priority), category: category(card.chapterId), history };
    if (/^business-general-\d+$/.test(card.businessTemplateKey || '')) result.templateKey = card.businessTemplateKey;
    return result;
  }).sort((a, b) => a.id.localeCompare(b.id));
  const result = { kind: 'memory-app-sentence-catalog', version: 1, cards };
  const output = JSON.stringify(result, null, 2) + '\n';
  if (forbidden.some(secret => secret && output.includes(secret)) ||
      /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/.test(output)) {
    throw Error('Possible credential in sentence data');
  }
  return { output, sha256: createHash('sha256').update(output).digest('hex'), count: cards.length };
}

function remoteUrl(repo, push) {
  const flags = push ? ['--push', '--all'] : ['--all'];
  return execFileSync('git', ['remote', 'get-url', ...flags, 'origin'], { cwd: repo, encoding: 'utf8' }).trim();
}
async function checkDestination(repo, token, fetcher = fetch, readRemote = remoteUrl) {
  const pattern = /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/;
  const match = readRemote(repo, false).match(pattern);
  const push = readRemote(repo, true).match(pattern);
  if (!match || !push || match[1].toLowerCase() !== push[1].toLowerCase() || !token) throw Error('An authenticated private GitHub destination is required');
  const response = await fetcher('https://api.github.com/repos/' + match[1], {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    redirect: 'error', signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw Error('Unable to verify GitHub repository visibility');
  const info = await response.json();
  if (info.private !== true || info.visibility !== 'private' || info.full_name?.toLowerCase() !== match[1].toLowerCase()) {
    throw Error('Sentence data requires a private GitHub repository');
  }
}

async function getSnapshot(code) {
  const response = await fetch(source, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get', code }), redirect: 'error', signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw Error('Worker read failed');
  const result = await response.json();
  if (result.error) throw Error('Worker declined the read');
  return result.data;
}

function writePrivate(target, value) {
  const temp = target + '.' + randomUUID();
  try {
    fs.writeFileSync(temp, value, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, target);
  } finally { fs.rmSync(temp, { force: true }); }
}

async function run(repo, { env = process.env, assertPrivate = checkDestination, fetcher = getSnapshot,
  now = () => new Date() } = {}) {
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  await assertPrivate(repo, token);
  const code = Object.hasOwn(env, 'MEMORY_APP_SYNC_CODE') ? validate(env.MEMORY_APP_SYNC_CODE) : getCode();
  const snapshot = await fetcher(code);
  const integrity = inspect(snapshot);
  const checkedAt = now().toISOString();
  const result = catalog(snapshot, [code, token]);
  const snapshotSha256 = createHash('sha256').update(integrity.canonical).digest('hex');
  const marker = snapshot.__memorySyncSnapshotV1;
  const uploadEvidence = validateUploadEvidence(marker.uploadEvidence, snapshotSha256, checkedAt);
  if (Object.hasOwn(marker, 'uploadEvidence') && !uploadEvidence) {
    throw Error('The stored upload evidence does not match the Worker snapshot');
  }
  const folder = path.resolve(repo, 'memory-library');
  fs.mkdirSync(folder, { mode: 0o700, recursive: true });
  if (fs.lstatSync(folder).isSymbolicLink()) throw Error('Unsafe sentence catalog path');
  writePrivate(path.join(folder, 'catalog.json'), result.output);
  writePrivate(path.join(folder, 'status.json'), JSON.stringify({
    version: 1, source: 'worker-get', checkedAt, catalogSha256: result.sha256, cardCount: result.count,
    snapshotVersion: snapshot.__memorySyncSnapshotV1.version, hashVersion: 1, storageKeyCount: keys.length,
    snapshotSha256, uploadEvidence,
    conflictCount: integrity.conflictCount
  }, null, 2) + '\n');
  return result.count;
}

if (require.main === module) {
  const [repo, flag] = process.argv.slice(2);
  Promise.resolve().then(() => {
    if (!repo) throw Error('Private destination path is required');
    if (flag === '--check-private') return checkDestination(repo, process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
    return run(repo).then(count => console.log('Verified private catalog cards: ' + count));
  }).catch(() => { console.error('Sentence catalog sync failed. Check private repository access, Worker authentication, and snapshot validity.'); process.exitCode = 1; });
}
module.exports = { catalog, checkDestination, run };
