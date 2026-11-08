const assert = require('node:assert/strict');
const { items, previousContexts, fillMissing } = require('../business-contexts');
const priorities=require('../business-priorities');
const source = require('../general_business_english_literal_ko.json');
assert.equal(items.length, source.count);
assert.equal(items.length, 200);
assert.equal(new Set(items.map(x => x.en)).size, 200);
for (const [i, row] of items.entries()) {
  assert.equal(row.en, source.items[i].en);
  assert.equal(row.context, source.items[i].context);
  // Reviewed user contexts may be custom prose or intentionally empty.
  assert.equal(typeof row.context,'string');
}
const chapters = [{id: 9, name: '업무대화 일반'}, {id: 10, name: '다른 챕터'}];
const cards = items.map((x, i) => ({id:i + 1, en:x.en, ko:'원래 번역', chapterId:9, stage:4, dueAt:123, ngCount:7, bookmarked:true, extra:{history:[1,2]}}));
const before = JSON.parse(JSON.stringify(cards));
cards.push({id:201,en:items[0].en,chapterId:10}, {id:202,en:'Unknown English',chapterId:9});
assert.equal(fillMissing(cards,chapters), true);
for (let i=0;i<200;i++) {
  assert.equal(cards[i].context, items[i].context);
  const {context, ...rest} = cards[i];
  assert.deepEqual(rest, before[i], 'all original card data survives');
}
assert.equal(cards[200].context, undefined);
assert.equal(cards[201].context, undefined);
cards[0].context='사용자가 작성한 문맥';cards[1].context='';
assert.equal(fillMissing(cards,chapters), false, 'idempotent, including intentional deletion');
assert.equal(cards[0].context,'사용자가 작성한 문맥');assert.equal(cards[1].context,'');
for (const name of ['영어업무(일반)', '업무대화(일반)']) {
  const fixture=[{en:items[0].en,chapterId:42}];
  assert.equal(fillMissing(fixture,[{id:42,name}]),true);
}
console.log('Passed all 200 stored context coverage, source parity, migration preservation and edit retention checks.');

// Exercise all previously shipped defaults, with arbitrary user data intact.
const oldSource=require('./fixtures/business-source-v1.json');
const legacy=oldSource.items.map((x,i)=>({...before[i],context:x.context,priority:['essential','important','support'][i%3],userData:{notes:'사용자 메모',wrongAnswers:['a']}}));
const legacyBefore=JSON.parse(JSON.stringify(legacy));
assert.equal(fillMissing(legacy,chapters),true);
legacy.forEach((c,i)=>{assert.equal(c.context,items[i].context);assert.deepEqual({...c,context:legacyBefore[i].context},legacyBefore[i]);});
assert.equal(fillMissing(legacy,chapters),false);
const edits=oldSource.items.map((x,i)=>({...before[i],context:i%2?'':x.context+' 사용자 수정'}));
const editsBefore=JSON.parse(JSON.stringify(edits));
assert.equal(fillMissing(edits,chapters),false);
assert.deepEqual(edits,editsBefore);
for (const [i,row] of source.items.entries()) {
  assert.equal(row.context,items[i].context,'each reviewed source context matches runtime data');
  assert.equal(row.businessTemplateKey,priorities.items[i].key);
  assert.equal(row.en,items[i].en);
}

assert.deepEqual(previousContexts,oldSource.items.map(x=>x.context));
oldSource.items.forEach((x,i)=>{assert.equal(priorities.identify({en:'Edited English',context:x.context}).key,priorities.items[i].key);});

// Reported production variant must migrate, without interpreting arbitrary prose as a default.
{
  const index=items.findIndex(x=>x.en==='When do we need to finish this?');
  const old='그 일의 대응기한을 물으려고 할 때.';
  const row={...before[index],context:old,priority:'important',businessTemplateKey:'business-general-058'};
  const snapshot=structuredClone(row);
  assert.equal(fillMissing([row],chapters),true);
  assert.equal(row.context,'업무기한 질문');
  assert.deepEqual({...row,context:old},snapshot);
  for(const context of [old,previousContexts[index]]){
    const custom={...snapshot,context,contextUserEdited:true},copy=structuredClone(custom);
    assert.equal(fillMissing([custom],chapters),false);assert.deepEqual(custom,copy);
  }
  const unknown={...snapshot,context:'내가 직접 작성한 기한을 물으려고 할 때.'};
  const copy=structuredClone(unknown);assert.equal(fillMissing([unknown],chapters),false);assert.deepEqual(unknown,copy);
  assert.equal(fillMissing([row],chapters),false);
}
console.log('Passed observed production default, explicit user-edit protection, unknown prose retention and idempotence.');

{
  const {preserveUserContexts}=require('../business-contexts');
  const local=items.slice(0,4).map((x,i)=>({...before[i],context:i===0?previousContexts[0]:i===1?'':i===2?'나의 문맥':x.context,...(i===0?{contextUserEdited:true}:{})}));
  const remote=items.slice(0,4).map((x,i)=>({...before[i],context:previousContexts[i],stage:8,dueAt:999,ngCount:20}));
  const remoteBefore=structuredClone(remote);
  preserveUserContexts(remote,local,chapters);
  remote.slice(0,3).forEach((x,i)=>{assert.equal(x.context,local[i].context);const {context,contextUserEdited,...rest}=x;const {context:old,...original}=remoteBefore[i];assert.deepEqual(rest,original);});
  assert.deepEqual(remote[3],remoteBefore[3]);
}
