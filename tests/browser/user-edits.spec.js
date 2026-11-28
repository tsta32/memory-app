const {test,expect}=require('@playwright/test');
const templates=require('../../business-priorities').items;
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const KEYS=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
const copy=x=>JSON.parse(JSON.stringify(x));
function initial(){return {srs_cards_v2:JSON.stringify({cards:templates.slice(0,2).map((t,i)=>({id:i+1,en:t.en,ko:t.ko,context:t.context,priority:t.priority,businessTemplateKey:t.key,chapterId:9,stage:4,dueAt:123,ngCount:7,firstCorrectAt:42,lastTestedAt:88,everAnswered:true,bookmarked:false})),nextId:3}),srs_chapters_v1:JSON.stringify({chapters:[{id:9,name:'영어업무(일반)'}],nextId:10}),srs_settings_v1:JSON.stringify({volume:0}),srs_notes_v1:'{}',srs_trends_v1:'[]',srs_biz_sessions_v1:'[]',srs_error_history_v1:JSON.stringify({version:1,records:[]})};}
async function open(browser,{server,offline=false,viewport}={}){
 const context=await browser.newContext({serviceWorkers:'block',viewport}),state={offline};
 await context.addInitScript(({data,sync})=>{if(localStorage.getItem('edits_fixture'))return;Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,v));localStorage.setItem('edits_fixture','1');if(sync)localStorage.setItem('memory_sync_code_v1','user_edits_fixture_12345');},{data:initial(),sync:!!server});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='toeic-cloud-sync.tsta32.workers.dev'&&server){
   if(state.offline)return route.fulfill({status:503,json:{error:'offline fixture'}});
   const body=route.request().postDataJSON();
   if(body.action==='get'){
    return route.fulfill({json:{data:copy(server.data)}});
   }
   if(body.action!=='set')return route.abort();
   server.data=copy(body.data);
   if(server.afterWrite)await server.afterWrite();
   return route.fulfill({json:{ok:true}});
  }
  if(url.pathname.endsWith('/business-priorities.js')&&server?.assets){
   return route.fulfill({contentType:'application/javascript',body:server.assets});
  }
  return url.hostname.endsWith('workers.dev')?route.abort():url.hostname.includes('google')?route.fulfill({body:''}):route.continue();
 });
 const page=await context.newPage();await page.goto('./');if(!server)await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
 return {page,context,state};
}
async function stored(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('srs_cards_v2')));}
async function edit(page,values,index=0){
 const card=(await stored(page)).cards[index];await page.locator('#tabAllCards').click();await page.locator('#allCardsSearch').fill(card.en);await page.locator('#allCardsList .fc-row input[type="checkbox"]').check();await page.locator('#editBulkBtn').click();
 for(const [field,value]of Object.entries(values)){
  const input=page.locator('#editCardList [data-field="'+field+'"]');if(field==='priority')await input.selectOption(value);else await input.fill(value);
 }
 await page.locator('#editSaveBtn').click();await page.locator('#editConfirmApply').click();
}
function historyPreserved(c){expect(c.id).toBe(1);expect(c.stage).toBe(4);expect(c.dueAt).toBe(123);expect(c.ngCount).toBe(7);expect(c.firstCorrectAt).toBe(42);expect(c.lastTestedAt).toBe(88);}

