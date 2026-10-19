import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export function observedKind(stdout) {
  const resultPrefix = 'GHOSTFLOW_RESULT_JSON:';
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith(resultPrefix));
  if (lines.length !== 1) return null;
  try {
    const response = JSON.parse(lines[0].slice(resultPrefix.length));
    return response && Object.keys(response).length === 1 &&
      ['candidate', 'clarification', 'answer'].includes(response.kind) ? response.kind : null;
  } catch { return null; }
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function sourceSha256(source) {
  if (typeof source !== 'string' && !Buffer.isBuffer(source)) return null;
  return createHash('sha256').update(source).digest('hex');
}

function savedSha256(stdout) {
  if (typeof stdout !== 'string') return null;
  const saved = stdout.split('\n').filter(line => line.startsWith('Saved '));
  if (saved.length !== 1) return null;
  return /SHA-256 ([a-f0-9]{64})\.$/.exec(saved[0])?.[1] ?? null;
}

/**
 * Classify a report using captures actually produced by the process.  Evidence
 * is deliberately separate from the report: report fields are claims, not
 * proof of a saved source file or of the fixed holdout execution.
 */
export function classifyCase(report, captures, evidence = {}) {
  const inputTurns = Array.isArray(report?.turns) ? report.turns : [];
  const inputCaptures = Array.isArray(captures) ? captures : [];
  const turns = inputTurns.map((turn, index) => {
    const capture = inputCaptures[index];
    const observed = observedKind(capture?.stdout);
    const claimedSha = turn?.sourceSha256;
    return {
      ...turn,
      observedKind: observed,
      // This records a process claim only.  Source-file corroboration is
      // required below before it can establish finalCandidate.
      persistedCandidate: isSha256(claimedSha) && savedSha256(capture?.stdout) === claimedSha,
    };
  });
  const kindMismatchTurns = turns
    .filter(turn => turn.expectedKind !== turn.observedKind)
    .map(turn => turn.turn);
  const expectedTurns = report?.identity?.scriptedTurns;
  const complete = report?.identity?.currentPinParity === true &&
    Number.isInteger(expectedTurns) && turns.length === expectedTurns &&
    kindMismatchTurns.length === 0 &&
    turns.every((turn, index) => inputCaptures[index]?.exitCode === 0);

  const finalTurn = turns.at(-1);
  const claimedFinalSha = report?.finalSourceSha256;
  const actualSourceSha = sourceSha256(evidence?.source);
  const finalCandidate = complete && finalTurn?.observedKind === 'candidate' &&
    isSha256(claimedFinalSha) && finalTurn.sourceSha256 === claimedFinalSha &&
    finalTurn.persistedCandidate === true && actualSourceSha === claimedFinalSha;

  const actualHoldout = evidence?.holdout;
  const holdoutOutputPassed = typeof actualHoldout?.stdout === 'string' &&
    actualHoldout.stdout.split('\n').some(line => line.startsWith('User expectations passed:'));
  const fixedHoldoutPass = Boolean(finalCandidate &&
    report?.holdout?.exitCode === 0 && report?.holdout?.fixedExpectationsPassed === true &&
    actualHoldout?.exitCode === 0 && holdoutOutputPassed);

  return {
    ...report,
    turns,
    complete,
    finalCandidate,
    fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

async function readOptional(file, parseJson = false) {
  try {
    const value = await readFile(file, parseJson ? 'utf8' : undefined);
    return parseJson ? JSON.parse(value) : value;
  } catch (error) {
    // An unavailable artifact is insufficient evidence, rather than a reason
    // to turn report assertions into a passing verdict.  Invalid JSON is not
    // treated as missing, since that is an operational error worth surfacing.
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');
  const { readdir } = await import('node:fs/promises');
  const reports = [];
  const reportDirs = [];
  for (const name of (await readdir(directory)).sort()) {
    const caseDir = path.join(directory, name);
    if (!(await stat(caseDir)).isDirectory()) continue;
    let report;
    try { report = JSON.parse(await readFile(path.join(caseDir, 'report.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const caseName = report?.identity?.case;
    const safeCaseName = typeof caseName === 'string' && path.basename(caseName) === caseName;
    const captures = await Promise.all((Array.isArray(report?.turns) ? report.turns : []).map(turn =>
      readOptional(path.join(caseDir, `turn-${turn?.turn}.json`), true)));
    const evidence = {
      source: safeCaseName ? await readOptional(path.join(caseDir, `${caseName}.ghost.md`)) : undefined,
      holdout: await readOptional(path.join(caseDir, 'holdout-result.json'), true),
    };
    reports.push(classifyCase(report, captures, evidence));
    reportDirs.push(caseDir);
  }
  const outputs = [path.join(directory, 'verdict-summary.json'), ...reportDirs.map(dir => path.join(dir, 'verdict.json'))];
  for (const output of outputs) {
    try { await stat(output); throw new Error(`Existing verdict evidence: ${output}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const [index, dir] of reportDirs.entries()) {
    await writeFile(path.join(dir, 'verdict.json'), JSON.stringify(reports[index], null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  }
  await writeFile(path.join(directory, 'verdict-summary.json'), JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  for (const row of reports) process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
