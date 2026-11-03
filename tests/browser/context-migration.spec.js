const {test,expect}=require('@playwright/test');
const {items,previousContexts}=require('../../business-contexts');
const DATA_KEYS=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
function fixture(){
 const cards=items.map((x,i)=>({id:701+i,en:x.en,ko:'사용자 번역 '+i,context:i===57?'그 일의 대응기한을 물으려고 할 때.':previousContexts[i],chapterId:9,priority:'important',businessTemplateKey:'business-general-'+String(i+1).padStart(3,'0'),stage:4,dueAt:123,everAnswered:true,ngCount:7,lastTestedAt:88,firstCorrectAt:42,bookmarked:true,userNotes:{history:[1,2]}}));
 const data={srs_cards_v2:JSON.stringify({cards,nextId:999}),srs_chapters_v1:JSON.stringify({chapters:[{id:9,name:'영어업무(일반)'}],nextId:10}),srs_settings_v1:JSON.stringify({volume:0,newCardRatio:5,quizOrder:'added',manualCorrectTotal:0,acSort:'added',bizChapterIds:[9],grammarOptions:{article:true}}),srs_notes_v1:JSON.stringify({'701':[{id:'note',text:'사용자 메모'}]}),srs_trends_v1:'[]',srs_biz_sessions_v1:'[]',srs_error_history_v1:JSON.stringify({version:1,records:[{id:'saved',cardId:701,errorType:'tense',referenceAnswer:'original',actualAnswer:'wrong',count:3,firstAt:123,lastAt:456,occurrences:[]}]})};
 return {cards,data};
}
async function verify(page,original,data){
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('srs_cards_v2')));
 expect(saved.nextId).toBe(999);expect(saved.cards).toHaveLength(200);
 saved.cards.forEach((c,i)=>{expect(c.context).toBe(items[i].context);expect({...c,context:original[i].context}).toEqual(original[i]);expect(c.context).not.toMatch(/할 때|하는 상황/);});
 const rest=await page.evaluate(keys=>Object.fromEntries(keys.filter(k=>k!=='srs_cards_v2').map(k=>[k,localStorage.getItem(k)])),DATA_KEYS);
 for(const [key,value] of Object.entries(rest)){if(key==='srs_settings_v1')expect(JSON.parse(value)).toMatchObject(JSON.parse(data[key]));else expect(JSON.parse(value)).toEqual(JSON.parse(data[key]));}
 await page.locator('#tabAllCards').click();await page.locator('#allCardsSearch').fill(items[57].en);
 await expect(page.locator('#allCardsList .fc-context')).toContainText('업무기한 질문');
 await page.locator('#tabAdd').click();await page.locator('#moveCardSearch').fill(items[57].en);
 await expect(page.locator('#moveCardList .fc-context')).toContainText('업무기한 질문');
 await page.locator('#tabQuiz').click();await page.locator('#quizPriorityMode').selectOption('all');await page.locator('#quizPromptMode').selectOption('context');await page.locator('#practiceBtn').click();
 await expect(page.locator('#koreanText')).toHaveText(items[0].context);
 // The active checkpoint stores IDs; reload must resolve the same migrated cards.
 await page.locator('#answerInput').fill('saved draft');await page.reload();
 await expect(page.locator('#koreanText')).toHaveText(items[0].context);await expect(page.locator('#answerInput')).toHaveValue('saved draft');
}
for(const sync of [false,true])test(`old populated profile migrates 200 defaults across all screens and session reload (${sync?'mock cloud snapshot':'local storage'})`,async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'block'}),{cards,data}=fixture();const errors=[],writes=[];
 await context.addInitScript(({data,sync})=>{
  if(localStorage.getItem('migration_fixture'))return;
  Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,v));
  if(sync)localStorage.setItem('memory_sync_code_v1','isolated_fixture_12345');
  localStorage.setItem('migration_fixture','1');
 },{data,sync});
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='toeic-cloud-sync.tsta32.workers.dev'){
   const body=route.request().postDataJSON();if(body.action==='set'){writes.push(body.data);return route.fulfill({json:{ok:true}});}
   return route.fulfill({json:{data:{...data,__memorySyncSnapshotV1:{version:1,keys:DATA_KEYS.slice().sort()}}}});
  }
  if(url.hostname.endsWith('workers.dev'))return route.abort();
  if(url.hostname.includes('google'))return route.fulfill({body:''});return route.continue();
 });
 try{
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('./');
  if(!sync)await page.locator('#memory-sync-local').click();
  await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
  await verify(page,cards,data);expect(errors).toEqual([]);
  if(sync)await expect.poll(()=>writes.some(d=>JSON.parse(d.srs_cards_v2).cards[57].context==='업무기한 질문')).toBe(true);
 }finally{await context.close();}
});

