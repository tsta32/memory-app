const { test, expect } = require('@playwright/test');
const SYNC = 'toeic-cloud-sync.tsta32.workers.dev';
const KEY = 'memory_study_session_v1';
const DATA_KEYS = ['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
async function fixture(browser, { sync = false, count = 3 } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await context.addInitScript(({ sync, count }) => {
    window.__polls = [];
    const original = window.setInterval;
    window.setInterval = function(fn, ms, ...args) { if(ms === 20000) { window.__polls.push(fn); return 991; } return original(fn, ms, ...args); };
    if(localStorage.getItem('__session_fixture'))return;
    localStorage.setItem('__session_fixture','1');
    localStorage.setItem('srs_cards_v2', JSON.stringify({ cards: Array.from({length:count},(_,i)=>({ id:900+i,ko:`학습 ${i+1}`,en:`Answer ${i+1}.`,chapterId:9,stage:0,dueAt:1,everAnswered:false,ngCount:0,lastTestedAt:0,bookmarked:false })),nextId:950 }));
    localStorage.setItem('srs_chapters_v1',JSON.stringify({chapters:[{id:9,name:'Recovery fixture'}],nextId:10}));
    localStorage.setItem('srs_settings_v1',JSON.stringify({volume:0,newCardRatio:5,manualCorrectTotal:0,grammarOptions:{article:true,tense:true,number:true,modal:true,preposition:true}}));
    localStorage.setItem('srs_error_history_v1',JSON.stringify({version:1,records:[]}));
    for(const key of ['srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1'])localStorage.setItem(key,key.includes('notes')?'{}':'[]');
    if(sync)localStorage.setItem('memory_sync_code_v1','isolated_test_code_123');
  }, { sync, count });
  const page = await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const state={ remoteChanged:false, fail:false, gets:0, sets:0, payloads:[], responseGate:null, gateStarted:null };
  await context.route('**/*', async route => {
    const url=new URL(route.request().url());
    if(url.hostname===SYNC){
      const body=route.request().postDataJSON();
      if(body.action==='set'){state.sets++;state.payloads.push(body.data);return route.fulfill({json:{ok:true}});}
      state.gets++;
      const data=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),DATA_KEYS);
      data.__memorySyncSnapshotV1={version:1,keys:DATA_KEYS.slice().sort()};
      if(state.remoteChanged){const settings=JSON.parse(data.srs_settings_v1);settings.volume=17;data.srs_settings_v1=JSON.stringify(settings);}
      if(state.gateStarted)state.gateStarted();
      if(state.responseGate)await state.responseGate;
      return route.fulfill(state.fail?{status:503,json:{error:'fixture offline'}}:{json:{data}});
    }
    if(url.hostname.endsWith('workers.dev'))throw new Error('Unexpected live Worker request');
    if(url.hostname.includes('google'))return route.fulfill({body:'',contentType:'text/css'});
    if(url.pathname.endsWith('favicon.ico'))return route.fulfill({status:204,body:''});
    await route.continue();
  });
  await page.goto('./');
  if(!sync)await page.locator('#memory-sync-local').click();
  // The static start button is visible before async sync/app initialization finishes.
  await expect(page.locator('#chapterSelectList')).toContainText('Recovery fixture');
  await expect(page.locator('#startBtn')).toBeVisible();
  return {context,page,state,errors};
}
async function submit(page,answer){await page.waitForTimeout(320);await page.locator('#answerInput').fill(answer);await page.locator('#checkBtn').click();}
async function reloadStudy(page){await page.reload();if(await page.locator('#memory-sync-local').isVisible())await page.locator('#memory-sync-local').click();await expect(page.locator('#quizScreen')).toBeVisible();}

test('typing survives a changed remote snapshot poll without navigation or data replacement',async({browser})=>{
  const app=await fixture(browser,{sync:true});const {page,state}=app;
  try{
    await page.locator('#startBtn').click();await page.locator('#answerInput').pressSequentially('unfinished draft');
    await page.evaluate(()=>window.memorySyncFlush());
    state.remoteChanged=true;const gets=state.gets;
    await page.evaluate(()=>window.__polls[0]());
    await page.waitForTimeout(500);
    await expect(page.locator('#quizScreen')).toBeVisible();
    await expect(page.locator('#answerInput')).toHaveValue('unfinished draft');
    expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('srs_settings_v1'))).volume).toBe(0);
    expect(state.gets).toBe(gets);
    expect(app.errors).toEqual([]);
  }finally{await app.context.close();}
});

