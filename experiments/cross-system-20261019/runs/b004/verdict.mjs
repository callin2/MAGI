import fs from 'node:fs/promises';
import path from 'node:path';
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

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function classifyCase(report, captures, evidence = {}) {
  // Validate source evidence
  let sourceBuffer;
  if (evidence.source) {
    sourceBuffer = Buffer.isBuffer(evidence.source) ? evidence.source : Buffer.from(evidence.source);
    const actualSourceSha256 = sha256(sourceBuffer);
    if (actualSourceSha256 !== report.finalSourceSha256) {
      // source hash mismatch
      return { ...report, complete: false, finalCandidate: false, fixedHoldoutPass: false,
        reason: 'Source evidence SHA-256 does not match finalSourceSha256',
      };
    }
  } else {
    // no source evidence
    return { ...report, complete: false, finalCandidate: false, fixedHoldoutPass: false,
      reason: 'Missing source evidence',
    };
  }

  // Validate holdout evidence
  if (!evidence.holdout || typeof evidence.holdout.exitCode !== 'number' || typeof evidence.holdout.stdout !== 'string') {
    return { ...report, complete: false, finalCandidate: false, fixedHoldoutPass: false,
      reason: 'Missing or invalid holdout evidence',
    };
  }

  const turns = report.turns.map((turn, index) => {
    const capture = captures[index] || {};
    const observed = observedKind(capture.stdout);
    // Verify persist candidate by SHA-256 matching in stdout line
    const persistedCandidate = (/^[a-f0-9]{64}$/i.test(turn.sourceSha256 ?? '') && capture.stdout && typeof capture.stdout === 'string')
      ? capture.stdout.split('\n').some(line => {
        const m = line.match(/Saved \/.*: SHA-256 ([a-f0-9]{64})\./i);
        return m && m[1].toLowerCase() === turn.sourceSha256.toLowerCase();
      })
      : false;
    return { ...turn, observedKind: observed, persistedCandidate };
  });

  // Validate kinds and exitCodes for completion
  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);

  // complete = all scripted turns present, pin true, all kinds observed matched, all exitCode zero, candidates persisted
  const complete = report.identity.currentPinParity === true &&
    turns.length === report.identity.scriptedTurns &&
    kindMismatchTurns.length === 0 &&
    turns.every(turn => turn.exitCode === 0 && (turn.observedKind !== 'candidate' || turn.persistedCandidate));

  // finalCandidate = complete and final turn candidate observed and source matched
  const final = turns.at(-1);
  const finalCandidate = complete && final?.observedKind === 'candidate' && final?.sourceSha256 === report.finalSourceSha256;

  // fixedHoldoutPass = finalCandidate and holdout evidence exitCode 0 and output matches expected line
  const fixedHoldoutPass = finalCandidate && evidence.holdout.exitCode === 0 && evidence.holdout.stdout.includes('User expectations passed:');

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

// CLI
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory = process.argv[2];
  if (!directory) {
    throw new Error('Usage: node verdict.mjs PRIVATE_RUN_DIR');
  }
  (async () => {
    const dirents = await fs.readdir(directory, { withFileTypes: true });
    const reports = [];
    const reportDirs = [];

    for (const dirent of dirents) {
      if (!dirent.isDirectory()) continue;
      const subdir = path.join(directory, dirent.name);
      // Load report.json
      let report;
      try {
        report = JSON.parse(await fs.readFile(path.join(subdir, 'report.json'), 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') continue;
        throw e;
      }

      // Load captures for all turns
      const captures = [];
      for (const turn of report.turns) {
        try {
          const capData = JSON.parse(await fs.readFile(path.join(subdir, `turn-${turn.turn}.json`), 'utf8'));
          captures.push(capData);
        } catch (e) {
          // missing capture file
          captures.push({ exitCode: null, stdout: '' });
        }
      }

      // Load source evidence (CASE_NAME.ghost.md) assumed source content
      let sourceEvidence;
      try {
        const ghostMdName = `${report.identity.case}.ghost.md`;
        sourceEvidence = await fs.readFile(path.join(subdir, ghostMdName));
      } catch {
        sourceEvidence = null;
      }

      // Load holdout capture (holdout-result.json)
      let holdoutEvidence;
      try {
        holdoutEvidence = JSON.parse(await fs.readFile(path.join(subdir, 'holdout-result.json'), 'utf8'));
      } catch {
        holdoutEvidence = null;
      }

      const verdict = classifyCase(report, captures, { source: sourceEvidence, holdout: holdoutEvidence });
      reports.push(verdict);
      reportDirs.push(subdir);
    }

    const summaryPath = path.join(directory, 'verdict-summary.json');
    const existingPaths = [summaryPath, ...reportDirs.map(d => path.join(d, 'verdict.json'))];
    for (const p of existingPaths) {
      try {
        await fs.access(p);
        throw new Error(`Existing verdict evidence: ${p}`);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }

    for (let i = 0; i < reportDirs.length; i++) {
      await fs.writeFile(path.join(reportDirs[i], 'verdict.json'), JSON.stringify(reports[i], null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
    await fs.writeFile(summaryPath, JSON.stringify(reports, null, 2) + '\n', { flag: 'wx', mode: 0o600 });

    for (const r of reports) {
      process.stdout.write(`${r.identity.case}: completed=${r.complete} finalCandidate=${r.finalCandidate} holdoutPass=${r.fixedHoldoutPass} kindMismatchTurns=${r.kindMismatchTurns.join(',')}\n`);
    }

    if (reports.length === 0 || reports.some(r => !r.fixedHoldoutPass)) {
      process.exitCode = 1;
    }
  })();
}
