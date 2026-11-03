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
// Priority assessment updates are template defaults; a directly edited priority is protected.
{
 const row=templates.find(x=>x.key==='business-general-142');
 const beforeReview={...structuredClone(row),priority:'important'};
 const oldBaseline={cards:[{id:142,en:row.en,ko:row.ko,context:row.context,priority:'important',businessTemplateKey:row.key,chapterId:9,stage:6,dueAt:777,ngCount:9}],nextId:143,templateBaselines:{[row.key]:{en:row.en,ko:row.ko,context:row.context,priority:'important'}}};
 const auto=o.defaults(structuredClone(oldBaseline),templates,contexts.isDefault);assert.equal(auto.cards[0].priority,'essential');assert.equal(auto.cards[0].stage,6);assert.equal(auto.cards[0].dueAt,777);assert.equal(auto.cards[0].ngCount,9);
 const edited=o.track(oldBaseline,{...structuredClone(oldBaseline),cards:[{...oldBaseline.cards[0],priority:'supplementary'}]},'priority-device');
 assert.equal(o.defaults(edited,templates,contexts.isDefault).cards[0].priority,'supplementary','user-selected priority remains above new template default');
 const contentEdited=o.track(oldBaseline,{...structuredClone(oldBaseline),cards:[{...oldBaseline.cards[0],en:'My rewritten file update.'}]},'content-device');
 assert.equal(o.defaults(contentEdited,templates,contexts.isDefault).cards[0].priority,'important','template grade change is held for a user-rewritten English card');
 const translationEdited=o.track(oldBaseline,{...structuredClone(oldBaseline),cards:[{...oldBaseline.cards[0],ko:'수정 번역'}]},'translation-device');
 assert.equal(o.defaults(translationEdited,templates,contexts.isDefault).cards[0].priority,'important','template grade change is held for a user-rewritten translation');
}
const preserved=o.defaults(structuredClone(a),updated,contexts.isDefault);assert.equal(preserved.cards[0].en,'My changed English.');assert.equal(preserved.cards[0].context,'업무문구 변경알림');
const legacyContext='이번건의 작업순서를 정하고싶다고 말하려고 할 때.';
const changedEnglish=templates.find(x=>x.key==='business-general-181');
const migrationState={cards:[{...structuredClone(card),id:1075,businessTemplateKey:changedEnglish.key,en:changedEnglish.en,ko:'작업의 순서를 정하고 싶습니다.',context:legacyContext,contextUserEdited:false,stage:8,dueAt:987,ngCount:12,everAnswered:true}],nextId:1076,editHistory:[{id:'legacy-context',entity:'id:number:1075',cardId:1075,templateKey:changedEnglish.key,field:'context',value:legacyContext,parents:[],at:0,device:'import',origin:'legacy-import',userContext:false}],templateBaselines:{[changedEnglish.key]:{en:changedEnglish.en,ko:changedEnglish.ko,context:changedEnglish.context,priority:changedEnglish.priority}}};
const migrated=o.defaults(structuredClone(migrationState),templates,contexts.isDefault);
assert.equal(migrated.cards[0].context,changedEnglish.context);assert.equal(migrated.cards[0].contextUserEdited,false);
assert.equal(migrated.cards[0].stage,8);assert.equal(migrated.cards[0].dueAt,987);assert.equal(migrated.cards[0].ngCount,12);
assert.ok(migrated.editHistory.some(e=>e.origin==='template-default-migration'&&e.value===changedEnglish.context));
assert.equal(o.merge(migrated,migrationState,false).cards[0].context,changedEnglish.context,'legacy cloud snapshot cannot restore migrated default context');
const manual=structuredClone(migrationState);manual.cards[0].context='내가 직접 편집한 작업 문맥';manual.cards[0].contextUserEdited=true;
assert.equal(o.defaults(manual,templates,contexts.isDefault).cards[0].context,'내가 직접 편집한 작업 문맥','direct context edits survive template migration');
const priorTranslation={cards:[{...structuredClone(card),ko:templates[0].ko_before}],nextId:6,templateBaselines:{[templates[0].key]:{en:templates[0].en,ko:templates[0].ko,context:templates[0].context,priority:templates[0].priority}}};
assert.equal(o.defaults(structuredClone(priorTranslation),templates,contexts.isDefault).cards[0].ko,templates[0].ko,'known former default translation receives current template value');
const editedPriorTranslation=structuredClone(priorTranslation);editedPriorTranslation.editHistory=[{id:'manual-ko',entity:o.key(card),cardId:card.id,templateKey:templates[0].key,field:'ko',value:templates[0].ko_before,parents:[],at:1,device:'a',origin:'user'}];
assert.equal(o.defaults(editedPriorTranslation,templates,contexts.isDefault).cards[0].ko,templates[0].ko_before,'explicit translation edit is preserved');
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
