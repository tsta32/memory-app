(function(root){
'use strict';
var fields=['en','ko','context','priority','category'];
var grades=['essential','important','supplementary'];
var idPattern=/^(?:id:number:[1-9]\d*|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
function normalize(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").trim().replace(/\s+/g,' ').replace(/[.!?]+$/,'').trim();}
function valid(field,value){
 return field==='priority'?grades.indexOf(value)!==-1:
  typeof value==='string'&&value.length<=10000&&(!['en','ko'].includes(field)||!!value.trim());
}
function importChanges(state,chapters,document,overrides,now,chapterSequence){
 if(!document||document.kind!=='memory-app-sentence-proposals'||document.version!==1||
    !Array.isArray(document.changes)||document.changes.length>1000)throw new Error('Invalid sentence proposals');
 var next=JSON.parse(JSON.stringify(state)),available=JSON.parse(JSON.stringify(chapters));
 var imported=new Set(next.sentenceProposalIds||[]),duplicates=0,applied=0,changed=false;
 var entities=new Map(next.cards.map(function(card){return [overrides.key(card),card];}));
 var names=new Map(available.map(function(chapter){return [chapter.name,chapter.id];}));
 var nextChapterId=Math.max(chapterSequence||1,...available.map(function(chapter){return Number(chapter.id)+1||1;}));
 function category(value){
  if(!value)return null;
  if(!names.has(value)){names.set(value,nextChapterId);available.push({id:nextChapterId++,name:value});}
  return names.get(value);
 }
 function duplicate(en,card){return next.cards.some(function(other){return other!==card&&normalize(other.en)===normalize(en);});}
 var proposalIds=new Set();
 var entries=document.changes.map(function(change){
  if(!change||!idPattern.test(change.id)||proposalIds.has(change.id)||!change.after||
     Object.keys(change.after).some(function(field){return !fields.includes(field)||!valid(field,change.after[field]);})||
     !Object.keys(change.after).length)throw new Error('Invalid sentence proposal');
  proposalIds.add(change.id);
  if(change.before!==null&&(!change.before||Object.keys(change.after).some(function(field){return !valid(field,change.before[field]);}))){
   throw new Error('A current baseline is required');
  }
  if(change.before===null&&(!change.after.en||!change.after.ko||change.id.startsWith('id:')))throw new Error('Invalid new sentence');
  return change;
 });
 entries.forEach(function(change){
  var existing=entities.get(change.id);
  if(change.before===null){
   if(existing||imported.has(change.id))return;
   if(duplicate(change.after.en)){duplicates++;return;}
   var card={id:Math.max(next.nextId||1,...next.cards.map(function(c){return Number(c.id)+1||1;})),
    userCardKey:change.id,en:change.after.en,ko:change.after.ko,context:change.after.context||'',
    priority:change.after.priority||'supplementary',chapterId:category(change.after.category),
    stage:0,dueAt:now,everAnswered:false,ngCount:0,lastTestedAt:0};
   next.nextId=card.id+1;next.cards.push(card);entities.set(change.id,card);
   overrides.addRepositoryCard(next,card);
   imported.add(change.id);applied++;changed=true;return;
  }
  if(!existing)throw new Error('A proposed card is missing');
  var changedFields=Object.keys(change.after).filter(function(field){return change.before[field]!==change.after[field];});
  if(changedFields.includes('en')&&duplicate(change.after.en,existing)){duplicates++;return;}
  changedFields.forEach(function(field){
   var current=field==='category'?(available.find(function(c){return c.id===existing.chapterId;})||{}).name||'':existing[field];
   if(current===undefined)current=field==='priority'?'supplementary':'';
   if(current===change.after[field])return;
   var appField=field==='category'?'chapterId':field;
   var nextValue=field==='category'?category(change.after[field]):change.after[field];
   var base=field==='category'?(names.get(change.before[field])||null):change.before[field];
   if(overrides.repositoryEdit(next,existing,appField,base,nextValue,current!==change.before[field]))changed=true;
  });
  applied++;
 });
 next.sentenceProposalIds=Array.from(imported);
 return {state:changed?overrides.project(next,next):next,chapters:available,changed:changed,applied:applied,duplicates:duplicates};
}
var api={fields:fields,idPattern:idPattern,normalize:normalize,importChanges:importChanges};
if(typeof module==='object'&&module.exports)module.exports=api;else root.SentenceLibrary=api;
})(typeof window==='undefined'?globalThis:window);
