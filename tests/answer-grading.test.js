const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function source(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `function ${name} exists`);
  const open = app.indexOf('{', start); let depth = 0;
  for (let i = open; i < app.length; i++) {
    if (app[i] === '{') depth++;
    else if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  assert.fail(`function ${name} closes`);
}
const context = { GRAMMAR_OPTION_DEFAULTS: { article: true }, ARTICLE_WORDS: { a: 1, an: 1, the: 1 } };
context.esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
vm.createContext(context);
vm.runInContext([source('expandContractions'), source('answerTokens'), source('answerTokensWithoutContractionExpansion'), source('articleFiltered'), source('deterministicGrade'), source('normalizeGrammarOptions'), source('diffTokenRecords'), source('alignDiffTokens'), source('renderDiffText'), source('diffHL'), source('buildAnswerSilhouette'), source('zeroNgCounts')].join('\n'), context);
const normalize = s => context.answerTokens(s).join(' ');
const equivalent = [
  ["I'm ready!", 'I am ready.'], ["don't", 'do not'], ["won't", 'will not'],
  ["I'm ready", 'I’m ready'], ["don't stop", 'don’t stop'], ["I'll go", 'I’ll go'],
  ["Let’s review today’s agenda first.", "let's review today's agenda first"],
  ["he's ready", 'he is ready'], ["he's finished", 'he has finished'], ["he's finished", 'he is finished'],
  ["he's tired", 'he is tired'], ["she's here", 'she is here'], ["she's gone", 'she has gone'],
  ["I'd go", 'I would go'], ["I'd gone", 'I had gone'],
  ["you'd leave", 'you would leave'], ["you'd seen", 'you had seen'],
  ["he'd call", 'he would call'], ["he'd called", 'he had called'],
  ["she'd stay", 'she would stay'], ["she'd stayed", 'she had stayed'],
  ["we're ready", 'we are ready'], ["they've arrived", 'they have arrived'],
  ["it'll work", 'it will work'], ["let's go", 'let us go']
];
for (const [a, b] of equivalent) assert.equal(normalize(a), normalize(b), `${a} ↔ ${b}`);
for (const [a, b] of [["he's ready", "he's finished"], ["I'd gone", 'I would go']]) assert.notEqual(normalize(a), normalize(b));
assert.equal(context.deterministicGrade('Let’s review today’s agenda first.', "let's review today's agenda first", { article: true }).pass, true);
assert.equal(context.deterministicGrade('I’ll verify the meeting time.', 'ill verify the meeting time', { article: true }).pass, true);
const normalizedDiff = context.diffHL('The time has changed.', 'the time was changed', { article: true });
assert.deepEqual(Array.from(normalizedDiff.y.matchAll(/<span[^>]*>(.*?)<\/span>/g), match => match[1]), ['has']);
assert.deepEqual(Array.from(normalizedDiff.a.matchAll(/<span[^>]*>(.*?)<\/span>/g), match => match[1]), ['was']);
assert.equal(context.diffHL('Lets do it?', "let's do it.", { article: true }).y.includes('<span'), false, 'ignored apostrophe/punctuation difference is not highlighted');
const articleOffDiff = context.diffHL('I saw bird cat.', 'I saw a bird dog.', { article: false });
assert.deepEqual(Array.from(articleOffDiff.y.matchAll(/<span[^>]*>(.*?)<\/span>/g), match => match[1]), ['cat']);
assert.deepEqual(Array.from(articleOffDiff.a.matchAll(/<span[^>]*>(.*?)<\/span>/g), match => match[1]), ['dog']);
const contractionDiff = context.diffHL("I'll verify the time tomorrow.", 'I will verify the date tomorrow.', { article: true });
assert.deepEqual(Array.from(contractionDiff.y.matchAll(/<span[^>]*>(.*?)<\/span>/g), match => match[1]), ['time']);
assert.deepEqual(Array.from(contractionDiff.a.matchAll(/<span[^>]*>(.*?)<\/span>/g), match => match[1]), ['date']);
assert.notEqual(normalize('red-blue'), normalize('redblue'), 'punctuation between words must not merge tokens');
assert.equal(context.deterministicGrade('I saw a bird.', 'I saw the bird.', { article: true }).pass, false);
assert.equal(context.deterministicGrade('I saw a bird.', 'I saw the bird.', { article: false }).pass, true);
for (const [a, b] of [['I went home.', 'I go home.'], ['She taught me.', 'She teached me.'], ['I can go.', 'I could go.'], ['They saw children.', 'They saw child.'], ['I went to school.', 'I went in school.'], ['She bought it.', 'She purchased it.']]) {
  assert.equal(context.deterministicGrade(a, b, {}).pass, false, `${a} / ${b} requires manual decision`);
}
assert.deepEqual(Object.keys(context.normalizeGrammarOptions({tense:false, number:false, modal:false, article:false, preposition:false})), ['article']);
assert.equal(context.buildAnswerSilhouette('Could you speak a little more slowly?'), 'C____ y__ s____ a l_____ m___ s_____');
assert.equal(context.buildAnswerSilhouette('I went to the office yesterday.'), 'I w___ t_ t__ o_____ y________');
assert.equal(context.buildAnswerSilhouette("She's already finished her work."), 'S___ a______ f_______ h__ w___');
assert.equal(context.buildAnswerSilhouette('A I!'), 'A I');
const resetCards = [{ ngCount: 4, stage: 2, dueAt: 123, lastTestedAt: 456 }, { ngCount: 0, stage: 1, dueAt: 789 }, { stage: 3, dueAt: 999 }];
assert.equal(context.zeroNgCounts(resetCards), 1);
assert.deepEqual(JSON.parse(JSON.stringify(resetCards)), [{ ngCount: 0, stage: 2, dueAt: 123, lastTestedAt: 456 }, { ngCount: 0, stage: 1, dueAt: 789 }, { stage: 3, dueAt: 999 }]);
assert.match(app, /on\('markCorrectBtn','click',function\(\).*finalizeCorrect\(true\)/);
assert.match(app, /manualCorrectCount/);
assert.doesNotMatch(app, /recheckIrregularGrammar|SECOND_PASS_IRREGULAR|verifiedAiIrregularPair/);
assert.match(app, /if\(result\.pass\)\{finalizeCorrect\(\);return;\}\s*showDiff\(raw,reference\)/);
assert.match(source('checkAnswer'), /deterministicGrade\(reference,raw,options\)/);
assert.doesNotMatch(source('checkAnswer'), /currentIsRetest|retestMode/);
assert.match(app, /retestPendingAction=currentRetestStage===1\?'promote':'complete'/);
assert.match(app, /manual\s*\?\s*\(currentRetestStage===1\?'정답으로 변경했습니다\. 다음에는 힌트 없이 다시 답해 주세요\.'[^\n]*'정답으로 변경했습니다\. 이 문제를 통과했습니다\.'/);
assert.doesNotMatch(source('finalizeCorrect'), /manual\?'retry'/);
assert.match(app, /currentRetestStage===2\)retestStages\[retestCard\.id\]=1/);
assert.match(app, /retestPendingAction==='complete'[\s\S]*retestUnresolvedIds=retestUnresolvedIds\.filter/);
assert.match(app, /on\('markCorrectBtn','click',function\(\)\{if\(!current\|\|currentIsRetest\|\|!pendingDiff\|\|answerSettled\)return;finalizeCorrect\(true\);\}\)/);
assert.match(app, /function confirmWrongAnswer\(\)[\s\S]*recordAnswerErrors\(card\.id,decision\.a,decision\.y,decision\.result\.errors\)/);
assert.match(app, /on\('nextBtn','click',handleResultNext\)/);
assert.match(app, /if\(\$\('nextBtn'\)\.style\.display==='block'\)\{e\.preventDefault\(\);handleResultNext\(\);return;\}/);
assert.match(app, /retestUnresolvedIds=retestUnresolvedIds\.filter/);
assert.match(app, /retestQueue\.push\(retestCard\.id\)/);

assert.match(app, /on\('skipRetestBtn','click',skipRetestCard\)/);
assert.match(app, /currentIsRetest\?'none':'block'.*skipRetestBtn/);
assert.match(app, /currentIsRetest\|\|!current\|\|!pendingDiff\|\|answerSettled/);
assert.match(app, /on\('resetNgCountsBtn','click'/);
assert.match(app, /var current=null[\s\S]*answerSettled=false/);
assert.doesNotMatch(app, /skipFailBtn|markWrongBtn/);
console.log('Passed answer normalization, article-only option, and manual grading regression checks.');

// Exercise inspection and editor entry points without a browser/server.
{
  class Element {
    constructor() { this.children = []; this.style = {}; this.dataset = {}; this.classList = { add() {}, remove() {} }; }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html || ''; }
    appendChild(child) { this.children.push(child); }
    addEventListener() {}
  }
  const elements = Object.create(null);
  const getElement = id => elements[id] || (elements[id] = new Element());
  getElement('quizScreen').style.display = 'block';
  const fixtureCards = [
    { id: 1, ko: '제출한 문장', en: 'Submitted answer.' },
    { id: 2, ko: '현재 문장', en: 'Current answer.' },
    { id: 3, ko: '노출 금지 문장', en: 'Unseen secret.' },
    { id: 4, ko: '다른 테스트 문장', en: 'Other session secret.' }
  ];
  const sandbox = {
    $: getElement, document: { createElement: () => new Element() },
    sessionSubmittedIds: [], sessionCompletedIds: [], sessionMissedIds: [], sessionSkippedIds: [],
    current: fixtureCards[1], notes: {}, editingSnapshots: [],
    findCard: id => fixtureCards.find(card => card.id === id), esc: context.esc
  };
  vm.createContext(sandbox);
  vm.runInContext(['quizIsActive', 'canInspectCard', 'renderTestStatusModal', 'openEditModal'].map(source).join('\n'), sandbox);
  const flatten = node => [node.innerHTML, node.textContent, node.value, ...node.children.map(flatten)].filter(Boolean).join(' ');
  sandbox.renderTestStatusModal();
  assert.match(flatten(getElement('testStatusContent')), /아직 답안을 제출한 문제가 없어요/);
  sandbox.sessionSubmittedIds.push(1);
  sandbox.renderTestStatusModal();
  let list = flatten(getElement('testStatusContent'));
  assert.match(list, /Submitted answer/);
  assert.doesNotMatch(list, /Current answer|Unseen secret|Other session secret|현재 문장|노출 금지/);
  assert.match(list, /채점 확인 중/);
  sandbox.openEditModal([1, 2, 3, 4]);
  assert.deepEqual(Array.from(sandbox.editingSnapshots, item => item.id), [1, 2]);
  assert.doesNotMatch(flatten(getElement('editCardList')), /Unseen secret|Other session secret/);
  // Retests retain the original submission allowlist, even for cards outside the queue.
  sandbox.sessionSubmittedIds.push(2, 3);
  sandbox.sessionCompletedIds.push(1, 2, 3);
  sandbox.current = fixtureCards[0];
  sandbox.renderTestStatusModal();
  list = flatten(getElement('testStatusContent'));
  assert.match(list, /Submitted answer/);
  assert.match(list, /Unseen secret/);
  assert.doesNotMatch(list, /Other session secret/);
  sandbox.openEditModal([3, 4]);
  assert.deepEqual(Array.from(sandbox.editingSnapshots, item => item.id), [3]);
  getElement('quizScreen').style.display = 'none';
  assert.equal(sandbox.canInspectCard(4), true, 'normal browsing resumes after the test');
}
console.log('Passed submitted-only inspection, current-card editing, and retest access checks.');

// Checkpoint choice and journal recovery must be idempotent and preserve conflicts.
{
  const makeStorage = () => {
    const values = new Map();
    return { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)) };
  };
  const localStorage = makeStorage(), sessionStorage = makeStorage();
  const events = [];
  const sandbox = { localStorage, sessionStorage, STUDY_KEY: 'session', CARDS_KEY: 'cards', SETTINGS_KEY: 'settings', ERROR_HISTORY_KEY: 'errors',
    studyDiagnostic: event => events.push(event), studyWrites: {}, studyTransaction: true, studyRestoring: false };
  vm.createContext(sandbox);
  vm.runInContext(['readStudyCheckpoint','studyWriteData','replayStudyWrites'].map(source).join('\n'), sandbox);
  localStorage.setItem('session', JSON.stringify({version:1,revision:100,status:'active'}));
  sessionStorage.setItem('session', JSON.stringify({version:1,revision:101,status:'ended'}));
  assert.equal(sandbox.readStudyCheckpoint().status, 'ended', 'a newer exit tombstone prevents stale session resurrection');
  sessionStorage.setItem('session', 'broken JSON');
  assert.equal(sandbox.readStudyCheckpoint().revision, 100, 'a corrupt fallback does not hide the durable checkpoint');
  localStorage.setItem('cards','before');
  sandbox.studyWriteData('cards','grade 1');sandbox.studyWriteData('cards','grade 2');
  assert.equal(localStorage.getItem('cards'),'before','grading data is not written before its session journal');
  assert.equal(sandbox.studyWrites.cards.before,'before');
  assert.equal(sandbox.studyWrites.cards.after,'grade 2');
  const journal=JSON.parse(JSON.stringify({writes:sandbox.studyWrites}));
  const crashCopy=JSON.parse(JSON.stringify(journal));
  sandbox.replayStudyWrites(journal);
  assert.equal(localStorage.getItem('cards'),'grade 2');
  sandbox.replayStudyWrites(crashCopy);
  assert.equal(localStorage.getItem('cards'),'grade 2','replaying an applied journal does not apply grading again');
  localStorage.setItem('cards','newer data from another action');
  sandbox.replayStudyWrites({writes:{cards:{before:'before',after:'grade 2'}}});
  assert.equal(localStorage.getItem('cards'),'newer data from another action','a conflicting snapshot is preserved');
  assert.deepEqual(events,['recovery-write-conflict']);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..','sync-bootstrap.js'),'utf8').match(/var DATA_KEYS=([^;]+);/)[1], /memory_study/);
}
console.log('Passed local checkpoint selection, atomic grading journal, and conflict preservation checks.');

