const assert=require('node:assert/strict');
const p=require('../business-priorities');const source=require('../general_business_english_literal_ko.json');
assert.equal(p.items.length,200);assert.equal(new Set(p.items.map(x=>x.key)).size,200);
const essential=p.items.filter(x=>x.priority==='essential');
assert.equal(new Set(essential.map(x=>x.purpose)).size,essential.length,'no duplicate essential purpose group');
for(const [i,row]of p.items.entries()){
  assert.equal(row.en,source.items[i].en);assert.equal(row.ko,source.items[i].ko_after);assert.equal(row.context,source.items[i].context);
  assert.equal(row.priority,source.items[i].priority);assert.ok(p.valid(row.priority));assert.ok(row.reason.length>20);
  if(row.priority==='essential')assert.ok(row.criteria.length&&row.criteria.every(n=>[1,2,3].includes(n)));
}
const chapters=[{id:9,name:'영어업무(일반)'},{id:10,name:'다른 카테고리'}];
const cards=p.items.map((x,i)=>({id:500-i,en:x.en,ko:'사용자 번역',context:'사용자 문맥',chapterId:9,stage:9,everAnswered:true,dueAt:99999,ngCount:7,lastTestedAt:34,bookmarked:true,extra:{keep:1}}));
const before=JSON.parse(JSON.stringify(cards));assert.equal(p.migrate(cards,chapters),true);
for(const [i,c]of cards.entries()){
  const {priority,businessTemplateKey,...rest}=c;assert.deepEqual(rest,before[i]);assert.equal(priority,p.items[i].priority);assert.equal(businessTemplateKey,p.items[i].key);assert.equal(p.passed(c),false,'SRS history is not proof of first-pass correctness');
}
cards.reverse();cards[0].en='User edited English';cards[0].ko='사용자 번역';cards[0].context='사용자 문맥';cards[0].priority='essential';
assert.equal(p.migrate(cards,chapters),false,'edited grades and content never overwritten');assert.equal(p.identify(cards[0]).key,p.items[199].key);
const edited={id:900,chapterId:9,en:'Completely edited English',ko:p.items[0].ko,context:'개인 문맥'};
assert.equal(p.migrate([edited],chapters),true);assert.equal(edited.priority,p.items[0].priority);assert.equal(edited.en,'Completely edited English');
const conflict={chapterId:9,en:'User edit',ko:p.items[0].ko,context:p.items[1].context};assert.equal(p.identify(conflict),null);
const other={chapterId:10,en:p.items[0].en};assert.equal(p.migrate([other],chapters),false);assert.equal(other.priority,undefined);
const unknown={chapterId:9,en:'Unknown',ko:'Unknown',context:'Unknown'};assert.equal(p.migrate([unknown],chapters),false);
const make=(id,priority,props={})=>({id,priority,chapterId:9,en:'Sentence '+id,dueAt:1,everAnswered:false,...props});
const a=make(1,'essential',{everAnswered:true,firstCorrectAt:10}),b=make(2,'essential'),c=make(3,'important',{everAnswered:true,firstCorrectAt:10}),d=make(4,'important'),e=make(5,'supplementary');
const ids=pool=>p.plan(pool,chapters,100).tiers.flatMap(t=>t.cards.map(c=>c.id));
assert.deepEqual(ids([d,c,b,a,e]),[1,2]);
a.dueAt=1000;assert.deepEqual(ids([a,b,c,d,e]),[2],'unpassed essential blocks important reviews and new work');
b.firstCorrectAt=11;b.everAnswered=true;b.dueAt=1000;assert.deepEqual(ids([a,b,c,d,e]),[3,4],'future essential reviews do not block important');
assert.deepEqual(p.plan([a,b,c,d,e],chapters,1001).tiers.flatMap(t=>t.cards.map(c=>c.id)),[1,2],'newly due essential work wins in the next session');
delete b.firstCorrectAt;assert.deepEqual(ids([a,b,c,d,e]),[],'unknown historical correctness is never guessed');
assert.equal(p.progress([a,b,c,d,e],chapters,100).essential.passed,1);
assert.equal(p.plan([e],chapters,100).legacy.length,0,'supplementary never falls back to automatic legacy selection');
assert.deepEqual(ids([e]),[]);
console.log('Passed all 200 priority assessments, essential purpose uniqueness, safe migration, frontier gating and future review selection.');

// Existing sync stores entire card objects; the new facts survive a legacy/partial snapshot merge.
{
  const fs=require('node:fs'),vm=require('node:vm');
  const sync=fs.readFileSync(require('node:path').join(__dirname,'..','sync-bootstrap.js'),'utf8');
  const start=sync.indexOf('function mergeRecordArrays('),end=sync.indexOf('function mergeNotes(',start);
  const scope={};vm.createContext(scope);vm.runInContext(sync.slice(start,end),scope);
  const local={nextId:9,cards:[{id:1,en:'User edited',priority:'supplementary',businessTemplateKey:p.items[0].key,firstCorrectAt:123,stage:5,ngCount:8}]};
  const remote={nextId:8,cards:[{id:1,en:'Old English',stage:0},{id:2,en:'Other card'}]};
  const merged=JSON.parse(scope.mergeWrappedRecords(JSON.stringify(local),JSON.stringify(remote),'cards'));
  assert.deepEqual(merged.cards[0],local.cards[0]);assert.equal(merged.cards[1].id,2);assert.equal(merged.nextId,9);
}
console.log('Passed priority/first-correct preservation through the existing sync object merge.');