test('English edits invalidate old default context, reviewed fields survive restart and template updates, export is truthful',async({browser})=>{
 const app=await open(browser);const p=app.page;
 try{
  await edit(p,{en:'Could you review my draft?'});
  let s=await stored(p);expect(s.cards[0].en).toBe('Could you review my draft?');expect(s.cards[0].context).toBe('');expect(s.cards[0].contextNeedsReview).toBe(true);historyPreserved(s.cards[0]);
  await edit(p,{ko:'내 초안을 검토해 주시겠어요?',context:'내초안 검토요청',priority:'supplementary'});
  await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('srs_cards_v2')),t=structuredClone(window.BusinessPriority.items);t[0].en='A different default.';t[0].ko='다른 기본 번역';t[0].context='기본문맥 변경알림';t[0].priority='important';window.CardOverrides.defaults(s,t,window.BusinessContexts.isDefault);localStorage.setItem('srs_cards_v2',JSON.stringify(s));});
  await p.reload();await p.locator('#memory-sync-local').click();await expect(p.locator('#chapterSelectList')).toContainText('영어업무(일반)');
  s=await stored(p);expect(s.cards[0]).toMatchObject({en:'Could you review my draft?',ko:'내 초안을 검토해 주시겠어요?',context:'내초안 검토요청',priority:'supplementary',contextUserEdited:true});historyPreserved(s.cards[0]);
  for(const field of ['en','ko','context','priority'])expect(s.editHistory.some(e=>e.field===field&&e.at>0&&e.device!=='import')).toBe(true);
  await p.locator('#tabSettings').click();await expect(p.locator('#templateRepoStatus')).toContainText('자동 반영 미지원');
  const download=p.waitForEvent('download');await p.locator('#templatePatchExport').click();const stream=await (await download).createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString();const patch=JSON.parse(text);expect(patch.changes[0].after.en).toBe('Could you review my draft?');await expect(p.locator('#templateRepoStatus')).toContainText('GitHub 미반영');
 }finally{await app.context.close();}
});

test('direct English and context edits survive two devices, stale templates, additions and deletion',async({browser})=>{
 const server={data:{...initial(),__memorySyncSnapshotV1:{version:1,keys:KEYS.slice().sort()}}},a=await open(browser,{server});let b;
 try{
  await edit(a.page,{en:'Please check my proposal.',ko:'제 제안을 확인해 주세요.',context:'내제안 확인요청',priority:'supplementary'});await a.page.evaluate(()=>window.memorySyncFlush());
  b=await open(browser,{server});let s=await stored(b.page);expect(s.cards[0]).toMatchObject({en:'Please check my proposal.',ko:'제 제안을 확인해 주세요.',context:'내제안 확인요청',priority:'supplementary'});historyPreserved(s.cards[0]);
  await a.page.locator('#tabAdd').click();await a.page.locator('#manualModeBtn').click();await a.page.locator('#manualContextInput').fill('새업무 시작알림');await a.page.locator('#manualKoInput').fill('새 업무를 시작합니다');await a.page.locator('#manualEnInput').fill('I am starting a new task.');await a.page.locator('#bulkAddBtn').click();
  await a.page.locator('#tabAllCards').click();await a.page.locator('#allCardsSearch').fill(templates[1].en);await a.page.locator('#allCardsList .fc-row input[type="checkbox"]').check();a.page.once('dialog',d=>d.accept());await a.page.locator('#delBulkBtn').click();await a.page.evaluate(()=>window.memorySyncFlush());
  await b.page.reload();await expect(b.page.locator('#chapterSelectList')).toContainText('영어업무(일반)');s=await stored(b.page);expect(s.cards.some(c=>c.id===2)).toBe(false);expect(s.deletedCards.some(d=>d.card.id===2&&d.card.ngCount===7)).toBe(true);expect(s.cards.some(c=>c.en==='I am starting a new task.')).toBe(true);historyPreserved(s.cards.find(c=>c.id===1));
  await b.page.reload();await expect(b.page.locator('#chapterSelectList')).toContainText('영어업무(일반)');expect((await stored(b.page)).cards.some(c=>c.id===2)).toBe(false);
 }finally{await a.context.close();if(b)await b.context.close();}
});

