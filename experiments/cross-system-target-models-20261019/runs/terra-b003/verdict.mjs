import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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

function isSuccessfulCapture(capture) {
  return capture && typeof capture.exitCode === 'number' && capture.exitCode === 0
    && typeof capture.stdout === 'string';
}

function savedSource(capture, sha) {
  return isSuccessfulCapture(capture)
    && capture.stdout.split('\n').some(line =>
      line.startsWith('Saved ') && /SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1] === sha);
}

function sourceMatches(source, sha) {
  if (!SHA256.test(sha ?? '') || !(typeof source === 'string' || Buffer.isBuffer(source))) return false;
  return createHash('sha256').update(source).digest('hex') === sha;
}

// evidence is deliberately separate from report claims: it is the stored source and
// the capture produced by the fixed holdout process.
export function classifyCase(report, captures, evidence = {}) {
  const safeReport = report && typeof report === 'object' ? report : {};
  const reportTurns = Array.isArray(safeReport.turns) ? safeReport.turns : [];
  const actualCaptures = Array.isArray(captures) ? captures : [];
  const turns = reportTurns.map((turn, index) => {
    const capture = actualCaptures[index];
    const sha = typeof turn?.sourceSha256 === 'string' ? turn.sourceSha256 : '';
    return {
      ...turn,
      observedKind: observedKind(capture?.stdout),
      // This records process evidence only; it is not used to promote completion.
      persistedCandidate: savedSource(capture, sha),
    };
  });
  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);
  const identity = safeReport.identity && typeof safeReport.identity === 'object' ? safeReport.identity : {};
  const allTurnsExited = turns.every((turn, index) => isSuccessfulCapture(actualCaptures[index]));
  const complete = identity.currentPinParity === true
    && Number.isInteger(identity.scriptedTurns)
    && turns.length === identity.scriptedTurns
    && kindMismatchTurns.length === 0
    && allTurnsExited;

  const finalTurn = turns.at(-1);
  const finalSha = safeReport.finalSourceSha256;
  const finalCandidate = Boolean(complete
    && finalTurn?.observedKind === 'candidate'
    && SHA256.test(finalSha ?? '')
    && finalTurn.sourceSha256 === finalSha
    && savedSource(actualCaptures[turns.length - 1], finalSha)
    && sourceMatches(evidence?.source, finalSha));

  const holdout = evidence?.holdout;
  const fixedHoldoutPass = Boolean(finalCandidate
    && safeReport.holdout?.exitCode === 0
    && safeReport.holdout?.fixedExpectationsPassed === true
    && isSuccessfulCapture(holdout)
    && holdout.stdout.split('\n').some(line => line.startsWith('User expectations passed:')));

  return { ...safeReport, turns, complete, finalCandidate, fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

async function readOptional(file, parser = value => value) {
  try { return parser(await readFile(file, 'utf8')); }
  catch (error) {
    // A missing or malformed piece of process evidence is evidence of no success.
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return undefined;
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
    if (!(await stat(path.join(directory, name))).isDirectory()) continue;
    const caseDir = path.join(directory, name);
    const report = await readOptional(path.join(caseDir, 'report.json'), JSON.parse);
    if (!report) continue;
    const reportTurns = Array.isArray(report.turns) ? report.turns : [];
    const captures = await Promise.all(reportTurns.map(turn =>
      readOptional(path.join(caseDir, `turn-${turn?.turn}.json`), JSON.parse)));
    const caseName = typeof report.identity?.case === 'string' ? report.identity.case : name;
    const evidence = {
      source: await readOptional(path.join(caseDir, `${caseName}.ghost.md`)),
      holdout: await readOptional(path.join(caseDir, 'holdout-result.json'), JSON.parse),
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
  for (const row of reports) process.stdout.write(`${row.identity?.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
