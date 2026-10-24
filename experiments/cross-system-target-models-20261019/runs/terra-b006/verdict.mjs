import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;

export function observedKind(stdout) {
  const resultPrefix = 'GHOSTFLOW_RESULT_JSON:';
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith(resultPrefix));
  if (lines.length !== 1) return null;
  try {
    const response = JSON.parse(lines[0].slice(resultPrefix.length));
    return response && Object.keys(response).length === 1 && ['candidate', 'clarification', 'answer'].includes(response.kind)
      ? response.kind : null;
  } catch { return null; }
}

function sourceHash(source) {
  if (!(typeof source === 'string' || Buffer.isBuffer(source))) return null;
  return createHash('sha256').update(source).digest('hex');
}

function savedHash(stdout, expected) {
  if (typeof stdout !== 'string' || !SHA256.test(expected ?? '')) return false;
  return stdout.split('\n').some(line =>
    line.startsWith('Saved ') && /SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1] === expected);
}

/**
 * Classify a case using captures made by the real processes.  `evidence.source`
 * is the saved final source (Buffer or string), and `evidence.holdout` is the
 * real fixed-holdout process capture.
 */
export function classifyCase(report, captures, evidence = {}) {
  const listedTurns = Array.isArray(report?.turns) ? report.turns : [];
  const actualCaptures = Array.isArray(captures) ? captures : [];
  const turns = listedTurns.map((turn, index) => {
    const capture = actualCaptures[index];
    const claim = turn?.sourceSha256;
    return {
      ...turn,
      observedKind: observedKind(capture?.stdout),
      // This says that this process reported saving the hash it claimed, not
      // that the claim has been corroborated by a file (done below for final).
      persistedCandidate: savedHash(capture?.stdout, claim),
    };
  });
  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);
  const expectedTurns = report?.identity?.scriptedTurns;
  const complete = report?.identity?.currentPinParity === true
    && Number.isInteger(expectedTurns) && turns.length === expectedTurns
    && kindMismatchTurns.length === 0
    && turns.every((turn, index) => actualCaptures[index]?.exitCode === 0);

  const finalTurn = turns.at(-1);
  const finalClaim = report?.finalSourceSha256;
  const sourceCorroborated = SHA256.test(finalClaim ?? '')
    && finalTurn?.sourceSha256 === finalClaim
    && sourceHash(evidence?.source) === finalClaim;
  const finalCandidate = Boolean(complete
    && finalTurn?.observedKind === 'candidate'
    && finalTurn.persistedCandidate
    && sourceCorroborated);

  const reportedHoldoutPass = report?.holdout?.exitCode === 0 && report?.holdout?.fixedExpectationsPassed === true;
  const actualHoldout = evidence?.holdout;
  const actualHoldoutPass = actualHoldout?.exitCode === 0
    && typeof actualHoldout?.stdout === 'string'
    && actualHoldout.stdout.split('\n').some(line => line.startsWith('User expectations passed:'));

  return { ...report, turns, complete, finalCandidate,
    fixedHoldoutPass: Boolean(finalCandidate && reportedHoldoutPass && actualHoldoutPass),
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

async function optionalJson(filename) {
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

async function optionalFile(filename) {
  try { return await readFile(filename); }
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
    const report = await optionalJson(path.join(caseDir, 'report.json'));
    if (!report) continue;
    const captures = await Promise.all((Array.isArray(report.turns) ? report.turns : []).map(turn =>
      optionalJson(path.join(caseDir, `turn-${turn?.turn}.json`))));
    // Case names are report data, so reject a path-like name rather than using
    // it to read outside this case directory.  A missing/unsafe file is simply
    // absent evidence and therefore cannot pass the final-candidate check.
    const caseName = report?.identity?.case;
    const safeCaseName = typeof caseName === 'string' && caseName === path.basename(caseName) && caseName !== '';
    const source = safeCaseName ? await optionalFile(path.join(caseDir, `${caseName}.ghost.md`)) : undefined;
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
  for (const row of reports) process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
