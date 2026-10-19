import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { classifyCase, observedKind, runCli } from './verdict.mjs';
const source = '# Stored candidate\n';
const digest = createHash('sha256').update(source).digest('hex');
const fixture = () => ({
  report: { identity: { case: 'demo', scriptedTurns: 1, currentPinParity: true },
    turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: digest }],
    finalSourceSha256: digest, holdout: { exitCode: 0, fixedExpectationsPassed: true },
    complete: true, finalCandidate: true, fixedHoldoutPass: true },
  captures: [{ exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved demo.ghost.md: SHA-256 ${digest}.\n` }],
  evidence: { source, holdout: { exitCode: 0, stdout: 'User expectations passed: 1\n' } },
});
const classify = f => classifyCase(f.report, f.captures, f.evidence);

test('source bytes, not claims, establish the final candidate', () => {
  const f = fixture();
  assert.equal(classify(f).fixedHoldoutPass, true);
  f.evidence.source = Buffer.from(source);
  assert.equal(classify(f).finalCandidate, true);
  for (const bad of [undefined, '', '# changed\n', {}, Buffer.from('wrong')]) {
    f.evidence.source = bad;
    const v = classify(f);
    assert.equal(v.complete, true);
    assert.equal(v.finalCandidate, false);
    assert.equal(v.fixedHoldoutPass, false);
  }
  assert.equal(classifyCase(f.report, f.captures).finalCandidate, false);
});

test('real process exit and response are mandatory; report flags cannot override', () => {
  for (const exitCode of [1, undefined, '0', null]) {
    const f = fixture(); f.captures[0].exitCode = exitCode;
    assert.equal(classify(f).complete, false);
  }
  const f = fixture(); f.captures = [];
  assert.equal(classify(f).complete, false);
  assert.deepEqual(classify(f).kindMismatchTurns, [1]);
  for (const mutate of [
    f => { f.report.identity.currentPinParity = false; },
    f => { f.report.identity.scriptedTurns = 2; },
    f => { f.report.turns[0].exitCode = 1; },
    f => { f.captures[0].stdout = 'GHOSTFLOW_RESULT_JSON:{"kind":"answer"}\n'; },
  ]) { const f = fixture(); mutate(f); assert.equal(classify(f).complete, false); }
  const g = fixture(); g.report.finalSourceSha256 = '0'.repeat(64);
  assert.equal(classify(g).finalCandidate, false);
  const h = fixture(); h.captures[0].stdout = h.captures[0].stdout.split('\n')[0];
  assert.equal(classify(h).complete, true);
  assert.equal(classify(h).finalCandidate, false);
  h.captures[0].stdout += `\nSaved demo: SHA-256 ${'0'.repeat(64)}.\n`;
  assert.equal(classify(h).finalCandidate, false);
});

test('holdout requires both strict report success and actual successful check output', () => {
  for (const holdout of [undefined, {}, { exitCode: 1, stdout: 'User expectations passed: 1' },
    { exitCode: '0', stdout: 'User expectations passed: 1' },
    { exitCode: 0, stdout: 'some User expectations passed: 1' },
    { exitCode: 0, stdout: '' }, { exitCode: 0, stdout: 42 }]) {
    const f = fixture(); f.evidence.holdout = holdout;
    assert.equal(classify(f).finalCandidate, true);
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
  for (const holdout of [undefined, { exitCode: 1, fixedExpectationsPassed: true },
    { exitCode: 0, fixedExpectationsPassed: 'true' }]) {
    const f = fixture(); f.report.holdout = holdout;
    assert.equal(classify(f).fixedHoldoutPass, false);
  }
});

test('clarification and answer complete without source or holdout; counts survive', () => {
  for (const kind of ['clarification', 'answer']) {
    const f = fixture(); f.report.turns[0].expectedKind = kind;
    f.captures[0].stdout = `GHOSTFLOW_RESULT_JSON:{"kind":"${kind}"}\n`;
    const v = classifyCase(f.report, f.captures);
    assert.equal(v.complete, true); assert.equal(v.finalCandidate, false);
    assert.equal(v.fixedHoldoutPass, false);
    assert.equal(v.expectedCandidateTurns, 0); assert.equal(v.observedCandidateTurns, 0);
    assert.deepEqual(v.kindMismatchTurns, []);
  }
});

test('strict response kind parser rejects ambiguous or extra fields', () => {
  for (const stdout of [null, '', 'GHOSTFLOW_RESULT_JSON:null',
    'GHOSTFLOW_RESULT_JSON:{"kind":"candidate","extra":true}',
    'GHOSTFLOW_RESULT_JSON:{"kind":"other"}',
    fixture().captures[0].stdout.repeat(2)]) assert.equal(observedKind(stdout), null);
});

test('CLI loader uses stored files, fails closed on missing evidence, and never overwrites verdicts', async () => {
  const root = await mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), 'cli-regression-'));
  const originalExit = process.exitCode;
  try {
    for (const mode of ['valid', 'source-missing', 'source-changed', 'holdout-missing', 'holdout-failed', 'capture-missing']) {
      const dir = path.join(root, mode, 'demo');
      await mkdir(dir, { recursive: true });
      const f = fixture();
      await writeFile(path.join(dir, 'report.json'), JSON.stringify(f.report));
      if (mode !== 'capture-missing') await writeFile(path.join(dir, 'turn-1.json'), JSON.stringify(f.captures[0]));
      if (mode !== 'source-missing') await writeFile(path.join(dir, 'demo.ghost.md'), mode === 'source-changed' ? 'tampered' : source);
      if (mode !== 'holdout-missing') await writeFile(path.join(dir, 'holdout-result.json'), JSON.stringify(
        mode === 'holdout-failed' ? { exitCode: 1, stdout: 'User expectations passed: 1' } : f.evidence.holdout));
      process.exitCode = 0;
      await runCli(path.dirname(dir));
      const stored = JSON.parse(await readFile(path.join(dir, 'verdict.json'), 'utf8'));
      assert.equal(stored.fixedHoldoutPass, mode === 'valid');
      assert.equal(process.exitCode, mode === 'valid' ? 0 : 1);
      const before = await readFile(path.join(dir, 'verdict.json'), 'utf8');
      await assert.rejects(runCli(path.dirname(dir)), /Existing verdict evidence/);
      assert.equal(await readFile(path.join(dir, 'verdict.json'), 'utf8'), before);
    }
    const dir = path.join(root, 'protected', 'demo'); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'report.json'), JSON.stringify(fixture().report));
    await writeFile(path.join(dir, 'verdict.json'), 'historical');
    await assert.rejects(runCli(path.dirname(dir)), /Existing verdict evidence/);
    assert.equal(await readFile(path.join(dir, 'verdict.json'), 'utf8'), 'historical');
  } finally {
    process.exitCode = originalExit;
    await rm(root, { recursive: true, force: true });
  }
});
