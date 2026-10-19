import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase, observedKind } from './verdict.mjs';

const source = '# Current fixture\n';
const sourceBuffer = Buffer.from(source, 'utf8');
const sourceSha256 = createHash('sha256').update(sourceBuffer).digest('hex');

const baseReport = {
  identity: { scriptedTurns: 1, currentPinParity: true, case: 'CASE1' },
  turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256 }],
  finalSourceSha256: sourceSha256,
  holdout: { exitCode: 0, fixedExpectationsPassed: true },
};

const candidateCapture = {
  exitCode: 0,
  stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /isolated/CASE1.ghost.md: SHA-256 ${sourceSha256}.\n`,
};

const holdoutCapture = {
  exitCode: 0,
  stdout: 'Some log lines\nUser expectations passed: 1\nMore lines\n',
};

// Test valid candidate is accepted when evidence matches
test('valid candidate accepted with exact source and holdout', () => {
  const result = classifyCase(baseReport, [candidateCapture], { source: sourceBuffer, holdout: holdoutCapture });
  assert(result.fixedHoldoutPass, 'fixedHoldoutPass should be true when evidence is present, source matches, and holdout passes');
  assert(result.finalCandidate, 'finalCandidate should be true for complete candidate with matching source');
  assert(result.complete, 'complete should be true for correct turn and exit codes');
});

// Test failure if source evidence is missing or mismatched
test('missing source causes finalCandidate and fixedHoldoutPass to fail', () => {
  const result1 = classifyCase(baseReport, [candidateCapture], { holdout: holdoutCapture });
  assert.strictEqual(result1.finalCandidate, false, 'finalCandidate false without source evidence');
  assert.strictEqual(result1.fixedHoldoutPass, false, 'fixedHoldoutPass false without source evidence');

  const badSource = 'mismatched source text';
  const result2 = classifyCase(baseReport, [candidateCapture], { source: badSource, holdout: holdoutCapture });
  assert.strictEqual(result2.finalCandidate, false, 'finalCandidate false with bad source evidence');
  assert.strictEqual(result2.fixedHoldoutPass, false, 'fixedHoldoutPass false with bad source evidence');
});

// Test failure if holdout evidence is missing or fails
test('missing or failing holdout causes fixedHoldoutPass false', () => {
  const result1 = classifyCase(baseReport, [candidateCapture], { source: sourceBuffer });
  assert.strictEqual(result1.fixedHoldoutPass, false, 'fixedHoldoutPass false without holdout evidence');

  const failHoldout = { exitCode: 0, stdout: 'No pass line here' };
  const result2 = classifyCase(baseReport, [candidateCapture], { source: sourceBuffer, holdout: failHoldout });
  assert.strictEqual(result2.fixedHoldoutPass, false, 'fixedHoldoutPass false without user pass line');

  const badExitHoldout = { exitCode: 1, stdout: 'User expectations passed: 1' };
  const result3 = classifyCase(baseReport, [candidateCapture], { source: sourceBuffer, holdout: badExitHoldout });
  assert.strictEqual(result3.fixedHoldoutPass, false, 'fixedHoldoutPass false with bad exit code');
});

// Test observedKind rejects duplicate responses
test('observedKind rejects duplicate responses', () => {
  const dupeStdout = candidateCapture.stdout + candidateCapture.stdout;
  assert.strictEqual(observedKind(dupeStdout), null, 'observedKind returns null on duplicates');
});

// Test kind mismatch turn reported
const badKindTurn = { turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256 };
const badStdout = 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\nSaved /isolated/CASE1.ghost.md: SHA-256 ' + sourceSha256 + '.\n';
const badCapture = { exitCode: 0, stdout: badStdout };

const badReport = { ...baseReport, turns: [badKindTurn] };

test('kindMismatchTurns detect expected vs observed difference', () => {
  const res = classifyCase(badReport, [badCapture], { source: sourceBuffer, holdout: holdoutCapture });
  assert.deepStrictEqual(res.kindMismatchTurns, [1], 'should list turns with kind mismatch');
});

// Test complete requires pinned parity
const parityFalseReport = { ...baseReport, identity: { ...baseReport.identity, currentPinParity: false } };
const resParity = classifyCase(parityFalseReport, [candidateCapture], { source: sourceBuffer, holdout: holdoutCapture });

test('complete is false if currentPinParity is false', () => {
  assert.strictEqual(resParity.complete, false, 'complete false if currentPinParity is false');
});

// Test no candidate final turn no finalCandidate
const clarificationCapture = { exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\n' };
const noCandidateReport = { ...baseReport, turns: [{ turn: 1, expectedKind: 'clarification', exitCode: 0, sourceSha256: '' }] };
const resNoCandidate = classifyCase(noCandidateReport, [clarificationCapture], { source: sourceBuffer, holdout: holdoutCapture });

test('finalCandidate false if last turn is not candidate', () => {
  assert.strictEqual(resNoCandidate.finalCandidate, false, 'finalCandidate false without candidate last turn');
});
