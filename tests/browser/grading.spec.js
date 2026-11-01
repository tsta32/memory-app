const { test, expect } = require('@playwright/test');

const TEST_CARD_ID = 42001;
const BLOCKED_WORKERS = new Set([
  'toeic-cloud-sync.tsta32.workers.dev',
  'lively-wave-a149.tsta32.workers.dev'
]);

async function openApp(browser, reference, grammarOptions = {}, extraCards = 0, savedManualCount = 0, seed = {}) {
  const context = await browser.newContext(seed.contextOptions || {});
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [], workerRequests: [] };
  await context.addInitScript(({ reference, grammarOptions, cardId, extraCards, savedManualCount, seed }) => {
    if (sessionStorage.getItem('__memory_app_fixture_seeded')) return;
    const overrides = Array.isArray(extraCards) ? extraCards : [];
    const extraCount = Array.isArray(extraCards) ? extraCards.length : extraCards;
    const cards = [{ id: cardId, ko: '브라우저 회귀 검사', en: reference, chapterId: 42, stage: 0,
      dueAt: Date.now() - 1000, bookmarked: false, everAnswered: false, ngCount: 0, lastTestedAt: 0, ...(seed.cardOverrides?.[0] || {}) }];
    for (let i = 0; i < extraCount; i++) cards.push({ ...cards[0], id: cardId + i + 1, ...(overrides[i] || {}), ...(seed.cardOverrides?.[i + 1] || {}) });
    localStorage.setItem('srs_chapters_v1', JSON.stringify({ chapters: [{ id: 42, name: 'Browser test' }], nextId: 43 }));
    localStorage.setItem('srs_cards_v2', JSON.stringify({
      cards,
      nextId: cardId + extraCount + 1
    }));
    localStorage.setItem('srs_settings_v1', JSON.stringify({ grammarOptions, manualCorrectTotal: savedManualCount, ...(seed.settings || {}) }));
    localStorage.setItem('srs_error_history_v1', JSON.stringify(seed.errorHistory || { version: 1, records: [] }));
    localStorage.removeItem('memory_sync_code_v1');
    sessionStorage.setItem('__memory_app_fixture_seeded', '1');
  }, { reference, grammarOptions, cardId: TEST_CARD_ID, extraCards, savedManualCount, seed });

  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (BLOCKED_WORKERS.has(url.hostname)) {
      diagnostics.workerRequests.push(url.hostname);
      await route.abort('blockedbyclient');
    } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    } else if (url.pathname.endsWith('/favicon.ico')) {
      await route.fulfill({ status: 204, body: '' });
    } else {
      await route.continue();
    }
  });

  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') diagnostics.consoleErrors.push(message.text()); });
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', request => diagnostics.requestFailures.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  await page.goto('./');
  await expect(page.locator('#memory-sync-local')).toBeVisible();
  await page.locator('#memory-sync-local').click();
  await expect(page.locator('#chapterSelectList')).toContainText('Browser test');
  return { context, page, diagnostics };
}

async function openQuiz(browser, reference, grammarOptions = {}) {
  const testApp = await openApp(browser, reference, grammarOptions);
  const { context, page, diagnostics } = testApp;
  await page.locator('#practiceBtn').click();
  await expect(page.locator('#quizScreen')).toBeVisible();
  await expect(page.locator('#koreanText')).toHaveText('브라우저 회귀 검사');
  return { context, page, diagnostics };
}

async function assertHealthyBrowser({ diagnostics }) {
  expect(diagnostics.workerRequests, 'local test should not contact a Worker').toEqual([]);
  expect(diagnostics.consoleErrors, 'browser console errors').toEqual([]);
  expect(diagnostics.pageErrors, 'uncaught browser exceptions').toEqual([]);
  expect(diagnostics.requestFailures, 'failed browser requests').toEqual([]);
  expect(diagnostics.badResponses, 'HTTP error responses').toEqual([]);
}

async function enterAnswerAndCheck(page, answer) {
  await page.locator('#answerInput').fill(answer);
  await page.locator('#checkBtn').click();
}

async function expectCorrect(page) {
  await expect(page.locator('#doneScreen')).toBeVisible();
  await expect(page.locator('#doneSummary')).toContainText('1개 완료');
}

test('real UI accepts contraction/full-form equivalents in both directions', async ({ browser }) => {
  const cases = [
    ["Let’s review today’s agenda first.", "let's review today's agenda first"],
    ["I'll reconnect.", 'I will reconnect.'],
    ["I'm ready.", 'I am ready.'],
    ["It's ready.", 'It is ready.'],
    ["It's been ready.", 'It has been ready.'],
    ["I've finished.", 'I have finished.'],
    ["I'd finished.", 'I had finished.'],
    ["I'd like to go.", 'I would like to go.']
  ];
  for (const [reference, answer] of cases) {
    for (const [front, back] of [[reference, answer], [answer, reference]]) {
      const testApp = await openQuiz(browser, front);
      try {
        await enterAnswerAndCheck(testApp.page, back);
        await expectCorrect(testApp.page);
        await assertHealthyBrowser(testApp);
      } finally {
        await testApp.context.close();
      }
    }
  }
});

