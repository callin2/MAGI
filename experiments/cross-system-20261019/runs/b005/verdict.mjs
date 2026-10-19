import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function observedKind(stdout) {
  const resultPrefix = 'GHOSTFLOW_RESULT_JSON:';
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith(resultPrefix));
  if (lines.length !== 1) return null; // Reject duplicates
  try {
    const response = JSON.parse(lines[0].slice(resultPrefix.length));
    if (response && Object.keys(response).length === 1 && ['candidate', 'clarification', 'answer'].includes(response.kind)) {
      return response.kind;
    }
  } catch { }
  return null;
}

function verifySourceSha256Match(source, expectedSha256) {
  if (typeof source !== 'string' && !Buffer.isBuffer(source)) return false;
  const buffer = Buffer.isBuffer(source) ? source : Buffer.from(source);
  const actualSha256 = createHash('sha256').update(buffer).digest('hex');
  return actualSha256 === expectedSha256;
}

function verifyHoldoutCapture(holdout) {
  if (!holdout || typeof holdout.exitCode !== 'number' || typeof holdout.stdout !== 'string') return false;
  if (holdout.exitCode !== 0) return false;
  if (!holdout.stdout.includes('User expectations passed:')) return false;
  return true;
}

export function classifyCase(report, captures, evidence = {}) {
  // Validate evidence
  if (!evidence.source || !evidence.holdout) {
    // Missing critical evidence for fixed holdout pass failure
    // Still attempt to classify other statuses
  }

  const turns = report.turns.map((turn, index) => {
    const cap = captures[index] || {};
    const stdout = cap.stdout || '';
    const kind = observedKind(stdout);

    // Persisted candidate validation: the output must contain 'Saved ... SHA-256 ...' line
    // matching the turn's sourceSha256
    const persistedCandidate = /^[a-f0-9]{64}$/.test(turn.sourceSha256 ?? '') &&
      stdout.split('\n').some(line => {
        if (!line.startsWith('Saved ')) return false;
        const match = /SHA-256 ([a-f0-9]{64})\.$/.exec(line);
        return match && match[1] === turn.sourceSha256;
      });

    return {
      ...turn,
      observedKind: kind,
      persistedCandidate,
    };
  });

  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);

  // 'complete': all scripted conversational turns exactly match their expected result kinds and exited successfully
  // also verified persistedCandidate for candidate kinds
  const complete = report.identity.currentPinParity === true &&
    turns.length === report.identity.scriptedTurns &&
    kindMismatchTurns.length === 0 &&
    turns.every(turn => turn.exitCode === 0 && (turn.observedKind !== 'candidate' || turn.persistedCandidate));

  // 'finalCandidate' additionally requires a final saved candidate corroborated by its sourceSha256
  const lastTurn = turns.at(-1) || {};
  const finalCandidate = complete && lastTurn.observedKind === 'candidate' && lastTurn.sourceSha256 === report.finalSourceSha256;

  // For fixedHoldoutPass, source must exist and match finalSourceSha256, and holdout capture must be valid
  const sourceMatches = evidence.source ? verifySourceSha256Match(evidence.source, report.finalSourceSha256) : false;
  const holdoutValid = evidence.holdout ? verifyHoldoutCapture(evidence.holdout) : false;
  const fixedHoldoutPass = Boolean(finalCandidate && sourceMatches && holdoutValid);

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

if (process.argv[1] === new URL(import.meta.url).pathname) {
  (async () => {
    const directory = process.argv[2];
    if (!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');

    const { readdir } = await import('node:fs/promises');

    const reports = [];
    const reportDirs = [];

    for (const name of (await readdir(directory)).sort()) {
      const candidateCaseDir = path.join(directory, name);
      if (!(await stat(candidateCaseDir)).isDirectory()) continue;

      // Load expected files
      let report, holdoutCapture, sourceContent;
      try {
        report = JSON.parse(await readFile(path.join(candidateCaseDir, 'report.json'), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }

      // Load turn captures
      const captures = await Promise.all(
        report.turns.map(turn => readFile(path.join(candidateCaseDir, `turn-${turn.turn}.json`), 'utf8').then(JSON.parse))
      );

      // Load holdout-result.json
      try {
        holdoutCapture = JSON.parse(await readFile(path.join(candidateCaseDir, 'holdout-result.json'), 'utf8'));
      } catch (error) {
        holdoutCapture = null; // missing holdout means failed fixedHoldoutPass
      }

      // Load source file CASE_NAME.ghost.md
      const sourceFile = `${report.identity.case}.ghost.md`;
      try {
        sourceContent = await readFile(path.join(candidateCaseDir, sourceFile));
      } catch (error) {
        if (error.code === 'ENOENT') {
          sourceContent = null; // missing source means fixedHoldoutPass fails
        } else {
          throw error;
        }
      }

      const verdict = classifyCase(report, captures, { source: sourceContent, holdout: holdoutCapture });

      reports.push(verdict);
      reportDirs.push(candidateCaseDir);
    }

    const summaryOutput = path.join(directory, 'verdict-summary.json');
    const outputs = [summaryOutput, ...reportDirs.map(dir => path.join(dir, 'verdict.json'))];

    for (const output of outputs) {
      try {
        await stat(output);
        throw new Error(`Existing verdict evidence: ${output}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    for (let i = 0; i < reportDirs.length; i++) {
      await import('node:fs/promises').then(({ writeFile }) => writeFile(path.join(reportDirs[i], 'verdict.json'), JSON.stringify(reports[i], null, 2) + '\n', { mode: 0o600, flag: 'wx' }));
    }

    await import('node:fs/promises').then(({ writeFile }) => writeFile(summaryOutput, JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' }));

    for (const row of reports) {
      process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
    }

    if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
  })();
}
