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
assert.match(app, /function confirmWrongAnswer\(\)[\s\S]*recordAnswerErrors\(card\.id,card\.en,decision\.y,decision\.result\.errors\)/);
assert.match(app, /on\('nextBtn','click',handleResultNext\)/);
assert.match(app, /if\(\$\('nextBtn'\)\.style\.display==='block'\)\{e\.preventDefault\(\);handleResultNext\(\);return;\}/);
assert.match(app, /retestUnresolvedIds=retestUnresolvedIds\.filter/);
assert.match(app, /retestQueue\.push\(retestCard\.id\)/);
assert.match(source('skipRetestCard'), /retestUnresolvedIds=retestUnresolvedIds\.filter[\s\S]*retestQueue=retestQueue\.filter[\s\S]*delete retestStages\[cardId\]/);
assert.match(app, /on\('skipRetestBtn','click',skipRetestCard\)/);
assert.match(app, /currentIsRetest\?'none':'block'.*skipRetestBtn/);
assert.match(app, /currentIsRetest\|\|!current\|\|!pendingDiff\|\|answerSettled/);
assert.match(app, /on\('resetNgCountsBtn','click'/);
assert.match(app, /var current=null[\s\S]*answerSettled=false/);
assert.doesNotMatch(app, /skipFailBtn|markWrongBtn/);
console.log('Passed answer normalization, article-only option, and manual grading regression checks.');
