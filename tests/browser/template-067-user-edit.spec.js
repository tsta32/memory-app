const {test,expect}=require('@playwright/test');
const source=require('../../general_business_english_literal_ko.json');
const priorities=require('../../business-priorities').items;
const currentTemplate=priorities.find(t=>t.key==='business-general-067');
const fields=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];

function profile(){
 const bySource=new Map(priorities.map(t=>[t.source_line,t]));
 const cards=source.items.map((row,index)=>{
  const t=bySource.get(row.source_line),id=894+row.source_line,isTarget=id===961;
  return {id,en:row.en,ko:row.ko_after,chapterId:1,stage:index%9,dueAt:1700000000000+index,everAnswered:index%2===0,ngCount:index%4,lastTestedAt:1690000000000+index,firstCorrectAt:index%3===0?1680000000000+index:0,bookmarked:index%2===1,userNotes:{keep:'note-'+id},...(isTarget?{}:{context:row.context,priority:t.priority,businessTemplateKey:t.key})};
 });
 for(let i=0;i<150;i++)cards.push({id:1095+i,en:`Circuit card ${i+1}`,ko:`회로 카드 ${i+1}`,chapterId:3,stage:i%8,dueAt:1701000000000+i,everAnswered:i%2===0,ngCount:i%3,lastTestedAt:i%2===0?1691000000000+i:0,firstCorrectAt:i%4===0?1681000000000+i:0,userNotes:{keep:'circuit-'+i}});
 for(let i=0;i<40;i++)cards.push({id:1245+i,en:`Speaking card ${i+1}`,ko:`토익 카드 ${i+1}`,chapterId:4,stage:i%7,dueAt:1702000000000+i,everAnswered:i%2===0,ngCount:i%2,lastTestedAt:i%2===0?1692000000000+i:0,firstCorrectAt:i%3===0?1682000000000+i:0,userNotes:{keep:'toeic-'+i}});
 const target=cards.find(c=>c.id===961);
 const entity='id:number:961',editHistory=[
  {id:'legacy-presence-961',entity,cardId:961,field:'$presence',value:{present:true,card:{...target}},parents:[],at:0,device:'import',origin:'legacy-import',userContext:false},
  {id:'legacy-en-961',entity,cardId:961,field:'en',value:target.en,parents:[],at:0,device:'import',origin:'legacy-import',userContext:false},
  {id:'legacy-ko-961',entity,cardId:961,field:'ko',value:target.ko,parents:[],at:0,device:'import',origin:'legacy-import',userContext:false},
  {id:'legacy-chapter-961',entity,cardId:961,field:'chapterId',value:1,parents:[],at:0,device:'import',origin:'legacy-import',userContext:false}
 ];
 for(const card of cards.filter(c=>c.chapterId!==1)){
  const cardEntity='id:number:'+card.id;
  editHistory.push({id:'legacy-presence-'+card.id,entity:cardEntity,cardId:card.id,field:'$presence',value:{present:true,card:{...card}},parents:[],at:0,device:'import',origin:'legacy-import',userContext:false});
  for(const field of ['en','ko','chapterId','bookmarked'])if(card[field]!==undefined)editHistory.push({id:`legacy-${field}-${card.id}`,entity:cardEntity,cardId:card.id,field,value:card[field],parents:[],at:0,device:'import',origin:'legacy-import',userContext:false});
 }
 const data={
  srs_cards_v2:JSON.stringify({cards,nextId:1285,editHistory,deletedCards:[],editConflicts:[],identityConflicts:[],templateBaselines:{}}),
  srs_chapters_v1:JSON.stringify({chapters:[{id:1,name:'영어업무(일반)'},{id:3,name:'영어업무(회로)'},{id:4,name:'토익스피킹(템플릿)'}],nextId:5}),
  srs_settings_v1:JSON.stringify({manualCorrectTotal:17,quizOrder:'added',bizChapterIds:[1],grammarOptions:{article:true}}),
  srs_notes_v1:JSON.stringify({'961':[{id:'n961',text:'보존 메모'}]}),
  srs_trends_v1:JSON.stringify([{id:'trend-1',correct:12,incorrect:3}]),
  srs_biz_sessions_v1:JSON.stringify([{id:'active-session',cardIds:[961,962],currentIndex:1}]),
  srs_error_history_v1:JSON.stringify({version:1,records:[{id:'wrong-961',cardId:961,errorType:'lexical',referenceAnswer:target.en,actualAnswer:'wrong answer',count:2}]})
 };
 return {cards,data};
}

test('card ID 961 receives only the agreed template text and retains all user study data after reload',async({browser})=>{
 const {cards,data}=profile(),beforeCards=structuredClone(cards),beforeHistory=JSON.parse(data.srs_cards_v2).editHistory,context=await browser.newContext({serviceWorkers:'block'});
 await context.addInitScript(data=>{if(localStorage.getItem('card-961-fixture'))return;Object.entries(data).forEach(([key,value])=>localStorage.setItem(key,value));localStorage.setItem('card-961-fixture','1');},data);
 await context.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname.endsWith('workers.dev')?route.abort():u.hostname.includes('google')?route.fulfill({body:''}):route.continue();});
 try{
  const page=await context.newPage();await page.goto('./');await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
  async function verify(){
   const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('srs_cards_v2'))),stored=state.cards,target=stored.find(c=>c.id===961);
   expect(stored).toHaveLength(390);expect(stored.filter(c=>c.id===961)).toHaveLength(1);
   expect(target).toMatchObject({id:961,en:currentTemplate.en,ko:currentTemplate.ko,context:currentTemplate.context,priority:currentTemplate.priority,businessTemplateKey:'business-general-067'});
   for(const key of ['stage','dueAt','everAnswered','ngCount','lastTestedAt','firstCorrectAt','bookmarked','userNotes'])expect(target[key]).toEqual(beforeCards.find(c=>c.id===961)[key]);
   expect(state.editHistory).toEqual(beforeHistory);expect(state.nextId).toBe(1285);
   for(const prior of beforeCards.filter(c=>c.id!==961))expect(stored.find(c=>c.id===prior.id)).toEqual(prior);
   for(const key of ['srs_chapters_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'])expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(data[key]);
   expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('srs_settings_v1')))).toMatchObject(JSON.parse(data.srs_settings_v1));
  }
  await verify();await page.reload();await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');await verify();
  await page.locator('#tabAllCards').click();await page.locator('#allCardsSearch').fill(currentTemplate.en);
  await expect(page.locator('#allCardsList')).toContainText(currentTemplate.en);
  await expect(page.locator('#allCardsList')).toContainText(currentTemplate.ko);
 }finally{await context.close();}
});
