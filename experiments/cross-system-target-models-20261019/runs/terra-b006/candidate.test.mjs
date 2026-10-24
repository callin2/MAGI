import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase } from './verdict.mjs';

const source = '# generated candidate\n';
const digest = createHash('sha256').update(source).digest('hex');
const candidateCapture = {
  exitCode: 0,
  stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved fixture.ghost.md: SHA-256 ${digest}.\n`,
};
function candidateReport() {
  return {
    identity: { case: 'fixture', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: digest }],
    finalSourceSha256: digest,
    holdout: { exitCode: 0, fixedExpectationsPassed: true },
  };
}
const passingHoldout = { exitCode: 0, stdout: 'setup\nUser expectations passed: 4\n' };

test('report claims alone cannot establish final candidate or holdout', () => {
  const result = classifyCase(candidateReport(), [candidateCapture]);
  assert.equal(result.complete, true);
  assert.equal(result.finalCandidate, false);
  assert.equal(result.fixedHoldoutPass, false);
});

test('final source must be the bytes whose hash was claimed', () => {
  const result = classifyCase(candidateReport(), [candidateCapture], {
    source: '# substituted source\n', holdout: passingHoldout,
  });
  assert.equal(result.finalCandidate, false);
  assert.equal(result.fixedHoldoutPass, false);
});

test('actual turn exit code, rather than report exit code, controls completion', () => {
  const failedCapture = { ...candidateCapture, exitCode: 1 };
  const result = classifyCase(candidateReport(), [failedCapture], { source, holdout: passingHoldout });
  assert.equal(result.complete, false);
  assert.equal(result.finalCandidate, false);
});

test('actual fixed-holdout success requires its success line', () => {
  const result = classifyCase(candidateReport(), [candidateCapture], {
    source: Buffer.from(source), holdout: { exitCode: 0, stdout: 'all done\n' },
  });
  assert.equal(result.finalCandidate, true);
  assert.equal(result.fixedHoldoutPass, false);
});

test('a successful clarification can complete without candidate evidence', () => {
  const report = {
    identity: { case: 'clarify', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'clarification' }],
  };
  const capture = { exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\n' };
  const result = classifyCase(report, [capture]);
  assert.equal(result.complete, true);
  assert.equal(result.finalCandidate, false);
  assert.equal(result.fixedHoldoutPass, false);
});