test('mobile reload restores an unsubmitted draft and original question',async({browser})=>{
  const app=await fixture(browser);const {page}=app;
  try{
    await page.locator('#startBtn').click();await page.locator('#answerInput').pressSequentially('typing without submit');
    await reloadStudy(page);
    await expect(page.locator('#koreanText')).toHaveText('학습 1');
    await expect(page.locator('#answerInput')).toHaveValue('typing without submit');
    await expect(page.locator('#progressCount')).toHaveText('0/3');
  }finally{await app.context.close();}
});

test('PWA controller change during typing does not reload the study page',async({browser})=>{
  const app=await fixture(browser);const {page}=app;
  try{
    await page.locator('#startBtn').click();await page.locator('#answerInput').fill('PWA draft');
    await page.evaluate(()=>{window.__sameDocument=true;navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));});
    await page.waitForTimeout(400);
    expect(await page.evaluate(()=>window.__sameDocument)).toBe(true);
    await expect(page.locator('#answerInput')).toHaveValue('PWA draft');
  }finally{await app.context.close();}
});

test('a home-screen poll response arriving after study starts is discarded',async({browser})=>{
  const app=await fixture(browser,{sync:true});const {page,state}=app;let release;
  try{
    await page.evaluate(()=>window.memorySyncFlush());
    state.remoteChanged=true;state.responseGate=new Promise(resolve=>release=resolve);
    const started=new Promise(resolve=>state.gateStarted=resolve);
    await page.evaluate(()=>window.__polls[0]());await started;
    await page.locator('#startBtn').click();await page.locator('#answerInput').fill('in-flight response draft');
    release();state.responseGate=null;state.gateStarted=null;
    await page.waitForTimeout(350);
    await expect(page.locator('#quizScreen')).toBeVisible();await expect(page.locator('#answerInput')).toHaveValue('in-flight response draft');
    expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('srs_settings_v1'))).volume).toBe(0);
    const gets=state.gets;await page.reload();await expect(page.locator('#quizScreen')).toBeVisible();
    expect(state.gets).toBe(gets);await expect(page.locator('#answerInput')).toHaveValue('in-flight response draft');
  }finally{if(release)release();await app.context.close();}
});

test('reload preserves pending decisions, both retest stages, queue order, and exactly-once grading',async({browser})=>{
  const app=await fixture(browser,{count:2});const {page}=app;
  const records=()=>page.evaluate(()=>({cards:localStorage.getItem('srs_cards_v2'),history:localStorage.getItem('srs_error_history_v1')}));
  try{
    await page.locator('#startBtn').click();await submit(page,'Wrong.');
    const pending=await records();await reloadStudy(page);expect(await records()).toEqual(pending);
    await expect(page.locator('#answerInput')).toHaveValue('Wrong.');await expect(page.locator('#diffPanel')).toBeVisible();
    await page.evaluate(()=>{document.getElementById('nextBtn').click();document.getElementById('nextBtn').click();});
    await expect(page.locator('#koreanText')).toHaveText('학습 2');
    await submit(page,'Answer 2.');await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    const graded=await records();expect(JSON.parse(graded.cards).cards[0].ngCount).toBe(1);
    await page.locator('#answerInput').fill('stage one draft');await reloadStudy(page);
    await expect(page.locator('#answerInput')).toHaveValue('stage one draft');expect(await records()).toEqual(graded);
    await submit(page,'Answer 1.');await reloadStudy(page);
    await expect(page.locator('#diffMessage')).toContainText('실루엣 단계 정답');await expect(page.locator('#nextBtn')).toBeVisible();
    await page.locator('#nextBtn').click();await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await page.locator('#answerInput').fill('stage two draft');await reloadStudy(page);
    await expect(page.locator('#answerInput')).toHaveValue('stage two draft');await expect(page.locator('#hintText')).toBeHidden();
    await submit(page,'Wrong again.');await reloadStudy(page);await page.locator('#nextBtn').click();
    await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');expect(await records()).toEqual(graded);
    await submit(page,'Answer 1.');await page.locator('#nextBtn').click();
    await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await submit(page,'Answer 1.');await reloadStudy(page);await page.locator('#nextBtn').click();
    await expect(page.locator('#doneScreen')).toBeVisible();expect(await records()).toEqual(graded);
    await page.reload();await expect(page.locator('#setupScreen')).toBeVisible();await expect(page.locator('#quizScreen')).toBeHidden();
    expect(app.errors).toEqual([]);
  }finally{await app.context.close();}
});

