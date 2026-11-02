const { test, expect } = require('@playwright/test');
const { items } = require('../../business-contexts');

async function openFixture(browser, {all=false, savedContext}={}) {
  const context=await browser.newContext();
  const errors=[],workers=[];
  await context.addInitScript(({items,all,savedContext})=>{
    if(sessionStorage.getItem('context_fixture'))return;
    const cards=(all?items:items.slice(0,1)).map((x,i)=>({id:i+1,en:x.en,ko:'기존 한국어 '+i,chapterId:9,stage:0,dueAt:1,ngCount:2,everAnswered:false,bookmarked:true,lastTestedAt:42,...(i===0&&savedContext!==undefined?{context:savedContext}:{})}));
    cards.push({id:999,en:'Unrelated answer.',ko:'다른 챕터',chapterId:10,stage:0,dueAt:1});
    localStorage.setItem('srs_cards_v2',JSON.stringify({cards,nextId:1000}));
    localStorage.setItem('srs_chapters_v1',JSON.stringify({chapters:[{id:9,name:'업무대화 일반'},{id:10,name:'기타'}],nextId:11}));
    localStorage.removeItem('memory_sync_code_v1');
    sessionStorage.setItem('context_fixture','1');
  },{items,all,savedContext});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname.endsWith('workers.dev')){workers.push(url.hostname);return route.abort();}
    if(url.hostname.includes('google'))return route.fulfill({status:200,body:''});
    return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');await page.locator('#memory-sync-local').click();
  await expect(page.locator('#chapterSelectList')).toContainText('업무대화 일반');
  return {context,page,errors,workers};
}
async function saved(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('srs_cards_v2')));}
async function start(page,practice=false){
  await page.locator('#quizPromptMode').selectOption('context');
  await page.locator(practice?'#practiceBtn':'#startBtn').click();
  await expect(page.locator('#quizScreen')).toBeVisible();
}
async function cancel(page){await page.locator('#cancelSessionBtn').click();await page.locator('#cancelModalConfirm').click();}

 test('all 200 templates migrate without changing history; context edits persist through backup and restore',async({browser})=>{
  const {page,context,errors,workers}=await openFixture(browser,{all:true});
  const initial=await saved(page);
  expect(initial.cards.filter(c=>c.context).length).toBe(200);
  expect(initial.nextId).toBe(1000);
  initial.cards.slice(0,200).forEach((c,i)=>{expect(c.context).toBe(items[i].context);expect(c.ngCount).toBe(2);expect(c.lastTestedAt).toBe(42);expect(c.ko).toBe('기존 한국어 '+i);});
  expect(initial.cards[200].context).toBeUndefined();
  await page.locator('#tabAllCards').click();
  // Existing editor, including its review/apply step.
  await page.locator('#allCardsSearch').fill(items[0].en);
  await page.locator('#allCardsList .fc-row input[type="checkbox"]').check();
  await page.locator('#editBulkBtn').click();
  const custom='업무를 논의하기 전에 동료가 지금 대화할 시간을 낼 수 있는지 물으려고 할 때.';
  await page.locator('#editCardList input[data-field="context"]').fill(custom);
  await page.locator('#editSaveBtn').click();
  await expect(page.locator('#editDiffList')).toContainText(custom);
  await page.locator('#editConfirmApply').click();
  expect((await saved(page)).cards[0].context).toBe(custom);
  await page.locator('#tabSettings').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#backupBtn').click();
  const download=await downloadPromise;
  const stream=await download.createReadStream();let raw='';for await(const chunk of stream)raw+=chunk.toString();
  const backup=JSON.parse(raw);expect(JSON.parse(backup.cards).cards[0].context).toBe(custom);
  await page.evaluate(()=>{const key='srs_cards_v2';const d=JSON.parse(localStorage.getItem(key));d.cards[0].context='temporary';localStorage.setItem(key,JSON.stringify(d));});
  page.on('dialog',dialog=>dialog.accept());
  await Promise.all([page.waitForEvent('load'),page.locator('#restoreFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(raw)})]);
  await page.locator('#memory-sync-local').click();
  await expect(page.locator('#chapterSelectList')).toContainText('업무대화 일반');
  await expect.poll(async()=>(await saved(page)).cards[0].context).toBe(custom);
  // Wait for restoration reload before interacting.
  await expect(page.locator('#setupScreen')).toBeVisible();
  await start(page,true);await expect(page.locator('#koreanText')).toHaveText(custom);
  expect(errors).toEqual([]);expect(workers).toEqual([]);await context.close();
 });

 test('stored context is the only prompt before submission, including reload and both retest stages; SRS still advances',async({browser})=>{
  const {page,context,errors,workers}=await openFixture(browser);
  await start(page);
  await expect(page.locator('#koreanText')).toHaveText(items[0].context);
  await page.locator('#answerInput').fill('draft');await page.reload();
  await expect(page.locator('#koreanText')).toHaveText(items[0].context);
  await expect(page.locator('#answerInput')).toHaveValue('draft');
  for(const button of ['#quizAskBtn','#quizNotesBtn','#editCurrentBtn']){
    await expect(page.locator(button)).toBeDisabled();await expect(page.locator('.modal-overlay.show')).toHaveCount(0);
  }
  await expect(page.locator('#quizScreen')).not.toContainText('기존 한국어');
  await expect(page.locator('#quizScreen')).not.toContainText(items[0].en);
  await page.waitForTimeout(320);
  await page.locator('#answerInput').fill('wrong');await page.locator('#checkBtn').click();
  await expect(page.locator('#diffAns')).toContainText(items[0].en);
  await page.locator('#nextBtn').click();
  await expect(page.locator('#boxBadge')).toContainText('1단계');
  await expect(page.locator('#hintText')).toBeHidden();
  await page.locator('#failAllBtn').click();
  await expect(page.locator('#testStatusContent')).not.toContainText(items[0].en);
  await page.locator('#testStatusClose').click();
  for(let stage=1;stage<=2;stage++){
    await expect(page.locator('#koreanText')).toHaveText(items[0].context);
    await expect(page.locator('#hintText')).toBeHidden();
    await page.waitForTimeout(320);
    await page.locator('#answerInput').fill(items[0].en);await page.locator('#checkBtn').click();
    await page.locator('#nextBtn').click();
  }
  await expect(page.locator('#doneScreen')).toBeVisible();
  expect((await saved(page)).cards[0].ngCount).toBe(3);
  expect((await saved(page)).cards[0].dueAt).toBeGreaterThan(Date.now());
  expect(errors).toEqual([]);expect(workers).toEqual([]);await context.close();
 });

 test('translation mode remains available and intentional empty/custom context survives reload',async({browser})=>{
  for(const savedContext of ['', '사용자가 저장한 문맥']){
    const {page,context,workers}=await openFixture(browser,{savedContext});
    await page.reload();await page.locator('#memory-sync-local').click();
    await expect(page.locator('#chapterSelectList')).toContainText('업무대화 일반');
    expect((await saved(page)).cards[0].context).toBe(savedContext);
    await page.locator('#practiceBtn').click();await expect(page.locator('#koreanText')).toHaveText('기존 한국어 0');
    await cancel(page);
    if(savedContext){await start(page,true);await expect(page.locator('#koreanText')).toHaveText(savedContext);}
    else{await page.locator('#quizPromptMode').selectOption('context');await page.locator('#practiceBtn').click();await expect(page.locator('#customCountHint')).toBeVisible();await expect(page.locator('#customCountHint')).toContainText('저장된 문맥');}
    expect(workers).toEqual([]);await context.close();
  }
 });
