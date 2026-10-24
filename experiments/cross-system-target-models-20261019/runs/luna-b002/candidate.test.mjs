import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase } from './verdict.mjs';
const source = '# candidate\n', hash = createHash('sha256').update(source).digest('hex');
const base = { identity: { scriptedTurns: 1, currentPinParity: true }, turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: hash }], finalSourceSha256: hash, holdout: { exitCode: 0, fixedExpectationsPassed: true } };
const capture = { exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved case.ghost.md: SHA-256 ${hash}.\n` };
const holdout = { exitCode: 0, stdout: 'User expectations passed: 4\n' };
test('needs source and actual holdout, then confirms all three statuses', () => {
 assert.equal(classifyCase(base, [capture]).complete, true);
 assert.equal(classifyCase(base, [capture], {source, holdout}).fixedHoldoutPass, true);
 assert.equal(classifyCase(base, [capture], {source: '# forged', holdout}).finalCandidate, false);
 assert.equal(classifyCase(base, [capture], {source, holdout: {exitCode: 0, stdout: 'all good'}}).fixedHoldoutPass, false);
});
test('process exit comes from capture, not report', () => {
 assert.equal(classifyCase(base, [{...capture, exitCode: 2}], {source, holdout}).complete, false);
});
test('clarification completes without candidate persistence', () => {
 const r = {identity: base.identity, turns: [{turn: 1, expectedKind: 'clarification', exitCode: 99}]};
 assert.equal(classifyCase(r, [{exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}'}]).complete, true);
 assert.equal(classifyCase(r, [{exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}'}]).finalCandidate, false);
});
