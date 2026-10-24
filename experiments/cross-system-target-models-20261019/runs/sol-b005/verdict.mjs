import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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

const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function classifyCase(report, captures, evidence = {}) {
  const scripted = Array.isArray(report?.turns) ? report.turns : [];
  const turns = scripted.map((turn, index) => {
    const capture = captures?.[index];
    return {
      ...turn,
      observedKind: observedKind(capture?.stdout),
      persistedCandidate: isDigest(turn.sourceSha256) && typeof capture?.stdout === 'string'
        && capture.stdout.split('\n').some(line => line.startsWith('Saved ')
          && /SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1] === turn.sourceSha256),
    };
  });
  const kindMismatchTurns = turns.filter(turn => !['candidate', 'clarification', 'answer'].includes(turn.expectedKind)
    || turn.expectedKind !== turn.observedKind).map(turn => turn.turn);
  // Conversational completion is distinct from candidate persistence and holdout success.
  const complete = report?.identity?.currentPinParity === true && turns.length > 0
    && turns.length === report.identity.scriptedTurns && kindMismatchTurns.length === 0
    && turns.every((turn, index) => turn.exitCode === 0 && captures?.[index]?.exitCode === 0);
  const source = evidence?.source;
  const sourceDigest = typeof source === 'string' || Buffer.isBuffer(source)
    ? createHash('sha256').update(source).digest('hex') : null;
  const last = turns.at(-1);
  const finalCandidate = Boolean(complete && last?.observedKind === 'candidate' && last.persistedCandidate
    && isDigest(report.finalSourceSha256) && last.sourceSha256 === report.finalSourceSha256
    && sourceDigest === report.finalSourceSha256);
  const holdout = evidence?.holdout;
  const fixedHoldoutPass = Boolean(finalCandidate && report.holdout?.exitCode === 0
    && report.holdout?.fixedExpectationsPassed === true && holdout?.exitCode === 0
    && typeof holdout.stdout === 'string'
    && holdout.stdout.split('\n').some(line => line.startsWith('User expectations passed:')));
  return { ...report, turns, complete, finalCandidate, fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

// Missing process/source evidence is an unsuccessful case, not an invented capture.
async function optionalFile(filename, json = false) {
  try {
    const bytes = await readFile(filename);
    return json ? JSON.parse(bytes.toString('utf8')) : bytes;
  } catch (error) {
    if (error.code === 'ENOENT' || (json && error instanceof SyntaxError)) return undefined;
    throw error;
  }
}

export async function runCli(directory) {
  if (!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');
  const reports = [];
  const reportDirs = [];
  for (const name of (await readdir(directory)).sort()) {
    const dir = path.join(directory, name);
    if (!(await stat(dir)).isDirectory()) continue;
    let report;
    try { report = JSON.parse(await readFile(path.join(dir, 'report.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const captures = await Promise.all((Array.isArray(report.turns) ? report.turns : []).map(turn =>
      optionalFile(path.join(dir, `turn-${turn.turn}.json`), true)));
    const [source, holdout] = await Promise.all([
      optionalFile(path.join(dir, `${name}.ghost.md`)),
      optionalFile(path.join(dir, 'holdout-result.json'), true),
    ]);
    reports.push(classifyCase(report, captures, { source, holdout }));
    reportDirs.push(dir);
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
  return reports;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli(process.argv[2]);
}
