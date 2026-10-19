import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
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

const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const successfulCapture = capture => capture?.exitCode === 0 && typeof capture.stdout === 'string';

export function classifyCase(report, captures, evidence = {}) {
  report = report && typeof report === 'object' ? report : {};
  captures = Array.isArray(captures) ? captures : [];
  evidence = evidence && typeof evidence === 'object' ? evidence : {};
  const turns = (Array.isArray(report.turns) ? report.turns : []).map((input, index) => {
    const turn = input && typeof input === 'object' ? input : {};
    const capture = captures[index];
    return {
      ...turn,
      observedKind: observedKind(capture?.stdout),
      persistedCandidate: isDigest(turn.sourceSha256) && typeof capture?.stdout === 'string' && capture.stdout.split('\n').some(line =>
        line.startsWith('Saved ') && /SHA-256 ([a-f0-9]{64})\.$/.exec(line.replace(/\r$/, ''))?.[1] === turn.sourceSha256),
    };
  });
  const kindMismatchTurns = turns.filter(turn => !turn.observedKind || turn.expectedKind !== turn.observedKind).map(turn => turn.turn);
  const complete = report.identity?.currentPinParity === true
    && Number.isInteger(report.identity?.scriptedTurns) && turns.length > 0
    && turns.length === report.identity.scriptedTurns && kindMismatchTurns.length === 0
    && turns.every((turn, index) => turn.exitCode === 0 && successfulCapture(captures[index]));
  const source = evidence.source;
  const sourceDigest = typeof source === 'string' || Buffer.isBuffer(source)
    ? createHash('sha256').update(source).digest('hex') : null;
  const final = turns.at(-1);
  const finalCandidate = Boolean(complete && final?.observedKind === 'candidate' && final.persistedCandidate
    && isDigest(report.finalSourceSha256) && final.sourceSha256 === report.finalSourceSha256
    && sourceDigest === report.finalSourceSha256);
  const fixedHoldoutPass = Boolean(finalCandidate && report.holdout?.exitCode === 0
    && report.holdout?.fixedExpectationsPassed === true && successfulCapture(evidence.holdout)
    && evidence.holdout.stdout.split('\n').some(line => line.startsWith('User expectations passed:')));
  return { ...report, turns, complete, finalCandidate, fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

// Missing or malformed evidence is not success. Other I/O failures remain errors.
async function loadEvidence(filename, json = false) {
  try {
    const value = await readFile(filename);
    return json ? JSON.parse(value.toString('utf8')) : value;
  } catch (error) {
    if (error.code === 'ENOENT' || (json && error instanceof SyntaxError)) return undefined;
    throw error;
  }
}

// Kept separate from process handling so the real file-loading path can be tested.
export async function runCli(directory) {
  const reports = [];
  const reportDirs = [];
  for (const name of (await readdir(directory)).sort()) {
    const dir = path.join(directory, name);
    if (!(await stat(dir)).isDirectory()) continue;
    let report;
    try { report = JSON.parse(await readFile(path.join(dir, 'report.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const turns = Array.isArray(report?.turns) ? report.turns : [];
    const captures = await Promise.all(turns.map(turn =>
      // Turn identifiers are numbers, not filesystem paths supplied by a report.
      Number.isInteger(turn?.turn) && turn.turn > 0
        ? loadEvidence(path.join(dir, `turn-${turn.turn}.json`), true) : undefined));
    const [source, holdout] = await Promise.all([
      loadEvidence(path.join(dir, `${name}.ghost.md`)),
      loadEvidence(path.join(dir, 'holdout-result.json'), true),
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
  return reports;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node verdict.mjs PRIVATE_RUN_DIR');
  const reports = await runCli(directory);
  for (const row of reports) process.stdout.write(`${row.identity?.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
