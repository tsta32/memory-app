const assert = require('node:assert/strict');
const { items, previousContexts, fillMissing } = require('../business-contexts');
const source = require('../general_business_english_literal_ko.json');
assert.equal(items.length, source.count);
assert.equal(items.length, 200);
assert.equal(new Set(items.map(x => x.en)).size, 200);
for (const [i, row] of items.entries()) {
  assert.equal(row.en, source.items[i].en);
  assert.equal(row.context, source.items[i].context);
  assert.match(row.context, /[가-힣]/);
  assert.match(row.context, /^[가-힣0-9·]+ [가-힣0-9]+$/);
  assert.doesNotMatch(row.context, /할 때|하는 상황|하려고|[.!?]/);
  assert.notEqual(row.context, source.items[i].ko_after);
  assert.ok(row.context.length >= 5 && row.context.length <= 24, row.en);
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
const sourceBefore=JSON.parse(JSON.stringify(source));
sourceBefore.items.forEach((x,i)=>{x.context=oldSource.items[i].context;});
assert.deepEqual(sourceBefore,oldSource,'only source context fields change');

assert.deepEqual(previousContexts,oldSource.items.map(x=>x.context));
const priorities=require('../business-priorities');
oldSource.items.forEach((x,i)=>{assert.equal(priorities.identify({en:'Edited English',context:x.context}).key,priorities.items[i].key);});