// A terminal skip removes every occurrence without changing grading history or other queue order.
{
  const sandbox = {
    retestAbandonedIds: [], sessionQueue: [1, 2, 1, 3], retryQueue: [1, 2, 1],
    retestCandidateIds: [1, 2, 3, 1], retestQueue: [2, 1, 3, 1], retestUnresolvedIds: [1, 2, 3],
    retestStages: { 1: 2, 2: 1, 3: 2 }, sessionMissedIds: [1, 2, 3], sessionCompletedIds: [1, 2, 3]
  };
  vm.createContext(sandbox);
  vm.runInContext([source('pruneAbandonedRetests'), source('abandonRetestId')].join('\n'), sandbox);
  sandbox.abandonRetestId(1);sandbox.abandonRetestId(1);
  assert.deepEqual(Array.from(sandbox.retestAbandonedIds), [1]);
  assert.deepEqual(Array.from(sandbox.sessionQueue), [2, 3]);
  assert.deepEqual(Array.from(sandbox.retryQueue), [2]);
  assert.deepEqual(Array.from(sandbox.retestCandidateIds), [2, 3]);
  assert.deepEqual(Array.from(sandbox.retestQueue), [2, 3]);
  assert.deepEqual(Array.from(sandbox.retestUnresolvedIds), [2, 3]);
  assert.equal(sandbox.retestStages[1], undefined);
  assert.deepEqual(Array.from(sandbox.sessionMissedIds), [1, 2, 3]);
  assert.deepEqual(Array.from(sandbox.sessionCompletedIds), [1, 2, 3]);
  for (const key of ['sessionQueue','retryQueue','retestCandidateIds','retestQueue','retestUnresolvedIds']) sandbox[key].unshift(1);
  sandbox.retestStages[1] = 1;
  sandbox.pruneAbandonedRetests();
  for (const key of ['sessionQueue','retryQueue','retestCandidateIds','retestQueue','retestUnresolvedIds']) assert.equal(sandbox[key].includes(1), false, key+' ignores stale abandoned entries');
  sandbox.abandonRetestId(2);sandbox.abandonRetestId(3);
  assert.deepEqual(Array.from(sandbox.retestQueue), []);
  assert.deepEqual(Array.from(sandbox.retestUnresolvedIds), []);
}
console.log('Passed terminal retest exclusion and stale queue pruning checks.');
