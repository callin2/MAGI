import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { classifyCase, observedKind } from './verdict.mjs';

const source = '# Stored candidate\n';
const digest = createHash('sha256').update(source).digest('hex');
function fixture() {
  return {
    report: { identity: { case: 'demo', scriptedTurns: 1, currentPinParity: true },
      turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: digest }],
      finalSourceSha256: digest, holdout: { exitCode: 0, fixedExpectationsPassed: true } },
    captures: [{ exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /old/demo.ghost.md: SHA-256 ${digest}.\n` }],
    evidence: { source: Buffer.from(source), holdout: { exitCode: 0, stdout: 'noise\nUser expectations passed: 3\n' } },
  };
}
function classify(f) { return classifyCase(f.report, f.captures, f.evidence); }
test('corroborated candidate, counts, and string or byte source', () => {
  const f = fixture();
  for (const value of [source, Buffer.from(source)]) {
    f.evidence.source = value;
    const v = classify(f);
    assert.equal(v.complete, true);
    assert.equal(v.finalCandidate, true);
    assert.equal(v.fixedHoldoutPass, true);
    assert.equal(v.expectedCandidateTurns, 1);
    assert.equal(v.observedCandidateTurns, 1);
    assert.deepEqual(v.kindMismatchTurns, []);
  }
});
test('source evidence is necessary only for final candidate, not conversation completion', () => {
  for (const value of [undefined, null, {}, source + 'tampered']) {
    const f = fixture(); f.evidence.source = value;
    const v = classify(f);
    assert.equal(v.complete, true);
    assert.equal(v.finalCandidate, false);
    assert.equal(v.fixedHoldoutPass, false);
  }
  const f = fixture();
  assert.equal(classifyCase(f.report, f.captures).finalCandidate, false);
});
test('actual numeric successful turn exits are mandatory', () => {
  for (const value of [undefined, null, '0', 1]) {
    const f = fixture(); f.captures[0].exitCode = value;
    assert.equal(classify(f).complete, false);
  }
  const f = fixture(); f.captures = [];
  assert.equal(classify(f).complete, false);
});
test('report labels and holdout capture must independently support success', () => {
  const invalid = [undefined, {}, { exitCode: '0', stdout: 'User expectations passed: 1' },
    { exitCode: 1, stdout: 'User expectations passed: 1' }, { exitCode: 0, stdout: '' },
    { exitCode: 0, stdout: 'prefix User expectations passed: 1' }, { exitCode: 0, stdout: 42 }];
  for (const holdout of invalid) {
    const f = fixture(); f.evidence.holdout = holdout;
    assert.equal(classify(f).finalCandidate, true);
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
  for (const claim of [undefined, { exitCode: 0, fixedExpectationsPassed: 'true' },
    { exitCode: 1, fixedExpectationsPassed: true }, { exitCode: 0, fixedExpectationsPassed: false }]) {
    const f = fixture(); f.report.holdout = claim;
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
});
test('clarification and answer complete without candidate or holdout files', () => {
  for (const kind of ['clarification', 'answer']) {
    const report = { identity: { currentPinParity: true, scriptedTurns: 1 }, turns: [{ turn: 1, expectedKind: kind, exitCode: 0 }] };
    const v = classifyCase(report, [{ exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"${kind}"}\n` }]);
    assert.equal(v.complete, true);
    assert.equal(v.finalCandidate, false);
    assert.equal(v.fixedHoldoutPass, false);
    assert.equal(v.observedCandidateTurns, 0);
  }
});
test('pin, kind, final turn, saved hash, and final claim protections', () => {
  const changes = [
    f => { f.report.identity.currentPinParity = false; },
    f => { f.report.identity.scriptedTurns = 2; },
    f => { f.report.turns[0].exitCode = 1; },
    f => { f.captures[0].stdout += 'GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\n'; },
    f => { f.captures[0].stdout = 'GHOSTFLOW_RESULT_JSON:{"kind":"answer"}\n'; },
    f => { f.captures[0].stdout = 'GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\n'; },
    f => { f.report.finalSourceSha256 = 'a'.repeat(64); },
    f => { f.report.turns[0].sourceSha256 = 'b'.repeat(64); },
    f => { f.report.turns[0].expectedKind = 'answer'; f.captures[0].stdout = 'GHOSTFLOW_RESULT_JSON:{"kind":"answer"}\n'; },
  ];
  for (const change of changes) {
    const f = fixture(); change(f);
    assert.equal(classify(f).finalCandidate, false);
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
  for (const stdout of ['', 'GHOSTFLOW_RESULT_JSON:{"kind":"other"}', 'GHOSTFLOW_RESULT_JSON:{"kind":"candidate","extra":true}', 'GHOSTFLOW_RESULT_JSON:invalid']) {
    assert.equal(observedKind(stdout), null);
  }
});

// Exercise the real CLI module in-process: sandbox rules forbid child processes.
let serial = 0;
async function runCLI(directory) {
  const argv = process.argv;
  const exitCode = process.exitCode;
  process.argv = [argv[0], fileURLToPath(new URL('./verdict.mjs', import.meta.url)), directory];
  process.exitCode = 0;
  try {
    await import(`./verdict.mjs?cli-regression=${++serial}`);
    return process.exitCode;
  } finally { process.argv = argv; process.exitCode = exitCode; }
}
test('CLI loads actual case artifacts, fails closed on missing evidence, and protects historical outputs', async () => {
  const root = await mkdtemp(new URL('./verdict-tests-', import.meta.url));
  try {
    for (const scenario of ['valid', 'source-missing', 'source-changed', 'holdout-missing', 'holdout-failed', 'turn-missing', 'turn-failed']) {
      const dir = path.join(root, scenario);
      const caseDir = path.join(dir, 'demo');
      await mkdir(caseDir, { recursive: true });
      const f = fixture();
      await writeFile(path.join(caseDir, 'report.json'), JSON.stringify(f.report));
      if (scenario !== 'turn-missing') {
        if (scenario === 'turn-failed') f.captures[0].exitCode = 1;
        await writeFile(path.join(caseDir, 'turn-1.json'), JSON.stringify(f.captures[0]));
      }
      if (scenario !== 'source-missing') await writeFile(path.join(caseDir, 'demo.ghost.md'), scenario === 'source-changed' ? 'wrong' : source);
      if (scenario !== 'holdout-missing') {
        if (scenario === 'holdout-failed') f.evidence.holdout.exitCode = 1;
        await writeFile(path.join(caseDir, 'holdout-result.json'), JSON.stringify(f.evidence.holdout));
      }
      assert.equal(await runCLI(dir), scenario === 'valid' ? 0 : 1);
      const v = JSON.parse(await readFile(path.join(caseDir, 'verdict.json'), 'utf8'));
      assert.equal(v.fixedHoldoutPass, scenario === 'valid');
      assert.equal(v.complete, !['turn-missing', 'turn-failed'].includes(scenario));
      const historical = await readFile(path.join(caseDir, 'verdict.json'), 'utf8');
      await assert.rejects(runCLI(dir), /Existing verdict evidence/);
      assert.equal(await readFile(path.join(caseDir, 'verdict.json'), 'utf8'), historical);
      // A case verdict alone must also block writing any new summary.
      await rm(path.join(dir, 'verdict-summary.json'));
      await assert.rejects(runCLI(dir), /Existing verdict evidence/);
      await assert.rejects(access(path.join(dir, 'verdict-summary.json')));
      assert.equal(await readFile(path.join(caseDir, 'verdict.json'), 'utf8'), historical);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
