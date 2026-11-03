/* Durable user changes. Histories merge by causal ancestry, never by wall-clock winners. */
(function(root){
'use strict';
var fields=['en','ko','context','priority','priorityAssessment','chapterId','bookmarked'];
function clone(x){return JSON.parse(JSON.stringify(x));}
function uid(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
function key(c){return c.userCardKey||'id:'+typeof c.id+':'+c.id;}
function history(s){return Array.isArray(s.editHistory)?s.editHistory:[];}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function frontier(list){var used=new Set();list.forEach(function(e){(e.parents||[]).forEach(function(p){used.add(p);});});return list.filter(function(e){return !used.has(e.id);}).map(function(e){return e.id;});}
function record(s,c,field,value,device,origin){
 s.editHistory=history(s).slice();
 s.editHistory.push({id:device?uid():'legacy:'+JSON.stringify([key(c),field,value]),entity:key(c),cardId:c.id,templateKey:c.businessTemplateKey||null,field:field,value:clone(value===undefined?null:value),parents:device?frontier(s.editHistory):[],at:device?Date.now():0,device:device||'import',origin:origin||(device?'user':'legacy-import'),userContext:field==='context'&&c.contextUserEdited===true});
}
function template(c,templates){return templates.find(function(t){return c.businessTemplateKey?t.key===c.businessTemplateKey:t.en===c.en;});}
function seed(s,templates,isDefault){
 if(!s||!Array.isArray(s.cards))return s;
 s.editHistory=history(s);
 s.cards.forEach(function(c){
  var t=template(c,templates),known=history(s).filter(function(e){return e.entity===key(c);});
  if(!t){if(!known.length){record(s,c,'$presence',{present:true,card:clone(c)});fields.forEach(function(f){if(c[f]!==undefined)record(s,c,f,c[f]);});}return;}
  ['en','ko','context','priority'].forEach(function(f){
   if(known.some(function(e){return e.field===f;})||c[f]===undefined||same(c[f],t[f])||(s.templateBaselines&&s.templateBaselines[t.key]&&same(c[f],s.templateBaselines[t.key][f])))return;
   if(f==='ko'&&c.ko===t.ko_before)return;
   if(f==='context'&&!c.contextUserEdited&&isDefault&&isDefault(t.en,c.context))return;
   record(s,c,f,c[f]);
  });
 });return s;
}
function track(previous,next,device){
 next.editHistory=history(previous).concat(history(next).filter(function(e){return !history(previous).some(function(p){return p.id===e.id;});}));
 var before=new Map((previous.cards||[]).map(function(c){return [key(c),c];}));
 var after=new Set();
 next.cards.forEach(function(c){
  var prior=before.get(key(c));
  if(!prior){if(!c.userCardKey)c.userCardKey=uid();record(next,c,'$presence',{present:true,card:clone(c)},device);}
  after.add(key(c));
  fields.forEach(function(f){if((!prior&&c[f]!==undefined)||(prior&&!same(prior[f],c[f])))record(next,c,f,c[f],device,f==='context'&&prior&&prior.en!==c.en&&!c.contextUserEdited?'english-derived':undefined);});
 });
 (previous.cards||[]).forEach(function(c){if(!after.has(key(c)))record(next,c,'$presence',{present:false,card:clone(c)},device);});
 return project(next,next);
}
function project(state,preferred){
 var events=history(state),byId=new Map(events.map(function(e){return [e.id,e];})),memo=new Map();
 function ancestor(a,b){var token=a+'|'+b;if(memo.has(token))return memo.get(token);var seen=new Set(),todo=[b],found=false;while(todo.length){var id=todo.pop();if(id===a){found=true;break;}if(seen.has(id))continue;seen.add(id);var e=byId.get(id);if(e)todo.push.apply(todo,e.parents||[]);}memo.set(token,found);return found;}
 var entities=new Map();events.forEach(function(e){if(!entities.has(e.entity))entities.set(e.entity,{});var groups=entities.get(e.entity);(groups[e.field]||(groups[e.field]=[])).push(e);});
 var records=new Map((state.cards||[]).map(function(c){return [key(c),c];})),pref=new Map((preferred.cards||[]).map(function(c){return [key(c),c];}));
 var deleted=[],conflicts=[];
 entities.forEach(function(groups,entity){
  var pres=groups.$presence||[],snap=pres.find(function(e){return e.value&&e.value.card;});
  var c=records.get(entity)||(snap?clone(snap.value.card):null);if(!c)return;
  var isPresent=true,deleteHead=null;
  Object.keys(groups).forEach(function(f){
   var heads=groups[f].filter(function(e){return !groups[f].some(function(other){return other.id!==e.id&&ancestor(e.id,other.id);});});
   var distinct=[];heads.forEach(function(e){if(!distinct.some(function(x){return same(x.value,e.value);}))distinct.push(e);});
   var preferredCard=pref.get(entity),chosen=heads.find(function(e){return f==='$presence'?e.value.present===!!preferredCard:preferredCard&&same(e.value,preferredCard[f]);})||heads.slice().sort(function(a,b){return a.id.localeCompare(b.id);})[0];
   if(f==='$presence'){
    if(heads.some(function(e){return e.value.present===false;})){isPresent=false;deleteHead=heads.find(function(e){return e.value.present===false;});}else isPresent=chosen.value.present;
   }else {c[f]=clone(chosen.value);if(f==='context'&&(chosen.userContext||chosen.device!=='import'&&chosen.origin!=='english-derived'&&chosen.origin!=='template-default-migration'))c.contextUserEdited=true;}
   if(distinct.length>1)conflicts.push({entity:entity,cardId:c.id,field:f,variants:clone(heads),chosen:chosen.id});
  });
  if(deleteHead){var concurrent=events.filter(function(e){return e.entity===entity&&e.field!=='$presence'&&!ancestor(e.id,deleteHead.id)&&!ancestor(deleteHead.id,e.id);});if(concurrent.length)conflicts.push({entity:entity,cardId:c.id,field:'$presence',variants:[clone(deleteHead)].concat(clone(concurrent)),chosen:deleteHead.id});}
  if(isPresent)records.set(entity,c);else{records.delete(entity);deleted.push({entity:entity,card:clone(c)});}
 });
 // Numeric ID collisions between independent additions are retained for explicit review.
 var active=[],ids=new Map(),identityConflicts=[];
 records.forEach(function(c){if(ids.has(c.id)){var other=ids.get(c.id);identityConflicts.push({cardId:c.id,cards:[clone(other),clone(c)]});}else{ids.set(c.id,c);active.push(c);}});
 state.cards=active;state.deletedCards=deleted;state.editConflicts=conflicts;state.identityConflicts=(state.identityConflicts||[]).concat(identityConflicts).filter(function(x,i,a){return a.findIndex(function(y){return same(x,y);})===i;});
 return state;
}
function merge(local,remote,preferLocal){
 var out=Object.assign({},remote,local),map=new Map();
 history(remote).concat(history(local)).forEach(function(e){map.set(e.id,e);});out.editHistory=Array.from(map.values());
 var list=preferLocal?(local.cards||[]).concat(remote.cards||[]):(remote.cards||[]).concat(local.cards||[]),records=new Map();
 list.forEach(function(c){if(!records.has(key(c)))records.set(key(c),clone(c));});out.cards=Array.from(records.values());
 out.identityConflicts=(local.identityConflicts||[]).concat(remote.identityConflicts||[]);
 out.nextId=Math.max(local.nextId||0,remote.nextId||0,...out.cards.map(function(c){return typeof c.id==='number'?c.id+1:0;}));
 return project(out,local);
}
function resolve(state,entity,field,value,device){
 var c=state.cards.find(function(c){return key(c)===entity;})||(state.deletedCards||[]).map(function(x){return x.card;}).find(function(c){return key(c)===entity;});
 if(!c)throw new Error('카드를 찾을 수 없습니다.');
 record(state,c,field,field==='$presence'?{present:!!value,card:clone(c)}:value,device);return project(state,state);
}
function defaults(state,templates,isDefault){
 seed(state,templates,isDefault);state.templateBaselines=state.templateBaselines||{};
 state.cards.forEach(function(c){var t=template(c,templates);if(!t)return;var old=state.templateBaselines[t.key];
  if(old)['en','ko','context','priority'].forEach(function(f){var edited=history(state).some(function(e){return e.entity===key(c)&&e.field===f;});var enEdited=history(state).some(function(e){return e.entity===key(c)&&e.field==='en';});var koEdited=history(state).some(function(e){return e.entity===key(c)&&e.field==='ko';});if(f==='ko'&&!edited&&c.ko===t.ko_before)c.ko=t.ko;else if(!edited&&!(f==='context'&&enEdited)&&!(f==='priority'&&(enEdited||koEdited))&&same(c[f],old[f]))c[f]=t[f];});
  var enEdited=history(state).some(function(e){return e.entity===key(c)&&e.field==='en';}),contextEdited=history(state).some(function(e){return e.entity===key(c)&&e.field==='context';});
  if(enEdited&&!contextEdited&&!c.contextUserEdited&&(c.context===t.context||(isDefault&&isDefault(t.en,c.context)))){var exact=templates.find(function(x){return x.en===c.en;});c.context=exact?exact.context:'';c.contextNeedsReview=!exact;}
  var contextWasManuallyEdited=c.contextUserEdited===true||history(state).some(function(e){return e.entity===key(c)&&e.field==='context'&&(e.userContext===true||e.device!=='import'&&e.origin!=='english-derived'&&e.origin!=='template-default-migration');});
  if(!contextWasManuallyEdited&&c.en===t.en&&c.context!==t.context&&isDefault&&isDefault(t.en,c.context)){
   record(state,c,'context',t.context,'template-migration','template-default-migration');
   c.context=t.context;delete c.contextNeedsReview;
  }
  state.templateBaselines[t.key]={en:t.en,ko:t.ko,context:t.context,priority:t.priority};
 });return state;
}
function patch(state,templates){
 if((state.editConflicts||[]).length||(state.identityConflicts||[]).length)throw new Error('CONFLICT: resolve card edit or identity conflicts before template export');
 var changes=[];
 state.cards.forEach(function(c){var t=template(c,templates),edited=history(state).some(function(e){return e.entity===key(c);});if(!edited)return;if(c.contextNeedsReview)throw new Error('CONFLICT: modified English has no reviewed context');var after={en:c.en,ko:c.ko,context:c.context||'',priority:c.priority||'supplementary'};var assessment=c.priorityAssessment;if(assessment&&assessment.version===1&&assessment.en===c.en&&assessment.ko===c.ko&&assessment.context===c.context&&assessment.priority===after.priority)after.priorityAssessment=clone(assessment);var assessmentChanged=!!(after.priorityAssessment&&(!t||t.reason!==after.priorityAssessment.reason||!same(t.coverageAreas||[],after.priorityAssessment.coverageAreas||[])||!same(t.coveragePurposes||[],after.priorityAssessment.coveragePurposes||[])));if(!t||['en','ko','context','priority'].some(function(f){return after[f]!==t[f];})||assessmentChanged)changes.push({key:t?t.key:'user-'+key(c),operation:'upsert',before:t?{en:t.en,ko:t.ko,context:t.context,priority:t.priority}:null,after:after});});
 (state.deletedCards||[]).forEach(function(d){var t=template(d.card,templates);if(t)changes.push({key:t.key,operation:'delete',before:{en:t.en,ko:t.ko,context:t.context,priority:t.priority}});});
 if(new Set(changes.map(function(c){return c.key;})).size!==changes.length)throw new Error('CONFLICT: multiple edited cards map to the same template key');
 return {kind:'memory-app-template-patch',version:1,createdAt:Date.now(),changes:changes};
}
var api={fields:fields,key:key,seed:seed,track:track,merge:merge,project:project,resolve:resolve,defaults:defaults,patch:patch};
if(typeof module==='object'&&module.exports)module.exports=api;else root.CardOverrides=api;
})(typeof window!=='undefined'?window:globalThis);
