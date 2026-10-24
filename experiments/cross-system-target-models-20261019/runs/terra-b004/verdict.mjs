import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;
const RESULT_PREFIX = 'GHOSTFLOW_RESULT_JSON:';
const HOLDOUT_PREFIX = 'User expectations passed:';

export function observedKind(stdout) {
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith(RESULT_PREFIX));
  if (lines.length !== 1) return null;
  try {
    const response = JSON.parse(lines[0].slice(RESULT_PREFIX.length));
    return response && Object.keys(response).length === 1
      && ['candidate', 'clarification', 'answer'].includes(response.kind)
      ? response.kind : null;
  } catch { return null; }
}

function savedSource(stdout, sourceSha256) {
  if (typeof stdout !== 'string' || typeof sourceSha256 !== 'string') return false;
  return stdout.split('\n').some(line =>
    line.startsWith('Saved ') && /SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1] === sourceSha256);
}

function sourceMatches(source, claimedSha256) {
  if (!(typeof source === 'string' || Buffer.isBuffer(source)) || !SHA256.test(claimedSha256 ?? '')) return false;
  return createHash('sha256').update(source).digest('hex') === claimedSha256;
}

function holdoutPassed(capture) {
  return capture?.exitCode === 0 && typeof capture.stdout === 'string'
    && capture.stdout.split('\n').some(line => line.startsWith(HOLDOUT_PREFIX));
}

// evidence is deliberately separate from report claims: it contains files and process captures.
export function classifyCase(report, captures, evidence = {}) {
  const reportTurns = Array.isArray(report?.turns) ? report.turns : [];
  const processCaptures = Array.isArray(captures) ? captures : [];
  const turns = reportTurns.map((turn, index) => {
    const capture = processCaptures[index];
    const sourceSha256 = turn?.sourceSha256;
    return {
      ...(turn && typeof turn === 'object' ? turn : {}),
      observedKind: observedKind(capture?.stdout),
      // This means the process said it saved the claimed bytes; sourceMatches below
      // independently verifies that the stored final source has those bytes.
      persistedCandidate: savedSource(capture?.stdout, sourceSha256),
    };
  });
  const kindMismatchTurns = turns
    .filter(turn => turn.expectedKind !== turn.observedKind)
    .map(turn => turn.turn);
  const allTurnsExitedSuccessfully = processCaptures.length >= turns.length
    && turns.every((turn, index) => processCaptures[index]?.exitCode === 0);
  const complete = report?.identity?.currentPinParity === true
    && report?.identity?.scriptedTurns === turns.length
    && kindMismatchTurns.length === 0
    && allTurnsExitedSuccessfully;

  const lastTurn = turns.at(-1);
  const finalClaim = report?.finalSourceSha256;
  const finalCandidate = complete
    && lastTurn?.observedKind === 'candidate'
    && typeof finalClaim === 'string'
    && lastTurn.sourceSha256 === finalClaim
    && lastTurn.persistedCandidate === true
    && sourceMatches(evidence?.source, finalClaim);

  // A report's holdout labels are assertions, not a substitute for its capture.
  const fixedHoldoutPass = Boolean(finalCandidate
    && report?.holdout?.exitCode === 0
    && report?.holdout?.fixedExpectationsPassed === true
    && holdoutPassed(evidence?.holdout));

  return {
    ...(report && typeof report === 'object' ? report : {}),
    turns,
    complete,
    finalCandidate,
    fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

async function optionalJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

async function optionalFile(file) {
  try { return await readFile(file); }
  catch (error) { if (error?.code === 'ENOENT') return undefined; throw error; }
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
    catch (error) { if (error?.code === 'ENOENT') continue; throw error; }
    const turns = Array.isArray(report?.turns) ? report.turns : [];
    const captures = await Promise.all(turns.map(turn => optionalJson(path.join(caseDir, `turn-${turn?.turn}.json`))));
    const caseName = report?.identity?.case;
    // Do not allow a report label to make this loader read outside its case directory.
    const source = typeof caseName === 'string' && caseName === path.basename(caseName) && caseName !== '.'
      ? await optionalFile(path.join(caseDir, `${caseName}.ghost.md`)) : undefined;
    const holdout = await optionalJson(path.join(caseDir, 'holdout-result.json'));
    reports.push(classifyCase(report, captures, { source, holdout }));
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
  for (const row of reports) process.stdout.write(`${row.identity?.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
