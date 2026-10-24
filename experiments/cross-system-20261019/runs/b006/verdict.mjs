import { createHash } from 'node:crypto';
import path from 'node:path';
import { readFile, stat, readdir, writeFile } from 'node:fs/promises';

// Extract the observed kind of response from stdout
export function observedKind(stdout) {
  const resultPrefix = 'GHOSTFLOW_RESULT_JSON:';
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith(resultPrefix));
  if (lines.length !== 1) return null; // reject duplicate or missing kinds
  try {
    const response = JSON.parse(lines[0].slice(resultPrefix.length));
    return response && Object.keys(response).length === 1 && ['candidate', 'clarification', 'answer'].includes(response.kind)
      ? response.kind : null;
  } catch { return null; }
}

// Classify a case, taking an optional evidence object with source (string or Buffer) and holdout (capture) to strengthen the checks
export function classifyCase(report, captures, evidence = {}) {
  // Validate that raw source matches final source SHA-256 claim
  const sourceSHA256Match = (() => {
    if (!evidence.source) return false;
    let buff;
    if (Buffer.isBuffer(evidence.source)) buff = evidence.source;
    else if (typeof evidence.source === 'string') buff = Buffer.from(evidence.source, 'utf8');
    else return false;
    const hash = createHash('sha256').update(buff).digest('hex');
    return hash === report.finalSourceSha256;
  })();

  // Validate holdout capture success
  const holdoutSuccess = (() => {
    if (!evidence.holdout) return false;
    const { exitCode, stdout } = evidence.holdout;
    if (typeof exitCode !== 'number' || typeof stdout !== 'string') return false;
    return exitCode === 0 && stdout.split('\n').some(line => line.startsWith('User expectations passed:'));
  })();

  // Identify turns with their observed kind and if candidate was persisted
  const turns = report.turns.map((turn, index) => {
    const obsKind = observedKind(captures[index]?.stdout);
    // Check if the turn's candidate was persisted matching sourceSha256
    const persistedCandidate = Boolean(
      typeof turn.sourceSha256 === 'string' && /^[a-f0-9]{64}$/.test(turn.sourceSha256) &&
      captures[index]?.stdout?.split('\n').some(line => {
        if (!line.startsWith('Saved ')) return false;
        const m = /SHA-256 ([a-f0-9]{64})\.$/.exec(line);
        return m && m[1] === turn.sourceSha256;
      })
    );
    return { ...turn, observedKind: obsKind, persistedCandidate };
  });

  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);

  // Complete requires current pin parity true, all turns observed expected kinds with exitCode 0 and persisted candidate for candidate turns
  const complete = report.identity.currentPinParity === true
    && turns.length === report.identity.scriptedTurns
    && kindMismatchTurns.length === 0
    && turns.every(turn => turn.exitCode === 0 && (turn.observedKind !== 'candidate' || turn.persistedCandidate));

  // finalCandidate requires complete and last turn to be candidate with its sourceSha256 matching finalSourceSha256
  const finalCandidate = complete 
    && turns.at(-1)?.observedKind === 'candidate'
    && turns.at(-1)?.sourceSha256 === report.finalSourceSha256
    && sourceSHA256Match;

  // fixedHoldoutPass requires finalCandidate and a confirmed successful holdout capture
  const fixedHoldoutPass = Boolean(finalCandidate && holdoutSuccess && report.holdout?.exitCode === 0 && report.holdout.fixedExpectationsPassed);

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

// CLI entry point when invoked directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');

  (async () => {
    const reports = [];
    const reportDirs = [];

    for (const name of (await readdir(directory)).sort()) {
      const fullDir = path.join(directory, name);
      if (!(await stat(fullDir)).isDirectory()) continue;

      let report;
      try {
        report = JSON.parse(await readFile(path.join(fullDir, 'report.json'), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }

      const captures = await Promise.all(
        report.turns.map(turn => readFile(path.join(fullDir, `turn-${turn.turn}.json`), 'utf8').then(JSON.parse))
      );

      // Load evidence.source (source file) and evidence.holdout (fixed-holdout capture) for classifyCase
      let sourceBuffer;
      try {
        sourceBuffer = await readFile(path.join(fullDir, `${report.identity.case}.ghost.md`));
      } catch (e) {
        // Missing source needed for proper classification
        sourceBuffer = null;
      }

      let holdoutCapture;
      try {
        holdoutCapture = JSON.parse(await readFile(path.join(fullDir, 'holdout-result.json'), 'utf8'));
      } catch (e) {
        holdoutCapture = null;
      }

      const verdict = classifyCase(report, captures, { source: sourceBuffer, holdout: holdoutCapture });
      reports.push(verdict);
      reportDirs.push(fullDir);
    }

    // Ensure no verdict overwrite
    const outputs = [path.join(directory, 'verdict-summary.json'), ...reportDirs.map(dir => path.join(dir, 'verdict.json'))];
    for (const output of outputs) {
      try {
        await stat(output);
        throw new Error(`Existing verdict evidence: ${output}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    for (const [index, dir] of reportDirs.entries()) {
      await writeFile(path.join(dir, 'verdict.json'), JSON.stringify(reports[index], null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    }
    await writeFile(path.join(directory, 'verdict-summary.json'), JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' });

    for (const row of reports) {
      process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
    }

    if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
  })();
}
