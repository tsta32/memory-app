const { test, expect } = require('@playwright/test');

const TEST_CARD_ID = 42001;
const BLOCKED_WORKERS = new Set([
  'toeic-cloud-sync.tsta32.workers.dev',
  'lively-wave-a149.tsta32.workers.dev'
]);

async function openApp(browser, reference, grammarOptions = {}, extraCards = 0, savedManualCount = 0) {
  const context = await browser.newContext();
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [], workerRequests: [] };
  await context.addInitScript(({ reference, grammarOptions, cardId, extraCards, savedManualCount }) => {
    const cards = [{ id: cardId, ko: '브라우저 회귀 검사', en: reference, chapterId: 42, stage: 0,
      dueAt: Date.now() - 1000, bookmarked: false, everAnswered: false, ngCount: 0, lastTestedAt: 0 }];
    for (let i = 0; i < extraCards; i++) cards.push({ ...cards[0], id: cardId + i + 1 });
    localStorage.setItem('srs_chapters_v1', JSON.stringify({ chapters: [{ id: 42, name: 'Browser test' }], nextId: 43 }));
    localStorage.setItem('srs_cards_v2', JSON.stringify({
      cards,
      nextId: cardId + extraCards + 1
    }));
    localStorage.setItem('srs_settings_v1', JSON.stringify({ grammarOptions, manualCorrectTotal: savedManualCount }));
    localStorage.setItem('srs_error_history_v1', JSON.stringify({ version: 1, records: [] }));
    localStorage.removeItem('memory_sync_code_v1');
  }, { reference, grammarOptions, cardId: TEST_CARD_ID, extraCards, savedManualCount });

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
  await page.goto('/');
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
    await enterAnswerAndCheck(negative.page, "I won't reconnect.");
    await expect(negative.page.locator('#diffPanel')).toBeVisible();
    await negative.page.locator('#answerInput').press('Enter');
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
    await expect(manual.page.locator('#manualCorrectCount')).toHaveText('수동판정정답 5');
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
    await enterAnswerAndCheck(nextCard.page, 'I go home.');
    await expect(nextCard.page.locator('#diffPanel')).toBeVisible();
    await expect(nextCard.page.locator('#manualCorrectCount')).toHaveText('수동판정정답 1');
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
