import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase } from './verdict.mjs';

const source = Buffer.from('# saved candidate\n', 'utf8');
const digest = createHash('sha256').update(source).digest('hex');
const candidateCapture = {
  exitCode: 0,
  stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved case.ghost.md: SHA-256 ${digest}.\n`,
};
function report(overrides = {}) {
  return {
    identity: { case: 'case', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'candidate', sourceSha256: digest }],
    finalSourceSha256: digest,
    holdout: { exitCode: 0, fixedExpectationsPassed: true },
    ...overrides,
  };
}
function passingEvidence(overrides = {}) {
  return { source, holdout: { exitCode: 0, stdout: 'User expectations passed: 4\n' }, ...overrides };
}

test('report claims cannot replace absent source or holdout captures', () => {
  const noEvidence = classifyCase(report(), [candidateCapture]);
  assert.equal(noEvidence.complete, true);
  assert.equal(noEvidence.finalCandidate, false);
  assert.equal(noEvidence.fixedHoldoutPass, false);

  const noHoldout = classifyCase(report(), [candidateCapture], { source });
  assert.equal(noHoldout.finalCandidate, true);
  assert.equal(noHoldout.fixedHoldoutPass, false);
});

test('saved source bytes and actual holdout output corroborate a passing verdict', () => {
  const verdict = classifyCase(report(), [candidateCapture], passingEvidence());
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, true);
  assert.equal(verdict.fixedHoldoutPass, true);
});

test('wrong source, failed actual holdout, and report-only holdout labels are rejected', () => {
  assert.equal(classifyCase(report(), [candidateCapture], passingEvidence({ source: 'different' })).finalCandidate, false);
  assert.equal(classifyCase(report(), [candidateCapture], passingEvidence({ holdout: { exitCode: 1, stdout: 'User expectations passed: 4' } })).fixedHoldoutPass, false);
  assert.equal(classifyCase(report(), [candidateCapture], passingEvidence({ holdout: { exitCode: 0, stdout: 'all good' } })).fixedHoldoutPass, false);
  assert.equal(classifyCase(report({ holdout: { exitCode: 0, fixedExpectationsPassed: false } }), [candidateCapture], passingEvidence()).fixedHoldoutPass, false);
});

test('process capture exit code, not report labels, determines conversational completion', () => {
  const failedCapture = { ...candidateCapture, exitCode: 1 };
  const verdict = classifyCase(report(), [failedCapture], passingEvidence());
  assert.equal(verdict.complete, false);
  assert.equal(verdict.finalCandidate, false);
});

test('a successful clarification completes without a candidate source file', () => {
  const clarification = { exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\n' };
  const clarificationReport = {
    identity: { case: 'clarify', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'clarification' }],
  };
  const verdict = classifyCase(clarificationReport, [clarification]);
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, false);
  assert.equal(verdict.fixedHoldoutPass, false);
});
