'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const cp = require('node:child_process');
const { plan, run, verify, fingerprint } = require('../scripts/review-app-sync.cjs');
const sync = require('../scripts/sync-app-templates.cjs');
const overrides = require('../card-overrides');
const templates = require('../business-priorities').items;
const t = templates[0];
const base = { cards: [{ id: 5, businessTemplateKey: t.key, en: t.en, ko: t.ko,
  context: t.context, priority: t.priority, stage: 6, dueAt: 123, ngCount: 7,
  firstCorrectAt: 99 }], editHistory: [] };
function snapshot(state) {
  const keys = ['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
  return { ...Object.fromEntries(keys.map(k => [k, '{}'])), srs_cards_v2: JSON.stringify(state),
    __memorySyncSnapshotV1: { version: 1, keys } };
}
function edited() {
  const next = structuredClone(base); next.cards[0].ko = '검증된 사용자 번역';
  return overrides.track(base, next, 'test-device');
}
const data = snapshot(edited()), original = JSON.stringify(data);
const patch = plan(data);
assert.equal(patch.changes.length, 1);
assert.equal(patch.changes[0].after.ko, '검증된 사용자 번역');
assert.equal(JSON.stringify(data), original, 'source snapshot is never mutated');
assert.deepEqual(plan(snapshot(base)).changes, []);
function rejects(mutate) { const s = edited(); mutate(s); assert.throws(() => plan(snapshot(s)), /CONFLICT/); }
rejects(s => { s.editHistory[0].origin = 'legacy-import'; });
rejects(s => { s.editHistory[0].device = 'import'; });
rejects(s => { s.editHistory[0].value = 'Old unrelated edit'; });
rejects(s => { s.editHistory[0].templateKey = templates[1].key; });
rejects(s => { s.editHistory[0].at = 0; });
rejects(s => { s.editHistory[0].cardId = 999; });
rejects(s => { s.editHistory[0].entity = 'id:number:999'; });
rejects(s => { s.cards[0].businessTemplateKey = 'unknown-template'; });
rejects(s => { s.cards[0].id = '5'; });
rejects(s => { s.editHistory[0].parents = ['missing']; });
rejects(s => { s.editHistory[0].parents = [s.editHistory[0].id]; });
rejects(s => { s.editHistory.push(structuredClone(s.editHistory[0])); });
rejects(s => { s.cards.push({ ...s.cards[0], id: 6 }); });
rejects(s => { s.cards.push({ ...s.cards[0], businessTemplateKey: templates[1].key }); });
rejects(s => { s.deletedCards = [{ card: s.cards[0] }]; });
rejects(s => { s.editHistory.push({id:'delete',parents:[],entity:'id:number:5',field:'$presence',value:{present:false}}); });
rejects(s => { s.editConflicts = [{ field: 'ko' }]; });
rejects(s => { s.identityConflicts = [{ cardId: 5 }]; });
rejects(s => { s.editHistory.push({...s.editHistory[0], id:'concurrent',value:'다른 수정'}); });
assert.throws(() => plan({ ...data, __memorySyncSnapshotV1: undefined }), /CONFLICT/);

(async () => {
  let reads = 0, writes = 0;
  const fetcher = async code => { assert.equal(code, 'test-secret-123'); reads++; return data; };
  const applyPatch = (repo, p, write) => { assert.equal(write, true); assert.deepEqual(p.changes, patch.changes); writes++; return { changes: p.changes.length }; };
  const common = { fetcher, applyPatch, cleanCheck: () => {} };
  await run({...common, env:{MEMORY_APP_SYNC_CODE:'test-secret-123'},localCode:()=>assert.fail('unexpected fallback')});
  await run({...common, env:{},localCode:()=> 'test-secret-123'});
  assert.equal(reads, 2); assert.equal(writes, 2);
  await assert.rejects(run({...common,env:{MEMORY_APP_SYNC_CODE:''},localCode:()=>assert.fail('empty secret must fail')}), /Invalid/);
  await assert.rejects(run({...common,env:{},localCode:()=>{throw Error('missing local secret');}}), /missing/);
  await assert.rejects(run({...common,env:{MEMORY_APP_SYNC_CODE:'test-secret-123'},fetcher:async()=>{throw Error('HTTP 403');}}), /403/);
  await assert.rejects(run({...common,env:{MEMORY_APP_SYNC_CODE:'test-secret-123'},fetcher:async()=>snapshot({...edited(),deletedCards:[{card:base.cards[0]}]})}), /CONFLICT/);
  await assert.rejects(run({...common,env:{MEMORY_APP_SYNC_CODE:'test-secret-123'},cleanCheck:()=>{throw Error('dirty templates');}}), /dirty/);
  assert.equal(reads, 2); assert.equal(writes, 2, 'failed checks never reach local apply');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'review-sync-repo-'));
  try {
    const files = ['general_business_english_literal_ko.json','business-contexts.js','business-priorities.js'];
    const before = new Map();
    for (const file of files) {
      const content = fs.readFileSync(path.join(__dirname,'..',file));
      before.set(file, content);
      fs.writeFileSync(path.join(repo,file),content);
    }
    const localGit=args=>cp.execFileSync('git',args,{cwd:repo,stdio:['ignore','pipe','pipe'],encoding:'utf8'}).trim();
    localGit(['init']);localGit(['add','--',...files]);
    localGit(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture base']);
    const receiptPath=path.join(repo,'receipt.json'),outputPath=path.join(repo,'step-output');
    const result = await run({repo,env:{MEMORY_APP_SYNC_CODE:'test-secret-123'},fetcher,
      cleanCheck:()=>{},backupRoot:path.join(repo,'private-backups'),receiptPath});
    assert.equal(result.changes,1);
    for (const file of files) assert.deepEqual(fs.readFileSync(path.join(result.backupPath,file)),before.get(file));
    const row = JSON.parse(fs.readFileSync(path.join(repo,files[0]))).items.find(r=>r.businessTemplateKey===t.key);
    assert.equal(row.ko_after,'검증된 사용자 번역');
    assert.equal(row.en,t.en); assert.equal(row.context,t.context); assert.equal(row.priority,t.priority);
    const updatedTemplates=require(path.join(repo,'business-priorities.js')).items;
    assert.deepEqual(plan(data,updatedTemplates).changes,[],'the same snapshot is a no-op once its template change is integrated');
    assert.equal(JSON.stringify(data),original,'real local apply preserves the entire input snapshot, including study fields');
    const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
    assert.equal(receipt.base,localGit(['rev-parse','HEAD']));
    assert.equal(fs.statSync(receiptPath).mode&0o777,0o600);
    await verify({repo,receiptPath,env:{MEMORY_APP_SYNC_CODE:'test-secret-123'},fetcher});
    const newStudy=JSON.parse(data.srs_cards_v2);newStudy.cards[0].ngCount++;
    await verify({repo,receiptPath,env:{MEMORY_APP_SYNC_CODE:'test-secret-123'},fetcher:async()=>snapshot(newStudy)});
    await assert.rejects(verify({repo,receiptPath,env:{MEMORY_APP_SYNC_CODE:'test-secret-123'},fetcher:async()=>snapshot(base)}),/CONFLICT/);
    assert.equal(fingerprint(receipt),fingerprint(structuredClone(receipt)),'retries have a stable branch key');
    await run({repo,env:{MEMORY_APP_SYNC_CODE:'test-secret-123',GITHUB_OUTPUT:outputPath},fetcher,
      templates:updatedTemplates,cleanCheck:()=>{},backupRoot:path.join(repo,'private-backups')});
    assert.equal(fs.readFileSync(outputPath,'utf8'),'changed=false\n');
    const applied = files.map(f=>fs.readFileSync(path.join(repo,f)));
    await assert.rejects(run({repo,env:{MEMORY_APP_SYNC_CODE:'test-secret-123'},
      cleanCheck:()=>{},backupRoot:path.join(repo,'private-backups'),
      fetcher:async()=>snapshot({...edited(),editConflicts:[{field:'ko'}]})}),/CONFLICT/);
    files.forEach((f,i)=>assert.deepEqual(fs.readFileSync(path.join(repo,f)),applied[i]));
  } finally { fs.rmSync(repo,{recursive:true,force:true}); }
  // Exercise the real local credential loader without reading any user credential.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-sync-auth-'));
  try {
    const file = path.join(dir, 'worker-sync.json');
    fs.writeFileSync(file, JSON.stringify({version:1,code:'test-secret-123'}), {mode:0o600});
    const load = () => cp.spawnSync(process.execPath, ['-e', "require('./scripts/sync-app-templates.cjs').getCode()"], {
      cwd:path.resolve(__dirname,'..'), env:{...process.env,MEMORY_APP_CONFIG_DIR:dir},encoding:'utf8'});
    assert.equal(load().status, 0);
    fs.chmodSync(file, 0o644); assert.notEqual(load().status, 0);
    fs.unlinkSync(file); fs.symlinkSync(path.join(dir,'missing'),file); assert.notEqual(load().status, 0);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  console.log('Passed review-only sync provenance, conflict/deletion refusal, immutable snapshots, Secret/local authentication and no-write failure checks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
