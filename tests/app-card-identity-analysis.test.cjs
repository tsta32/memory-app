'use strict';
const assert=require('node:assert/strict');
const cli=require('../scripts/sync-app-templates.cjs');
const templates=require('../business-priorities').items;
const fields=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
const empty=Object.fromEntries(fields.map(k=>[k,'{}']));
const ordinal=t=>Number(t.key.slice(-3));
function makeSnapshot({direct=false,editedContext=false}={}){
 const offset=5000,anchorCards=templates.filter(t=>ordinal(t)!==67).map(t=>({id:offset+ordinal(t),businessTemplateKey:t.key,chapterId:1,en:t.en,ko:t.ko,context:t.context,priority:t.priority,stage:4,dueAt:4000+ordinal(t),ngCount:2,firstCorrectAt:1000+ordinal(t)}));
 const target=templates.find(t=>ordinal(t)===67),candidate={id:offset+67,chapterId:1,en:'I will share the presentation materials.',ko:'제가 발표 자료를 공유하겠습니다.',stage:7,dueAt:98765,ngCount:9,firstCorrectAt:1234};
 if(editedContext){candidate.context='발표자료 공유완료안내';candidate.contextUserEdited=true;}
 const other={id:offset+201,chapterId:3,en:'This circuit is independently categorized.',ko:'독립된 회로 카드',stage:1,dueAt:77,ngCount:0};
 const history=[{id:'legacy-presence',entity:'id:number:'+candidate.id,cardId:candidate.id,field:'$presence',value:{present:true},origin:'legacy-import',device:'import'}];
 for(const field of ['en','ko'])history.push({id:'legacy-'+field,entity:'id:number:'+candidate.id,cardId:candidate.id,field,value:candidate[field],origin:'legacy-import',device:'import'});
 if(direct)for(const field of ['en','ko'])history.push({id:'user-'+field,entity:'id:number:'+candidate.id,cardId:candidate.id,templateKey:target.key,field,value:candidate[field],origin:'user',device:'current'});
 if(editedContext)history.push({id:'user-context',entity:'id:number:'+candidate.id,cardId:candidate.id,templateKey:target.key,field:'context',value:candidate.context,origin:'user',device:'current',userContext:true});
 history.push({id:'legacy-other',entity:'id:number:'+other.id,cardId:other.id,field:'$presence',value:{present:true},origin:'legacy-import',device:'import'});
 const data={...empty,srs_chapters_v1:JSON.stringify({chapters:[{id:1,name:'영어업무(일반)'},{id:3,name:'영어업무(회로)'}]}),srs_cards_v2:JSON.stringify({cards:[...anchorCards,candidate,other],editHistory:history,deletedCards:[],templateBaselines:Object.fromEntries(anchorCards.map(c=>[c.businessTemplateKey,{en:c.en,ko:c.ko,context:c.context,priority:c.priority}]))})};
 return {data,target,candidate,other};
}
{
 const {data,target,candidate,other}=makeSnapshot();
 const report=cli.cardAnalysis(data);
 assert.equal(report.unlinkedCount,2);
 assert.equal(report.anchor.available,true);
 assert.deepEqual(report.anchor,{available:true,count:199,offset:5000,chapterId:1});
 const candidateReport=report.unlinked.find(c=>c.id===candidate.id);
 assert.equal(candidateReport.classification,'stable-id-template-candidate');
 assert.equal(candidateReport.candidateTemplateKey,target.key);
 assert.equal(candidateReport.en,candidate.en);
 assert.equal(candidateReport.category,'영어업무(일반)');
 assert.equal(report.unlinked.find(c=>c.id===other.id).classification,'independent-category-card');
 assert.equal(report.confirmedUserCardCount,0,'legacy-import events alone do not prove direct user edits');
 const coverage=report.templateCoverage.find(x=>x.key===target.key);
 assert.equal(coverage.cardId,candidate.id);
 assert.equal(coverage.fields.en.status,'different');
 assert.throws(()=>cli.analyze(data),new RegExp('id='+candidate.id+'.*'+target.key+'.*en'));
}
{
 const {data,target,candidate,other}=makeSnapshot({direct:true,editedContext:true});
 const result=cli.analyze(data);
 assert.equal(result.unlinkedChanges,1,'the independent other-category card remains unlinked');
 assert.equal(result.changes.changes.length,1);
 assert.equal(result.changes.changes[0].key,target.key);
 assert.equal(result.changes.changes[0].after.en,candidate.en);
 assert.equal(result.changes.changes[0].after.ko,candidate.ko);
 assert.equal(result.changes.changes[0].after.context,candidate.context);
 const saved=result.state.cards.find(c=>c.id===candidate.id);
 assert.deepEqual({stage:saved.stage,dueAt:saved.dueAt,ngCount:saved.ngCount,firstCorrectAt:saved.firstCorrectAt},{stage:7,dueAt:98765,ngCount:9,firstCorrectAt:1234});
 assert.ok(result.state.cards.some(c=>c.id===other.id)===false,'independent cards are excluded from the template patch projection');
}
{
 const {data,target}=makeSnapshot();
 const s=JSON.parse(data.srs_cards_v2),duplicate={id:99999,chapterId:1,en:target.en,ko:target.ko};
 s.cards.push(duplicate);s.editHistory.push({id:'dup',entity:'id:number:99999',cardId:99999,field:'$presence',value:{present:true},origin:'legacy-import'});
 data.srs_cards_v2=JSON.stringify(s);
 const report=cli.cardAnalysis(data);
 assert.ok(report.unlinked.some(c=>c.id===99999&&c.classification==='unlinked-general-card'),'English text alone never establishes template identity');
}
console.log('Passed stable card-ID identity, full 200-card template comparison, import-only conflict safety, direct user edit application, unrelated-category exclusion and SRS preservation.');
