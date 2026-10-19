import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase } from './verdict.mjs';

const source = '# generated candidate\n';
const digest = createHash('sha256').update(source).digest('hex');
const candidateCapture = {
  exitCode: 0,
  stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved case.ghost.md: SHA-256 ${digest}.\n`,
};
function candidateReport() {
  return {
    identity: { case: 'case', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: digest }],
    finalSourceSha256: digest,
    holdout: { exitCode: 0, fixedExpectationsPassed: true },
  };
}
const passingHoldout = { exitCode: 0, stdout: 'User expectations passed: 4\n' };

test('a report cannot replace final candidate source bytes', () => {
  const verdict = classifyCase(candidateReport(), [candidateCapture], { holdout: passingHoldout });
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, false);
  assert.equal(verdict.fixedHoldoutPass, false);
});

test('actual turn exit status, not the report exit label, controls completion', () => {
  const capture = { ...candidateCapture, exitCode: 1 };
  const verdict = classifyCase(candidateReport(), [capture], { source, holdout: passingHoldout });
  assert.equal(verdict.complete, false);
  assert.equal(verdict.finalCandidate, false);
});

test('fixed holdout requires its actual successful capture and marker', () => {
  const report = candidateReport();
  assert.equal(classifyCase(report, [candidateCapture], { source }).fixedHoldoutPass, false);
  assert.equal(classifyCase(report, [candidateCapture], {
    source, holdout: { exitCode: 0, stdout: 'all good\n' },
  }).fixedHoldoutPass, false);
  assert.equal(classifyCase(report, [candidateCapture], {
    source: Buffer.from(source), holdout: passingHoldout,
  }).fixedHoldoutPass, true);
});

test('clarification can complete without a candidate source or holdout', () => {
  const report = {
    identity: { case: 'clarify', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'clarification' }],
  };
  const capture = { exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\n' };
  const verdict = classifyCase(report, [capture]);
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, false);
  assert.equal(verdict.fixedHoldoutPass, false);
});
