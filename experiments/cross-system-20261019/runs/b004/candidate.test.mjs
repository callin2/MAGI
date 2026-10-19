import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCase, observedKind } from './verdict.mjs';
import { createHash } from 'node:crypto';

const source = '# Test source content\n';
const sourceHash = createHash('sha256').update(source).digest('hex');

const validHoldout = { exitCode: 0, stdout: 'User expectations passed: all good\n' };
const invalidHoldout = { exitCode: 0, stdout: 'Some other output\n' };

const validCapture = {
  exitCode: 0,
  stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /path/case.ghost.md: SHA-256 ${sourceHash}.\n`
};

const invalidCapture = {
  exitCode: 0,
  stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /path/case.ghost.md: SHA-256 deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef.\n`
};

test('observedKind parses correct kind', () => {
  assert.equal(observedKind(validCapture.stdout), 'candidate');
  assert.equal(observedKind(invalidCapture.stdout), 'candidate');
  assert.equal(observedKind(''), null);
  assert.equal(observedKind(validCapture.stdout + validCapture.stdout), null);
});


// Base report data
const baseReport = {
  identity: { scriptedTurns: 1, currentPinParity: true, case: 'case' },
  finalSourceSha256: sourceHash,
  turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sourceHash }],
  holdout: { exitCode: 0, fixedExpectationsPassed: true },
};

// Tests

// 1. Valid candidate detected, final candidate matches source, holdout evidence valid --> fixedHoldoutPass true
test('valid candidate with valid evidence produces fixedHoldoutPass true', () => {
  const result = classifyCase(baseReport, [validCapture], { source, holdout: validHoldout });
  assert.equal(result.fixedHoldoutPass, true);
  assert.equal(result.complete, true);
  assert.equal(result.finalCandidate, true);
});

// 2. Source evidence missing --> fixedHoldoutPass false, complete false
test('missing source evidence produces failure', () => {
  const result = classifyCase(baseReport, [validCapture], { holdout: validHoldout });
  assert.equal(result.fixedHoldoutPass, false);
  assert.equal(result.complete, false);
  assert.equal(result.finalCandidate, false);
  assert.match(result.reason, /Missing source evidence/);
});

// 3. Source evidence hash mismatch --> no fixedHoldoutPass
test('source hash mismatch produces failure', () => {
  const badSource = 'some different source';
  const result = classifyCase(baseReport, [validCapture], { source: badSource, holdout: validHoldout });
  assert.equal(result.fixedHoldoutPass, false);
  assert.equal(result.complete, false);
  assert.equal(result.finalCandidate, false);
  assert.match(result.reason, /SHA-256/);
});

// 4. Holdout evidence missing --> failure
test('missing holdout evidence produces failure', () => {
  const result = classifyCase(baseReport, [validCapture], { source });
  assert.equal(result.fixedHoldoutPass, false);
  assert.equal(result.complete, false);
  assert.equal(result.finalCandidate, false);
  assert.match(result.reason, /holdout evidence/);
});

// 5. Holdout evidence exitCode non-zero --> failure
test('invalid holdout exitCode produces failure', () => {
  const badHoldout = { exitCode: 1, stdout: 'User expectations passed: 1\n' };
  const result = classifyCase(baseReport, [validCapture], { source, holdout: badHoldout });
  assert.equal(result.fixedHoldoutPass, false);
});

// 6. Holdout evidence missing expected line --> failure
test('holdout stdout without expected line produces failure', () => {
  const badHoldout = { exitCode: 0, stdout: 'No pass line here\n' };
  const result = classifyCase(baseReport, [validCapture], { source, holdout: badHoldout });
  assert.equal(result.fixedHoldoutPass, false);
});

// 7. Turn expected kind mismatch disables complete
const baseReportMismatch = JSON.parse(JSON.stringify(baseReport));
baseReportMismatch.turns[0].expectedKind = 'answer';
const result7 = classifyCase(baseReportMismatch, [validCapture], { source, holdout: validHoldout });
test('turn expected kind mismatch disables complete', () => {
  assert.equal(result7.complete, false);
});

// 8. Turn exitCode non-zero disables complete
const baseReportFailExit = JSON.parse(JSON.stringify(baseReport));
baseReportFailExit.turns[0].exitCode = 1;
const result8 = classifyCase(baseReportFailExit, [validCapture], { source, holdout: validHoldout });
test('turn non-zero exitCode disables complete', () => {
  assert.equal(result8.complete, false);
});

// 9. Candidate file missing in stdout disables complete
const badCaptureNoSave = { exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nRandom output with no save line\n` };
const result9 = classifyCase(baseReport, [badCaptureNoSave], { source, holdout: validHoldout });
test('missing candidate save line disables complete', () => {
  assert.equal(result9.complete, false);
});

// 10. Clarification or answer can complete without final candidate
const clarifyReport = JSON.parse(JSON.stringify(baseReport));
clarifyReport.turns[0].expectedKind = 'answer';
const clarifyCapture = { exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"answer"}\n` };
const clarifyResult = classifyCase(clarifyReport, [clarifyCapture], { source, holdout: validHoldout });
test('answer turn can complete without candidate', () => {
  assert.equal(clarifyResult.complete, true);
  assert.equal(clarifyResult.finalCandidate, false);
  assert.equal(clarifyResult.fixedHoldoutPass, false);
});

// 11. Multiple turns correct with final candidate
const multiTurnReport = JSON.parse(JSON.stringify(baseReport));
multiTurnReport.identity.scriptedTurns = 2;
multiTurnReport.turns.push({ turn: 2, expectedKind: 'candidate', exitCode: 0, sourceSha256: sourceHash });
const multiCaptures = [
  validCapture,
  {
    exitCode: 0,
    stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /path/case.ghost.md: SHA-256 ${sourceHash}.\n`
  }
];
const multiResult = classifyCase(multiTurnReport, multiCaptures, { source, holdout: validHoldout });
test('multiple turns correct produce completion', () => {
  assert.equal(multiResult.complete, true);
  assert.equal(multiResult.finalCandidate, true);
  assert.equal(multiResult.fixedHoldoutPass, true);
});

// 12. CLI execution path test (basic) - skipped due to environment constraints
// Skipping this test because it requires child processes not allowed in this environment.
// test('CLI rejects missing directory arg', async () => {
//   try {
//     cp.execSync(`node ${__filename}`, { stdio: 'pipe' });
//     throw new Error('Should have thrown');
//   } catch (e) {
//     assert.match(e.message, /Usage: node verdict.mjs PRIVATE_RUN_DIR/);
//   }
// });

// More CLI tests are integration style requiring directories, skipped here
