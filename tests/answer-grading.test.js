const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function functionSource(name, from = 0) {
  const start = app.indexOf(`function ${name}(`, from);
  assert.notEqual(start, -1, `function ${name} must exist in app.js`);
  const open = app.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < app.length; i++) {
    if (app[i] === '{') depth++;
    else if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  assert.fail(`function ${name} must have a closing brace`);
}

const helpersStart = app.indexOf('function lev(');
const helpersEnd = app.indexOf('// A narrow second pass', helpersStart);
const pipelineEnd = app.indexOf('function diffHL(', helpersStart);
assert.notEqual(helpersStart, -1, 'grading helpers must exist in app.js');
assert.notEqual(helpersEnd, -1, 'grading helper boundary must exist in app.js');
assert.notEqual(pipelineEnd, -1, 'grading pipeline boundary must exist in app.js');
const gradingHelpers = app.slice(helpersStart, helpersEnd);
const pipelineStart = app.indexOf('var ARTICLE_WORDS=', helpersStart);
assert.notEqual(pipelineStart, -1, 'grading pipeline declarations must exist in app.js');
const gradingPipeline = app.slice(pipelineStart, pipelineEnd);
const expandContractions = functionSource('expandContractions');
const normalizeOptions = functionSource('normalizeGrammarOptions');
const checkAnswer = functionSource('checkAnswer');

function createHarness(reference, answer, options = {}, workerResponse = { content: [{ text: '' }] }) {
  const outcomes = [];
  const aiCalls = [];
  const harness = {
    GRAMMAR_OPTION_DEFAULTS: { tense: true, number: true, modal: true, article: true, preposition: true },
    GRAMMAR_OPTION_LABELS: {
      tense: '시제', number: '수', modal: '조동사', article: '관사', preposition: '전치사',
      spelling: '철자', meaning: '의미·문맥', vocabulary: '어휘'
    },
    current: { id: 7, en: reference },
    settings: { grammarOptions: options },
    workerResponse,
    aiCalls,
    trace: {},
    setTimeout,
    clearTimeout,
    elements: {
      answerInput: { value: answer, disabled: false },
      checkBtn: { disabled: false, textContent: '확인' }
    },
    outcomes,
    finalizeCorrect() { outcomes.push('correct'); },
    finishWrongAnswer(cardId, source, raw, result) { outcomes.push({ outcome: 'wrong', result }); },
    openAICompatRequest(maxTokens, messages, systemPrompt) {
      aiCalls.push({ maxTokens, messages, systemPrompt });
      return Promise.resolve({ json: () => Promise.resolve(workerResponse) });
    }
  };
  harness.$ = id => harness.elements[id];
  vm.runInNewContext(`${gradingHelpers}\n${gradingPipeline}\n${expandContractions}\n${normalizeOptions}\n${checkAnswer}`, harness);
  const copy = value => JSON.parse(JSON.stringify(value));
  const deterministicGrade = harness.deterministicGrade;
  harness.deterministicGrade = function(reference, response, grammarOptions) {
    const result = deterministicGrade(reference, response, grammarOptions);
    harness.trace.deterministic = { reference, answer: response, options: copy(grammarOptions), result: copy(result) };
    return result;
  };
  const parseResults = harness.extractIrregularResultsJson;
  harness.extractIrregularResultsJson = function(raw) {
    const parsed = parseResults(raw);
    harness.trace.parsing = { raw, parsed: copy(parsed) };
    return parsed;
  };
  const verifyPair = harness.verifiedAiIrregularPair;
  harness.verifiedAiIrregularPair = function(referenceWord, answerWord, type, lemma) {
    const valid = verifyPair(referenceWord, answerWord, type, lemma);
    harness.trace.validation = { reference: referenceWord, answer: answerWord, type, lemma, valid };
    return valid;
  };
  const recheck = harness.recheckIrregularGrammar;
  harness.recheckIrregularGrammar = function(reference, response, grammarOptions, initialResult) {
    return recheck(reference, response, grammarOptions, initialResult).then(refined => {
      harness.trace.postprocessing = { input: copy(initialResult), output: copy(refined) };
      return refined;
    });
  };
  const finishWrong = harness.finishWrongAnswer;
  harness.finishWrongAnswer = function(cardId, reference, response, result) {
    harness.trace.finalError = { cardId, reference, answer: response, result: copy(result) };
    finishWrong(cardId, reference, response, result);
  };
  return harness;
}