test('real UI normalizes case and punctuation, then waits for explicit incorrect-result confirmation', async ({ browser }) => {
  const positive = await openQuiz(browser, "I'll reconnect.");
  try {
    await enterAnswerAndCheck(positive.page, 'i WILL reconnect!!!');
    await expectCorrect(positive.page);
    await assertHealthyBrowser(positive);
  } finally {
    await positive.context.close();
  }

  const negative = await openApp(browser, "I'll reconnect.", {}, 1);
  try {
    await negative.page.locator('#startBtn').click();
    await expect(negative.page.locator('#quizScreen')).toBeVisible();
    await enterAnswerAndCheck(negative.page, "I won't reconnect.");
    await expect(negative.page.locator('#diffPanel')).toBeVisible();
    await expect(negative.page.locator('#diffYour')).toContainText('내 답변');
    await expect(negative.page.locator('#diffYour')).toContainText("won't");
    await expect(negative.page.locator('#diffAns')).toContainText('모범 답안');
    expect(await negative.page.locator('#diffYour span').count()).toBeGreaterThan(0);
    await expect(negative.page.locator('#nextBtn')).toHaveText('다음 문제');
    await expect(negative.page.locator('#markCorrectBtn')).toHaveText('정답으로 변경');
    await expect(negative.page.locator('#nextBtn').locator('xpath=..')).toHaveCSS('display', 'flex');
    const beforeConfirm = await negative.page.evaluate(() => ({
      card: JSON.parse(localStorage.getItem('srs_cards_v2')).cards[0],
      errors: JSON.parse(localStorage.getItem('srs_error_history_v1')).records
    }));
    expect(beforeConfirm.card).toMatchObject({ stage: 0, ngCount: 0, everAnswered: false });
    expect(beforeConfirm.errors).toEqual([]);
    await negative.page.waitForTimeout(250);
    await expect(negative.page.locator('#diffPanel')).toBeVisible();
    await expect(negative.page.locator('#progressCount')).toHaveText('0/2');
    await negative.page.locator('#nextBtn').click();
    await expect(negative.page.locator('#progressCount')).toHaveText('1/2');
    await negative.page.waitForTimeout(320);
    await enterAnswerAndCheck(negative.page, "I won't reconnect.");
    await expect(negative.page.locator('#diffPanel')).toBeVisible();
    await negative.page.locator('#answerInput').press('Enter');
    await expect(negative.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await negative.page.waitForTimeout(320);
    await enterAnswerAndCheck(negative.page, "I'll reconnect.");
    await expect(negative.page.locator('#diffPanel')).toBeVisible();
    await negative.page.locator('#nextBtn').click();
    await negative.page.waitForTimeout(320);
    await enterAnswerAndCheck(negative.page, "I'll reconnect.");
    await expect(negative.page.locator('#diffPanel')).toBeVisible();
    await expect(negative.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await negative.page.locator('#nextBtn').click();
    await negative.page.waitForTimeout(320);
    await enterAnswerAndCheck(negative.page, "I'll reconnect.");
    await expect(negative.page.locator('#diffPanel')).toBeVisible();
    await expect(negative.page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await expect(negative.page.locator('#hintText')).toBeHidden();
    await negative.page.locator('#nextBtn').click();
    await negative.page.waitForTimeout(320);
    await enterAnswerAndCheck(negative.page, "I'll reconnect.");
    await expect(negative.page.locator('#diffPanel')).toBeVisible();
    await expect(negative.page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await negative.page.locator('#nextBtn').click();
    await expect(negative.page.locator('#doneScreen')).toBeVisible();
    const history = await negative.page.evaluate(() => JSON.parse(localStorage.getItem('srs_error_history_v1')));
    expect(history.records).toHaveLength(2);
    expect(history.records[0]).toMatchObject({ cardId: expect.any(Number), errorType: 'vocabulary', actualAnswer: "I won't reconnect.", count: 1 });
    expect(history.records.every(record => record.occurrences[0].reason.includes('정규화 후에도'))).toBe(true);
    const gradedCards = await negative.page.evaluate(() => JSON.parse(localStorage.getItem('srs_cards_v2')).cards);
    expect(gradedCards).toHaveLength(2);
    for (const gradedCard of gradedCards) {
      expect(gradedCard).toMatchObject({ stage: 0, ngCount: 1, everAnswered: true });
      expect(gradedCard.dueAt).toBeGreaterThan(Date.now());
      expect(gradedCard.dueAt).toBeLessThan(Date.now() + 16 * 60 * 1000);
    }
    await assertHealthyBrowser(negative);
  } finally {
    await negative.context.close();
  }
});

test('smart apostrophe contraction equivalence is identical in first test and both retest stages', async ({ browser }) => {
  const reference = 'Let’s review today’s agenda first.';
  const equivalent = "let's review today's agenda first";
  const firstPass = await openQuiz(browser, reference);
  try {
    await enterAnswerAndCheck(firstPass.page, equivalent);
    await expectCorrect(firstPass.page);
    await expect(firstPass.page.locator('#diffPanel')).toBeHidden();
    await expect(firstPass.page.locator('#markCorrectBtn')).toBeHidden();
  } finally { await firstPass.context.close(); }

  const retest = await openApp(browser, reference);
  try {
    await retest.page.locator('#startBtn').click();
    await enterAnswerAndCheck(retest.page, 'We will decide this later.');
    await retest.page.locator('#diffPanel').waitFor({ state: 'visible' });
    await retest.page.locator('#nextBtn').click();
    await expect(retest.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    const beforeRetest = await retest.page.evaluate(() => ({ cards: localStorage.getItem('srs_cards_v2'), errors: localStorage.getItem('srs_error_history_v1'), settings: localStorage.getItem('srs_settings_v1') }));
    await enterAnswerAndCheck(retest.page, equivalent);
    await expect(retest.page.locator('#diffMessage')).toContainText('실루엣 단계 정답');
    await retest.page.locator('#nextBtn').click();
    await retest.page.waitForTimeout(320);
    await expect(retest.page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await expect(retest.page.locator('#hintText')).toBeHidden();
    await enterAnswerAndCheck(retest.page, equivalent);
    await expect(retest.page.locator('#diffMessage')).toContainText('2단계 자동 정답');
    await retest.page.locator('#nextBtn').click();
    await expect(retest.page.locator('#doneScreen')).toBeVisible();
    const afterRetest = await retest.page.evaluate(() => ({ cards: localStorage.getItem('srs_cards_v2'), errors: localStorage.getItem('srs_error_history_v1'), settings: localStorage.getItem('srs_settings_v1') }));
    expect(afterRetest).toEqual(beforeRetest);
    await assertHealthyBrowser(retest);
  } finally { await retest.context.close(); }
});

test('omitted apostrophe in I’ll is accepted in first test and retest stages one and two', async ({ browser }) => {
  const reference = 'I’ll verify the meeting time.';
  const equivalent = 'ill verify the meeting time';
  const firstPass = await openQuiz(browser, reference);
  try {
    await enterAnswerAndCheck(firstPass.page, equivalent);
    await expectCorrect(firstPass.page);
    await expect(firstPass.page.locator('#diffPanel')).toBeHidden();
    await expect(firstPass.page.locator('#markCorrectBtn')).toBeHidden();
  } finally { await firstPass.context.close(); }

  const retest = await openApp(browser, reference);
  try {
    await retest.page.locator('#startBtn').click();
    await enterAnswerAndCheck(retest.page, 'We will decide this later.');
    await expect(retest.page.locator('#diffPanel')).toBeVisible();
    await retest.page.locator('#nextBtn').click();
    await expect(retest.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await enterAnswerAndCheck(retest.page, equivalent);
    await expect(retest.page.locator('#diffMessage')).toContainText('실루엣 단계 정답');
    await expect(retest.page.locator('#diffYour')).toBeHidden();
    await expect(retest.page.locator('#markCorrectBtn')).toBeHidden();
    await retest.page.locator('#nextBtn').click();
    await expect(retest.page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await retest.page.waitForTimeout(320);
    await enterAnswerAndCheck(retest.page, equivalent);
    await expect(retest.page.locator('#diffMessage')).toContainText('2단계 자동 정답');
    await expect(retest.page.locator('#diffYour')).toBeHidden();
    await expect(retest.page.locator('#markCorrectBtn')).toBeHidden();
    await retest.page.locator('#nextBtn').click();
    await expect(retest.page.locator('#doneScreen')).toBeVisible();
    await assertHealthyBrowser(retest);
  } finally { await retest.context.close(); }
});

test('answer differences highlight only normalized grading mismatches in first test and both retest stages', async ({ browser }) => {
  const reference = 'the time was changed';
  const answer = 'The time has changed.';
  const firstPass = await openQuiz(browser, reference);
  try {
    await enterAnswerAndCheck(firstPass.page, answer);
    await expect(firstPass.page.locator('#diffPanel')).toBeVisible();
    await expect(firstPass.page.locator('#diffYour span')).toHaveText(['has']);
    await expect(firstPass.page.locator('#diffAns span')).toHaveText(['was']);
  } finally { await firstPass.context.close(); }

  const retest = await openApp(browser, reference);
  try {
    await retest.page.locator('#startBtn').click();
    await enterAnswerAndCheck(retest.page, answer);
    await expect(retest.page.locator('#diffPanel')).toBeVisible();
    await expect(retest.page.locator('#diffYour span')).toHaveText(['has']);
    await expect(retest.page.locator('#diffAns span')).toHaveText(['was']);
    await retest.page.locator('#nextBtn').click();
    await expect(retest.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await retest.page.waitForTimeout(320);

    await enterAnswerAndCheck(retest.page, answer);
    await expect(retest.page.locator('#diffPanel')).toBeVisible();
    await expect(retest.page.locator('#diffYour span')).toHaveText(['has']);
    await expect(retest.page.locator('#diffAns span')).toHaveText(['was']);
    await retest.page.locator('#nextBtn').click();
    await expect(retest.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await retest.page.waitForTimeout(320);
    await enterAnswerAndCheck(retest.page, reference);
    await expect(retest.page.locator('#diffMessage')).toContainText('실루엣 단계 정답');
    await retest.page.locator('#nextBtn').click();
    await retest.page.waitForTimeout(320);
    await expect(retest.page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');

    await enterAnswerAndCheck(retest.page, answer);
    await expect(retest.page.locator('#diffPanel')).toBeVisible();
    await expect(retest.page.locator('#diffYour span')).toHaveText(['has']);
    await expect(retest.page.locator('#diffAns span')).toHaveText(['was']);
    await assertHealthyBrowser(retest);
  } finally { await retest.context.close(); }
});

test('real settings UI exposes only the article option and result buttons settle one answer once', async ({ browser }) => {
  const inventory = await openApp(browser, "I'll reconnect.");
  try {
    await inventory.page.locator('#tabSettings').click();
    const optionNames = await inventory.page.locator('[data-grammar-option]').evaluateAll(nodes =>
      nodes.map(node => node.getAttribute('data-grammar-option')).sort()
    );
    expect(optionNames).toEqual(['article']);
    await expect(inventory.page.locator('[data-grammar-option="meaning"]')).toHaveCount(0);
    await expect(inventory.page.locator('#grammarErrorStats')).toContainText('어휘');
    await assertHealthyBrowser(inventory);
  } finally {
    await inventory.context.close();
  }

  const articleOn = await openQuiz(browser, 'I saw a bird.');
  try {
    await enterAnswerAndCheck(articleOn.page, 'I saw the bird.');
    await expect(articleOn.page.locator('#diffPanel')).toBeVisible();
  } finally { await articleOn.context.close(); }

  const articleOff = await openApp(browser, 'I saw a bird.');
  try {
    await articleOff.page.locator('#tabSettings').click();
    await articleOff.page.locator('[data-grammar-option="article"]').uncheck();
    await articleOff.page.locator('#tabQuiz').click();
    await articleOff.page.locator('#practiceBtn').click();
    await expect(articleOff.page.locator('#quizScreen')).toBeVisible();
    await enterAnswerAndCheck(articleOff.page, 'I saw the bird.');
    await expectCorrect(articleOff.page);
  } finally { await articleOff.context.close(); }

  const manual = await openApp(browser, 'I went home.', {}, 0, 4);
  try {
    await manual.page.locator('#startBtn').click();
    await expect(manual.page.locator('#quizScreen')).toBeVisible();
    await enterAnswerAndCheck(manual.page, 'I go home.');
    await expect(manual.page.locator('#diffPanel')).toBeVisible();
    await manual.page.locator('#markCorrectBtn').click();
    await expectCorrect(manual.page);
    await expect(manual.page.locator('#manualCorrectCount')).toHaveText('5');
    await manual.page.locator('#markCorrectBtn').evaluate(button => { button.click(); button.click(); });
    await expect(manual.page.locator('#progressCount')).toHaveText('1/1');
    const correctedCard = await manual.page.evaluate(() => JSON.parse(localStorage.getItem('srs_cards_v2')).cards[0]);
    expect(correctedCard).toMatchObject({ stage: 1, ngCount: 0, everAnswered: true });
    expect(JSON.parse(await manual.page.evaluate(() => localStorage.getItem('srs_settings_v1'))).manualCorrectTotal).toBe(5);
    expect(JSON.parse(await manual.page.evaluate(() => localStorage.getItem('srs_error_history_v1'))).records).toEqual([]);
    await assertHealthyBrowser(manual);
  } finally { await manual.context.close(); }

  const nextCard = await openApp(browser, 'I went home.', {}, 1);
  try {
    await nextCard.page.locator('#practiceBtn').click();
    await expect(nextCard.page.locator('#quizScreen')).toBeVisible();
    await enterAnswerAndCheck(nextCard.page, 'I go home.');
    await nextCard.page.locator('#markCorrectBtn').click();
    await expect(nextCard.page.locator('#progressCount')).toHaveText('1/2');
    await expect(nextCard.page.locator('#diffPanel')).toBeHidden();
    await nextCard.page.waitForTimeout(320);
    await enterAnswerAndCheck(nextCard.page, 'I go home.');
    await expect(nextCard.page.locator('#diffPanel')).toBeVisible();
    await expect(nextCard.page.locator('#manualCorrectCount')).toHaveText('1');
    await assertHealthyBrowser(nextCard);
  } finally { await nextCard.context.close(); }

  for (const [reference, answer] of [['I went home.', 'I go home.'], ['I can go.', 'I could go.'], ['I saw the child.', 'I saw the children.'], ['I went to school.', 'I went in school.']]) {
    const enabled = await openQuiz(browser, reference);
    try {
      await enterAnswerAndCheck(enabled.page, answer);
      await expect(enabled.page.locator('#diffPanel')).toBeVisible();
      await assertHealthyBrowser(enabled);
    } finally {
      await enabled.context.close();
    }
  }
});

test('local app documents its assets without contacting sync or grading Workers', async ({ browser }) => {
  const testApp = await openQuiz(browser, "I'll reconnect.");
  try {
    const loaded = await testApp.page.evaluate(() => ({
      title: document.title,
      appScript: Array.from(document.scripts).some(script => script.src.endsWith('/app.js')),
      stylesheets: document.styleSheets.length,
      background: getComputedStyle(document.body).backgroundColor
    }));
    expect(loaded.title).toBe('Memory');
    expect(loaded.appScript).toBe(true);
    expect(loaded.stylesheets).toBeGreaterThan(0);
    expect(loaded.background).not.toBe('rgba(0, 0, 0, 0)');
    await assertHealthyBrowser(testApp);
  } finally {
    await testApp.context.close();
  }
});

test('two-stage retest repeats misses, returns to stage one after a stage-two error, and preserves data', async ({ browser }) => {
  const app = await openApp(browser, 'I went home.', {}, 0, 0);
  try {
    await app.page.locator('#startBtn').click();
    await enterAnswerAndCheck(app.page, 'I go home.');
    await app.page.locator('#nextBtn').click();
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    const beforeRetest = await app.page.evaluate(() => ({ cards: localStorage.getItem('srs_cards_v2'), errors: localStorage.getItem('srs_error_history_v1'), settings: localStorage.getItem('srs_settings_v1') }));

    await enterAnswerAndCheck(app.page, 'I go home.');
    await expect(app.page.locator('#skipRetestBtn')).toBeVisible();
    await app.page.locator('#nextBtn').click();
    await app.page.waitForTimeout(320);
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await enterAnswerAndCheck(app.page, 'I went home.');
    await expect(app.page.locator('#diffMessage')).toContainText('실루엣 단계 정답');
    await app.page.locator('#nextBtn').click();
    await app.page.waitForTimeout(320);
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await enterAnswerAndCheck(app.page, 'I go home.');
    await expect(app.page.locator('#skipRetestBtn')).toBeVisible();
    await app.page.locator('#nextBtn').click();
    await app.page.waitForTimeout(320);
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await enterAnswerAndCheck(app.page, 'I went home.');
    await app.page.locator('#nextBtn').click();
    await app.page.waitForTimeout(320);
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await enterAnswerAndCheck(app.page, 'I went home.');
    await app.page.locator('#nextBtn').click();
    await app.page.locator('#doneScreen').waitFor({ state: 'visible' });
    const afterRetest = await app.page.evaluate(() => ({ cards: localStorage.getItem('srs_cards_v2'), errors: localStorage.getItem('srs_error_history_v1'), settings: localStorage.getItem('srs_settings_v1') }));
    expect(afterRetest).toEqual(beforeRetest);
    await assertHealthyBrowser(app);
  } finally { await app.context.close(); }
});

test('retest skip removes stage-one and stage-two misses once and finishes after the last card', async ({ browser }) => {
  const app = await openApp(browser, 'I went home.', {}, [{ en: 'She ate lunch.' }], 0);
  try {
    await app.page.locator('#startBtn').click();
    await enterAnswerAndCheck(app.page, 'I go home.');
    await app.page.locator('#nextBtn').click();
    await app.page.waitForTimeout(320);
    await enterAnswerAndCheck(app.page, 'She has lunch.');
    await app.page.locator('#nextBtn').click();
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    const beforeRetest = await app.page.evaluate(() => ({ cards: localStorage.getItem('srs_cards_v2'), errors: localStorage.getItem('srs_error_history_v1'), settings: localStorage.getItem('srs_settings_v1') }));
    const manualCount = await app.page.locator('#manualCorrectCount').textContent();

    await expect(app.page.locator('#skipRetestBtn')).toBeHidden();
    await enterAnswerAndCheck(app.page, 'I go home.');
    await expect(app.page.locator('#skipRetestBtn')).toBeVisible();
    await expect(app.page.locator('#markCorrectBtn')).toBeHidden();
    await app.page.locator('#skipRetestBtn').evaluate(button => { button.click(); button.click(); });
    await app.page.keyboard.press('Enter');
    await app.page.waitForTimeout(380);
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await expect(app.page.locator('#hintText')).toHaveText('S__ a__ l____');

    await enterAnswerAndCheck(app.page, 'She is eating lunch.');
    await expect(app.page.locator('#skipRetestBtn')).toBeVisible();
    await app.page.locator('#nextBtn').click();
    await app.page.waitForTimeout(320);
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await enterAnswerAndCheck(app.page, 'She ate lunch.');
    await expect(app.page.locator('#diffMessage')).toContainText('실루엣 단계 정답');
    await app.page.locator('#nextBtn').click();
    await app.page.waitForTimeout(320);
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await enterAnswerAndCheck(app.page, 'She ate lunch yesterday.');
    await expect(app.page.locator('#skipRetestBtn')).toBeVisible();
    await expect(app.page.locator('#markCorrectBtn')).toBeHidden();
    await app.page.locator('#skipRetestBtn').click();
    await app.page.locator('#doneScreen').waitFor({ state: 'visible' });
    await expect(app.page.locator('#doneSummary')).toContainText('오답 재출제 완료');
    const afterRetest = await app.page.evaluate(() => ({ cards: localStorage.getItem('srs_cards_v2'), errors: localStorage.getItem('srs_error_history_v1'), settings: localStorage.getItem('srs_settings_v1') }));
    expect(afterRetest).toEqual(beforeRetest);
    await expect(app.page.locator('#manualCorrectCount')).toHaveText(manualCount);
    await assertHealthyBrowser(app);
  } finally { await app.context.close(); }
});

test('retest uses contraction normalization and the saved article option', async ({ browser }) => {
  const app = await openApp(browser, "She's finished a report.", { article: false });
  try {
    await app.page.locator('#startBtn').click();
    await enterAnswerAndCheck(app.page, 'She has not finished it.');
    await app.page.locator('#nextBtn').click();
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await expect(app.page.locator('#hintText')).toHaveText('S___ f_______ a r_____');
    await app.page.waitForTimeout(320);
    await enterAnswerAndCheck(app.page, 'sHE HAS finished the REPORT!!!');
    await expect(app.page.locator('#diffPanel')).toBeVisible();
    await expect(app.page.locator('#diffMessage')).toContainText('실루엣 단계 정답');
    await app.page.locator('#nextBtn').click();
    await app.page.waitForTimeout(320);
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
    await expect(app.page.locator('#hintText')).toBeHidden();
    await enterAnswerAndCheck(app.page, 'sHE HAS finished the REPORT!!!');
    await expect(app.page.locator('#diffPanel')).toBeVisible();
    await app.page.locator('#nextBtn').click();
    await expect(app.page.locator('#doneScreen')).toBeVisible();
    const history = await app.page.evaluate(() => JSON.parse(localStorage.getItem('srs_error_history_v1')).records);
    expect(history).toHaveLength(1);
    await assertHealthyBrowser(app);
  } finally { await app.context.close(); }
});

test('retest uses the same strict article ON rule as the first test', async ({ browser }) => {
  const app = await openApp(browser, 'I saw a bird.', { article: true });
  try {
    await app.page.locator('#startBtn').click();
    await enterAnswerAndCheck(app.page, 'I saw a cat.');
    await app.page.locator('#nextBtn').click();
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await app.page.waitForTimeout(320);
    await enterAnswerAndCheck(app.page, 'I saw the bird.');
    await expect(app.page.locator('#diffPanel')).toBeVisible();
    await expect(app.page.locator('#markCorrectBtn')).toBeHidden();
    await expect(app.page.locator('#skipRetestBtn')).toBeVisible();
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    await app.page.locator('#nextBtn').click();
    await app.page.waitForTimeout(320);
    await enterAnswerAndCheck(app.page, 'I saw a bird.');
    await expect(app.page.locator('#diffMessage')).toContainText('실루엣 단계 정답');
    await app.page.locator('#nextBtn').click();
    await app.page.waitForTimeout(320);
    await enterAnswerAndCheck(app.page, 'I saw a bird.');
    await expect(app.page.locator('#diffMessage')).toContainText('2단계 자동 정답');
    await app.page.locator('#nextBtn').click();
    await expect(app.page.locator('#doneScreen')).toBeVisible();
    await assertHealthyBrowser(app);
  } finally { await app.context.close(); }
});

test('retest removes manual-correct and only offers skip on submitted wrong results', async ({ browser }) => {
  const app = await openApp(browser, 'I went home.', {}, 0, 6);
  try {
    await app.page.locator('#startBtn').click();
    await enterAnswerAndCheck(app.page, 'I go home.');
    await app.page.locator('#nextBtn').click();
    await expect(app.page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
    const beforeRetest = await app.page.evaluate(() => ({ cards: localStorage.getItem('srs_cards_v2'), errors: localStorage.getItem('srs_error_history_v1'), settings: localStorage.getItem('srs_settings_v1') }));
    await enterAnswerAndCheck(app.page, 'I go home.');
    await expect(app.page.locator('#diffPanel')).toBeVisible();
    await expect(app.page.locator('#skipRetestBtn')).toBeVisible();
    await expect(app.page.locator('#markCorrectBtn')).toBeHidden();
    await expect(app.page.locator('#diffYour')).toContainText('내 답변');
    await expect(app.page.locator('#diffAns')).toContainText('모범 답안');
    await app.page.locator('#skipRetestBtn').click();
    await expect(app.page.locator('#doneScreen')).toBeVisible();
    const afterRetest = await app.page.evaluate(() => ({ cards: localStorage.getItem('srs_cards_v2'), errors: localStorage.getItem('srs_error_history_v1'), settings: localStorage.getItem('srs_settings_v1') }));
    expect(afterRetest).toEqual(beforeRetest);
    await expect(app.page.locator('#manualCorrectCount')).toHaveText('6');
    await assertHealthyBrowser(app);
  } finally { await app.context.close(); }
});

test('wrong-count reset confirms, cancels safely, saves only ngCount, and preserves other data', async ({ browser }) => {
  const originalHistory = { version: 1, records: [{ cardId: TEST_CARD_ID, count: 3, occurrences: [{ reason: 'kept' }] }] };
  const app = await openApp(browser, 'I went home.', {}, 1, 9, {
    cardOverrides: [{ ngCount: 4, stage: 2, dueAt: Date.now() + 86400000, lastTestedAt: 1234 }, { ngCount: 2, stage: 1, dueAt: Date.now() + 40000000 }],
    errorHistory: originalHistory,
    settings: { correctTotal: 11 }
  });
  try {
    await app.page.locator('#tabSettings').click();
    const before = await app.page.evaluate(() => ({ cards: localStorage.getItem('srs_cards_v2'), errors: localStorage.getItem('srs_error_history_v1'), settings: localStorage.getItem('srs_settings_v1') }));
    app.page.once('dialog', dialog => dialog.dismiss());
    await app.page.locator('#resetNgCountsBtn').click();
    expect(await app.page.evaluate(() => ({ cards: localStorage.getItem('srs_cards_v2'), errors: localStorage.getItem('srs_error_history_v1'), settings: localStorage.getItem('srs_settings_v1') }))).toEqual(before);
    app.page.once('dialog', dialog => {
      expect(dialog.message()).toContain('오답 누적 횟수');
      expect(dialog.message()).toContain('SRS 단계');
      dialog.accept();
    });
    await app.page.locator('#resetNgCountsBtn').click();
    await expect(app.page.locator('#resetNgCountsFeedback')).toContainText('2개 카드의 오답 누적 횟수를 초기화');
    const saved = await app.page.evaluate(() => ({ cards: JSON.parse(localStorage.getItem('srs_cards_v2')), errors: JSON.parse(localStorage.getItem('srs_error_history_v1')), settings: JSON.parse(localStorage.getItem('srs_settings_v1')) }));
    expect(saved.cards.cards.map(card => card.ngCount)).toEqual([0, 0]);
    expect(saved.cards.cards.map(card => [card.stage, card.dueAt, card.lastTestedAt])).toEqual([[2, expect.any(Number), 1234], [1, expect.any(Number), 1234]]);
    expect(saved.errors).toEqual(originalHistory);
    expect(saved.settings).toMatchObject({ correctTotal: 11, manualCorrectTotal: 9 });
    await app.page.reload();
    expect(await app.page.evaluate(() => JSON.parse(localStorage.getItem('srs_cards_v2')).cards.map(card => card.ngCount))).toEqual([0, 0]);
    await assertHealthyBrowser(app);
  } finally { await app.context.close(); }
});

test('manual-correct statistic heading stays on one line on desktop and mobile', async ({ browser }) => {
  const app = await openApp(browser, 'I went home.');
  try {
    await app.page.locator('#startBtn').click();
    for (const width of [320, 390, 1280]) {
      await app.page.setViewportSize({ width, height: 850 });
      const heading = app.page.locator('#manualCorrectStat .lbl');
      await expect(heading).toHaveText('수동판정정답');
      const metrics = await heading.evaluate(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        return { height: node.getBoundingClientRect().height, lines: range.getClientRects().length, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
      });
      expect(metrics.lines).toBe(1);
      expect(metrics.height).toBeLessThanOrEqual(16);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      await expect(app.page.locator('#manualCorrectCount')).toBeVisible();
    }
    await assertHealthyBrowser(app);
  } finally { await app.context.close(); }
});

for (const mobile of [false, true]) {
  test(`test inspection and editing preserves submissions and retest order (${mobile ? 'mobile' : 'desktop'})`, async ({ browser }) => {
    const app = await openApp(browser, 'First answer.', {}, [
      { ko: '미출제 한국어 둘', en: 'Second secret.' },
      { ko: '미출제 한국어 셋', en: 'Third secret.' }
    ], 0, { contextOptions: mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {} });
    const { page } = app;
    const submit = async answer => {
      await page.waitForTimeout(320);
      await enterAnswerAndCheck(page, answer);
    };
    const stored = () => page.evaluate(() => ({
      cards: JSON.parse(localStorage.getItem('srs_cards_v2')),
      errors: localStorage.getItem('srs_error_history_v1')
    }));
    try {
      await page.locator('#startBtn').click();
      await expect(page.locator('#koreanText')).toHaveText('브라우저 회귀 검사');
      await page.locator('#failAllBtn').click();
      await expect(page.locator('#testStatusContent')).toContainText('아직 답안을 제출한 문제가 없어요');
      await expect(page.locator('#testStatusContent')).not.toContainText('First answer.');
      await expect(page.locator('#testStatusContent')).not.toContainText('미출제');
      await page.locator('#testStatusClose').click();
      await expect(page.locator('#tabAllCards')).toBeDisabled();
      await expect(page.locator('#allCardsList')).not.toContainText('Second secret.');
      await expect(page.locator('#allCardsList')).not.toContainText('미출제');
      await page.locator('#answerInput').fill('my draft');
      await page.locator('#editCurrentBtn').click();
      await expect(page.locator('#editCardList input')).toHaveCount(2);
      await page.locator('#editCardList input[data-field="en"]').fill('discarded');
      await page.locator('#editCardList input[data-field="en"]').press('Enter');
      await expect(page.locator('#diffPanel')).not.toBeVisible();
      await page.locator('#editCancelBtn').click();
      await expect(page.locator('#answerInput')).toHaveValue('my draft');
      await page.locator('#editCurrentBtn').click();
      await page.locator('#editCardList input[data-field="ko"]').fill('현재 문제 수정');
      await page.locator('#editSaveBtn').click();
      await page.locator('#editConfirmApply').click();
      await expect(page.locator('#koreanText')).toHaveText('현재 문제 수정');
      await expect(page.locator('#answerInput')).toHaveValue('my draft');
      await submit('Wrong.');
      await expect(page.locator('#diffPanel')).toBeVisible();
      const before = await stored();
      const result = await page.locator('#diffPanel').innerText();
      await page.locator('#failAllBtn').click();
      await expect(page.locator('#testStatusContent')).toContainText('First answer.');
      await expect(page.locator('#testStatusContent')).not.toContainText('Second secret.');
      await page.locator('#testStatusContent').getByRole('button', { name: '편집', exact: true }).click();
      await page.locator('#editCardList input[data-field="ko"]').fill('제출 문제 수정');
      await page.locator('#editSaveBtn').click();
      await page.locator('#editConfirmCancel').click();
      expect(await stored()).toEqual(before);
      expect(await page.locator('#diffPanel').innerText()).toEqual(result);
      await expect(page.locator('#answerInput')).toHaveValue('Wrong.');
      await page.locator('#nextBtn').click();
      await expect(page.locator('#koreanText')).toHaveText('미출제 한국어 둘');
      await submit('Wrong.');
      await page.locator('#nextBtn').click();
      await expect(page.locator('#koreanText')).toHaveText('미출제 한국어 셋');
      await submit('Third secret.');
      await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
      await expect(page.locator('#koreanText')).toHaveText('현재 문제 수정');
      const retestState = await stored();
      await page.locator('#failAllBtn').click();
      await expect(page.locator('#testStatusContent')).toContainText('제출한 문제 3개');
      await page.locator('#testStatusContent').getByRole('button', { name: '편집', exact: true }).nth(1).click();
      await page.locator('#editCardList input[data-field="en"]').fill('Second revised.');
      await page.locator('#editSaveBtn').click();
      await page.locator('#editConfirmApply').click();
      await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
      await expect(page.locator('#koreanText')).toHaveText('현재 문제 수정');
      const afterEdit = await stored();
      expect(afterEdit.errors).toEqual(retestState.errors);
      const schedules = data => data.cards.cards.map(({ ko, en, ...rest }) => rest);
      expect(schedules(afterEdit)).toEqual(schedules(retestState));
      await submit('First answer.');
      await page.locator('#nextBtn').click();
      await expect(page.locator('#koreanText')).toHaveText('미출제 한국어 둘');
      await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
      await submit('Second revised.');
      await page.locator('#nextBtn').click();
      await expect(page.locator('#koreanText')).toHaveText('현재 문제 수정');
      await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 2단계');
      await assertHealthyBrowser(app);
    } finally { await app.context.close(); }
  });
}

for (const mobile of [false, true]) {
  test(`editing a submitted answer preserves its original grading reference (${mobile ? 'mobile' : 'desktop'})`, async ({ browser }) => {
    const app = await openApp(browser, 'Original answer.', {}, 0, 0, {
      contextOptions: mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}
    });
    const { page } = app;
    try {
      await page.locator('#startBtn').click();
      await enterAnswerAndCheck(page, 'Wrong.');
      const originalResult = await page.locator('#diffPanel').innerText();
      await page.locator('#editCurrentBtn').click();
      await page.locator('#editCardList input[data-field="en"]').fill('Revised answer.');
      await page.locator('#editSaveBtn').click();
      await page.locator('#editConfirmApply').click();
      expect(await page.locator('#diffPanel').innerText()).toEqual(originalResult);
      await expect(page.locator('#answerInput')).toHaveValue('Wrong.');
      await page.locator('#nextBtn').click();
      await expect(page.locator('#boxBadge')).toHaveText('오답 재출제 · 1단계');
      const saved = await page.evaluate(() => ({
        errors: JSON.parse(localStorage.getItem('srs_error_history_v1')).records,
        card: JSON.parse(localStorage.getItem('srs_cards_v2')).cards[0]
      }));
      expect(saved.errors.length).toBeGreaterThan(0);
      for (const record of saved.errors) {
        expect(record.referenceAnswer).toBe('Original answer.');
        expect(record.occurrences[0].referenceAnswer).toBe('Original answer.');
        expect(record.actualAnswer).toBe('Wrong.');
      }
      expect(saved.card.en).toBe('Revised answer.');
      expect(saved.card.ngCount).toBe(1);
      await page.waitForTimeout(320);
      await enterAnswerAndCheck(page, 'Revised answer.');
      await expect(page.locator('#diffMessage')).toContainText('실루엣 단계 정답');
      await assertHealthyBrowser(app);
    } finally { await app.context.close(); }
  });
}
