const assert = require('node:assert/strict');
const { items, fillMissing } = require('../business-contexts');
const source = require('../general_business_english_literal_ko.json');
assert.equal(items.length, source.count);
assert.equal(items.length, 200);
assert.equal(new Set(items.map(x => x.en)).size, 200);
for (const [i, row] of items.entries()) {
  assert.equal(row.en, source.items[i].en);
  assert.equal(row.context, source.items[i].context);
  assert.match(row.context, /[가-힣]/);
  assert.match(row.context, /려고 할 때\.$/);
  assert.notEqual(row.context, source.items[i].ko_after);
  assert.ok(row.context.length >= 20 && row.context.length <= 110, row.en);
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
