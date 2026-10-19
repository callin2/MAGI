import { readFile, stat } from 'node:fs/promises';
import path from 'path';
import { createHash } from 'node:crypto';

// Validate the GHOSTFLOW_RESULT_JSON in stdout for a single correctly formatted response
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

// Enhanced classifyCase to require evidence.source and evidence.holdout
export function classifyCase(report, captures, evidence = {}) {
  // Validate presence and content of evidence fields
  if (!evidence.source) {
    // Missing source means fail
    return { ...report, turns: [], complete: false, finalCandidate: false, fixedHoldoutPass: false, kindMismatchTurns: [] };
  }
  if (!evidence.holdout) {
    // Missing holdout means fail
    return { ...report, turns: [], complete: false, finalCandidate: false, fixedHoldoutPass: false, kindMismatchTurns: [] };
  }

  // Validate that evidence.source matches report.finalSourceSha256
  let sourceBuffer = evidence.source;
  if (typeof sourceBuffer === 'string') {
    sourceBuffer = Buffer.from(sourceBuffer, 'utf8');
  }
  const actualSha256 = createHash('sha256').update(sourceBuffer).digest('hex');
  if (actualSha256 !== report.finalSourceSha256) {
    return { ...report, turns: [], complete: false, finalCandidate: false, fixedHoldoutPass: false, kindMismatchTurns: [] };
  }

  // Compose turns with validations
  const turns = report.turns.map((turn, index) => {
    const capture = captures[index];
    const obsKind = observedKind(capture?.stdout);
    // Validate persisted candidate claim by presence in turn stdout
    const candidatePersisted = /^[a-f0-9]{64}$/.test(turn.sourceSha256 ?? '') && capture?.stdout?.split('\n').some(line =>
      line.startsWith('Saved ') && /SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1] === turn.sourceSha256) === true;
    return {
      ...turn,
      observedKind: obsKind,
      persistedCandidate: candidatePersisted,
      captureExitCode: capture?.exitCode
    };
  });

  // Detect kind mismatches
  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);

  // Check complete conditions
  const complete = report.identity?.currentPinParity === true &&
    turns.length === report.identity?.scriptedTurns &&
    kindMismatchTurns.length === 0 &&
    turns.every(turn => turn.captureExitCode === 0 && (turn.observedKind !== 'candidate' || turn.persistedCandidate));

  // Final candidate requires completion and last turn candidate matches finalSourceSha256
  const finalCandidate = complete && turns.length > 0 &&
    turns.at(-1).observedKind === 'candidate' &&
    turns.at(-1).sourceSha256 === report.finalSourceSha256;

  // fixedHoldoutPass requires candidate final, holdout capture exitCode 0, and holdout stdout contains success line
  const fixedHoldoutPass = finalCandidate &&
    evidence.holdout.exitCode === 0 &&
    typeof evidence.holdout.stdout === 'string' &&
    evidence.holdout.stdout.includes('User expectations passed:');

  return {
    ...report,
    turns,
    complete,
    finalCandidate,
    fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

// CLI entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');
  const { readdir } = await import('node:fs/promises');

  const reports = [];
  const reportDirs = [];

  for (const name of (await readdir(directory)).sort()) {
    const reportDirPath = path.join(directory, name);
    if (!(await stat(reportDirPath)).isDirectory()) continue;

    let report;
    try {
      report = JSON.parse(await readFile(path.join(reportDirPath, 'report.json'), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }

    // Load captures for each turn
    const captures = await Promise.all(report.turns.map(turn =>
      readFile(path.join(reportDirPath, `turn-${turn.turn}.json`), 'utf8').then(JSON.parse)));

    // Load fixed holdout capture with validation
    let holdoutCapture = null;
    try {
      holdoutCapture = JSON.parse(await readFile(path.join(reportDirPath, 'holdout-result.json'), 'utf8'));
    } catch (e) {
      // missing or invalid holdout means no pass
      holdoutCapture = null;
    }

    // Load source from CASE_NAME.ghost.md (name from identity.case) to verify source hash
    let sourceContent = null;
    try {
      sourceContent = await readFile(path.join(reportDirPath, `${report.identity.case}.ghost.md`));
    } catch (e) {
      sourceContent = null;
    }

    const verdict = classifyCase(report, captures, { source: sourceContent, holdout: holdoutCapture });

    reports.push(verdict);
    reportDirs.push(reportDirPath);
  }

  // Check for existing verdict outputs to prevent overwrites
  const outputs = [
    path.join(directory, 'verdict-summary.json'),
    ...reportDirs.map(dir => path.join(dir, 'verdict.json'))
  ];
  for (const output of outputs) {
    try {
      await stat(output);
      throw new Error(`Existing verdict evidence: ${output}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  // Write verdict.json files for each report
  for (const [index, dir] of reportDirs.entries()) {
    await import('node:fs/promises').then(({writeFile}) =>
      writeFile(path.join(dir, 'verdict.json'), JSON.stringify(reports[index], null, 2) + '\n', { mode: 0o600, flag: 'wx' }));
  }

  // Write summary for all verdicts
  await import('node:fs/promises').then(({writeFile}) =>
    writeFile(path.join(directory, 'verdict-summary.json'), JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' }));

  // Output concise report to stdout
  for (const row of reports) {
    process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  }

  if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
