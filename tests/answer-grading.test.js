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
vm.createContext(context);
vm.runInContext([source('expandContractions'), source('answerTokens'), source('articleFiltered'), source('deterministicGrade'), source('normalizeGrammarOptions'), source('buildAnswerSilhouette'), source('zeroNgCounts')].join('\n'), context);
const normalize = s => context.answerTokens(s).join(' ');
const equivalent = [
  ["I'm ready!", 'I am ready.'], ["don't", 'do not'], ["won't", 'will not'],
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
assert.match(app, /function confirmWrongAnswer\(\)[\s\S]*recordAnswerErrors\(card\.id,card\.en,decision\.y,decision\.result\.errors\)/);
assert.match(app, /on\('nextBtn','click',handleResultNext\)/);
assert.match(app, /if\(\$\('nextBtn'\)\.style\.display==='block'\)\{e\.preventDefault\(\);handleResultNext\(\);return;\}/);
assert.match(app, /retestUnresolvedIds=retestUnresolvedIds\.filter/);
assert.match(app, /retestQueue\.push\(retestCard\.id\)/);
assert.match(app, /on\('resetNgCountsBtn','click'/);
assert.match(app, /var current=null[\s\S]*answerSettled=false/);
assert.doesNotMatch(app, /skipFailBtn|markWrongBtn/);
console.log('Passed answer normalization, article-only option, and manual grading regression checks.');
