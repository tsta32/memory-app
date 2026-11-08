#!/usr/bin/env node
'use strict';
// Read-only Worker transport; local changes must be tested and submitted for review.
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const sync = require('./sync-app-templates.cjs');
const overrides = require('../card-overrides');
const { apply } = require('./apply-template-patch.cjs');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
const normalized = changes => canonical(changes.slice().sort((a,b)=>a.key.localeCompare(b.key)));
const TEMPLATE_FILES=['general_business_english_literal_ko.json','business-contexts.js','business-priorities.js'];
const fileHashes=repo=>Object.fromEntries(TEMPLATE_FILES.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex')]));
function verifyFiles(receipt,repo) {
  if(!receipt.fileHashes||!same(canonical(fileHashes(repo)),canonical(receipt.fileHashes))) stop();
}
function stop() { throw Error('CONFLICT: snapshot requires manual review; no template files were changed.'); }

function plan(data, templates = require('../business-priorities').items) {
  if (!sync.complete(data)) stop();
  const state = JSON.parse(data.srs_cards_v2);
  if (!state || !Array.isArray(state.cards) || !Array.isArray(state.editHistory)) stop();
  if ((state.deletedCards || []).length || (state.editConflicts || []).length ||
      (state.identityConflicts || []).length || state.editHistory.some(e =>
        e.field === '$presence' && e.value && e.value.present === false)) stop();
  // Recompute conflicts instead of trusting caller-supplied conflict summaries.
  const events = new Map();
  for (const e of state.editHistory) {
    if (!e || typeof e.id !== 'string' || !e.id || !Array.isArray(e.parents) ||
        events.has(e.id) || e.parents.some(p => typeof p !== 'string')) stop();
    events.set(e.id, e);
  }
  // A matching value must never hide an event attached to the wrong card ID.
  for (const card of state.cards) {
    if (!Number.isSafeInteger(card.id)) stop();
    for (const e of state.editHistory) {
      if (e.entity === overrides.key(card) && e.cardId !== card.id) stop();
      if (e.cardId === card.id && e.entity !== overrides.key(card)) stop();
      if (e.entity === overrides.key(card) && e.templateKey && card.businessTemplateKey &&
          e.templateKey !== card.businessTemplateKey) stop();
    }
    if (card.businessTemplateKey && !templates.some(t => t.key === card.businessTemplateKey)) stop();
  }
  // History must be a complete acyclic graph before causal projection is trusted.
  const done = new Set(), active = new Set();
  function visit(id) {
    if (done.has(id)) return;
    if (active.has(id) || !events.has(id)) stop();
    active.add(id);
    for (const parent of events.get(id).parents) visit(parent);
    active.delete(id); done.add(id);
  }
  for (const id of events.keys()) visit(id);
  const projected = overrides.project(structuredClone(state), structuredClone(state));
  if (projected.editConflicts.length || projected.identityConflicts.length || projected.deletedCards.length) stop();
  let analysis;
  try { analysis = sync.analyze(structuredClone(data), templates); } catch { stop(); }
  const keys = new Set();
  for (const card of analysis.state.cards) {
    if (keys.has(card.businessTemplateKey)) stop();
    keys.add(card.businessTemplateKey);
  }
  for (const change of analysis.changes.changes) {
    if (change.operation !== 'upsert' || !change.before) stop();
    const card = analysis.state.cards.find(c => c.businessTemplateKey === change.key);
    const current = projected.cards.find(c => overrides.key(c) === overrides.key(card));
    if (!current) stop();
    for (const field of ['en', 'ko', 'context', 'priority', 'priorityAssessment']) {
      if (field === 'priorityAssessment' ? change.after[field] === undefined : same(change.before[field], change.after[field])) continue;
      if (!same(current[field], change.after[field])) stop();
      const evidence = state.editHistory.some(e => e.entity === overrides.key(card) &&
        e.cardId === card.id && (!e.templateKey || e.templateKey === change.key) &&
        e.field === field && e.origin === 'user' && typeof e.device === 'string' &&
        e.device && e.device !== 'import' && Number.isFinite(e.at) && e.at > 0 &&
        same(e.value, change.after[field]));
      if (!evidence) stop();
    }
  }
  return analysis.changes;
}

async function run({ repo = path.resolve(__dirname, '..'), env = process.env,
  fetcher = sync.fetchSnapshot, localCode = sync.getCode, applyPatch = apply,
  cleanCheck = sync.assertTemplateTargetsClean,
  backupRoot = path.join(sync.CONFIG, 'template-backups'), receiptPath,
  templates = require('../business-priorities').items } = {}) {
  cleanCheck(repo);
  const code = Object.hasOwn(env, 'MEMORY_APP_SYNC_CODE')
    ? sync.validate(env.MEMORY_APP_SYNC_CODE) : localCode();
  const data = await fetcher(code);
  const patch = plan(data, templates);
  const base = receiptPath ? execFileSync('git', ['rev-parse', 'HEAD'], {cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim() : undefined;
  // No saved snapshot fallback, Worker set, Git commit, push, or secret output.
  const result = applyPatch(repo, patch, true, backupRoot);
  if(receiptPath) fs.writeFileSync(receiptPath,JSON.stringify({version:1,base,templates,changes:patch.changes,fileHashes:fileHashes(repo)}),{mode:0o600,flag:'wx'});
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, 'changed=' + (result.changes > 0) + '\n');
  console.log('Verified user-field sync: ' + result.changes + ' template change(s); Worker writes: 0.');
  return result;
}
async function verify({receiptPath, repo=path.resolve(__dirname,'..'), env=process.env, fetcher=sync.fetchSnapshot, localCode=sync.getCode}={}) {
  const receipt = JSON.parse(fs.readFileSync(receiptPath,'utf8'));
  if (receipt.version !== 1 || !Array.isArray(receipt.templates)) stop();
  verifyFiles(receipt,repo);
  const code = Object.hasOwn(env,'MEMORY_APP_SYNC_CODE') ? sync.validate(env.MEMORY_APP_SYNC_CODE) : localCode();
  const patch = plan(await fetcher(code), receipt.templates);
  if (!same(normalized(patch.changes), normalized(receipt.changes))) stop();
  return receipt;
}
const fingerprint = receipt => crypto.createHash('sha256').update(JSON.stringify({base:receipt.base,changes:normalized(receipt.changes)})).digest('hex');
if (require.main === module) (process.argv.includes('--verify')
  ? verify({receiptPath:process.env.MEMORY_APP_SYNC_RECEIPT})
  : run({receiptPath:process.env.MEMORY_APP_SYNC_RECEIPT})).catch(() => {
  // Upstream analysis/errors may contain private card text or network details.
  console.error('Sync stopped safely. Check authentication, snapshot completeness and edit conflicts privately.');
  process.exitCode = 1;
});
module.exports = { plan, run, verify, fingerprint, fileHashes, verifyFiles };
