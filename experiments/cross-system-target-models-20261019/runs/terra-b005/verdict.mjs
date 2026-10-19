import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

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

function hasSavedSha(stdout, sha) {
  return typeof stdout === 'string' && typeof sha === 'string'
    && stdout.split('\n').some(line =>
      line.startsWith('Saved ') && /SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1] === sha);
}

function sourceMatches(source, sha) {
  if (!(typeof source === 'string' || Buffer.isBuffer(source)) || !/^[a-f0-9]{64}$/.test(sha ?? '')) return false;
  return createHash('sha256').update(source).digest('hex') === sha;
}

function holdoutSucceeded(capture) {
  return capture?.exitCode === 0 && typeof capture.stdout === 'string'
    && capture.stdout.split('\n').some(line => line.startsWith('User expectations passed:'));
}

// evidence is deliberately separate from report claims: it contains the saved source
// and the capture from actually running the fixed holdout.
export function classifyCase(report, captures, evidence = {}) {
  const reportTurns = Array.isArray(report?.turns) ? report.turns : [];
  const safeCaptures = Array.isArray(captures) ? captures : [];
  const turns = reportTurns.map((turn, index) => {
    const capture = safeCaptures[index];
    return {
      ...turn,
      observedKind: observedKind(capture?.stdout),
      captureExitCode: capture?.exitCode,
      // This records what the process said it saved; source verification is done
      // below for the final candidate against the actual file bytes.
      persistedCandidate: hasSavedSha(capture?.stdout, turn?.sourceSha256),
    };
  });
  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);
  const complete = report?.identity?.currentPinParity === true
    && Number.isInteger(report?.identity?.scriptedTurns)
    && turns.length === report.identity.scriptedTurns
    && kindMismatchTurns.length === 0
    && turns.every(turn => turn.captureExitCode === 0);
  const last = turns.at(-1);
  const finalCandidate = complete
    && last?.observedKind === 'candidate'
    && typeof report?.finalSourceSha256 === 'string'
    && last.sourceSha256 === report.finalSourceSha256
    && hasSavedSha(safeCaptures.at(-1)?.stdout, report.finalSourceSha256)
    && sourceMatches(evidence?.source, report.finalSourceSha256);
  const fixedHoldoutPass = Boolean(finalCandidate
    && report?.holdout?.exitCode === 0
    && report?.holdout?.fixedExpectationsPassed === true
    && holdoutSucceeded(evidence?.holdout));
  return { ...report, turns, complete, finalCandidate, fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

async function optionalJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT') return undefined; throw error; }
}
async function optionalBytes(file) {
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
    if (!(await stat(path.join(directory, name))).isDirectory()) continue;
    const caseDir = path.join(directory, name);
    const report = await optionalJson(path.join(caseDir, 'report.json'));
    if (report === undefined) continue;
    const captures = await Promise.all((Array.isArray(report.turns) ? report.turns : []).map(turn =>
      optionalJson(path.join(caseDir, `turn-${turn?.turn}.json`))));
    const caseName = report?.identity?.case;
    const source = typeof caseName === 'string' && path.basename(caseName) === caseName
      ? await optionalBytes(path.join(caseDir, `${caseName}.ghost.md`)) : undefined;
    const holdout = await optionalJson(path.join(caseDir, 'holdout-result.json'));
    const verdict = classifyCase(report, captures, { source, holdout });
    reports.push(verdict);
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
