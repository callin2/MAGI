import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase, observedKind } from './verdict.mjs';

// Fixture source and SHA
const source = '# Current fixture\n';
const sourceBuffer = Buffer.from(source, 'utf8');
const sha256 = createHash('sha256').update(sourceBuffer).digest('hex');

// Valid candidate turn capture
const candidateCapture = {
  exitCode: 0,
  stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /isolated/case.ghost.md: SHA-256 ${sha256}.\n`
};

// Sample report structure
const baseReport = {
  identity: {
    case: 'example-case',
    scriptedTurns: 1,
    currentPinParity: true
  },
  turns: [
    {
      turn: 1,
      expectedKind: 'candidate',
      exitCode: 0,
      sourceSha256: sha256
    }
  ],
  finalSourceSha256: sha256,
  holdout: {
    exitCode: 0,
    fixedExpectationsPassed: true
  }
};

// Valid holdout yield
const validHoldout = {
  exitCode: 0,
  stdout: 'User expectations passed: 1\nSome other info\n'
};

// Tests

test('valid evidence produces positive verdict', () => {
  const v = classifyCase(baseReport, [candidateCapture], { source: sourceBuffer, holdout: validHoldout });
  assert(v.complete, 'complete is true');
  assert(v.finalCandidate, 'finalCandidate is true');
  assert(v.fixedHoldoutPass, 'fixedHoldoutPass is true');
  assert.deepEqual(v.kindMismatchTurns, []);
  assert.equal(v.expectedCandidateTurns, 1);
  assert.equal(v.observedCandidateTurns, 1);
});

// Missing source evidence should disallow complete
test('missing source evidence fails verdict', () => {
  const v = classifyCase(baseReport, [candidateCapture], { holdout: validHoldout });
  assert(!v.complete, 'complete is false');
  assert(!v.finalCandidate, 'finalCandidate is false');
  assert(!v.fixedHoldoutPass, 'fixedHoldoutPass is false');
});

// Source evidence mismatch
const wrongSource = '# wrong source\n';
// Keep finalSourceSha256 as correct sha256 (baseReport.finalSourceSha256)
// Provide wrongSource evidence that hashes differently
const wrongReport = { ...baseReport };
test('source evidence mismatch fails verdict', () => {
  const v = classifyCase(wrongReport, [candidateCapture], { source: wrongSource, holdout: validHoldout });
  assert(!v.complete, 'complete is false');
  assert(!v.finalCandidate, 'finalCandidate is false');
  assert(!v.fixedHoldoutPass, 'fixedHoldoutPass is false');
});

// Missing holdout evidence fails
test('missing holdout evidence fails verdict', () => {
  const v = classifyCase(baseReport, [candidateCapture], { source: sourceBuffer });
  assert(!v.complete, 'complete is false');
  assert(!v.finalCandidate, 'finalCandidate is false');
  assert(!v.fixedHoldoutPass, 'fixedHoldoutPass is false');
});

// Holdout evidence no passed line
const holdoutNoPassLine = { exitCode: 0, stdout: 'Some output without pass line' };
test('holdout missing pass line fails fixedHoldoutPass', () => {
  const v = classifyCase(baseReport, [candidateCapture], { source: sourceBuffer, holdout: holdoutNoPassLine });
  assert(!v.fixedHoldoutPass, 'fixedHoldoutPass is false');
});

// Duplicate response lines rejected by observedKind
const duplicateStdout = candidateCapture.stdout + candidateCapture.stdout;
test('observedKind rejects duplicate responses', () => {
  assert.equal(observedKind(duplicateStdout), null);
});

// Exit code mismatch fails complete
const badExitReport = JSON.parse(JSON.stringify(baseReport));
badExitReport.turns[0].exitCode = 1;
test('exitCode !== 0 fails complete', () => {
  const v = classifyCase(badExitReport, [candidateCapture], { source: sourceBuffer, holdout: validHoldout });
  assert(!v.complete);
});

// Expected kind and observed kind mismatch
const wrongKindCapture = { exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"answer"}\n' };
test('kind mismatch fails complete', () => {
  const v = classifyCase(baseReport, [wrongKindCapture], { source: sourceBuffer, holdout: validHoldout });
  assert(!v.complete);
  assert.deepEqual(v.kindMismatchTurns, [1]);
});

// Missing persisted candidate line fails complete when candidate is expected
const missingPersistedLineCapture = { exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\n' };
test('missing persisted candidate line fails complete', () => {
  const v = classifyCase(baseReport, [missingPersistedLineCapture], { source: sourceBuffer, holdout: validHoldout });
  assert(!v.complete);
});

// Legitimate clarification turn completes without candidate file
const clarificationCapture = { exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\n' };
const clarificationReport = JSON.parse(JSON.stringify(baseReport));
clarificationReport.turns[0].expectedKind = 'clarification';
test('clarification completes without candidate file', () => {
  const v = classifyCase(clarificationReport, [clarificationCapture], { source: sourceBuffer, holdout: validHoldout });
  assert(v.complete);
  assert(!v.finalCandidate);
});