test('concurrent offline device edits retain both histories, block repository export and resolve explicitly',async({browser})=>{
 const server={data:{...initial(),__memorySyncSnapshotV1:{version:1,keys:KEYS.slice().sort()}}},a=await open(browser,{server}),b=await open(browser,{server,offline:true});
 try{
  await edit(a.page,{ko:'기기 A의 번역'});await a.page.evaluate(()=>window.memorySyncFlush());
  await edit(b.page,{ko:'기기 B의 번역'});b.state.offline=false;await b.page.evaluate(()=>window.memorySyncFlush());await b.page.reload();await expect(b.page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
  const s=await stored(b.page);expect(s.editHistory.filter(e=>e.field==='ko').map(e=>e.value)).toEqual(expect.arrayContaining(['기기 A의 번역','기기 B의 번역']));expect(s.editConflicts.some(c=>c.field==='ko')).toBe(true);historyPreserved(s.cards[0]);
  await b.page.locator('#tabSettings').click();await expect(b.page.locator('#cardEditConflicts')).toContainText('수정 충돌');await b.page.locator('#templatePatchExport').click();await expect(b.page.locator('#templateRepoStatus')).toContainText('내보내기 실패');
  await b.page.locator('#cardEditConflicts').getByRole('button',{name:/기기 A의 번역/}).click();expect((await stored(b.page)).editConflicts).toHaveLength(0);await b.page.evaluate(()=>window.memorySyncFlush());
  await a.page.reload();await expect(a.page.locator('#chapterSelectList')).toContainText('영어업무(일반)');expect((await stored(a.page)).cards[0].ko).toBe('기기 A의 번역');expect((await stored(a.page)).editHistory.filter(e=>e.field==='ko').length).toBeGreaterThanOrEqual(3);
 }finally{await a.context.close();await b.context.close();}
});

function mockServer(){
 return {data:{...initial(),__memorySyncSnapshotV1:{version:1,keys:KEYS.slice().sort()}}};
}
const templateFields=['en','ko','context','priority'];
function installTemplate(server,changes){
 const prior=Object.fromEntries(templateFields.map(field=>[field,templates[0][field]]));
 const source=fs.readFileSync(require.resolve('../../business-priorities'),'utf8');
 server.assets=source+'\nObject.assign(window.BusinessPriority.items[0],'+JSON.stringify({...changes,previousDefaults:[prior]})+');';
}
async function flush(page){
 expect(await page.evaluate(async()=>({ok:(await window.memorySyncFlush()).ok}))).toEqual({ok:true});
}
function remoteCards(server){return JSON.parse(server.data.srs_cards_v2);}
function setRemoteStudy(server){
 const cards=remoteCards(server);
 Object.assign(cards.cards[0],{stage:6,dueAt:2000,lastTestedAt:1000,firstCorrectAt:20,ngCount:8});
 // Older clients can reschedule a card without changing the last answer timestamp.
 Object.assign(cards.cards[1],{stage:5,dueAt:2200});
 server.data.srs_cards_v2=JSON.stringify(cards);
 server.data.srs_settings_v1=JSON.stringify({manualCorrectTotal:17});
 server.data.srs_trends_v1=JSON.stringify([{id:'remote-trend',correct:12,incorrect:3}]);
 server.data.srs_error_history_v1=JSON.stringify({version:1,records:[{id:'remote-error',cardId:1,errorType:'article',count:1,occurrences:[{id:'wrong-answer',at:10}]}]});
}

test('concurrent remote study updates survive a stale app sentence edit and a competing snapshot write',async({browser})=>{
 const server=mockServer(),app=await open(browser,{server});
 try{
  await flush(app.page);
  setRemoteStudy(server);
  const newer=copy(server.data);
  let raceInjected=false;
  server.afterWrite=()=>{
   if(raceInjected)return;
   raceInjected=true;
   // A second device overwrites the first save before its confirmation read.
   server.data={...newer,srs_trends_v1:JSON.stringify([
    ...JSON.parse(newer.srs_trends_v1),{id:'competing-trend',correct:1,incorrect:0}
   ])};
  };
  await edit(app.page,{ko:'가상 앱 편집'});
  await flush(app.page);
  expect(raceInjected).toBe(true);
  const remote=remoteCards(server);
  expect(remote.cards.map(c=>c.id)).toEqual([1,2]);
  expect(remote.cards[0]).toMatchObject({ko:'가상 앱 편집',stage:6,dueAt:2000,lastTestedAt:1000,firstCorrectAt:20,ngCount:8});
  expect(remote.cards[1]).toMatchObject({stage:5,dueAt:2200,lastTestedAt:88});
  expect(JSON.parse(server.data.srs_settings_v1).manualCorrectTotal).toBe(17);
  expect(JSON.parse(server.data.srs_trends_v1).map(t=>t.id)).toEqual(['remote-trend','competing-trend']);
  expect(JSON.parse(server.data.srs_error_history_v1).records[0].occurrences[0].id).toBe('wrong-answer');
 }finally{await app.context.close();}
});

test('a known prior template migrates a profile without baselines',async({browser})=>{
 const server=mockServer();
 const update={en:'The virtual lab opens at seven.',ko:'가상 연구소가 일곱 시에 열립니다.',context:'연구소 개장안내',priority:'supplementary'};
 installTemplate(server,update);
 const app=await open(browser,{server});
 try{
  const state=await stored(app.page);
  expect(state.cards.map(c=>c.id)).toEqual([1,2]);
  expect(state.cards[0]).toMatchObject(update);
  historyPreserved(state.cards[0]);
  await flush(app.page);
  expect(remoteCards(server).cards[0]).toMatchObject(update);
 }finally{await app.context.close();}
});

for(const choice of ['앱 값 유지','Codex 값 적용']){
 test('same-field template conflict offers '+choice,async({browser})=>{
  const server=mockServer(),app=await open(browser,{server});
  try{
   const appValue='가상 앱 번역',codexValue='가상 저장소 번역';
   await edit(app.page,{ko:appValue});
   await flush(app.page);
   installTemplate(server,{ko:codexValue});
   await app.page.reload();
   await expect(app.page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
   expect((await stored(app.page)).cards[0].ko).toBe(appValue);
   await app.page.locator('#tabSettings').click();
   const conflicts=app.page.locator('#cardEditConflicts');
   await expect(conflicts.getByRole('button',{name:/앱 값 유지/})).toBeVisible();
   await expect(conflicts.getByRole('button',{name:/Codex 값 적용/})).toBeVisible();
   await conflicts.getByRole('button',{name:new RegExp(choice)}).click();
   expect((await stored(app.page)).templateConflicts).toEqual([]);
   await flush(app.page);
   await app.page.reload();
   await expect(app.page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
   const result=await stored(app.page);
   expect(result.templateConflicts).toEqual([]);
   expect(result.cards[0].ko).toBe(choice==='앱 값 유지'?appValue:codexValue);
   expect(result.editHistory.some(e=>e.value===appValue)).toBe(true);
   historyPreserved(result.cards[0]);
  }finally{await app.context.close();}
 });
}

test('mobile diagnostics are in Settings and still compare and copy the synthetic code',async({browser})=>{
 const server=mockServer(),app=await open(browser,{server,viewport:{width:390,height:844}});
 try{
  const code='user_edits_fixture_12345';
  const button=app.page.locator('#settingsPane #memory-sync-diagnostic-button');
  await expect(button).toBeHidden();
  await app.page.locator('#tabSettings').click();
  await button.click();
  const panel=app.page.locator('#memory-sync-diagnostic-panel');
  app.page.once('dialog',dialog=>dialog.accept(createHash('sha256').update(code).digest('hex')));
  await panel.getByRole('button',{name:'Codex 코드 일치 검사'}).click();
  await expect(panel).toContainText('Codex 코드: 일치');
  await app.context.grantPermissions(['clipboard-read','clipboard-write']);
  app.page.once('dialog',dialog=>dialog.accept());
  await panel.getByRole('button',{name:'코드 확인 / 복사'}).click();
  await expect(panel.locator('input')).toHaveAttribute('type','password');
  await panel.getByRole('button',{name:'복사',exact:true}).click();
  await expect(panel).toContainText('복사됨');
  expect(await app.page.evaluate(()=>navigator.clipboard.readText())).toBe(code);
 }finally{await app.context.close();}
});
