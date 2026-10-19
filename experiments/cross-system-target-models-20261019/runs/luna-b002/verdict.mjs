import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function observedKind(stdout) {
  const prefix = 'GHOSTFLOW_RESULT_JSON:';
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith(prefix));
  if (lines.length !== 1) return null;
  try {
    const response = JSON.parse(lines[0].slice(prefix.length));
    return response && Object.keys(response).length === 1 && ['candidate', 'clarification', 'answer'].includes(response.kind) ? response.kind : null;
  } catch { return null; }
}

const sha256 = value => createHash('sha256').update(value).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function classifyCase(report, captures, evidence = {}) {
  const source = evidence.source;
  const sourceHash = typeof source === 'string' || Buffer.isBuffer(source) ? sha256(source) : null;
  const turns = (Array.isArray(report?.turns) ? report.turns : []).map((turn, index) => {
    const capture = captures?.[index];
    const kind = observedKind(capture?.stdout);
    const persisted = validHash(turn.sourceSha256) && typeof capture?.stdout === 'string' && capture.stdout.split('\n').some(line =>
      line.startsWith('Saved ') && /SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1] === turn.sourceSha256);
    return { ...turn, observedKind: kind, persistedCandidate: persisted, captureExitCode: capture?.exitCode ?? null };
  });
  const kindMismatchTurns = turns.filter(t => t.expectedKind !== t.observedKind).map(t => t.turn);
  const complete = report?.identity?.currentPinParity === true && Number.isInteger(report.identity.scriptedTurns) && turns.length === report.identity.scriptedTurns &&
    captures?.length === turns.length && kindMismatchTurns.length === 0 && turns.every((t, i) => Number.isInteger(captures[i]?.exitCode) && captures[i].exitCode === 0);
  const last = turns.at(-1);
  const finalCandidate = complete && last?.observedKind === 'candidate' && validHash(report.finalSourceSha256) &&
    last.sourceSha256 === report.finalSourceSha256 && last.persistedCandidate && sourceHash === report.finalSourceSha256;
  const holdout = evidence.holdout;
  const actualHoldout = holdout && Number.isInteger(holdout.exitCode) && holdout.exitCode === 0 && typeof holdout.stdout === 'string' &&
    holdout.stdout.split('\n').some(line => line.startsWith('User expectations passed:'));
  const fixedHoldoutPass = Boolean(finalCandidate && report.holdout?.exitCode === 0 && report.holdout?.fixedExpectationsPassed === true && actualHoldout);
  return { ...report, turns, complete: Boolean(complete), finalCandidate: Boolean(finalCandidate), fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(t => t.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(t => t.observedKind === 'candidate').length, kindMismatchTurns };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');
  const { readdir } = await import('node:fs/promises');
  const reports = [], reportDirs = [];
  for (const name of (await readdir(directory)).sort()) {
    const dir = path.join(directory, name);
    if (!(await stat(dir)).isDirectory()) continue;
    let report;
    try { report = JSON.parse(await readFile(path.join(dir, 'report.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const captures = await Promise.all((Array.isArray(report.turns) ? report.turns : []).map(async turn => {
      try { return JSON.parse(await readFile(path.join(dir, `turn-${turn.turn}.json`), 'utf8')); } catch { return null; }
    }));
    let source, holdout;
    try { source = await readFile(path.join(dir, `${report.identity.case}.ghost.md`)); } catch {}
    try { holdout = JSON.parse(await readFile(path.join(dir, 'holdout-result.json'), 'utf8')); } catch {}
    reports.push(classifyCase(report, captures, { source, holdout })); reportDirs.push(dir);
  }
  const outputs = [path.join(directory, 'verdict-summary.json'), ...reportDirs.map(dir => path.join(dir, 'verdict.json'))];
  for (const output of outputs) { try { await stat(output); throw new Error(`Existing verdict evidence: ${output}`); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  for (const [i, dir] of reportDirs.entries()) await writeFile(path.join(dir, 'verdict.json'), JSON.stringify(reports[i], null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await writeFile(path.join(directory, 'verdict-summary.json'), JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  for (const row of reports) process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if (!reports.length || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
