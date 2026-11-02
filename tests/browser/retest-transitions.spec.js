const {test,expect}=require('@playwright/test');
const sample=[
  {id:1,en:'We could consider another option.',ko:'다른 대안을 검토할 수도 있어요.',context:'회의에서 다른 대안도 검토하자고 제안하려고 할 때.'},
  {id:2,en:'Let me check and get back to you.',ko:'확인하고 다시 알려드릴게요.',context:'업무 질문에 바로 답할 수 없어 확인 후 알려주겠다고 말하려고 할 때.'},
  {id:3,en:'Legacy card.',ko:'기존 카드'}
];
const keys=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_error_history_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1'];
async function open(browser,mobile=false){
  const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{});
  await context.addInitScript(({sample})=>{
    if(sessionStorage.getItem('transitions-seeded'))return;
    localStorage.setItem('srs_cards_v2',JSON.stringify({nextId:4,cards:sample.map(c=>({...c,chapterId:12,stage:3,dueAt:1,ngCount:4,everAnswered:true,lastTestedAt:32,bookmarked:false}))}));
    localStorage.setItem('srs_chapters_v1',JSON.stringify({chapters:[{id:12,name:'단계 전환 검사'}],nextId:13}));
    localStorage.setItem('srs_settings_v1',JSON.stringify({volume:37,manualCorrectTotal:9,grammarOptions:{article:false},customSetting:{keep:'original'}}));
    localStorage.setItem('srs_error_history_v1',JSON.stringify({version:1,records:[]}));
    localStorage.setItem('srs_notes_v1',JSON.stringify({1:[{id:77,q:'보존할 질문',a:'보존할 답변'}]}));
    localStorage.setItem('srs_trends_v1','[]');localStorage.setItem('srs_biz_sessions_v1','[]');
    localStorage.removeItem('memory_sync_code_v1');sessionStorage.setItem('transitions-seeded','1');
  },{sample});
  const errors=[],workers=[];
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.hostname.endsWith('workers.dev')){workers.push(u.hostname);return route.abort();}
    if(u.hostname.includes('google'))return route.fulfill({status:200,body:''});
    return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');await page.locator('#memory-sync-local').click();
  await expect(page.locator('#chapterSelectList')).toContainText('단계 전환 검사');
  return{page,context,errors,workers};
}
async function snapshot(page){return page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),keys);}
async function checkpoint(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('memory_study_session_v1')));}
async function submit(page,answer){await page.waitForTimeout(320);await page.locator('#answerInput').fill(answer);await page.locator('#checkBtn').click();}
async function cleanStageTwo(page,prompt,id){
  await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
  await expect(page.locator('#koreanText')).toHaveText(prompt);
  await expect(page.locator('#hintText')).toBeHidden();await expect(page.locator('#hintLabel')).toBeHidden();
  await expect(page.locator('#answerInput')).toHaveValue('');await expect(page.locator('#answerInput')).toBeEnabled();
  await expect(page.locator('#diffPanel')).toBeHidden();await expect(page.locator('#diffYour')).toBeEmpty();await expect(page.locator('#diffAns')).toBeEmpty();
  const state=(await checkpoint(page)).state;
  expect(state.currentId).toBe(id);expect(state.currentRetestStage).toBe(2);expect(state.retestStages[id]).toBe(2);
  expect(state.retestUnresolvedIds).toContain(id);expect(state.retestAbandonedIds).not.toContain(id);
}
for(const mode of ['translation','context']){
  test(`${mode}: explicit skips advance the same card, restore cleanly, then terminate without changing records`,async({browser})=>{
    const{page,context,errors,workers}=await open(browser,mode==='context');
    const prompt=c=>mode==='context'?c.context:c.ko;
    try{
      await page.locator('#quizPromptMode').selectOption(mode);
      await page.locator('#customCountInput').fill('2');await page.locator('#customCountBtn').click();
      await page.locator('#startBtn').click();
      for(const c of sample.slice(0,2)){await expect(page.locator('#koreanText')).toHaveText(prompt(c));await submit(page,'Original wrong answer.');await page.locator('#nextBtn').click();}
      await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
      const before=await snapshot(page);
      await submit(page,'First stage wrong answer.');
      await page.locator('#skipRetestBtn').evaluate(b=>{b.click();b.click();});
      await cleanStageTwo(page,prompt(sample[0]),1);expect(await snapshot(page)).toEqual(before);
      await page.reload();await cleanStageTwo(page,prompt(sample[0]),1);expect(await snapshot(page)).toEqual(before);
      await submit(page,'Second stage wrong answer.');await page.locator('#skipRetestBtn').click();
      await expect(page.locator('#koreanText')).toHaveText(prompt(sample[1]));
      await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
      const state=(await checkpoint(page)).state;
      expect(state.retestAbandonedIds).toEqual([1]);
      for(const key of ['sessionQueue','retryQueue','retestCandidateIds','retestQueue','retestUnresolvedIds'])expect(state[key]).not.toContain(1);
      expect(await snapshot(page)).toEqual(before);
      // Persisted exclusions still beat queue entries from an older snapshot.
      await page.evaluate(()=>{
        const k='memory_study_session_v1',s=JSON.parse(localStorage.getItem(k));
        for(const q of ['sessionQueue','retryQueue','retestCandidateIds','retestQueue','retestUnresolvedIds'])s.state[q].unshift(1);
        s.state.retestStages[1]=1;s.revision+=100;localStorage.setItem(k,JSON.stringify(s));sessionStorage.setItem(k,JSON.stringify(s));
      });
      await page.reload();await expect(page.locator('#koreanText')).toHaveText(prompt(sample[1]));
      await submit(page,'Another first stage miss.');await page.locator('#skipRetestBtn').focus();await page.locator('#skipRetestBtn').press('Enter');
      await cleanStageTwo(page,prompt(sample[1]),2);expect(await snapshot(page)).toEqual(before);
      await page.reload();await cleanStageTwo(page,prompt(sample[1]),2);
      await submit(page,'Final second stage miss.');await page.locator('#skipRetestBtn').click();
      await expect(page.locator('#doneScreen')).toBeVisible();expect((await checkpoint(page)).status).toBe('ended');
      await expect(page.locator('#manualCorrectCount')).toHaveText('9');expect(await snapshot(page)).toEqual(before);
      await page.reload();await page.locator('#memory-sync-local').click();await expect(page.locator('#setupScreen')).toBeVisible();
      await expect(page.locator('#quizScreen')).toBeHidden();expect(await snapshot(page)).toEqual(before);
      expect(errors).toEqual([]);expect(workers).toEqual([]);
    }finally{await context.close();}
  });
}
for(const mobile of [false,true]){
  test(`independent context/Korean/English toggles preserve all eight combinations and existing settings (${mobile?'mobile':'desktop'})`,async({browser})=>{
    const{page,context,errors,workers}=await open(browser,mobile);
    try{
      const before=await snapshot(page);
      await page.locator('#tabAllCards').click();
      const row=page.locator('#allCardsList .fc-row').filter({hasText:sample[0].en});
      const missing=page.locator('#allCardsList .fc-row').filter({hasText:sample[2].en});
      const buttons=['toggleContext','toggleKo','toggleEn'];
      async function check(bits){
        for(let i=0;i<3;i++)expect(await page.locator('#'+buttons[i]).evaluate(el=>el.classList.contains('active'))).toBe(bits[i]);
        expect(await row.locator('[data-card-field]').evaluateAll(nodes=>nodes.map(n=>n.dataset.cardField))).toEqual(['context','ko','en']);
        if(bits[0]){await expect(row.locator('.fc-context')).toBeVisible();await expect(missing.locator('.fc-context')).toContainText('문맥 미등록');}
        else{await expect(row.locator('.fc-context')).toBeHidden();await expect(missing.locator('.fc-context')).toBeHidden();expect(await row.locator('.fc-context').evaluate(el=>el.offsetHeight)).toBe(0);}
        for(const[i,cls]of [[1,'.fc-ko'],[2,'.fc-en']])expect(await row.locator(cls).evaluate(el=>getComputedStyle(el).color==='rgba(0, 0, 0, 0)')).toBe(!bits[i]);
      }
      for(let mask=0;mask<8;mask++){
        const bits=[!!(mask&4),!!(mask&2),!!(mask&1)];
        for(let i=0;i<3;i++)if(await page.locator('#'+buttons[i]).evaluate(el=>el.classList.contains('active'))!==bits[i])await page.locator('#'+buttons[i]).click();
        await check(bits);
        await page.locator('#tabAdd').click();
        // The list toggle never hides context in management or changes saved card data.
        await expect(page.locator('#moveCardList .fc-context').first()).toBeVisible();
        await page.locator('#tabAllCards').click();await check(bits);
      }
      await page.locator('#toggleContext').click();
      await page.locator('#memModeBtn').click();
      for(const id of buttons)await expect(page.locator('#'+id)).toBeVisible();
      await expect(row.locator('.fc-context')).toBeHidden();
      await page.locator('#toggleContext').click();await expect(row.locator('.fc-context')).toBeVisible();
      for(const id of buttons)expect(await page.locator('#'+id).evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})).toBe(true);
      await page.locator('#memCollapseBtn').click();expect(await snapshot(page)).toEqual(before);
      await page.reload();await page.locator('#memory-sync-local').click();await expect(page.locator('#chapterSelectList')).toContainText('단계 전환 검사');
      await page.locator('#tabAllCards').click();await check([true,true,true]);
      expect(await snapshot(page)).toEqual(before);expect(errors).toEqual([]);expect(workers).toEqual([]);
    }finally{await context.close();}
  });
}
