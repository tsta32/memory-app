const {test,expect}=require('@playwright/test');
const policy=require('../../business-priorities');
async function open(browser,{state='new',all=false,mobile=false,other=false}={}){
  const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{});
  await context.addInitScript(({rows,state,all,other})=>{
    if(sessionStorage.getItem('priority-seeded'))return;
    const selected=all?rows:[rows[0],rows[8],rows[1],rows[3],rows[2]];
    const t=Date.now();
    const cards=selected.map((r,i)=>({id:100+i,en:r.en,ko:'사용자 번역 '+i,context:'저장 문맥 '+i,chapterId:9,
      stage:all?9:0,everAnswered:all,dueAt:all?t+86400000:1+i,ngCount:7,lastTestedAt:12,bookmarked:false,extra:{preserved:'yes'},
      ...(!all?{priority:r.priority}:{})}));
    if(state==='ready'){
      for(let i=0;i<2;i++)Object.assign(cards[i],{stage:3,everAnswered:true,firstCorrectAt:100,dueAt:t+(i===0?600000:3600000)});
      Object.assign(cards[2],{stage:2,everAnswered:true,firstCorrectAt:100,dueAt:1});
    }
    if(other)cards.push({id:999,en:'Other category.',ko:'다른 카테고리',context:'다른 문맥',chapterId:10,stage:0,everAnswered:false,dueAt:1,ngCount:0});
    localStorage.setItem('srs_cards_v2',JSON.stringify({cards:all?cards.reverse():cards,nextId:1000}));
    localStorage.setItem('srs_chapters_v1',JSON.stringify({chapters:[{id:9,name:'영어업무(일반)'},{id:10,name:'다른 카테고리'}],nextId:11}));
    localStorage.setItem('srs_settings_v1',JSON.stringify({volume:42,manualCorrectTotal:6,grammarOptions:{article:true},custom:{keep:1}}));
    localStorage.setItem('srs_error_history_v1',JSON.stringify({version:1,records:[]}));
    localStorage.removeItem('memory_sync_code_v1');sessionStorage.setItem('priority-seeded','1');
  },{rows:policy.items,state,all,other});
  const errors=[],workerRequests=[];
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.hostname.endsWith('workers.dev')){workerRequests.push(u.hostname);return route.abort();}
    if(u.hostname.includes('google'))return route.fulfill({status:200,body:''});return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
  return{page,context,errors,workerRequests};
}
async function data(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('srs_cards_v2')));}
async function current(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('memory_study_session_v1')).state);}
async function answer(page,text){await page.waitForTimeout(320);await page.locator('#answerInput').fill(text);await page.locator('#checkBtn').click();}
async function restart(page){await page.locator('#restartBtn').click();}
async function cancel(page){await page.locator('#cancelSessionBtn').click();await page.locator('#cancelModalConfirm').click();}
async function start(page,mode='translation',practice=false){await page.locator('#quizPromptMode').selectOption(mode);await page.locator(practice?'#practiceBtn':'#startBtn').click();await expect(page.locator('#quizScreen')).toBeVisible();}
function healthy(app){expect(app.errors).toEqual([]);expect(app.workerRequests).toEqual([]);}

test('all 200 cards migrate by source rather than id/order, preserve user fields and do not infer past correctness',async({browser})=>{
  const app=await open(browser,{all:true});const{page}=app;
  try{
    const saved=await data(page);expect(saved.cards).toHaveLength(200);expect(saved.nextId).toBe(1000);
    const counts={essential:0,important:0,supplementary:0};
    for(const c of saved.cards){const row=policy.items[c.id-100];expect(c.en).toBe(row.en);expect(c.priority).toBe(row.priority);expect(c.businessTemplateKey).toBe(row.key);expect(c.ko).toBe('사용자 번역 '+(c.id-100));expect(c.context).toBe('저장 문맥 '+(c.id-100));expect(c.stage).toBe(9);expect(c.ngCount).toBe(7);expect(c.firstCorrectAt).toBeUndefined();counts[c.priority]++;}
    expect(counts).toEqual({essential:39,important:128,supplementary:33});
    await expect(page.locator('#priorityProgress')).toContainText('필수: 0 / 39');
    await expect(page.locator('#priorityProgress')).toContainText('과거 정답이 불명확');healthy(app);
  }finally{await app.context.close();}
});

