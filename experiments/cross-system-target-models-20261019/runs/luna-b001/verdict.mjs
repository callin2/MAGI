import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function observedKind(stdout) {
  const resultPrefix = 'GHOSTFLOW_RESULT_JSON:';
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split(/\r?\n/).filter(line => line.startsWith(resultPrefix));
  if (lines.length !== 1) return null;
  try {
    const response = JSON.parse(lines[0].slice(resultPrefix.length));
    return response && Object.keys(response).length === 1 && ['candidate', 'clarification', 'answer'].includes(response.kind) ? response.kind : null;
  } catch { return null; }
}

const sha256 = value => createHash('sha256').update(value).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function classifyCase(report, captures, evidence = {}) {
  const source = Buffer.isBuffer(evidence.source) || typeof evidence.source === 'string' ? evidence.source : null;
  const sourceHash = source === null ? null : sha256(source);
  const sourceClaimMatches = validHash(report?.finalSourceSha256) && sourceHash === report.finalSourceSha256;
  const turns = (Array.isArray(report?.turns) ? report.turns : []).map((turn, index) => {
    const capture = captures?.[index];
    const kind = observedKind(capture?.stdout);
    const savedHash = typeof capture?.stdout === 'string'
      ? capture.stdout.split(/\r?\n/).map(line => /^Saved .*: SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1]).find(Boolean)
      : null;
    return { ...turn, observedKind: kind,
      persistedCandidate: kind === 'candidate' && validHash(turn.sourceSha256) && savedHash === turn.sourceSha256 && sourceClaimMatches && turn.sourceSha256 === sourceHash };
  });
  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);
  const successful = turns.every((turn, i) => typeof captures?.[i]?.exitCode === 'number' && captures[i].exitCode === 0);
  const complete = report?.identity?.currentPinParity === true && turns.length === report?.identity?.scriptedTurns && turns.length > 0 && kindMismatchTurns.length === 0 && successful;
  const last = turns.at(-1);
  const finalCandidate = Boolean(complete && last?.observedKind === 'candidate' && last.persistedCandidate && sourceClaimMatches && last.sourceSha256 === report.finalSourceSha256);
  const holdout = evidence?.holdout;
  const fixedHoldoutPass = Boolean(finalCandidate && report?.holdout?.exitCode === 0 && report?.holdout?.fixedExpectationsPassed === true && holdout?.exitCode === 0 && typeof holdout.stdout === 'string' && holdout.stdout.split(/\r?\n/).some(line => line.startsWith('User expectations passed:')));
  return { ...report, turns, complete, finalCandidate, fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length, kindMismatchTurns };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');
  const { readdir } = await import('node:fs/promises');
  const reports = [], reportDirs = [];
  for (const name of (await readdir(directory)).sort()) {
    const caseDir = path.join(directory, name);
    if (!(await stat(caseDir)).isDirectory()) continue;
    let report;
    try { report = JSON.parse(await readFile(path.join(caseDir, 'report.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const captures = await Promise.all((Array.isArray(report.turns) ? report.turns : []).map(async turn => {
      try { return JSON.parse(await readFile(path.join(caseDir, `turn-${turn.turn}.json`), 'utf8')); } catch { return null; }
    }));
    let source = null, holdout = null;
    try { source = await readFile(path.join(caseDir, `${name}.ghost.md`)); } catch {}
    try { holdout = JSON.parse(await readFile(path.join(caseDir, 'holdout-result.json'), 'utf8')); } catch {}
    reports.push(classifyCase(report, captures, { source, holdout })); reportDirs.push(caseDir);
  }
  const outputs = [path.join(directory, 'verdict-summary.json'), ...reportDirs.map(dir => path.join(dir, 'verdict.json'))];
  for (const output of outputs) { try { await stat(output); throw new Error(`Existing verdict evidence: ${output}`); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  for (const [i, dir] of reportDirs.entries()) await writeFile(path.join(dir, 'verdict.json'), JSON.stringify(reports[i], null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await writeFile(path.join(directory, 'verdict-summary.json'), JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  for (const row of reports) process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if (!reports.length || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
