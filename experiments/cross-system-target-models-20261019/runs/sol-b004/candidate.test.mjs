import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { classifyCase, observedKind } from './verdict.mjs';

const source = '# Candidate\n';
const digest = createHash('sha256').update(source).digest('hex');
function fixture() {
  return {
    report: { identity: { case: 'sample', currentPinParity: true, scriptedTurns: 1 },
      turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: digest }],
      finalSourceSha256: digest, holdout: { exitCode: 0, fixedExpectationsPassed: true } },
    captures: [{ exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /any/sample.ghost.md: SHA-256 ${digest}.\n` }],
    evidence: { source, holdout: { exitCode: 0, stdout: 'User expectations passed: 7\n' } },
  };
}
const classify = f => classifyCase(f.report, f.captures, f.evidence);

test('source bytes and real captures establish all three statuses', () => {
  const f = fixture();
  f.evidence.source = Buffer.from(source);
  const v = classify(f);
  assert.equal(v.complete, true);
  assert.equal(v.finalCandidate, true);
  assert.equal(v.fixedHoldoutPass, true);
  assert.equal(v.expectedCandidateTurns, 1);
  assert.equal(v.observedCandidateTurns, 1);
  assert.deepEqual(v.kindMismatchTurns, []);
});

test('source absence, edits, and final-claim disagreement cannot certify candidate', () => {
  for (const source of [undefined, '', '# Modified\n', { toString: () => '# Candidate\n' }]) {
    const f = fixture(); f.evidence.source = source;
    const v = classify(f);
    assert.equal(v.complete, true);
    assert.equal(v.finalCandidate, false);
    assert.equal(v.fixedHoldoutPass, false);
  }
  const f = fixture(); f.report.finalSourceSha256 = 'a'.repeat(64);
  assert.equal(classify(f).finalCandidate, false);
  assert.equal(classifyCase(f.report, f.captures).fixedHoldoutPass, false);
});

test('actual process exit cannot be replaced by report exit or historical verdict fields', () => {
  for (const capture of [undefined, {}, { exitCode: 9 }, { exitCode: '0' }, { exitCode: null }]) {
    const f = fixture();
    f.report.complete = f.report.finalCandidate = f.report.fixedHoldoutPass = true;
    f.captures[0] = capture ? { stdout: f.captures[0].stdout, ...capture } : undefined;
    const v = classify(f);
    assert.equal(v.complete, false);
    assert.equal(v.finalCandidate, false);
    assert.equal(v.fixedHoldoutPass, false);
  }
  const f = fixture(); f.report.turns[0].exitCode = 1;
  assert.equal(classify(f).complete, false);
});

test('fixed holdout needs both explicit report success and actual successful marker capture', () => {
  for (const holdout of [undefined, {}, { exitCode: 1, stdout: 'User expectations passed: 1' },
    { exitCode: '0', stdout: 'User expectations passed: 1' },
    { exitCode: 0, stdout: 'not passed' }, { exitCode: 0, stdout: 'prefix User expectations passed: 1' }]) {
    const f = fixture(); f.evidence.holdout = holdout;
    assert.equal(classify(f).finalCandidate, true);
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
  for (const holdout of [undefined, { exitCode: 1, fixedExpectationsPassed: true },
    { exitCode: 0, fixedExpectationsPassed: 'true' }, { exitCode: 0, fixedExpectationsPassed: false }]) {
    const f = fixture(); f.report.holdout = holdout;
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
});

test('complete clarification and answer do not require source or holdout evidence', () => {
  for (const kind of ['clarification', 'answer']) {
    const f = fixture();
    f.report.turns = [{ turn: 1, expectedKind: kind, exitCode: 0 }];
    f.captures = [{ exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"${kind}"}\n` }];
    const v = classifyCase(f.report, f.captures);
    assert.equal(v.complete, true);
    assert.equal(v.finalCandidate, false);
    assert.equal(v.fixedHoldoutPass, false);
    assert.equal(v.observedCandidateTurns, 0);
  }
});

test('save marker is required for finalCandidate, not conversational completion', () => {
  const f = fixture(); f.captures[0].stdout = 'GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\n';
  const v = classify(f);
  assert.equal(v.complete, true);
  assert.equal(v.finalCandidate, false);
});

