import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase } from './verdict.mjs';

const source = '# stored candidate\n';
const sha = createHash('sha256').update(source).digest('hex');
const candidateCapture = {
  exitCode: 0,
  stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /run/case.ghost.md: SHA-256 ${sha}.\n`,
};
function report(overrides = {}) {
  return {
    identity: { case: 'case', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sha }],
    finalSourceSha256: sha,
    holdout: { exitCode: 0, fixedExpectationsPassed: true },
    ...overrides,
  };
}
const passingHoldout = { exitCode: 0, stdout: 'User expectations passed: all fixed checks\n' };

test('a saved candidate needs the actual matching stored source and holdout capture', () => {
  const verdict = classifyCase(report(), [candidateCapture], { source, holdout: passingHoldout });
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, true);
  assert.equal(verdict.fixedHoldoutPass, true);
});

test('report claims cannot replace missing source or real fixed-holdout output', () => {
  const noSource = classifyCase(report(), [candidateCapture], { holdout: passingHoldout });
  assert.equal(noSource.complete, true);
  assert.equal(noSource.finalCandidate, false);
  assert.equal(noSource.fixedHoldoutPass, false);

  const forgedHoldout = classifyCase(report(), [candidateCapture], { source, holdout: { exitCode: 0, stdout: 'all good\n' } });
  assert.equal(forgedHoldout.finalCandidate, true);
  assert.equal(forgedHoldout.fixedHoldoutPass, false);
});

test('actual turn exit status, not the report exitCode label, controls completion', () => {
  const failedCapture = { ...candidateCapture, exitCode: 1 };
  const verdict = classifyCase(report(), [failedCapture], { source, holdout: passingHoldout });
  assert.equal(verdict.complete, false);
  assert.equal(verdict.finalCandidate, false);
});

test('clarification can complete without a candidate file', () => {
  const clarification = { exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\n' };
  const r = report({ turns: [{ turn: 1, expectedKind: 'clarification', exitCode: 99 }], finalSourceSha256: undefined });
  const verdict = classifyCase(r, [clarification]);
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, false);
  assert.equal(verdict.fixedHoldoutPass, false);
});

test('stored source with a different digest cannot certify the final candidate', () => {
  const verdict = classifyCase(report(), [candidateCapture], { source: '# changed\n', holdout: passingHoldout });
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, false);
});
