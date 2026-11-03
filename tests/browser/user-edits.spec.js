const {test,expect}=require('@playwright/test');
const templates=require('../../business-priorities').items;
const KEYS=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
const copy=x=>JSON.parse(JSON.stringify(x));
function initial(){return {srs_cards_v2:JSON.stringify({cards:templates.slice(0,2).map((t,i)=>({id:i+1,en:t.en,ko:t.ko,context:t.context,priority:t.priority,businessTemplateKey:t.key,chapterId:9,stage:4,dueAt:123,ngCount:7,firstCorrectAt:42,lastTestedAt:88,everAnswered:true,bookmarked:false})),nextId:3}),srs_chapters_v1:JSON.stringify({chapters:[{id:9,name:'영어업무(일반)'}],nextId:10}),srs_settings_v1:JSON.stringify({volume:0}),srs_notes_v1:'{}',srs_trends_v1:'[]',srs_biz_sessions_v1:'[]',srs_error_history_v1:JSON.stringify({version:1,records:[]})};}
async function open(browser,{server,offline=false}={}){
 const context=await browser.newContext({serviceWorkers:'block'}),state={offline};
 await context.addInitScript(({data,sync})=>{if(localStorage.getItem('edits_fixture'))return;Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,v));localStorage.setItem('edits_fixture','1');if(sync)localStorage.setItem('memory_sync_code_v1','user_edits_fixture_12345');},{data:initial(),sync:!!server});
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='toeic-cloud-sync.tsta32.workers.dev'&&server){if(state.offline)return r.fulfill({status:503,json:{error:'offline fixture'}});const b=r.request().postDataJSON();if(b.action==='get')return r.fulfill({json:{data:copy(server.data)}});server.data=copy(b.data);return r.fulfill({json:{ok:true}});}return u.hostname.endsWith('workers.dev')?r.abort():u.hostname.includes('google')?r.fulfill({body:''}):r.continue();});
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
