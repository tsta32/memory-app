const { expect } = require('@playwright/test');

// Explicit skip now passes through stage two before a card can be removed.
async function skipRetestCompletely(page, activation = 'click') {
  const stageOne=(await page.locator('#boxBadge').textContent()).endsWith('1단계');
  const prompt=await page.locator('#koreanText').textContent();
  const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('memory_study_session_v1')).state.currentId);
  async function activate() {
    const button=page.locator('#skipRetestBtn');
    if(activation==='Enter'){await button.focus();await button.press('Enter');}
    else if(activation==='tap')await button.tap();
    else if(activation==='double')await button.evaluate(b=>{b.click();b.click();});
    else await button.click();
  }
  await activate();
  if(stageOne){
    await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await expect(page.locator('#koreanText')).toHaveText(prompt);
    await expect(page.locator('#hintText')).toBeHidden();
    await expect(page.locator('#answerInput')).toHaveValue('');
    await expect(page.locator('#answerInput')).toBeEnabled();
    await expect(page.locator('#diffPanel')).toBeHidden();
    await expect(page.locator('#diffYour')).toBeEmpty();await expect(page.locator('#diffAns')).toBeEmpty();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('memory_study_session_v1')).state.currentId)).toBe(id);
    await page.waitForTimeout(320);
    await page.locator('#answerInput').fill('Skip the second stage.');await page.locator('#checkBtn').click();
    await expect(page.locator('#skipRetestBtn')).toBeVisible();
    await activate();
  }
}
module.exports={skipRetestCompletely};