test('explicitly edited old-default wording survives UI editing and reload',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'block'}),{data}=fixture();
 await context.addInitScript(data=>{if(localStorage.getItem('migration_fixture'))return;Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,v));localStorage.setItem('migration_fixture','1');},data);
 await context.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname.endsWith('workers.dev')?r.abort():u.hostname.includes('google')?r.fulfill({body:''}):r.continue();});
 try{
  const page=await context.newPage();await page.goto('./');await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
  await page.locator('#tabAllCards').click();await page.locator('#allCardsSearch').fill(items[57].en);await page.locator('#allCardsList .fc-row input[type="checkbox"]').check();await page.locator('#editBulkBtn').click();
  await page.locator('#editCardList input[data-field="context"]').fill('그 일의 대응기한을 물으려고 할 때.');await page.locator('#editSaveBtn').click();await page.locator('#editConfirmApply').click();
  await page.reload();await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
  const card=await page.evaluate(()=>JSON.parse(localStorage.getItem('srs_cards_v2')).cards[57]);expect(card.context).toBe('그 일의 대응기한을 물으려고 할 때.');expect(card.contextUserEdited).toBe(true);
 }finally{await context.close();}
});

test.describe('service worker cache migration',()=>{
 test.use({serviceWorkers:'allow'});
 test('old asset cache is replaced without deleting populated card storage',async({browser})=>{
  const context=await browser.newContext({serviceWorkers:'allow'}),{cards,data}=fixture();
  await context.addInitScript(({data})=>{if(localStorage.getItem('migration_fixture'))return;Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,v));localStorage.setItem('migration_fixture','1');},{data});
  await context.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname.endsWith('workers.dev')?r.abort():u.hostname.includes('google')?r.fulfill({body:''}):r.continue();});
  try{
   const page=await context.newPage();await page.goto('./');
   await page.evaluate(async()=>{const unrelated=await caches.open('user-unrelated-cache');await unrelated.put('./user-note',new Response('keep'));const old=await caches.open('srs-app-v72');await old.put('./business-contexts.js',new Response('window.BusinessContexts={items:[],fillMissing:function(){return false;}}',{headers:{'Content-Type':'text/javascript'}}));});
   await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
   await expect.poll(async()=>{try{return await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.active);}catch{return false;}}).toBe(true);
   await expect.poll(async()=>{try{return await page.evaluate(async()=>await caches.keys());}catch{return ['srs-app-v72'];}}).not.toContain('srs-app-v72');
   await page.reload();await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
   expect(await page.evaluate(async()=>await caches.keys())).toContain('srs-app-v74');
   expect(await page.evaluate(async()=>await (await caches.match('./user-note')).text())).toBe('keep');
   const response=await page.evaluate(async()=>{const r=await caches.match('./business-contexts.js?v=74');return r&&r.text();});expect(response).toContain('그 일의 대응기한을 물으려고 할 때.');
   await verify(page,cards,data);
  }finally{await context.close();}
 });
});

test('older complete cloud defaults cannot replace local custom or intentionally empty contexts',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'block'}),{data,cards}=fixture();
 const custom=structuredClone(cards);custom[0].context='내가 직접 만든 문장형 문맥을 말하려고 할 때.';custom[1].context='';custom[57].contextUserEdited=true;
 const local={...data,srs_cards_v2:JSON.stringify({cards:custom,nextId:999})};
 await context.addInitScript(data=>{Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,v));localStorage.setItem('memory_sync_code_v1','isolated_fixture_12345');},local);
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='toeic-cloud-sync.tsta32.workers.dev'){const b=route.request().postDataJSON();return route.fulfill({json:b.action==='get'?{data:{...data,__memorySyncSnapshotV1:{version:1,keys:DATA_KEYS.slice().sort()}}}:{ok:true}});}return u.hostname.endsWith('workers.dev')?route.abort():u.hostname.includes('google')?route.fulfill({body:''}):route.continue();});
 try{
  const page=await context.newPage();await page.goto('./');await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
  const actual=await page.evaluate(()=>JSON.parse(localStorage.getItem('srs_cards_v2')).cards);
  for(const i of [0,1,57])expect(actual[i]).toEqual(custom[i]);
  actual.forEach((c,i)=>{if(![0,1,57].includes(i))expect(c).toEqual({...cards[i],context:items[i].context});});
 }finally{await context.close();}
});