test('compiler pin, scripted turns, final response, and strict response parser remain enforced', () => {
  const f = fixture(); f.report.identity.currentPinParity = false;
  assert.equal(classify(f).complete, false);
  f.report.identity.currentPinParity = true; f.report.identity.scriptedTurns = 2;
  assert.equal(classify(f).complete, false);
  f.report.identity.scriptedTurns = 1; f.report.turns[0].expectedKind = 'answer';
  assert.deepEqual(classify(f).kindMismatchTurns, [1]);
  for (const stdout of ['', 'GHOSTFLOW_RESULT_JSON:null', 'GHOSTFLOW_RESULT_JSON:{bad}',
    'GHOSTFLOW_RESULT_JSON:{"kind":"candidate","extra":1}',
    'GHOSTFLOW_RESULT_JSON:{"kind":"other"}', f.captures[0].stdout.repeat(2)]) {
    assert.equal(observedKind(stdout), null);
  }
  f.report.turns.push({ turn: 2, expectedKind: 'answer', exitCode: 0 });
  f.report.turns[0].expectedKind = 'candidate'; f.report.identity.scriptedTurns = 2;
  f.captures.push({ exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"answer"}' });
  assert.equal(classify(f).complete, true);
  assert.equal(classify(f).finalCandidate, false);
});

// Exercise the real CLI module in-process: no subprocess or external access required.
let invocation = 0;
async function cli(directory) {
  const oldArgs = process.argv;
  const oldExit = process.exitCode;
  try {
    process.argv = [process.execPath, fileURLToPath(new URL('./verdict.mjs', import.meta.url)), directory];
    process.exitCode = 0;
    await import(`./verdict.mjs?cli-regression=${++invocation}`);
    return process.exitCode;
  } finally {
    process.argv = oldArgs;
    process.exitCode = oldExit;
  }
}

test('CLI loads exact case files, fails closed on missing/bad evidence, and never overwrites verdicts', async () => {
  const root = await mkdtemp(fileURLToPath(new URL('./cli-regression-', import.meta.url)));
  try {
    for (const mode of ['valid', 'missing-source', 'changed-source', 'missing-holdout', 'bad-holdout', 'missing-turn', 'failed-turn']) {
      const run = path.join(root, mode); const dir = path.join(run, 'sample');
      await mkdir(dir, { recursive: true });
      const f = fixture();
      await writeFile(path.join(dir, 'report.json'), JSON.stringify(f.report));
      if (mode !== 'missing-source') await writeFile(path.join(dir, 'sample.ghost.md'), mode === 'changed-source' ? 'changed' : source);
      if (mode !== 'missing-holdout') await writeFile(path.join(dir, 'holdout-result.json'), mode === 'bad-holdout' ? '{bad' : JSON.stringify(f.evidence.holdout));
      if (mode === 'failed-turn') f.captures[0].exitCode = 2;
      if (mode !== 'missing-turn') await writeFile(path.join(dir, 'turn-1.json'), JSON.stringify(f.captures[0]));
      assert.equal(await cli(run), mode === 'valid' ? 0 : 1);
      const verdictPath = path.join(dir, 'verdict.json');
      const before = await readFile(verdictPath, 'utf8');
      const v = JSON.parse(before);
      assert.equal(v.fixedHoldoutPass, mode === 'valid');
      assert.equal(v.complete, !['missing-turn', 'failed-turn'].includes(mode));
      assert.deepEqual(JSON.parse(await readFile(path.join(run, 'verdict-summary.json'), 'utf8')), [v]);
      await assert.rejects(cli(run), /Existing verdict evidence/);
      assert.equal(await readFile(verdictPath, 'utf8'), before);
    }
    const run = path.join(root, 'existing-case-verdict'); const dir = path.join(run, 'sample');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'report.json'), JSON.stringify(fixture().report));
    await writeFile(path.join(dir, 'verdict.json'), 'historical evidence');
    await assert.rejects(cli(run), /Existing verdict evidence/);
    assert.equal(await readFile(path.join(dir, 'verdict.json'), 'utf8'), 'historical evidence');
    await assert.rejects(readFile(path.join(run, 'verdict-summary.json')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
