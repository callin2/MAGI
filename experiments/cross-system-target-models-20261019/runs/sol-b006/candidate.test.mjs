import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { classifyCase, observedKind, runCli } from './verdict.mjs';

const source = '# Candidate\n';
const digest = createHash('sha256').update(source).digest('hex');
const report = () => ({ identity: { case: 'sample', scriptedTurns: 1, currentPinParity: true },
  turns: [{ turn: 1, expectedKind: 'candidate', exitCode: 0, sourceSha256: digest }],
  finalSourceSha256: digest, holdout: { exitCode: 0, fixedExpectationsPassed: true } });
const capture = () => ({ exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved sample.ghost.md: SHA-256 ${digest}.\n` });
const evidence = () => ({ source, holdout: { exitCode: 0, stdout: 'User expectations passed: 2\n' } });

test('source bytes and real holdout are required independently of report labels', () => {
  assert.equal(classifyCase(report(), [capture()], evidence()).fixedHoldoutPass, true);
  assert.equal(classifyCase(report(), [capture()], { ...evidence(), source: Buffer.from(source) }).finalCandidate, true);
  for (const badSource of [undefined, null, '', source + 'changed', { text: source }]) {
    const result = classifyCase(report(), [capture()], { ...evidence(), source: badSource });
    assert.equal(result.complete, true);
    assert.equal(result.finalCandidate, false);
    assert.equal(result.fixedHoldoutPass, false);
  }
  assert.equal(classifyCase(report(), [capture()]).fixedHoldoutPass, false);
  for (const holdout of [undefined, {}, { exitCode: 1, stdout: 'User expectations passed: 2' },
    { exitCode: '0', stdout: 'User expectations passed: 2' }, { exitCode: 0, stdout: 'success' },
    { exitCode: 0, stdout: 'prefix User expectations passed: 2' }]) {
    const result = classifyCase(report(), [capture()], { source, holdout });
    assert.equal(result.finalCandidate, true);
    assert.equal(result.fixedHoldoutPass, false);
  }
});

test('capture exit codes, pins, response kinds and final saved claims cannot be forged by report', () => {
  for (const exitCode of [1, undefined, '0']) {
    const result = classifyCase(report(), [{ ...capture(), exitCode }], evidence());
    assert.equal(result.complete, false);
    assert.equal(result.finalCandidate, false);
  }
  assert.equal(classifyCase(report(), [], evidence()).complete, false);
  for (const stdout of ['', capture().stdout + capture().stdout, 'GHOSTFLOW_RESULT_JSON:{"kind":"answer"}']) {
    assert.equal(classifyCase(report(), [{ exitCode: 0, stdout }], evidence()).complete, false);
  }
  const r = report(); r.identity.currentPinParity = false;
  assert.equal(classifyCase(r, [capture()], evidence()).complete, false);
  r.identity.currentPinParity = true; r.identity.scriptedTurns = 2;
  assert.equal(classifyCase(r, [capture()], evidence()).complete, false);
  for (const mutate of [r => { r.finalSourceSha256 = 'a'.repeat(64); }, r => { r.turns[0].sourceSha256 = 'b'.repeat(64); }]) {
    const r = report(); mutate(r);
    assert.equal(classifyCase(r, [capture()], evidence()).finalCandidate, false);
  }
  const noSave = { exitCode: 0, stdout: 'GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\n' };
  const result = classifyCase(report(), [noSave], evidence());
  assert.equal(result.complete, true);
  assert.equal(result.finalCandidate, false);
  for (const holdout of [{ exitCode: 1, fixedExpectationsPassed: true }, { exitCode: 0, fixedExpectationsPassed: 'true' }]) {
    assert.equal(classifyCase({ ...report(), holdout }, [capture()], evidence()).fixedHoldoutPass, false);
  }
});

test('answer and clarification complete without candidate evidence; counters stay derived', () => {
  for (const kind of ['answer', 'clarification']) {
    const r = report(); r.turns = [{ turn: 1, expectedKind: kind, exitCode: 0 }];
    r.complete = false; r.finalCandidate = true; r.fixedHoldoutPass = true;
    const result = classifyCase(r, [{ exitCode: 0, stdout: `GHOSTFLOW_RESULT_JSON:{"kind":"${kind}"}` }]);
    assert.equal(result.complete, true);
    assert.equal(result.finalCandidate, false);
    assert.equal(result.fixedHoldoutPass, false);
    assert.equal(result.expectedCandidateTurns, 0);
    assert.equal(result.observedCandidateTurns, 0);
    assert.deepEqual(result.kindMismatchTurns, []);
  }
  assert.equal(observedKind('GHOSTFLOW_RESULT_JSON:{"kind":"candidate","extra":true}'), null);
  assert.equal(classifyCase({}, []).complete, false);
});

test('real CLI loader reads case files, fails closed, and never overwrites verdicts', async () => {
  const root = await mkdtemp(new URL('./verdict-fixture-', import.meta.url));
  try {
    for (const name of ['valid', 'missing-source', 'changed-source', 'missing-holdout', 'failed-turn', 'malformed-holdout', 'missing-turn']) {
      const dir = `${root}/${name}`;
      await mkdir(dir);
      const r = report(); r.identity.case = name;
      await writeFile(`${dir}/report.json`, JSON.stringify(r));
      if (name !== 'missing-turn') await writeFile(`${dir}/turn-1.json`, JSON.stringify({ ...capture(), exitCode: name === 'failed-turn' ? 7 : 0 }));
      if (name !== 'missing-source') await writeFile(`${dir}/${name}.ghost.md`, name === 'changed-source' ? 'wrong' : source);
      if (name !== 'missing-holdout') await writeFile(`${dir}/holdout-result.json`, name === 'malformed-holdout' ? '{' : JSON.stringify(evidence().holdout));
    }
    const rows = await runCli(root);
    for (const row of rows) assert.equal(row.fixedHoldoutPass, row.identity.case === 'valid', row.identity.case);
    const summary = await readFile(`${root}/verdict-summary.json`, 'utf8');
    assert.equal(JSON.parse(summary).length, 7);
    const saved = await readFile(`${root}/valid/verdict.json`, 'utf8');
    await assert.rejects(runCli(root), /Existing verdict evidence/);
    assert.equal(await readFile(`${root}/verdict-summary.json`, 'utf8'), summary);
    await rm(`${root}/verdict-summary.json`);
    await assert.rejects(runCli(root), /Existing verdict evidence/);
    assert.equal(await readFile(`${root}/valid/verdict.json`, 'utf8'), saved);
  } finally { await rm(root, { recursive: true, force: true }); }
});