test('storage write failure recovers a grade journal without increasing SRS or errors twice',async({browser})=>{
  const app=await fixture(browser);const {page}=app;
  try{
    await page.locator('#startBtn').click();
    await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){
      if(this===localStorage&&['srs_cards_v2','srs_error_history_v1','memory_study_session_v1'].includes(k))throw new DOMException('Fixture full','QuotaExceededError');return original.call(this,k,v);
    };});
    await submit(page,'Wrong.');await page.locator('#nextBtn').click();await expect(page.locator('#koreanText')).toHaveText('학습 2');
    await page.locator('#answerInput').fill('preserve after write failure');await expect(page.locator('#studyRecoveryStatus')).not.toBeEmpty();
    await reloadStudy(page);await expect(page.locator('#answerInput')).toHaveValue('preserve after write failure');
    const saved=await page.evaluate(()=>({card:JSON.parse(localStorage.getItem('srs_cards_v2')).cards[0],errors:JSON.parse(localStorage.getItem('srs_error_history_v1')).records}));
    expect(saved.card.ngCount).toBe(1);expect(saved.errors.length).toBeGreaterThan(0);for(const row of saved.errors)expect(row.count).toBe(1);
    await reloadStudy(page);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('srs_cards_v2')).cards[0])).toEqual(saved.card);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('srs_error_history_v1')).records)).toEqual(saved.errors);
  }finally{await app.context.close();}
});

test('background, offline sync, touch scrolling, and composition events cannot submit or leave a draft',async({browser})=>{
  const app=await fixture(browser,{sync:true});const {page,state}=app;
  try{
    const touch=await app.context.newCDPSession(page);
    await page.locator('#startBtn').tap();
    for(let i=0;i<6;i++){
      await page.locator('#answerInput').tap();await page.locator('#answerInput').pressSequentially(`draft-${i} `);
      await page.evaluate(()=>{window.scrollBy(0,100);window.scrollBy(0,-100);});
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:375,y:700}]});
      await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:375,y:500}]});
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.locator('#answerInput').dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});
      await page.locator('#answerInput').dispatchEvent('keydown',{key:'Enter',code:'Enter',repeat:true});
      await expect(page.locator('#quizScreen')).toBeVisible();await expect(page.locator('#progressCount')).toHaveText('0/3');
    }
    const draft=await page.locator('#answerInput').inputValue();
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});
    state.fail=true;const result=await page.evaluate(()=>window.memorySyncFlush());expect(result.ok).toBe(false);
    await app.context.setOffline(true);await expect(page.locator('#quizScreen')).toBeVisible();await app.context.setOffline(false);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
    await expect(page.locator('#quizScreen')).toBeVisible();await expect(page.locator('#answerInput')).toHaveValue(draft);
    await reloadStudy(page);await expect(page.locator('#answerInput')).toHaveValue(draft);await expect(page.locator('#progressCount')).toHaveText('0/3');
    for(const payload of state.payloads){expect(payload).not.toHaveProperty(KEY);expect(payload).not.toHaveProperty('memory_study_diagnostics_v1');}
    const logs=await page.evaluate(()=>localStorage.getItem('memory_study_diagnostics_v1'));expect(logs).not.toContain(draft);expect(logs).not.toContain('Answer 1.');
    expect(app.errors).toEqual([]);
  }finally{await app.context.close();}
});

