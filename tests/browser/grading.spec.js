const { test, expect } = require('@playwright/test');

const TEST_CARD_ID = 42001;
const BLOCKED_WORKERS = new Set([
  'toeic-cloud-sync.tsta32.workers.dev',
  'lively-wave-a149.tsta32.workers.dev'
]);

async function openApp(browser, reference, grammarOptions = {}) {
  const context = await browser.newContext();
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [], workerRequests: [] };
  await context.addInitScript(({ reference, grammarOptions, cardId }) => {
    localStorage.setItem('srs_chapters_v1', JSON.stringify({ chapters: [{ id: 42, name: 'Browser test' }], nextId: 43 }));
    localStorage.setItem('srs_cards_v2', JSON.stringify({
      cards: [{ id: cardId, ko: '브라우저 회귀 검사', en: reference, chapterId: 42, stage: 0,
        dueAt: Date.now() - 1000, bookmarked: false, everAnswered: false, ngCount: 0, lastTestedAt: 0 }],
      nextId: cardId + 1
    }));
    localStorage.setItem('srs_settings_v1', JSON.stringify({ grammarOptions }));
    localStorage.setItem('srs_error_history_v1', JSON.stringify({ version: 1, records: [] }));
    localStorage.removeItem('memory_sync_code_v1');
  }, { reference, grammarOptions, cardId: TEST_CARD_ID });

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

test('real UI ignores case and punctuation but rejects a meaning change and stores its error', async ({ browser }) => {
  const positive = await openQuiz(browser, "I'll reconnect.");
  try {
    await enterAnswerAndCheck(positive.page, 'i WILL reconnect!!!');
    await expectCorrect(positive.page);
    await assertHealthyBrowser(positive);
  } finally {
    await positive.context.close();
  }

  const negative = await openQuiz(browser, "I'll reconnect.");
  try {
    await enterAnswerAndCheck(negative.page, "I won't reconnect.");
    await expect(negative.page.locator('#footerHint')).toContainText('오답:');
    await expect(negative.page.locator('#footerHint')).toContainText('핵심 단어가 추가');
    const history = await negative.page.evaluate(() => JSON.parse(localStorage.getItem('srs_error_history_v1')));
    expect(history.records).toHaveLength(1);
    expect(history.records[0]).toMatchObject({ cardId: TEST_CARD_ID, errorType: 'vocabulary', actualAnswer: "I won't reconnect.", count: 1 });
    expect(history.records[0].occurrences[0].reason).toContain('핵심 단어가 추가');
    await assertHealthyBrowser(negative);
  } finally {
    await negative.context.close();
  }
});

test('real settings UI exposes only five grammar options and each option works ON/OFF', async ({ browser }) => {
  const inventory = await openApp(browser, "I'll reconnect.");
  try {
    await inventory.page.locator('#tabSettings').click();
    const optionNames = await inventory.page.locator('[data-grammar-option]').evaluateAll(nodes =>
      nodes.map(node => node.getAttribute('data-grammar-option')).sort()
    );
    expect(optionNames).toEqual(['article', 'modal', 'number', 'preposition', 'tense']);
    await expect(inventory.page.locator('[data-grammar-option="meaning"]')).toHaveCount(0);
    await expect(inventory.page.locator('#grammarErrorStats')).toContainText('의미·문맥');
    await assertHealthyBrowser(inventory);
  } finally {
    await inventory.context.close();
  }

  const cases = [
    ['I went home.', 'I go home.', 'tense', '시제'],
    ['I saw the child.', 'I saw the children.', 'number', '단수·복수 및 수 일치'],
    ['I can go.', 'I could go.', 'modal', '조동사'],
    ['I saw a bird.', 'I saw the bird.', 'article', '관사'],
    ['I went to school.', 'I went in school.', 'preposition', '전치사']
  ];
  for (const [reference, answer, option, label] of cases) {
    const enabled = await openQuiz(browser, reference);
    try {
      await enterAnswerAndCheck(enabled.page, answer);
      await expect(enabled.page.locator('#footerHint')).toContainText('오답:');
      await expect(enabled.page.locator('#footerHint')).toContainText(label);
      const history = await enabled.page.evaluate(() => JSON.parse(localStorage.getItem('srs_error_history_v1')));
      expect(history.records[0]).toMatchObject({ cardId: TEST_CARD_ID, errorType: option, count: 1 });
      await assertHealthyBrowser(enabled);
    } finally {
      await enabled.context.close();
    }

    const disabled = await openApp(browser, reference);
    try {
      await disabled.page.locator('#tabSettings').click();
      const checkbox = disabled.page.locator(`[data-grammar-option="${option}"]`);
      await expect(checkbox).toBeChecked();
      await checkbox.uncheck();
      await disabled.page.locator('#tabQuiz').click();
      await disabled.page.locator('#practiceBtn').click();
      await expect(disabled.page.locator('#quizScreen')).toBeVisible();
      await enterAnswerAndCheck(disabled.page, answer);
      await expectCorrect(disabled.page);
      expect(await disabled.page.evaluate(() => JSON.parse(localStorage.getItem('srs_error_history_v1')).records)).toEqual([]);
      await assertHealthyBrowser(disabled);
    } finally {
      await disabled.context.close();
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
