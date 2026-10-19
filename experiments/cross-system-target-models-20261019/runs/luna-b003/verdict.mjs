import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function observedKind(stdout) {
  const resultPrefix = 'GHOSTFLOW_RESULT_JSON:';
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith(resultPrefix));
  if (lines.length !== 1) return null;
  try {
    const response = JSON.parse(lines[0].slice(resultPrefix.length));
    return response && Object.keys(response).length === 1 && ['candidate', 'clarification', 'answer'].includes(response.kind) ? response.kind : null;
  } catch { return null; }
}

const sha256 = value => createHash('sha256').update(value).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function classifyCase(report, captures, evidence = {}) {
  const turnReports = Array.isArray(report?.turns) ? report.turns : [];
  const captureList = Array.isArray(captures) ? captures : [];
  const turns = turnReports.map((turn, index) => {
    const capture = captureList[index];
    const stdout = capture?.stdout;
    const kind = observedKind(stdout);
    const saved = typeof stdout === 'string' && validHash(turn.sourceSha256) && stdout.split('\n').some(line =>
      line.startsWith('Saved ') && /SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1] === turn.sourceSha256);
    return { ...turn, observedKind: kind, persistedCandidate: saved,
      processSucceeded: Number.isInteger(capture?.exitCode) && capture.exitCode === 0 };
  });
  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);
  const complete = report?.identity?.currentPinParity === true
    && Number.isInteger(report.identity.scriptedTurns) && turns.length === report.identity.scriptedTurns
    && captureList.length === turns.length && kindMismatchTurns.length === 0
    && turns.every(turn => turn.processSucceeded);
  const source = evidence?.source;
  const sourceHash = typeof source === 'string' || Buffer.isBuffer(source) ? sha256(source) : null;
  const last = turns.at(-1);
  const finalCandidate = Boolean(complete && last?.observedKind === 'candidate' && last.persistedCandidate
    && validHash(report.finalSourceSha256) && last.sourceSha256 === report.finalSourceSha256
    && sourceHash === report.finalSourceSha256);
  const holdout = evidence?.holdout;
  const actualHoldoutPass = Number.isInteger(holdout?.exitCode) && holdout.exitCode === 0
    && typeof holdout.stdout === 'string' && holdout.stdout.split('\n').some(line => line.startsWith('User expectations passed:'));
  const reportedHoldoutPass = report?.holdout?.exitCode === 0 && report?.holdout?.fixedExpectationsPassed === true;
  return { ...report, turns, complete, finalCandidate,
    fixedHoldoutPass: Boolean(finalCandidate && reportedHoldoutPass && actualHoldoutPass),
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');
  const { readdir } = await import('node:fs/promises');
  const optional = async file => { try { return await readFile(file); } catch (e) { if (e.code === 'ENOENT') return undefined; throw e; } };
  const reports = [], reportDirs = [];
  for (const name of (await readdir(directory)).sort()) {
    const dir = path.join(directory, name);
    if (!(await stat(dir)).isDirectory()) continue;
    let report;
    try { report = JSON.parse(await readFile(path.join(dir, 'report.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const captures = await Promise.all((Array.isArray(report.turns) ? report.turns : []).map(async turn => {
      const raw = await optional(path.join(dir, `turn-${turn.turn}.json`));
      if (!raw) return undefined;
      try { return JSON.parse(raw.toString('utf8')); } catch { return undefined; }
    }));
    const source = await optional(path.join(dir, `${name}.ghost.md`));
    let holdout;
    const holdoutRaw = await optional(path.join(dir, 'holdout-result.json'));
    if (holdoutRaw) { try { holdout = JSON.parse(holdoutRaw.toString('utf8')); } catch {} }
    reports.push(classifyCase(report, captures, { source, holdout }));
    reportDirs.push(dir);
  }
  const outputs = [path.join(directory, 'verdict-summary.json'), ...reportDirs.map(dir => path.join(dir, 'verdict.json'))];
  for (const output of outputs) {
    try { await stat(output); throw new Error(`Existing verdict evidence: ${output}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const [index, dir] of reportDirs.entries()) await writeFile(path.join(dir, 'verdict.json'), JSON.stringify(reports[index], null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await writeFile(path.join(directory, 'verdict-summary.json'), JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  for (const row of reports) process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
