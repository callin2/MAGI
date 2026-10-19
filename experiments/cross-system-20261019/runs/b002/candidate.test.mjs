import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase, observedKind } from './verdict.mjs';

// Helper function to create a turn result
function turnResult(turnNum, expectedKind, exitCode, stdout, sourceSha256) {
  return { turn: turnNum, expectedKind, exitCode, stdout, sourceSha256 };
}

// Helper function to create a capture
function capture(exitCode, stdout) {
  return { exitCode, stdout };
}

const source = '# Current fixture\n';
const validSha = createHash('sha256').update(source).digest('hex');

// Base report structure
const baseReport = {
  identity: { scriptedTurns: 1, currentPinParity: true },
  turns: [
    { turn: 1, expectedKind: 'candidate', sourceSha256: validSha }
  ],
  finalSourceSha256: validSha,
  holdout: { exitCode: 0, fixedExpectationsPassed: true, stdout: 'User expectations passed: 1\n' }
};

// Valid candidate scenario
const validCandidateStdout = `GHOSTFLOW_RESULT_JSON:{\"kind\":\"candidate\"}\nSaved /isolated/case.ghost.md: SHA-256 ${validSha}.\n`;

const validCaptures = [capture(0, validCandidateStdout)];

const validClassifyResult = classifyCase(baseReport, validCaptures, { source, holdout: baseReport.holdout });

// Tests

test('valid candidate stays accepted and fixed holdout passes', () => {
  assert.ok(validClassifyResult.finalCandidate, 'Should confirm final candidate present and valid');
  assert.ok(validClassifyResult.fixedHoldoutPass, 'Should confirm fixed holdout passes with matching outputs');
});

// Missing evidence source - should fail classification
const noSourceReport = {
  ...baseReport,
  holdout: { exitCode: 0, fixedExpectationsPassed: true }
};

test('missing evidence.source fails finalCandidate and fixedHoldoutPass', () => {
  const res = classifyCase(noSourceReport, validCaptures, { holdout: noSourceReport.holdout });
  assert.equal(res.finalCandidate, false, 'finalCandidate must be false without valid source evidence');
  assert.equal(res.fixedHoldoutPass, false, 'fixedHoldoutPass must be false without valid holdout capture');
});

// Source SHA mismatch - should fail finalCandidate
const badSource = 'some other source text';
const badSourceSha = createHash('sha256').update(badSource).digest('hex');
const badSourceReport = {
  ...baseReport,
  finalSourceSha256: badSourceSha
};

test('source SHA mismatch rejects finalCandidate', () => {
  const res = classifyCase(badSourceReport, validCaptures, { source, holdout: baseReport.holdout });
  assert.equal(res.finalCandidate, false, 'finalCandidate must be false if source SHA does not match finalSourceSha256');
});

// Holdout capture missing passes failing fixedHoldoutPass
const noHoldoutCapture = { exitCode: 0, stdout: 'User expectations passed: 1\n' };
const noHoldoutReport = {
  ...baseReport,
  holdout: { exitCode: 0, fixedExpectationsPassed: true }
};

test('missing actual holdout capture fails fixedHoldoutPass', () => {
  const res = classifyCase(noHoldoutReport, validCaptures, { source, holdout: undefined });
  assert.equal(res.fixedHoldoutPass, false, 'fixedHoldoutPass must be false if no holdout capture is provided');
});

// A complete report but no final candidate turn (like clarification)
test('complete but no final candidate turn', () => {
  const clarReport = {
    identity: { scriptedTurns: 1, currentPinParity: true },
    turns: [
      { turn: 1, expectedKind: 'clarification', sourceSha256: undefined }
    ],
    finalSourceSha256: validSha,
    holdout: { exitCode: 0, fixedExpectationsPassed: true }
  };
  const clarCaptures = [capture(0, 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\n')];

  const res = classifyCase(clarReport, clarCaptures, { source, holdout: clarReport.holdout });
  assert.ok(res.complete, 'Should be complete');
  assert.equal(res.finalCandidate, false, 'finalCandidate must be false without candidate');
  assert.equal(res.fixedHoldoutPass, false, 'fixedHoldoutPass must be false without finalCandidate');
});

// Holdout capture stdout without "User expectations passed:" line
const holdoutFailCapture = { exitCode: 0, stdout: 'some error output\nno success line here' };

test('holdout capture missing success line fails fixedHoldoutPass', () => {
  const res = classifyCase(baseReport, validCaptures, { source, holdout: holdoutFailCapture });
  assert.equal(res.fixedHoldoutPass, false, 'fixedHoldoutPass must be false if holdout capture lacks success line');
});

// Exit code nonzero in holdout capture
const holdoutNonZeroCode = { exitCode: 1, stdout: 'User expectations passed: 1\n' };

test('holdout capture nonzero exit code fails fixedHoldoutPass', () => {
  const res = classifyCase(baseReport, validCaptures, { source, holdout: holdoutNonZeroCode });
  assert.equal(res.fixedHoldoutPass, false, 'fixedHoldoutPass must be false if holdout capture exit code nonzero');
});

// Kind mismatch in turn
const kindMismatchReport = {
  identity: { scriptedTurns: 1, currentPinParity: true },
  turns: [
    { turn: 1, expectedKind: 'candidate', sourceSha256: validSha }
  ],
  finalSourceSha256: validSha
};
const kindMismatchCaptures = [capture(0, 'GHOSTFLOW_RESULT_JSON:{"kind":"answer"}\nSaved /isolated/case.ghost.md: SHA-256 ' + validSha + '.\n')];

test('kind mismatch on turn produces kindMismatchTurns entry and incomplete overall', () => {
  const res = classifyCase(kindMismatchReport, kindMismatchCaptures, { source, holdout: { exitCode: 0, stdout: 'User expectations passed: 1\n' } });
  assert.equal(res.kindMismatchTurns.length, 1, 'kindMismatchTurns should contain the mismatched turn number');
  assert.equal(res.complete, false, 'complete should be false due to mismatch');
});

// No source evidence at all - breaks finalCandidate and fixedHoldoutPass
const blankEvidence = {};
test('blank evidence cannot produce finalCandidate or fixedHoldoutPass', () => {
  const res = classifyCase(baseReport, validCaptures, blankEvidence);
  assert.equal(res.finalCandidate, false, 'finalCandidate must be false without evidence.source');
  assert.equal(res.fixedHoldoutPass, false, 'fixedHoldoutPass must be false without evidence.holdout');
});

// observedKind duplicate response test (from public.test.mjs)
test('parser rejects duplicate responses', () => {
  const c = capture(0, validCandidateStdout);
  assert.equal(observedKind(c.stdout + c.stdout), null);
});