test('cancel requires visible confirmation and invalidates old callbacks before a new session',async({browser})=>{
  const app=await fixture(browser);const {page}=app;
  try{
    await page.locator('#startBtn').click();await page.locator('#answerInput').fill('cancel draft');
    await page.evaluate(()=>{document.getElementById('cancelModalConfirm').click();document.getElementById('restartBtn').click();document.getElementById('failAllConfirm').click();});
    await expect(page.locator('#quizScreen')).toBeVisible();
    await page.locator('#cancelSessionBtn').click();await page.locator('#cancelModalBack').click();await expect(page.locator('#answerInput')).toHaveValue('cancel draft');
    await page.evaluate(()=>{const original=window.setTimeout;window.setTimeout=function(fn,ms,...args){if(ms===150){window.__oldAdvance=fn;return 999;}return original(fn,ms,...args);};});
    await submit(page,'Answer 1.');
    await page.locator('#cancelSessionBtn').click();await page.locator('#cancelModalConfirm').click();await expect(page.locator('#setupScreen')).toBeVisible();
    await page.locator('#practiceBtn').click();const current=await page.locator('#koreanText').innerText();
    await page.locator('#answerInput').fill('new session draft');await page.evaluate(()=>window.__oldAdvance());
    await expect(page.locator('#koreanText')).toHaveText(current);await expect(page.locator('#answerInput')).toHaveValue('new session draft');
    await page.locator('#cancelSessionBtn').click();await page.locator('#cancelModalConfirm').click();
    await page.reload();if(await page.locator('#memory-sync-local').isVisible())await page.locator('#memory-sync-local').click();
    await expect(page.locator('#setupScreen')).toBeVisible();await expect(page.locator('#quizScreen')).toBeHidden();
  }finally{await app.context.close();}
});

test('a reload in the settled transition advances once without grading again',async({browser})=>{
  const app=await fixture(browser);const {page}=app;
  try{
    await page.locator('#startBtn').click();
    await page.evaluate(()=>{const original=window.setTimeout;window.setTimeout=function(fn,ms,...args){if(ms===150)return 999;return original(fn,ms,...args);};});
    await submit(page,'Answer 1.');await expect(page.locator('#progressCount')).toHaveText('1/3');
    const before=await page.evaluate(()=>localStorage.getItem('srs_cards_v2'));await reloadStudy(page);
    await expect(page.locator('#koreanText')).toHaveText('학습 2');await expect(page.locator('#progressCount')).toHaveText('1/3');
    expect(await page.evaluate(()=>localStorage.getItem('srs_cards_v2'))).toBe(before);
  }finally{await app.context.close();}
});

test('closing a tab and opening a fresh tab restores from device-local storage',async({browser})=>{
  const app=await fixture(browser);let {page}=app;
  try{
    await page.locator('#startBtn').click();await page.locator('#answerInput').fill('restart draft');await page.close();
    page=await app.context.newPage();await page.goto('./');
    await expect(page.locator('#quizScreen')).toBeVisible();await expect(page.locator('#answerInput')).toHaveValue('restart draft');
    await page.goto('./?away=1');await expect(page.locator('#quizScreen')).toBeVisible();await page.goBack();
    await expect(page.locator('#quizScreen')).toBeVisible();await expect(page.locator('#answerInput')).toHaveValue('restart draft');
  }finally{await app.context.close();}
});


test('repeated mobile sessions finish normally and partial exit still requires confirmation',async({browser})=>{
  const app=await fixture(browser,{count:1});const {page}=app;
  try{
    for(let i=0;i<3;i++){
      await page.locator('#practiceBtn').tap();await submit(page,'Answer 1.');await expect(page.locator('#doneScreen')).toBeVisible();
      expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('memory_study_session_v1'))).status).toBe('ended');
      await page.locator('#restartBtn').tap();await expect(page.locator('#setupScreen')).toBeVisible();
    }
    await page.locator('#practiceBtn').tap();await page.locator('#answerInput').fill('confirmed partial draft');
    await page.locator('#failAllBtn').tap();
    page.once('dialog',dialog=>dialog.dismiss());await page.locator('#testStatusFailAll').tap();await expect(page.locator('#quizScreen')).toBeVisible();
    await page.locator('#testStatusClose').tap();await expect(page.locator('#answerInput')).toHaveValue('confirmed partial draft');
    await page.locator('#failAllBtn').tap();page.once('dialog',dialog=>dialog.accept());await page.locator('#testStatusFailAll').tap();
    await expect(page.locator('#doneScreen')).toBeVisible();await page.reload();
    if(await page.locator('#memory-sync-local').isVisible())await page.locator('#memory-sync-local').click();
    await expect(page.locator('#setupScreen')).toBeVisible();await expect(page.locator('#quizScreen')).toBeHidden();
  }finally{await app.context.close();}
});