async function check(reference, answer, options = {}, workerResponse) {
  const harness = createHarness(reference, answer, options, workerResponse);
  harness.checkAnswer();
  await new Promise(resolve => setImmediate(resolve));
  return { outcome: harness.outcomes[0], aiCalls: harness.aiCalls, trace: harness.trace };
}

async function main() {
  const accepted = [
    ["I'll reconnect.", 'I will reconnect.'],
    ['I will reconnect.', "I'll reconnect."],
    ["I'm ready.", 'I am ready.'],
    ["It's ready.", 'It is ready.'],
    ["I've finished.", 'I have finished.'],
    ["I'd finished.", 'I had finished.'],
    ["I'd like to go.", 'I would like to go.'],
    ["We don't need it.", 'We do not need it.'],
    ["I can't attend.", 'I cannot attend.'],
    ["She doesn't know.", 'She does not know.'],
    ["They didn't call.", 'They did not call.'],
    ["It won't work.", 'It will not work.'],
    ["I won't reconnect.", 'I will not reconnect.'],
    ["He isn't here.", 'He is not here.'],
    ["We aren't late.", 'We are not late.'],
    ["She wasn't ready.", 'She was not ready.'],
    ["They weren't invited.", 'They were not invited.'],
    ["They're waiting.", 'They are waiting.'],
    ["We're leaving.", 'We are leaving.'],
    ["You're welcome.", 'You are welcome.'],
    ["That's correct.", 'That is correct.'],
    ["There's a problem.", 'There is a problem.']
  ];

  for (const [reference, answer] of accepted) {
    const forward = await check(reference, answer);
    assert.equal(forward.outcome, 'correct', `${reference} ↔ ${answer}`);
    assert.equal(forward.aiCalls.length, 0, `${reference} ↔ ${answer} should not need AI`);
    const reverse = await check(answer, reference);
    assert.equal(reverse.outcome, 'correct', `${answer} ↔ ${reference}`);
    assert.equal(reverse.aiCalls.length, 0, `${answer} ↔ ${reference} should not need AI`);
  }

  const rejected = [
    ["I'd finished.", "I'd like to go."],
    ["I'd finished.", 'I would finish.'],
    ["It's ready.", "It's finished."],
    ["It's ready.", 'It has ready.'],
    ['I will reconnect.', 'I can reconnect.'],
    ['She does not know.', 'She did not know.']
  ];
  for (const [reference, answer] of rejected) {
    const result = await check(reference, answer);
    assert.equal(result.outcome.outcome, 'wrong', `${reference} must not match ${answer}`);
  }

  const caseAndPunctuation = [
    ["I'LL reconnect!!!", 'i WILL reconnect'],
    ["i'M ready?!", 'I am READY.'],
    ["IT'S ready.", 'it IS ready!'],
    ["i'VE finished", 'I HAVE finished.'],
    ["I'D finished!", 'i HAD finished'],
    ["I'd like to go?", 'I WOULD like to go.']
  ];
  for (const [reference, answer] of caseAndPunctuation) {
    assert.equal((await check(reference, answer)).outcome, 'correct', `${reference} ↔ ${answer}`);
  }

  const grammarCases = [
    ['I went home.', 'I go home.', 'tense'],
    ['I saw the child.', 'I saw the children.', 'number'],
    ['I can go.', 'I could go.', 'modal'],
    ['I saw a bird.', 'I saw the bird.', 'article'],
    ['I went to school.', 'I went in school.', 'preposition']
  ];
  for (const [reference, answer, option] of grammarCases) {
    assert.equal((await check(reference, answer, { [option]: true })).outcome.outcome, 'wrong', `${option} ON`);
    assert.equal((await check(reference, answer, { [option]: false })).outcome, 'correct', `${option} OFF`);
  }

  function workerAnswer(reference, answer, lemma, overrides = {}) {
    return { content: [{ text: '```json\n' + JSON.stringify({ results: [{ reference, answer, isIrregular: true, type: 'tense', lemma, certain: true, ...overrides }] }) + '\n```' }] };
  }
  for (const [reference, answer, refWord, answerWord, lemma] of [
    ['She taught me.', 'She teached me.', 'taught', 'teached', 'teach'],
    ['I stole it.', 'I stealed it.', 'stole', 'stealed', 'steal']
  ]) {
    const workerResponse = workerAnswer(refWord, answerWord, lemma);
    const optionOn = await check(reference, answer, { tense: true }, workerResponse);
    assert.equal(optionOn.aiCalls.length, 1, `${refWord} → ${answerWord} should use the existing AI review`);
    assert.equal(optionOn.trace.deterministic.result.errors[0].type, 'vocabulary', 'deterministic grading begins with the vocabulary candidate');
    assert.match(optionOn.aiCalls[0].messages[0].content, new RegExp(`\\"reference\\":\\"${refWord}\\",\\"answer\\":\\"${answerWord}\\"`));
    assert.deepEqual(optionOn.trace.parsing.parsed.results[0], { reference: refWord, answer: answerWord, isIrregular: true, type: 'tense', lemma, certain: true });
    assert.deepEqual(optionOn.trace.validation, { reference: refWord, answer: answerWord, type: 'tense', lemma, valid: true });
    assert.equal(optionOn.trace.postprocessing.output.errors[0].type, 'tense', 'postprocessing replaces the exact vocabulary candidate with a tense error');
    assert.equal(optionOn.outcome.outcome, 'wrong', `${refWord} → ${answerWord} remains wrong when tense checking is ON`);
    assert.equal(optionOn.outcome.result.errors[0].type, 'tense', `${lemma} should validate as the verb lemma`);
    assert.match(optionOn.outcome.result.errors[0].reason, /불규칙 형태/);
    assert.equal(optionOn.trace.finalError.result.errors[0].type, 'tense', 'the final error path receives the refined result');

    const optionOff = await check(reference, answer, { tense: false }, workerResponse);
    assert.equal(optionOff.aiCalls.length, 1, `${refWord} → ${answerWord} should still use the existing AI review`);
    assert.equal(optionOff.outcome, 'correct', `${refWord} → ${answerWord} is accepted when tense checking is OFF`);
  }

  const invalidAiResponses = [
    workerAnswer('taught', 'teached', 'teach', { certain: false }),
    workerAnswer('taught', 'teached', ''),
    workerAnswer('teach', 'teaches', 'teach'),
    workerAnswer('taught', 'teached', 'teach', { isIrregular: 'true' }),
    workerAnswer('taught', 'teached', 'teach', { type: 'vocabulary' }),
    workerAnswer('taught', 'teached', 'banana'),
    { content: [{ text: 'not valid JSON' }] }
  ];
  for (const response of invalidAiResponses) {
    const result = await check('She taught me.', 'She teached me.', { tense: true }, response);
    assert.equal(result.aiCalls.length, 1, 'mismatch candidate keeps the existing AI second pass');
    assert.equal(result.outcome.outcome, 'wrong', 'invalid or untrusted AI result must fail closed');
    assert.equal(result.outcome.result.errors[0].type, 'vocabulary', 'original vocabulary classification is retained');
  }
  const actualVocabulary = await check('She taught me.', 'She tutored me.', { tense: true }, workerAnswer('taught', 'tutored', 'teach', { isIrregular: false }));
  assert.equal(actualVocabulary.outcome.outcome, 'wrong');
  assert.equal(actualVocabulary.trace.finalError.result.errors[0].type, 'vocabulary', 'a real lexical mismatch stays vocabulary when AI rejects irregularity');
  const nonCandidate = await check('I went home.', 'I go home.', { tense: true }, workerAnswer('went', 'go', 'go'));
  assert.equal(nonCandidate.aiCalls.length, 0, 'non-vocabulary grammar mismatch must not trigger AI');
  assert.equal(nonCandidate.outcome.outcome, 'wrong');

  const optionHarness = createHarness('a', 'a', { meaning: false, vocabulary: false, spelling: false });
  const normalized = optionHarness.normalizeGrammarOptions(optionHarness.settings.grammarOptions);
  assert.deepEqual(Object.keys(normalized).sort(), ['article', 'modal', 'number', 'preposition', 'tense']);
  assert.ok(Object.hasOwn(optionHarness.GRAMMAR_OPTION_LABELS, 'meaning'), 'meaning error classification stays available');
  assert.ok(Object.hasOwn(optionHarness.GRAMMAR_OPTION_LABELS, 'vocabulary'), 'vocabulary error classification stays available');

  console.log('Passed all checkAnswer → deterministicGrade regression checks, including AI second-pass cases.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
