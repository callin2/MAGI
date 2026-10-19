import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function observedKind(stdout) {
  const resultPrefix = 'GHOSTFLOW_RESULT_JSON:';
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith(resultPrefix));
  if (lines.length !== 1) return null;  // exactly one result line
  try {
    const response = JSON.parse(lines[0].slice(resultPrefix.length));
    // Only accept known kinds and exactly one key
    return response && Object.keys(response).length === 1 && ['candidate', 'clarification', 'answer'].includes(response.kind)
      ? response.kind : null;
  } catch {
    return null;
  }
}

function sha256sum(data) {
  return createHash('sha256').update(data).digest('hex');
}

function hasSuccessUserExpectationsLine(holdoutCapture) {
  if (!holdoutCapture || typeof holdoutCapture.stdout !== 'string') return false;
  if (holdoutCapture.exitCode !== 0) return false;
  return holdoutCapture.stdout.split('\n').some(line => line.startsWith('User expectations passed:'));
}

// Main classifier function
export function classifyCase(report, captures, evidence = {}) {
  // Each turn gets its observed kind and persisted candidate check plus exitCode from capture
  const turns = report.turns.map((turn, index) => {
    const capture = captures[index];
    const obsKind = observedKind(capture?.stdout);
    const exitCode = capture?.exitCode;
    // Check candidate persisted by scanning lines in capture stdout for Saved line with matching SHA-256
    const hasPersistedCandidate = obsKind === 'candidate' && typeof turn.sourceSha256 === 'string'
      && /^[a-f0-9]{64}$/.test(turn.sourceSha256) && capture?.stdout?.split('\n').some(line => {
        if (!line.startsWith('Saved ')) return false;
        const m = /SHA-256 ([a-f0-9]{64})\.$/.exec(line);
        return m && m[1] === turn.sourceSha256;
      });
    return {
      ...turn,
      exitCode,
      observedKind: obsKind,
      persistedCandidate: hasPersistedCandidate
    };
  });

  // Identify all turn numbers where observed kind differs from expected
  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);

  // Complete means all scripted turns were run without kind mismatches and exitCode 0;
  // each candidate turn must also have a persisted saved candidate
  const complete = report.identity.currentPinParity === true
    && turns.length === report.identity.scriptedTurns
    && kindMismatchTurns.length === 0
    && turns.every(turn => turn.exitCode === 0 && (turn.observedKind !== 'candidate' || turn.persistedCandidate));

  // finalCandidate means complete AND the final turn is a candidate with a valid source
  // This now verifies that evidence.source exists and matches finalSourceSha256
  // and that the final turn's sourceSha256 matches finalSourceSha256
  let finalCandidate = false;
  if (complete && turns.length > 0) {
    const finalTurn = turns.at(-1);
    if (finalTurn.observedKind === 'candidate' && typeof report.finalSourceSha256 === 'string') {
      if (!(evidence.source && (typeof evidence.source === 'string' || Buffer.isBuffer(evidence.source)))) {
        finalCandidate = false;
      } else {
        const sourceData = evidence.source instanceof Buffer ? evidence.source : Buffer.from(evidence.source || '', 'utf8');
        const sum = sha256sum(sourceData);
        if (sum === report.finalSourceSha256 && finalTurn.sourceSha256 === report.finalSourceSha256) {
          finalCandidate = true;
        }
      }
    }
  }

  // fixedHoldoutPass means finalCandidate true AND evidence.holdout is defined and valid
  // Check evidence.holdout has exitCode 0 and stdout including the line starting "User expectations passed:"
  let fixedHoldoutPass = false;
  if (finalCandidate && evidence.holdout) {
    fixedHoldoutPass = hasSuccessUserExpectationsLine(evidence.holdout);
  }

  return {
    ...report,
    turns,
    complete,
    finalCandidate,
    fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns
  };
}

// CLI entry point for Node use
if (process.argv[1].endsWith('verdict.mjs')) {
  // Expect a directory with report.json, turn-N.json, CASE_NAME.ghost.md, holdout-result.json
  const directory = process.argv[2];
  if (!directory) {
    console.error('Usage: node verdict.mjs PRIVATE_RUN_DIR');
    process.exit(1);
  }

  (async () => {
    const { readdir } = await import('node:fs/promises');

    const reportDirs = [];
    const reports = [];

    for (const name of (await readdir(directory)).sort()) {
      const fullPath = path.join(directory, name);
      try {
        if (!(await stat(fullPath)).isDirectory()) continue;
      } catch {
        continue;
      }

      // Load report.json
      let report;
      try {
        report = JSON.parse(await readFile(path.join(fullPath, 'report.json'), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }

      // Load captures
      const captures = [];
      for (const turn of report.turns) {
        try {
          const turnFile = path.join(fullPath, `turn-${turn.turn}.json`);
          const turnData = JSON.parse(await readFile(turnFile, 'utf8'));
          captures.push(turnData);
        } catch (error) {
          throw new Error(`Missing or invalid capture file for turn ${turn.turn} in ${name}`);
        }
      }

      // Load source file (CASE_NAME.ghost.md)
      let sourceData;
      try {
        const ghostFiles = (await readdir(fullPath)).filter(f => f.endsWith('.ghost.md'));
        if (ghostFiles.length !== 1) {
          throw new Error(`Expected exactly 1 .ghost.md file in ${name}, found ${ghostFiles.length}`);
        }
        sourceData = await readFile(path.join(fullPath, ghostFiles[0]));
      } catch (error) {
        sourceData = null;
      }

      // Load holdout-result.json
      let holdoutData;
      try {
        holdoutData = JSON.parse(await readFile(path.join(fullPath, 'holdout-result.json'), 'utf8'));
      } catch (error) {
        holdoutData = null;
      }

      // classify using evidence
      const verdict = classifyCase(report, captures, { source: sourceData, holdout: holdoutData });

      reports.push(verdict);
      reportDirs.push(fullPath);
    }

    for (const dir of reportDirs) {
      const verdictFile = path.join(dir, 'verdict.json');
      try {
        await stat(verdictFile);
        throw new Error(`Existing verdict evidence: ${verdictFile}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    for (let i = 0; i < reportDirs.length; i++) {
      await writeFile(path.join(reportDirs[i], 'verdict.json'), JSON.stringify(reports[i], null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    }

    const summaryPath = path.join(directory, 'verdict-summary.json');
    try {
      await stat(summaryPath);
      throw new Error(`Existing verdict evidence: ${summaryPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    await writeFile(summaryPath, JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' });

    for (const row of reports) {
      process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
    }

    if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
  })().catch(error => {
    console.error('Fatal error in verdict CLI:', error);
    process.exit(1);
  });
}
