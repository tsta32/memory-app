const assert=require('node:assert/strict'),o=require('../card-overrides');
const templates=require('../business-priorities').items,contexts=require('../business-contexts');
const card={id:5,en:templates[0].en,ko:templates[0].ko,context:templates[0].context,priority:templates[0].priority,businessTemplateKey:templates[0].key,chapterId:9,stage:4,dueAt:123,ngCount:7,firstCorrectAt:12};
const base={cards:[structuredClone(card)],nextId:6};
function edit(state,changes,device){const next=structuredClone(state);Object.assign(next.cards[0],changes);return o.track(state,next,device);}
const a=edit(base,{en:'My changed English.',ko:'내 번역',context:'업무문구 변경알림',priority:'supplementary'},'a');
assert.ok(a.editHistory.every(e=>e.at&&e.parents&&e.device==='a'));
const fresh=o.merge(a,base,false);for(const f of ['en','ko','context','priority'])assert.equal(fresh.cards[0][f],a.cards[0][f]);
for(const f of ['id','stage','dueAt','ngCount','firstCorrectAt'])assert.equal(fresh.cards[0][f],base.cards[0][f]);
const b=edit(base,{en:'Other device English.'},'b');const both=o.merge(a,b,false);
assert.equal(both.cards[0].en,a.cards[0].en);assert.equal(both.editConflicts.filter(c=>c.field==='en').length,1);
const resolved=o.resolve(structuredClone(both),o.key(card),'en','Reviewed English.','a');assert.equal(resolved.editConflicts.length,0);
assert.equal(o.merge(resolved,b,false).cards[0].en,'Reviewed English.');assert.equal(o.merge(resolved,b,false).editConflicts.length,0);
const deleted=o.track(a,{...structuredClone(a),cards:[]},'a');const stale=o.merge(deleted,base,false);
assert.equal(stale.cards.length,0);assert.equal(stale.deletedCards[0].card.id,5);assert.equal(stale.deletedCards[0].card.ngCount,7);
const concurrent=o.merge(deleted,b,false);assert.equal(concurrent.cards.length,0);assert.ok(concurrent.deletedCards[0].card);assert.ok(concurrent.editConflicts.length);
const addition=structuredClone(base);addition.cards.push({id:6,en:'Added.',ko:'추가',context:'문장추가 알림',stage:0,dueAt:123,ngCount:0});const added=o.track(base,addition,'a');
assert.equal(o.merge(added,base,false).cards.length,2);
const addedB=structuredClone(base);addedB.cards.push({id:6,en:'Another add.',ko:'다른추가',stage:0});const collision=o.merge(added,o.track(base,addedB,'b'),false);assert.equal(collision.identityConflicts.length,1);
let defaulted=o.defaults(structuredClone(base),templates,contexts.isDefault);const updated=structuredClone(templates);updated[0].context='현재대화 시간질문';defaulted=o.defaults(defaulted,updated,contexts.isDefault);assert.equal(defaulted.cards[0].context,updated[0].context);
const preserved=o.defaults(structuredClone(a),updated,contexts.isDefault);assert.equal(preserved.cards[0].en,'My changed English.');assert.equal(preserved.cards[0].context,'업무문구 변경알림');
assert.throws(()=>o.patch(both,templates),/충돌/);const patch=o.patch(a,templates);assert.equal(patch.changes[0].after.en,'My changed English.');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{apply}=require('../scripts/apply-template-patch.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'template-patch-'));
try{
 for(const file of ['general_business_english_literal_ko.json','business-contexts.js','business-priorities.js'])fs.copyFileSync(path.join(__dirname,'..',file),path.join(temp,file));
 assert.equal(apply(temp,patch).status,'validated-only');assert.equal(apply(temp,patch,true).status,'written-locally');
 assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'general_business_english_literal_ko.json'))).items[0].en,'My changed English.');
 assert.throws(()=>apply(temp,patch,true),/CONFLICT/);
 assert.throws(()=>apply(temp,{...patch,kind:'invalid'}),/Invalid/);
}catch(e){throw e;}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Passed causal field merge, all content overrides, additions, deletion tombstones, ID collision retention, template defaults, export and repository success/failure/conflict checks.');
