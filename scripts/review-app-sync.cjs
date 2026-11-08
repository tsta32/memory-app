#!/usr/bin/env node
'use strict';
// Read-only Worker transport; local changes must be tested and submitted for review.
const path = require('node:path');
const sync = require('./sync-app-templates.cjs');
const overrides = require('../card-overrides');
const { apply } = require('./apply-template-patch.cjs');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
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
  backupRoot = path.join(sync.CONFIG, 'template-backups') } = {}) {
  cleanCheck(repo);
  const code = Object.hasOwn(env, 'MEMORY_APP_SYNC_CODE')
    ? sync.validate(env.MEMORY_APP_SYNC_CODE) : localCode();
  const data = await fetcher(code);
  const patch = plan(data);
  // No saved snapshot fallback, Worker set, Git commit, push, or secret output.
  const result = applyPatch(repo, patch, true, backupRoot);
  console.log('Verified user-field sync: ' + result.changes + ' template change(s); Worker writes: 0.');
  return result;
}
if (require.main === module) run().catch(() => {
  // Upstream analysis/errors may contain private card text or network details.
  console.error('Sync stopped safely. Check authentication, snapshot completeness and edit conflicts privately.');
  process.exitCode = 1;
});
module.exports = { plan, run };
