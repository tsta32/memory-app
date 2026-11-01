// Run with: node tests/deployed-irregular-validation.cjs
// Optional target override: APP_URL=https://... node tests/deployed-irregular-validation.cjs
// Uses a fresh Playwright context and a synthetic card; never opens the user's browser profile.
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

const appUrl = process.env.APP_URL || 'https://tsta32.github.io/memory-app/';
const cardId = 97421987;
const report = { appUrl, workerRequests: [], consoleErrors: [], pageErrors: [], failedRequests: [] };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(id => {
    localStorage.setItem('srs_chapters_v1', JSON.stringify({ chapters: [], nextId: 1 }));
    localStorage.setItem('srs_cards_v2', JSON.stringify({ cards: [{
      id, ko: '격리된 불규칙 동사 검증', en: 'She taught me.', chapterId: null,
      stage: 0, dueAt: Date.now() - 1000, bookmarked: false,
      everAnswered: false, ngCount: 0, lastTestedAt: 0
    }], nextId: id + 1 }));
    localStorage.setItem('srs_settings_v1', JSON.stringify({ grammarOptions: {
      tense: true, number: true, modal: true, article: true, preposition: true
    } }));
    localStorage.setItem('srs_error_history_v1', JSON.stringify({ version: 1, records: [] }));
    localStorage.removeItem('memory_sync_code_v1');
  }, cardId);

  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('requestfailed', request => report.failedRequests.push({
    url: request.url(), error: request.failure()?.errorText
  }));
  page.on('request', request => {
    if (request.url().includes('.workers.dev/')) report.workerRequests.push({
      method: request.method(), url: request.url(), body: request.postData()
    });
  });
  page.on('response', async response => {
    if (response.url().includes('.workers.dev/')) {
      report.workerStatus = response.status();
      try {
        report.workerHttpBody = await response.text();
        const envelope = JSON.parse(report.workerHttpBody);
        report.workerText = envelope.content?.[0]?.text || '';
        const jsonText = report.workerText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        report.workerParsed = JSON.parse(jsonText);
      } catch (error) { report.workerResponseReadError = error.message; }
    }
  });

  try {
    const response = await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    report.appStatus = response && response.status();
    await page.locator('#memory-sync-local').click();
    await page.locator('#bulkModeBtn').waitFor({ state: 'attached' });
    await page.locator('#practiceBtn').click();
    await page.locator('#quizScreen').waitFor({ state: 'visible' });
    await page.locator('#answerInput').fill('She teached me.');
    await page.locator('#checkBtn').click();
    await page.waitForFunction(() => document.getElementById('footerHint').textContent.startsWith('오답:'), null, { timeout: 25000 });
    report.result = await page.evaluate(() => ({
      footer: document.getElementById('footerHint').textContent,
      records: JSON.parse(localStorage.getItem('srs_error_history_v1')).records
    }));

    assert.equal(report.appStatus, 200, 'deployed app should load');
    assert.equal(report.workerStatus, 200, 'the actual grading Worker should respond');
    assert.equal(report.workerParsed.results[0].reference, 'taught', 'Worker must return the exact reference token');
    assert.equal(report.workerParsed.results[0].answer, 'teached', 'Worker must return the exact answer token');
    assert.equal(report.workerParsed.results[0].isIrregular, true, 'Worker must identify the pair as irregular');
    assert.equal(report.workerParsed.results[0].type, 'tense', 'Worker must classify it as tense');
    assert.equal(report.workerParsed.results[0].lemma, 'teach', 'Worker must return the base lemma');
    assert.equal(report.workerParsed.results[0].certain, true, 'Worker must mark the judgment certain');
    assert.match(report.result.footer, /시제.*불규칙 형태/, 'UI must display the refined tense classification');
    assert.equal(report.result.records.length, 1, 'one isolated error record should be saved');
    assert.equal(report.result.records[0].errorType, 'tense', 'saved error category must be tense');
    assert.equal(report.result.records[0].cardId, cardId, 'only the synthetic fixture card is used');
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.failedRequests, []);
    report.pass = true;
  } catch (error) {
    report.pass = false;
    report.failure = error.message;
  } finally {
    console.log(JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
  }
  if (!report.pass) process.exitCode = 1;
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 2;
});
