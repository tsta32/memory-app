'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const source=require('../general_business_english_literal_ko.json');
const contexts=require('../business-contexts'),priorities=require('../business-priorities');
const overrides=require('../card-overrides'),{plan}=require('../scripts/review-app-sync.cjs');
const {apply}=require('../scripts/apply-template-patch.cjs');
const key='business-general-067',row=source.items.find(x=>x.businessTemplateKey===key),meta=priorities.items.find(x=>x.key===key);
assert.equal(source.items.length,200);assert.ok(row&&meta);
assert.equal(row.en,meta.en);assert.equal(row.ko_after,meta.ko);assert.equal(row.context,meta.context);assert.equal(row.priority,meta.priority);
assert.equal(meta.source_line,67);assert.equal(contexts.items.find(x=>x.en===row.en).context,row.context);
const card={id:961,businessTemplateKey:key,en:row.en,ko:row.ko_after,context:row.context,priority:row.priority,
  chapterId:1,stage:7,dueAt:98765,ngCount:9,firstCorrectAt:1234,lastTestedAt:456,bookmarked:true};
const before={cards:[card],editHistory:[]},next=structuredClone(before);
next.cards[0].ko='격리된 회귀 검사 번역';
const state=overrides.track(before,next,'fixture-device');
const keys=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
const data={...Object.fromEntries(keys.map(k=>[k,'{}'])),srs_cards_v2:JSON.stringify(state),__memorySyncSnapshotV1:{version:1,keys}};
const original=JSON.stringify(data),patch=plan(data);
assert.equal(patch.changes.length,1);assert.equal(patch.changes[0].key,key);
const repo=fs.mkdtempSync(path.join(os.tmpdir(),'template-067-regression-'));
try{
 for(const file of ['general_business_english_literal_ko.json','business-contexts.js','business-priorities.js'])fs.copyFileSync(path.join(__dirname,'..',file),path.join(repo,file));
 apply(repo,patch,true,path.join(repo,'private-backups'));
 const updated=JSON.parse(fs.readFileSync(path.join(repo,'general_business_english_literal_ko.json'),'utf8'));
 for(const item of updated.items){
  const prior=source.items.find(x=>x.businessTemplateKey===item.businessTemplateKey);
  assert.deepEqual(item,item.businessTemplateKey===key?{...prior,ko_after:next.cards[0].ko}:prior,'only the verified target field may change');
 }
 assert.equal(JSON.stringify(data),original,'source snapshot and all study/edit history fields remain untouched');
 assert.deepEqual(JSON.parse(data.srs_cards_v2).cards[0],next.cards[0]);
}finally{fs.rmSync(repo,{recursive:true,force:true});}
console.log('Passed ID 961/template-067 identity, source parity, verified target-only patch, unrelated template and study-history preservation.');
