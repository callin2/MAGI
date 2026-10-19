import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

async function optionalRead(file) {
  try { return await readFile(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

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

export function classifyCase(report, captures, evidence = {}) {
  const turns = report.turns.map((turn, index) => ({
    ...turn,
    observedKind: observedKind(captures[index]?.stdout),
    captureExitVerified: turn.exitCode === 0 && captures[index]?.exitCode === 0,
    persistedCandidate: /^[a-f0-9]{64}$/.test(turn.sourceSha256 ?? '') && captures[index]?.stdout?.split('\n').some(line =>
      line.startsWith('Saved ') && /SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1] === turn.sourceSha256) === true,
  }));
  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);
  const complete = report.identity.currentPinParity === true && turns.length === report.identity.scriptedTurns && kindMismatchTurns.length === 0
    && turns.every(turn => turn.captureExitVerified && (turn.observedKind !== 'candidate' || turn.persistedCandidate));
  const sourceEvidenceVerified = (Buffer.isBuffer(evidence.source) || typeof evidence.source === 'string')
    && createHash('sha256').update(evidence.source).digest('hex') === report.finalSourceSha256;
  const holdoutEvidenceVerified = evidence.holdout?.exitCode === 0
    && typeof evidence.holdout.stdout === 'string'
    && evidence.holdout.stdout.split('\n').some(line => line.startsWith('User expectations passed:'));
  const finalCandidate = complete && turns.at(-1)?.observedKind === 'candidate'
    && turns.at(-1)?.sourceSha256 === report.finalSourceSha256 && sourceEvidenceVerified;
  return { ...report, turns, complete, finalCandidate, sourceEvidenceVerified, holdoutEvidenceVerified,
    fixedHoldoutPass: Boolean(finalCandidate && holdoutEvidenceVerified && report.holdout?.exitCode === 0 && report.holdout.fixedExpectationsPassed === true),
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory = process.argv[2];
  const checkOnly = process.argv[3] === '--check-only';
  if (!directory || process.argv.length > 4 || (process.argv[3] && !checkOnly)) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR [--check-only]');
  const { readdir } = await import('node:fs/promises');
  const reports = [];
  const reportDirs = [];
  for (const name of (await readdir(directory)).sort()) {
    if (!(await stat(path.join(directory, name))).isDirectory()) continue;
    let report;
    try { report = JSON.parse(await readFile(path.join(directory, name, 'report.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const captures = await Promise.all(report.turns.map(turn => readFile(path.join(directory, name, `turn-${turn.turn}.json`), 'utf8').then(JSON.parse)));
    const source = await optionalRead(path.join(directory, name, `${name}.ghost.md`));
    const holdoutBytes = await optionalRead(path.join(directory, name, 'holdout-result.json'));
    const verdict = classifyCase(report, captures, { source, holdout: holdoutBytes && JSON.parse(holdoutBytes.toString('utf8')) });
    reports.push(verdict);
    reportDirs.push(path.join(directory, name));
  }
  if (!checkOnly) {
    const outputs = [path.join(directory, 'verdict-summary.json'), ...reportDirs.map(dir => path.join(dir, 'verdict.json'))];
    for (const output of outputs) {
      try { await stat(output); throw new Error(`Existing verdict evidence: ${output}`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const [index, dir] of reportDirs.entries()) {
      await writeFile(path.join(dir, 'verdict.json'), JSON.stringify(reports[index], null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    }
    await writeFile(path.join(directory, 'verdict-summary.json'), JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  }
  for (const row of reports) process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
