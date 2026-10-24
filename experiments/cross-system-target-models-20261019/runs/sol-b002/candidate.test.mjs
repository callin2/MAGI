import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { classifyCase, observedKind } from './verdict.mjs';

const source = '# Real saved source\n';
const digest = createHash('sha256').update(source).digest('hex');
function fixture() {
  return {
    report: { identity: { case: 'case-a', scriptedTurns: 1, currentPinParity: true },
      turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: digest }],
      finalSourceSha256: digest, holdout: { exitCode: 0, fixedExpectationsPassed: true } },
    captures: [{ exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved case-a.ghost.md: SHA-256 ${digest}.\n` }],
    evidence: { source, holdout: { exitCode: 0, stdout: 'checks\nUser expectations passed: 2\n' } },
  };
}
const classify = f => classifyCase(f.report, f.captures, f.evidence);

test('source bytes and all three independent statuses', () => {
  const f = fixture();
  assert.equal(classify(f).fixedHoldoutPass, true);
  f.evidence.source = Buffer.from(source);
  assert.equal(classify(f).finalCandidate, true);
  for (const bad of [undefined, '', source + 'changed', new Uint8Array([1])]) {
    f.evidence.source = bad;
    const v = classify(f);
    assert.equal(v.complete, true);
    assert.equal(v.finalCandidate, false);
    assert.equal(v.fixedHoldoutPass, false);
  }
  assert.equal(classifyCase(f.report, f.captures).finalCandidate, false);
});

test('real numeric process exits, response kinds and pin parity are required', () => {
  for (const exitCode of [undefined, null, '0', 1, -1]) {
    const f = fixture(); f.captures[0].exitCode = exitCode;
    assert.equal(classify(f).complete, false);
  }
  for (const mutate of [
    f => { f.report.identity.currentPinParity = false; },
    f => { f.report.identity.scriptedTurns = 2; },
    f => { f.report.turns[0].exitCode = 1; },
    f => { f.captures = []; },
    f => { f.captures[0].stdout += 'GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\n'; },
    f => { f.report.turns[0].expectedKind = 'answer'; },
  ]) {
    const f = fixture(); mutate(f);
    assert.equal(classify(f).complete, false);
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
  assert.equal(observedKind('GHOSTFLOW_RESULT_JSON:{"kind":"answer","extra":true}\n'), null);
});

test('clarification and answer complete without source, but are not candidates', () => {
  for (const kind of ['clarification', 'answer']) {
    const f = fixture(); f.report.turns[0].expectedKind = kind;
    f.captures[0].stdout = `GHOSTFLOW_RESULT_JSON:{"kind":"${kind}"}\n`;
    const v = classifyCase(f.report, f.captures);
    assert.equal(v.complete, true);
    assert.equal(v.finalCandidate, false);
    assert.equal(v.fixedHoldoutPass, false);
    assert.equal(v.expectedCandidateTurns, 0);
    assert.equal(v.observedCandidateTurns, 0);
    assert.deepEqual(v.kindMismatchTurns, []);
  }
});

test('saved marker and final claim must agree with actual source', () => {
  for (const mutate of [
    f => { f.captures[0].stdout = 'GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\n'; },
    f => { f.report.finalSourceSha256 = 'a'.repeat(64); },
    f => { f.report.turns[0].sourceSha256 = 'a'.repeat(64); },
  ]) {
    const f = fixture(); mutate(f);
    assert.equal(classify(f).complete, true);
    assert.equal(classify(f).finalCandidate, false);
  }
});

test('holdout requires strict report success and a real successful check line', () => {
  for (const capture of [undefined, {}, { exitCode: '0', stdout: 'User expectations passed: 1' },
    { exitCode: 1, stdout: 'User expectations passed: 1' }, { exitCode: 0, stdout: '' },
    { exitCode: 0, stdout: 'not User expectations passed: 1' }]) {
    const f = fixture(); f.evidence.holdout = capture;
    assert.equal(classify(f).finalCandidate, true);
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
  for (const claim of [undefined, { exitCode: 1, fixedExpectationsPassed: true },
    { exitCode: 0, fixedExpectationsPassed: 'true' }, { exitCode: 0, fixedExpectationsPassed: false }]) {
    const f = fixture(); f.report.holdout = claim;
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
});

test('CLI reads actual case files, fails closed on missing evidence, refuses overwrites', async () => {
  // Exercise the real entry branch in-process: no child processes or external access.
  const root = await mkdtemp(fileURLToPath(new URL('./cli-regression-', import.meta.url)));
  const argv = process.argv;
  const oldExit = process.exitCode;
  const output = process.stdout.write;
  const modulePath = fileURLToPath(new URL('./verdict.mjs', import.meta.url));
  let invocation = 0;
  const invoke = async dir => {
    process.argv = [argv[0], modulePath, dir]; process.exitCode = 0;
    await import(`./verdict.mjs?cli-regression=${++invocation}`);
    return process.exitCode;
  };
  try {
    process.stdout.write = () => true;
    for (const scenario of ['valid', 'missing-source', 'wrong-source', 'missing-holdout', 'failed-holdout', 'missing-turn']) {
      const dir = path.join(root, scenario);
      const caseDir = path.join(dir, 'case-a');
      await mkdir(caseDir, { recursive: true });
      const f = fixture();
      await writeFile(path.join(caseDir, 'report.json'), JSON.stringify(f.report));
      if (scenario !== 'missing-turn') await writeFile(path.join(caseDir, 'turn-1.json'), JSON.stringify(f.captures[0]));
      if (scenario !== 'missing-source') await writeFile(path.join(caseDir, 'case-a.ghost.md'), scenario === 'wrong-source' ? 'wrong' : source);
      if (scenario !== 'missing-holdout') await writeFile(path.join(caseDir, 'holdout-result.json'), JSON.stringify(scenario === 'failed-holdout' ? { exitCode: 1, stdout: 'User expectations passed: 2' } : f.evidence.holdout));
      assert.equal(await invoke(dir), scenario === 'valid' ? 0 : 1);
      const saved = await readFile(path.join(caseDir, 'verdict.json'), 'utf8');
      assert.equal(JSON.parse(saved).fixedHoldoutPass, scenario === 'valid');
      assert.equal(JSON.parse(await readFile(path.join(dir, 'verdict-summary.json'), 'utf8')).length, 1);
      await assert.rejects(invoke(dir), /Existing verdict evidence/);
      assert.equal(await readFile(path.join(caseDir, 'verdict.json'), 'utf8'), saved);
    }
    // A lone historical per-case verdict must also prevent all output writes.
    const dir = path.join(root, 'historical'); const caseDir = path.join(dir, 'case-a');
    await mkdir(caseDir, { recursive: true });
    await writeFile(path.join(caseDir, 'report.json'), JSON.stringify(fixture().report));
    await writeFile(path.join(caseDir, 'verdict.json'), 'historical');
    await assert.rejects(invoke(dir), /Existing verdict evidence/);
    assert.equal(await readFile(path.join(caseDir, 'verdict.json'), 'utf8'), 'historical');
    await assert.rejects(readFile(path.join(dir, 'verdict-summary.json')), { code: 'ENOENT' });
  } finally {
    process.argv = argv; process.exitCode = oldExit; process.stdout.write = output;
    await rm(root, { recursive: true, force: true });
  }
});
