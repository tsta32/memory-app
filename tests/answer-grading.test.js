const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const start = app.indexOf('function lev(');
const end = app.indexOf('// A narrow second pass', start);
assert.notEqual(start, -1, 'grading helpers must exist in app.js');
assert.notEqual(end, -1, 'grading helper boundary must exist in app.js');

const context = {
  GRAMMAR_OPTION_LABELS: {
    tense: '시제', number: '수', modal: '조동사', article: '관사', preposition: '전치사'
  },
  normalizeGrammarOptions(options) {
    return Object.assign({ tense: true, number: true, modal: true, article: true, preposition: true }, options);
  }
};
vm.runInNewContext(`${app.slice(start, end)}\nthis.grade = deterministicGrade;`, context);

const accepted = [
  ["I'll reconnect.", 'I will reconnect.'],
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
  const result = context.grade(reference, answer, {});
  assert.equal(result.pass, true, `${reference} ↔ ${answer}: ${JSON.stringify(result.errors)}`);
  const reverse = context.grade(answer, reference, {});
  assert.equal(reverse.pass, true, `${answer} ↔ ${reference}: ${JSON.stringify(reverse.errors)}`);
}

for (const [reference, answer] of [
  ["I'd finished.", "I'd like to go."],
  ["I'd finished.", 'I would finish.'],
  ["It's ready.", "It's finished."],
  ["It's ready.", 'It has ready.'],
  ['I will reconnect.', 'I can reconnect.'],
  ['She does not know.', 'She did not know.']
]) {
  assert.equal(context.grade(reference, answer, {}).pass, false, `${reference} must not match ${answer}`);
}

for (const [reference, answer] of [
  ["I'LL reconnect!!!", 'i WILL reconnect'],
  ["i'M ready?!", 'I am READY.'],
  ["IT'S ready.", 'it IS ready!'],
  ["i'VE finished", 'I HAVE finished.'],
  ["I'D finished!", 'i HAD finished'],
  ["I'd like to go?", 'I WOULD like to go.']
]) {
  assert.equal(context.grade(reference, answer, {}).pass, true, `${reference} should match ${answer} ignoring case/punctuation`);
}

const grammarCases = [
  ['I went home.', 'I go home.', 'tense'],
  ['I saw the child.', 'I saw the children.', 'number'],
  ['I can go.', 'I could go.', 'modal'],
  ['I saw a bird.', 'I saw the bird.', 'article'],
  ['I went to school.', 'I went in school.', 'preposition']
];
for (const [reference, answer, option] of grammarCases) {
  assert.equal(context.grade(reference, answer, { [option]: true }).pass, false, `${option} ON must reject ${reference} ↔ ${answer}`);
  assert.equal(context.grade(reference, answer, { [option]: false }).pass, true, `${option} OFF must accept ${reference} ↔ ${answer}`);
}

console.log(`Passed ${accepted.length * 2 + 6 + 12 + grammarCases.length * 2} answer grading regression checks.`);
