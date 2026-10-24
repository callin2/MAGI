import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase } from './verdict.mjs';

const source = '# generated candidate\n';
const sha = createHash('sha256').update(source).digest('hex');
const candidateCapture = {
  exitCode: 0,
  stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved fixture.ghost.md: SHA-256 ${sha}.\n`,
};
function report() {
  return {
    identity: { case: 'fixture', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sha }],
    finalSourceSha256: sha,
    holdout: { exitCode: 0, fixedExpectationsPassed: true },
  };
}
const goodEvidence = { source, holdout: { exitCode: 0, stdout: 'User expectations passed: 3\n' } };

test('a fully corroborated candidate and holdout pass', () => {
  const verdict = classifyCase(report(), [candidateCapture], goodEvidence);
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, true);
  assert.equal(verdict.fixedHoldoutPass, true);
});

test('report claims cannot replace missing source or actual holdout', () => {
  const withoutSource = classifyCase(report(), [candidateCapture], { holdout: goodEvidence.holdout });
  assert.equal(withoutSource.complete, true);
  assert.equal(withoutSource.finalCandidate, false);
  assert.equal(withoutSource.fixedHoldoutPass, false);
  const withoutHoldout = classifyCase(report(), [candidateCapture], { source });
  assert.equal(withoutHoldout.finalCandidate, true);
  assert.equal(withoutHoldout.fixedHoldoutPass, false);
});

test('source content and real capture exit status are authoritative', () => {
  assert.equal(classifyCase(report(), [candidateCapture], { ...goodEvidence, source: '# altered\n' }).finalCandidate, false);
  const forgedExit = classifyCase(report(), [{ ...candidateCapture, exitCode: 1 }], goodEvidence);
  assert.equal(forgedExit.complete, false);
  assert.equal(forgedExit.finalCandidate, false);
});

test('a clarification can complete without any candidate source', () => {
  const clarification = {
    identity: { case: 'question', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'clarification', exitCode: 0 }],
  };
  const verdict = classifyCase(clarification, [{ exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\n' }]);
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, false);
  assert.equal(verdict.fixedHoldoutPass, false);
});

test('holdout requires its own successful process marker', () => {
  for (const holdout of [
    { exitCode: 1, stdout: 'User expectations passed: 3\n' },
    { exitCode: 0, stdout: 'all good\n' },
  ]) assert.equal(classifyCase(report(), [candidateCapture], { source, holdout }).fixedHoldoutPass, false);
});