for(const mode of ['translation','context']){
  test(`${mode}: automatic frontier blocks important, records automatic/manual first-pass answers and excludes supplementary`,async({browser})=>{
    const app=await open(browser);const{page}=app;
    try{
      await start(page,mode);
      expect((await current(page)).sessionUniqueIds).toEqual([100,101]);
      await expect(page.locator('#koreanText')).toHaveText(mode==='context'?'저장 문맥 0':'사용자 번역 0');
      await answer(page,policy.items[0].en);await expect(page.locator('#koreanText')).toHaveText(mode==='context'?'저장 문맥 1':'사용자 번역 1');
      expect((await data(page)).cards[0].firstCorrectAt).toBeGreaterThan(0);
      await answer(page,'Wrong draft');await page.locator('#markCorrectBtn').click();await expect(page.locator('#doneScreen')).toBeVisible();
      const saved=await data(page);expect(saved.cards[1].firstCorrectAt).toBeGreaterThan(0);expect(saved.cards[0].ngCount).toBe(7);expect(saved.cards[1].ngCount).toBe(7);
      await expect(page.locator('#manualCorrectCount')).toHaveText('7');
      await restart(page);await expect(page.locator('#priorityProgress')).toContainText('중요 학습 가능');
      await start(page,mode);expect((await current(page)).sessionUniqueIds).toEqual([102,103]);
      expect((await current(page)).sessionUniqueIds).not.toContain(104);healthy(app);
    }finally{await app.context.close();}
  });
  test(`${mode}: retest answers and skips never mark a failed initial answer as first-pass correct`,async({browser})=>{
    const app=await open(browser);const{page}=app;
    try{
      await start(page,mode);
      for(let i=0;i<2;i++){await answer(page,'Wrong');await page.locator('#nextBtn').click();}
      await expect(page.locator('#boxBadge')).toContainText('1단계');const before=await data(page);
      await answer(page,policy.items[0].en);await page.locator('#nextBtn').click();
      await answer(page,'Wrong');await page.locator('#skipRetestBtn').click();await expect(page.locator('#boxBadge')).toContainText('2단계');
      await answer(page,'Wrong');await page.locator('#skipRetestBtn').click();await expect(page.locator('#koreanText')).toHaveText(mode==='context'?'저장 문맥 0':'사용자 번역 0');
      await expect(page.locator('#hintText')).toBeHidden();await answer(page,policy.items[0].en);await page.locator('#nextBtn').click();
      await expect(page.locator('#doneScreen')).toBeVisible();expect(await data(page)).toEqual(before);
      for(const c of (await data(page)).cards.slice(0,2))expect(c.firstCorrectAt).toBeUndefined();
      await restart(page);await expect(page.locator('#priorityProgress')).toContainText('필수 학습 중');
      healthy(app);
    }finally{await app.context.close();}
  });
}

test('newly due essential review wins next session without altering the active important queue; important reviews precede new work',async({browser})=>{
  const app=await open(browser,{state:'ready'});const{page}=app;
  try{
    await start(page);expect((await current(page)).sessionUniqueIds).toEqual([102,103]);
    await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+1200000;});
    await expect(page.locator('#koreanText')).toHaveText('사용자 번역 2');expect((await current(page)).sessionQueue).toEqual([103]);
    await answer(page,policy.items[1].en);await expect(page.locator('#koreanText')).toHaveText('사용자 번역 3');
    await answer(page,policy.items[3].en);await expect(page.locator('#doneScreen')).toBeVisible();
    await restart(page);await expect(page.locator('#priorityProgress')).toContainText('현재 필수 복습: 1장');
    await start(page);expect((await current(page)).currentId).toBe(100);expect((await current(page)).sessionUniqueIds).toEqual([100]);healthy(app);
  }finally{await app.context.close();}
});

test('explicit supplementary, category and selected-card sessions respect user scope and practice can assess future unknown cards',async({browser})=>{
  const app=await open(browser,{other:true});const{page}=app;
  try{
    await page.locator('#quizPriorityMode').selectOption('supplementary');await start(page,'context',true);
    expect((await current(page)).sessionUniqueIds).toEqual([104]);await answer(page,policy.items[2].en);await expect(page.locator('#doneScreen')).toBeVisible();
    await restart(page);await page.locator('#quizPriorityMode').selectOption('auto');
    await page.locator('#chapterSelectList label').filter({hasText:'다른 카테고리'}).locator('input').check();await start(page);
    expect((await current(page)).sessionUniqueIds).toEqual([999]);await cancel(page);
    await page.locator('#tabAllCards').click();await page.locator('#allCardsSearch').fill(policy.items[1].en);
    await page.locator('#allCardsList .fc-row input[type="checkbox"]').check();await page.locator('#selectedQuizBtn').click();
    expect((await current(page)).sessionUniqueIds).toEqual([102]);await cancel(page);
    await page.locator('#chapterSelectList label').filter({hasText:'전체'}).first().locator('input').check();
    await page.evaluate(()=>{const k='srs_cards_v2',s=JSON.parse(localStorage.getItem(k));for(const c of s.cards.filter(c=>c.priority==='essential')){c.everAnswered=true;c.stage=9;c.dueAt=Date.now()+86400000;delete c.firstCorrectAt;}localStorage.setItem(k,JSON.stringify(s));});
    await page.reload();await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
    await page.locator('#quizPriorityMode').selectOption('essential');const before=(await data(page)).cards.filter(c=>c.priority==='essential').map(c=>({id:c.id,stage:c.stage,dueAt:c.dueAt,ngCount:c.ngCount}));
    await start(page,'translation',true);expect((await current(page)).sessionUniqueIds).toEqual([100,101]);
    await answer(page,policy.items[0].en);await expect(page.locator('#koreanText')).toHaveText('사용자 번역 1');
    expect((await data(page)).cards.filter(c=>c.priority==='essential').map(c=>({id:c.id,stage:c.stage,dueAt:c.dueAt,ngCount:c.ngCount}))).toEqual(before);
    expect((await data(page)).cards[0].firstCorrectAt).toBeGreaterThan(0);healthy(app);
  }finally{await app.context.close();}
});

