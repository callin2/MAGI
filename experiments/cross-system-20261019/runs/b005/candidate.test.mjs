import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase, observedKind } from './verdict.mjs';

const source = '# Current fixture\n';
const sourceBuffer = Buffer.from(source);
const sourceSha = createHash('sha256').update(sourceBuffer).digest('hex');

const validCapture = { exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /isolated/case.ghost.md: SHA-256 ${sourceSha}.\n` };
const invalidCapture = { exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /isolated/case.ghost.md: SHA-256 deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef.\n` };

const holdoutValid = { exitCode: 0, stdout: 'User expectations passed: 1\n' };
const holdoutFailExit = { exitCode: 1, stdout: 'User expectations passed: 1\n' };
const holdoutFailMissing = { exitCode: 0, stdout: 'No pass line\n' };

const reportBase = {
  identity: { scriptedTurns: 1, currentPinParity: true, case: 'testcase' },
  turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sourceSha }],
  finalSourceSha256: sourceSha,
  holdout: { exitCode: 0, fixedExpectationsPassed: true },
};

test('observedKind parses valid single JSON response line only', () => {
  assert.equal(observedKind(validCapture.stdout), 'candidate');
  assert.equal(observedKind(validCapture.stdout + validCapture.stdout), null); // duplicates rejected
  assert.equal(observedKind(''), null);
  assert.equal(observedKind('non-json line'), null);
});

test('valid candidate with correct source and holdout passes fixedHoldoutPass', () => {
  const verdict = classifyCase(reportBase, [validCapture], { source: sourceBuffer, holdout: holdoutValid });
  assert.equal(verdict.complete, true);
  assert.equal(verdict.finalCandidate, true);
  assert.equal(verdict.fixedHoldoutPass, true);
});

test('candidate with missing source fails fixedHoldoutPass', () => {
  const ver = classifyCase(reportBase, [validCapture], { holdout: holdoutValid });
  assert.equal(ver.fixedHoldoutPass, false);
});

test('candidate with missing holdout fails fixedHoldoutPass', () => {
  const ver = classifyCase(reportBase, [validCapture], { source: sourceBuffer });
  assert.equal(ver.fixedHoldoutPass, false);
});

test('candidate with invalid source SHA fails fixedHoldoutPass', () => {
  const ver = classifyCase(reportBase, [invalidCapture], { source: sourceBuffer, holdout: holdoutValid });
  assert.equal(ver.fixedHoldoutPass, false);
});

// completes false if expectedKind and observedKind differ
const wrongKindReport = {
  identity: { scriptedTurns: 1, currentPinParity: true, case: 'wrongkind' },
  turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sourceSha }],
  finalSourceSha256: sourceSha,
  holdout: { exitCode: 0, fixedExpectationsPassed: true },
};
const wrongKindCapture = [{ exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"answer"}\nSaved /isolated/case.ghost.md: SHA-256 ' + sourceSha + '.\n' }];

test('wrong kind in stdout results in kindMismatch and incomplete', () => {
  const ver = classifyCase(wrongKindReport, wrongKindCapture, { source: sourceBuffer, holdout: holdoutValid });
  assert.equal(ver.complete, false);
  assert.deepEqual(ver.kindMismatchTurns, [1]);
});

// persistedCandidate requires matching SHA in stdout saved line
const missingSaveReport = {
  identity: { scriptedTurns: 1, currentPinParity: true, case: 'missingsave' },
  turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sourceSha }],
  finalSourceSha256: sourceSha,
  holdout: { exitCode: 0, fixedExpectationsPassed: true },
};
const missingSaveCapture = [{ exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nOther output line\n' }];

test('missing saved SHA line fails candidate persistedCandidate check and complete', () => {
  const ver = classifyCase(missingSaveReport, missingSaveCapture, { source: sourceBuffer, holdout: holdoutValid });
  assert.equal(ver.complete, false);
  assert.equal(ver.finalCandidate, false);
});

// multiple turns with mixed valid and invalid
const multiTurnsReport = {
  identity: { scriptedTurns: 2, currentPinParity: true, case: 'multiturns' },
  turns: [
    { turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sourceSha },
    { turn: 2, expectedKind: 'clarification', exitCode: 0 },
  ],
  finalSourceSha256: sourceSha,
  holdout: { exitCode: 0, fixedExpectationsPassed: true },
};
const multiTurnsCaptures = [
  { exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /isolated/case.ghost.md: SHA-256 ${sourceSha}.\n` },
  { exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}\n` },
];

test('multiple turns with correct kinds and saved candidate pass complete but finalCandidate requires last turn candidate', () => {
  const ver = classifyCase(multiTurnsReport, multiTurnsCaptures, { source: sourceBuffer, holdout: holdoutValid });
  assert.equal(ver.complete, true);
  assert.equal(ver.finalCandidate, false); // last turn is clarification, not candidate
});

// fixedHoldoutPass requires finalCandidate and valid source and holdout
const holdoutFailReport = {
  ...multiTurnsReport,
  turns: [
    { turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sourceSha },
    { turn: 2, expectedKind: 'candidate', exitCode: 0, sourceSha256: sourceSha },
  ],
  finalSourceSha256: sourceSha,
  holdout: { exitCode: 0, fixedExpectationsPassed: true },
};
const holdoutFailCapture = [
  { exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /isolated/case.ghost.md: SHA-256 ${sourceSha}.\n` },
  { exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /isolated/case.ghost.md: SHA-256 ${sourceSha}.\n` },
];

const holdoutInvalids = [holdoutFailExit, holdoutFailMissing, null, undefined];
for (const invalidHoldout of holdoutInvalids) {
  test(`fixedHoldoutPass fails if holdout invalid or missing: ${JSON.stringify(invalidHoldout)}`, () => {
    const ver = classifyCase(holdoutFailReport, holdoutFailCapture, { source: sourceBuffer, holdout: invalidHoldout });
    assert.equal(ver.fixedHoldoutPass, false);
  });
}

// missing evidence
const missingEvidenceReport = {
  identity: { scriptedTurns: 1, currentPinParity: true, case: 'missingevidence' },
  turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sourceSha }],
  finalSourceSha256: sourceSha,
  holdout: { exitCode: 0, fixedExpectationsPassed: true },
};

test('missing source or holdout makes fixedHoldoutPass false', () => {
  assert.equal(classifyCase(missingEvidenceReport, [validCapture], { holdout: holdoutValid }).fixedHoldoutPass, false);
  assert.equal(classifyCase(missingEvidenceReport, [validCapture], { source: sourceBuffer }).fixedHoldoutPass, false);
  assert.equal(classifyCase(missingEvidenceReport, [validCapture], {}).fixedHoldoutPass, false);
});
