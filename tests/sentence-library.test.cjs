'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { catalog, checkDestination, run } = require('../scripts/sync-sentence-library.cjs');
const library = require('../sentence-library');
const overrides = require('../card-overrides');
const confusableCode = 'synthetic_sync_12345';
const newCardId = 'bc17a3e5-74d8-470b-80ae-ebe43e5ef06b';
const keys = ['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
const chapters = [{ id: 4, name: 'Team category' }];
const cards = [
 { id: 1, en: 'A fictional project.', ko: '이전 한국어', context: '가상 문맥', priority: 'important', chapterId: 4, stage: 5, dueAt: 1200, ngCount: 3 },
 { id: 2, en: 'Sample standalone card.', ko: '별도 카드', chapterId: 4, userCardKey: '2107ec5d-1e14-4d44-a12c-2ff72de2edea' }
];
const baseline = { cards, nextId: 3 };
const current = structuredClone(baseline);
current.cards[0].ko = '변경한 한국어';
const edited = overrides.track(baseline, current, 'private-device-marker');
const snapshot = {
  __memorySyncSnapshotV1: { version: 1, keys }, srs_cards_v2: JSON.stringify(edited),
  srs_chapters_v1: JSON.stringify({ chapters }), srs_error_history_v1: '{"answer":"private-wrong-answer"}',
  srs_settings_v1: '{"key":"private-settings"}', srs_notes_v1: '{"note":"private-note"}'
};
snapshot.srs_trends_v1='[]';
snapshot.srs_biz_sessions_v1='[]';
const exported = catalog(snapshot, [confusableCode]);
const parsed = JSON.parse(exported.output);
assert.equal(parsed.cards.length, 2);
assert.equal(parsed.cards.find(card => card.id === 'id:number:1').category, 'Team category');
assert.deepEqual(parsed.cards.find(card => card.id === 'id:number:1').history.map(({field,before,after,userEdited})=>({field,before,after,userEdited})), [
  {field:'ko', before:'이전 한국어', after:'변경한 한국어', userEdited:true}
]);
for (const omitted of ['private-device-marker','private-wrong-answer','private-settings','private-note','dueAt','ngCount','stage']) {
  assert.equal(exported.output.includes(omitted),false);
}
const injected = {...snapshot, srs_cards_v2: JSON.stringify({cards:[{...cards[0],en:confusableCode}]})};
assert.throws(() => catalog(injected,[confusableCode]), /Possible credential/);
const document = { kind: 'memory-app-sentence-proposals', version: 1, changes: [
  {id:'id:number:1',before:{ko:'이전 한국어'},after:{ko:'저장소 한국어'}},
  {id:newCardId,before:null,after:{en:'A synthetic addition.',ko:'새 가상 문장',category:'New category'}}
]};
const imported = library.importChanges(edited,chapters,document,overrides,100,9);
assert.equal(imported.state.cards.length,3);
assert.equal(imported.state.cards[0].ko,'변경한 한국어');
assert.equal(imported.state.cards[0].dueAt,1200);
assert.equal(imported.state.cards[0].ngCount,3);
assert.equal(imported.state.editConflicts[0].field,'ko');
assert.deepEqual(imported.state.editConflicts[0].variants.map(v=>v.value).sort(),['변경한 한국어','저장소 한국어'].sort());
assert.equal(imported.chapters[1].id,9);
assert.equal(library.importChanges(imported.state,imported.chapters,document,overrides,200).changed,false);
const duplicate = { ...document, changes:[{...document.changes[1],after:{...document.changes[1].after,en:' A FICTIONAL PROJECT! '}}] };
assert.equal(library.importChanges(baseline,chapters,duplicate,overrides,200).duplicates,1);
assert.equal(library.importChanges(baseline,chapters,document,overrides,100).state.cards[0].ko,'저장소 한국어');

(async()=>{
  const repo = fs.mkdtempSync(path.join(os.tmpdir(),'private-catalog-fixture-'));
  const env = {GH_TOKEN:'synthetic-github-token',MEMORY_APP_SYNC_CODE:confusableCode};
  try {
    const remote=()=> 'https://github.com/example/private-memory.git';
    const verify = visibility => (url,{headers}) => {
      assert.equal(url,'https://api.github.com/repos/example/private-memory');
      assert.equal(headers.Authorization,'Bearer '+env.GH_TOKEN);
      return {ok:true,json:async()=>({private:visibility==='private',visibility,full_name:'example/private-memory'})};
    };
    let reads=0;
    await assert.rejects(run(repo,{env,assertPrivate:(r,t)=>checkDestination(r,t,verify('public'),remote),
      fetcher:async()=>{reads++;return snapshot;}}), /private GitHub/);
    assert.equal(reads,0);
    const access=(r,t)=>checkDestination(r,t,verify('private'),remote);
    const fetcher=async(code)=>{assert.equal(code,confusableCode);reads++;return snapshot;};
    assert.equal(await run(repo,{env,assertPrivate:access,fetcher}),2);
    const statusPath=path.join(repo,'memory-library/status.json');
    const lastStatus=fs.readFileSync(statusPath,'utf8');
    assert.equal(JSON.parse(lastStatus).catalogSha256,exported.sha256);
    await assert.rejects(run(repo,{env,assertPrivate:access,fetcher:async()=>{throw Error('offline');}}),/offline/);
    assert.equal(fs.readFileSync(statusPath,'utf8'),lastStatus);
    assert.equal(reads,1);
  }finally{fs.rmSync(repo,{recursive:true,force:true});}
  console.log('Passed private destination, allowlisted export, preference history, fresh status and conflict-safe imports.');
})().catch(error=>{console.error(error);process.exitCode=1;});