for(const mobile of [false,true]){
  test(`priority filters, edit confirmation, refresh and backup restore preserve SRS and apply the new grade (${mobile?'mobile':'desktop'})`,async({browser})=>{
    const app=await open(browser,{state:'ready',mobile});const{page}=app;
    try{
      const original=(await data(page)).cards[2];
      await page.locator('#tabAllCards').click();await page.locator('#acPriorityFilter').selectOption('essential');await expect(page.locator('#allCardsList .fc-row')).toHaveCount(2);
      await page.locator('#toggleContext').click();await expect(page.locator('#allCardsList .fc-context').first()).toBeHidden();
      await page.locator('#tabAdd').click();await page.locator('#movePriorityFilter').selectOption('important');await expect(page.locator('#moveCardList > div')).toHaveCount(2);
      const row=page.locator('#moveCardList > div').filter({hasText:original.en});await expect(row.locator('.priority-badge')).toHaveText('중요');
      await row.getByRole('button',{name:'편집',exact:true}).click();await page.locator('#editCardList select[data-field="priority"]').selectOption('essential');
      await page.locator('#editSaveBtn').click();await expect(page.locator('#editDiffList')).toContainText('중요 → 필수');await page.locator('#editConfirmApply').click();
      expect((await data(page)).cards[2]).toEqual({...original,priority:'essential'});
      await page.locator('#tabAllCards').click();await expect(page.locator('#allCardsList .fc-row')).toHaveCount(3);await expect(page.locator('#allCardsList .fc-context').first()).toBeHidden();
      await page.locator('#tabSettings').click();const pending=page.waitForEvent('download');await page.locator('#backupBtn').click();const download=await pending;
      let raw='';for await(const part of await download.createReadStream())raw+=part.toString();
      expect(JSON.parse(JSON.parse(raw).cards).cards[2].priority).toBe('essential');
      await page.evaluate(()=>{const k='srs_cards_v2',s=JSON.parse(localStorage.getItem(k));s.cards[2].priority='supplementary';localStorage.setItem(k,JSON.stringify(s));});
      page.on('dialog',d=>d.accept());await Promise.all([page.waitForEvent('load'),page.locator('#restoreFile').setInputFiles({name:'priority.json',mimeType:'application/json',buffer:Buffer.from(raw)})]);
      await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('영어업무(일반)');
      expect((await data(page)).cards[2]).toEqual({...original,priority:'essential'});
      await start(page,'context');expect((await current(page)).currentId).toBe(102);healthy(app);
    }finally{await app.context.close();}
  });
}

test('migration after reload preserves the frozen active manual queue and its draft',async({browser})=>{
  const app=await open(browser);const{page}=app;
  try{
    await page.locator('#quizPriorityMode').selectOption('important');await start(page,'context');await page.locator('#answerInput').fill('내가 입력하던 답안');
    const before=await current(page);await page.evaluate(()=>{const k='srs_cards_v2',s=JSON.parse(localStorage.getItem(k));for(const c of s.cards){delete c.priority;delete c.businessTemplateKey;}localStorage.setItem(k,JSON.stringify(s));});
    await page.reload();await expect(page.locator('#answerInput')).toHaveValue('내가 입력하던 답안');const after=await current(page);
    expect(after.currentId).toBe(before.currentId);expect(after.sessionQueue).toEqual(before.sessionQueue);expect(after.sessionUniqueIds).toEqual(before.sessionUniqueIds);
    expect((await data(page)).cards.every(c=>policy.valid(c.priority))).toBe(true);healthy(app);
  }finally{await app.context.close();}
});
