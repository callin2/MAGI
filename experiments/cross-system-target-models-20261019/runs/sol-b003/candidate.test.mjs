import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyCase, observedKind } from './verdict.mjs';
const source = '# Actual saved candidate\n';
const sha = createHash('sha256').update(source).digest('hex');
function fixture() {
  return {
    report: { identity: { case: 'sample', currentPinParity: true, scriptedTurns: 1 },
      turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: sha }],
      finalSourceSha256: sha, holdout: { exitCode: 0, fixedExpectationsPassed: true } },
    captures: [{ exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved sample.ghost.md: SHA-256 ${sha}.\n` }],
    evidence: { source, holdout: { exitCode: 0, stdout: 'User expectations passed: 3\n' } },
  };
}
const classify = f => classifyCase(f.report, f.captures, f.evidence);
test('positive string and Buffer evidence, fields and non-mutation', () => {
  const f = fixture(); const before = JSON.stringify(f);
  const v = classify(f);
  assert.equal(v.complete, true); assert.equal(v.finalCandidate, true); assert.equal(v.fixedHoldoutPass, true);
  assert.equal(v.expectedCandidateTurns, 1); assert.equal(v.observedCandidateTurns, 1);
  assert.deepEqual(v.kindMismatchTurns, []); assert.equal(JSON.stringify(f), before);
  f.evidence.source = Buffer.from(source); assert.equal(classify(f).fixedHoldoutPass, true);
});
test('source is mandatory, exact bytes must match both final claims', () => {
  for (const value of [undefined, null, '', source + '\n', { evidence: ['claimed'] }]) {
    const f = fixture(); f.evidence.source = value;
    assert.equal(classify(f).complete, true); assert.equal(classify(f).finalCandidate, false);
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
  const f = fixture(); f.report.finalSourceSha256 = '0'.repeat(64);
  assert.equal(classify(f).finalCandidate, false);
  assert.equal(classifyCase(f.report, f.captures).fixedHoldoutPass, false);
});
test('actual process exit is required, not report success', () => {
  for (const code of [1, -1, null, undefined, '0']) {
    const f = fixture(); f.captures[0].exitCode = code;
    assert.equal(classify(f).complete, false); assert.equal(classify(f).finalCandidate, false);
  }
  const f = fixture(); f.report.turns[0].exitCode = 1; assert.equal(classify(f).complete, false);
  assert.equal(classifyCase(f.report, []).complete, false);
});
test('holdout requires both strict report claims and actual successful capture', () => {
  for (const capture of [undefined, {}, {exitCode: '0', stdout: 'User expectations passed: 1'},
    {exitCode: 1, stdout: 'User expectations passed: 1'}, {exitCode: 0, stdout: 'claimed success'},
    {exitCode: 0, stdout: 'prefix User expectations passed: 1'}, {exitCode: 0, stdout: null}]) {
    const f = fixture(); f.evidence.holdout = capture;
    assert.equal(classify(f).finalCandidate, true); assert.equal(classify(f).fixedHoldoutPass, false);
  }
  for (const claim of [false, 'true', 1, undefined]) {
    const f = fixture(); f.report.holdout.fixedExpectationsPassed = claim;
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
  const f = fixture(); f.report.holdout.exitCode = 1; assert.equal(classify(f).fixedHoldoutPass, false);
});
test('completion is distinct from a saved final candidate', () => {
  for (const kind of ['clarification', 'answer', 'candidate']) {
    const f = fixture(); f.report.turns[0].expectedKind = kind;
    f.captures[0].stdout = `GHOSTFLOW_RESULT_JSON:{"kind":"${kind}"}\n`;
    const v = classifyCase(f.report, f.captures);
    assert.equal(v.complete, true); assert.equal(v.finalCandidate, false); assert.equal(v.fixedHoldoutPass, false);
  }
  const f = fixture(); f.captures[0].stdout = f.captures[0].stdout.replace(sha, '0'.repeat(64));
  assert.equal(classify(f).finalCandidate, false);
});
test('pin, scripted turn count, kind and unique response protections remain', () => {
  const f = fixture(); f.report.identity.currentPinParity = false; assert.equal(classify(f).complete, false);
  f.report.identity.currentPinParity = true; f.report.identity.scriptedTurns = 2; assert.equal(classify(f).complete, false);
  f.report.identity.scriptedTurns = 1; f.captures[0].stdout += f.captures[0].stdout;
  assert.equal(classify(f).complete, false); assert.deepEqual(classify(f).kindMismatchTurns, [1]);
  for (const stdout of ['GHOSTFLOW_RESULT_JSON:null', 'GHOSTFLOW_RESULT_JSON:{"kind":"answer","extra":1}',
    'GHOSTFLOW_RESULT_JSON:{"kind":"other"}', 'GHOSTFLOW_RESULT_JSON:not json']) assert.equal(observedKind(stdout), null);
});
test('all turns need successful captures; a final answer is not a candidate', () => {
  const f = fixture(); f.report.identity.scriptedTurns = 2;
  f.report.turns.push({ turn: 2, expectedKind: 'answer', exitCode: 0 });
  f.captures.push({ exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"answer"}' });
  assert.equal(classify(f).complete, true); assert.equal(classify(f).finalCandidate, false);
  f.captures[0].exitCode = 2; assert.equal(classify(f).complete, false);
});

test('CLI reads actual artifacts, fails closed on absent evidence, and never overwrites verdicts', async () => {
  const root = await mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), '.verdict-test-'));
  const oldArgv = process.argv; const oldExit = process.exitCode;
  let serial = 0;
  const run = async dir => {
    process.argv = [oldArgv[0], fileURLToPath(new URL('./verdict.mjs', import.meta.url)), dir];
    process.exitCode = 0;
    await import(`./verdict.mjs?cli-regression=${Date.now()}-${serial++}`);
    return process.exitCode;
  };
  try {
    const sets = [
      {name: 'valid', source: true, capture: true, holdout: true, pass: true},
      {name: 'missing-source', source: false, capture: true, holdout: true, pass: false},
      {name: 'missing-holdout', source: true, capture: true, holdout: false, pass: false},
      {name: 'missing-turn', source: true, capture: false, holdout: true, pass: false},
      {name: 'changed-source', source: 'changed', capture: true, holdout: true, pass: false},
    ];
    for (const item of sets) {
      const runDir = path.join(root, item.name); const dir = path.join(runDir, 'sample');
      await mkdir(dir, {recursive: true}); const f = fixture();
      await writeFile(path.join(dir, 'report.json'), JSON.stringify(f.report));
      if (item.source) await writeFile(path.join(dir, 'sample.ghost.md'), item.source === 'changed' ? 'tampered' : source);
      if (item.capture) await writeFile(path.join(dir, 'turn-1.json'), JSON.stringify(f.captures[0]));
      if (item.holdout) await writeFile(path.join(dir, 'holdout-result.json'), JSON.stringify(f.evidence.holdout));
      assert.equal(await run(runDir), item.pass ? 0 : 1);
      const prior = await readFile(path.join(dir, 'verdict.json'), 'utf8');
      assert.equal(JSON.parse(prior).fixedHoldoutPass, item.pass);
      const summary = await readFile(path.join(runDir, 'verdict-summary.json'), 'utf8');
      await assert.rejects(run(runDir), /Existing verdict evidence/);
      assert.equal(await readFile(path.join(dir, 'verdict.json'), 'utf8'), prior);
      assert.equal(await readFile(path.join(runDir, 'verdict-summary.json'), 'utf8'), summary);
    }
  } finally { process.argv = oldArgv; process.exitCode = oldExit; await rm(root, {recursive: true, force: true}); }
});
