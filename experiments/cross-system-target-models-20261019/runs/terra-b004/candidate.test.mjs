import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase } from './verdict.mjs';

const source = '# saved candidate\n';
const sha = createHash('sha256').update(source).digest('hex');
const candidateCapture = {
  exitCode: 0,
  stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved case.ghost.md: SHA-256 ${sha}.\n`,
};
function report() {
  return {
    identity: { case: 'case', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'candidate', sourceSha256: sha, exitCode: 0 }],
    finalSourceSha256: sha,
    holdout: { exitCode: 0, fixedExpectationsPassed: true },
  };
}
const goodEvidence = { source, holdout: { exitCode: 0, stdout: 'User expectations passed: all\n' } };

test('report claims alone cannot establish a final candidate or holdout', () => {
  const verdict = classifyCase(report(), [candidateCapture]);
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, false);
  assert.equal(verdict.fixedHoldoutPass, false);
});

test('stored source must hash to the final claim and real holdout output must pass', () => {
  const badSource = classifyCase(report(), [candidateCapture], { ...goodEvidence, source: 'altered' });
  assert.equal(badSource.finalCandidate, false);
  const reportOnlyHoldout = classifyCase(report(), [candidateCapture], { source, holdout: { exitCode: 0, stdout: 'all good' } });
  assert.equal(reportOnlyHoldout.finalCandidate, true);
  assert.equal(reportOnlyHoldout.fixedHoldoutPass, false);
  assert.equal(classifyCase(report(), [candidateCapture], goodEvidence).fixedHoldoutPass, true);
});

test('completion uses process capture exits, while a clarification needs no source', () => {
  const failedProcess = classifyCase(report(), [{ ...candidateCapture, exitCode: 1 }], goodEvidence);
  assert.equal(failedProcess.complete, false);
  const clarification = {
    identity: { scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'clarification' }],
  };
  const verdict = classifyCase(clarification, [{ exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\n' }]);
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, false);
});
