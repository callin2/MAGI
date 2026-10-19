import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase, observedKind } from './verdict.mjs';

const source = '# Some source code';
const sourceBuffer = Buffer.from(source, 'utf8');
const sha256 = createHash('sha256').update(sourceBuffer).digest('hex');

// A valid capture stdout for candidate with saved SHA
const validCandidateStdout = `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /path/to/case.ghost.md: SHA-256 ${sha256}.\n`;
const validHoldoutStdout = 'User expectations passed: all tests\n';

const report = {
  identity: { scriptedTurns: 1, currentPinParity: true, case: 'case' },
  turns: [
    { turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sha256 }
  ],
  finalSourceSha256: sha256,
  holdout: { exitCode: 0, fixedExpectationsPassed: true }
};

const capture = { exitCode: 0, stdout: validCandidateStdout };
const holdout = { exitCode: 0, stdout: validHoldoutStdout };

// Test: valid candidate and holdout produce fixedHoldoutPass true
test('valid candidate with correct evidence passes fixedHoldoutPass', () => {
  const result = classifyCase(report, [capture], { source: sourceBuffer, holdout });
  assert.equal(result.fixedHoldoutPass, true);
  assert.equal(result.finalCandidate, true);
  assert.equal(result.complete, true);
});

// Test: missing evidence.source rejects completion
test('missing evidence.source fails completion', () => {
  const partial = classifyCase(report, [capture], { holdout });
  assert.equal(partial.complete, false);
  assert.equal(partial.finalCandidate, false);
  assert.equal(partial.fixedHoldoutPass, false);
});

// Test: missing evidence.holdout fails holdout pass
test('missing evidence.holdout fails holdout pass', () => {
  const partial = classifyCase(report, [capture], { source: sourceBuffer });
  assert.equal(partial.complete, false);
  assert.equal(partial.fixedHoldoutPass, false);
});

// Test: source content mismatch fails
const wrongSourceBuffer = Buffer.from('# wrong content', 'utf8');
test('wrong source content fails finalCandidate and holdout', () => {
  const result = classifyCase(report, [capture], { source: wrongSourceBuffer, holdout });
  assert.equal(result.finalCandidate, false);
  assert.equal(result.fixedHoldoutPass, false);
  assert.equal(result.complete, false);
});

// Test: holdout capture no success message fails holdout pass
const badHoldout = { exitCode: 0, stdout: 'some failure or empty' };
test('holdout capture without pass line fails holdoutPass', () => {
  const result = classifyCase(report, [capture], { source: sourceBuffer, holdout: badHoldout });
  assert.equal(result.fixedHoldoutPass, false);
});

// Test: holdout capture failure exit code fails holdout pass
const badExitHoldout = { exitCode: 1, stdout: validHoldoutStdout };
test('holdout capture with failure exitCode fails holdoutPass', () => {
  const result = classifyCase(report, [capture], { source: sourceBuffer, holdout: badExitHoldout });
  assert.equal(result.fixedHoldoutPass, false);
});

// Test: observedKind ignores multiple GHOSTFLOW_RESULT_JSON
const dupStdout = validCandidateStdout + validCandidateStdout;
test('observedKind returns null for duplicated responses', () => {
  assert.equal(observedKind(dupStdout), null);
});

// Test: finalCandidate requires last turn sourceSha256 to match report finalSourceSha256
const reportMismatch = {...report, turns: [{...report.turns[0], sourceSha256: '1234'}]};
test('finalCandidate false if last turn sourceSha256 mismatch', () => {
  const result = classifyCase(reportMismatch, [capture], { source: sourceBuffer, holdout });
  assert.equal(result.finalCandidate, false);
  assert.equal(result.fixedHoldoutPass, false);
});

// Test: complete false if any turn expectedKind different from observedKind
const wrongKindCapture = [{ exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"answer"}\nSaved /path/to/case.ghost.md: SHA-256 ' + sha256 + '.\n' }];
test('complete false if kind mismatch', () => {
  const result = classifyCase(report, wrongKindCapture, { source: sourceBuffer, holdout });
  assert.equal(result.complete, false);
});

// Test: complete false if any turn exitCode not zero
const badExitCapture = [{ exitCode: 1, stdout: validCandidateStdout }];
test('complete false if any turn exitCode not zero', () => {
  const result = classifyCase(report, badExitCapture, { source: sourceBuffer, holdout });
  assert.equal(result.complete, false);
});

// Test: persistedCandidate false when candidate not indicated as saved correctly
const badSavedCapture = [{ exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSome unrelated line\n`}];
test('persistedCandidate false if saved line missing or mismatched', () => {
  const result = classifyCase(report, badSavedCapture, { source: sourceBuffer, holdout });
  assert.equal(result.turns[0].persistedCandidate, false);
});
