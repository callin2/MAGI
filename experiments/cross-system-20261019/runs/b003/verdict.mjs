import { createHash } from 'node:crypto';
import path from 'node:path';
import { readFile, stat, readdir, writeFile } from 'node:fs/promises';

export function observedKind(stdout) {
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith('GHOSTFLOW_RESULT_JSON:'));
  if (lines.length !== 1) return null;
  try {
    const response = JSON.parse(lines[0].slice('GHOSTFLOW_RESULT_JSON:'.length));
    if (response && ['candidate', 'clarification', 'answer'].includes(response.kind)) {
      return response.kind;
    }
    return null;
  } catch { return null; }
}

/**
 * @param {object} report
 * @param {Array<object>} captures
 * @param {object} evidence optional {source, holdout}
 *   source: Buffer|string, the stored source to check against finalSourceSha256
 *   holdout: object {exitCode, stdout}, the actual fixed holdout result
 * @returns {object} verdict with complete, finalCandidate, fixedHoldoutPass
 */
export function classifyCase(report, captures, evidence = {}) {
  // Check that source evidence buffer/string matches finalSourceSha256
  if (!evidence.source) {
    return generateFailVerdict(report, 'Missing source evidence buffer/string');
  }
  const sourceBuffer = Buffer.isBuffer(evidence.source) ? evidence.source : Buffer.from(evidence.source || '', 'utf8');
  const actualSourceSha256 = createHash('sha256').update(sourceBuffer).digest('hex');
  if (actualSourceSha256 !== report.finalSourceSha256) {
    return generateFailVerdict(report, 'Source SHA-256 mismatch');
  }

  // Check holdout evidence existence
  if (!evidence.holdout || typeof evidence.holdout.exitCode !== 'number' || typeof evidence.holdout.stdout !== 'string') {
    return generateFailVerdict(report, 'Missing or invalid holdout evidence');
  }

  // Parse turns
  const turns = report.turns.map((turn, index) => {
    const cap = captures[index];
    const observed = observedKind(cap?.stdout);
    const expected = turn.expectedKind;

    // Check for candidate persistence in stdout lines
    const persistedCandidate = /^[a-f0-9]{64}$/.test(turn.sourceSha256 ?? '') && cap?.stdout?.split('\n').some(line => {
      const m = /Saved .*: SHA-256 ([a-f0-9]{64})\.$/.exec(line);
      return m && m[1] === turn.sourceSha256;
    }) === true;

    return {
      ...turn,
      observedKind: observed,
      persistedCandidate
    };
  });

  // Validate exit codes for all turns
  const exitOk = turns.every(turn => turn.exitCode === 0);

  // Validate turned kinds matching
  const kindMismatchTurns = turns.filter(turn => turn.expectedKind !== turn.observedKind).map(turn => turn.turn);

  // Check complete: all scripted turns, pin parity, no kind mismatches, all exitCode=0, candidate persisted when candidate expected
  const complete = report.identity.currentPinParity === true
    && turns.length === report.identity.scriptedTurns
    && kindMismatchTurns.length === 0
    && exitOk
    && turns.every(turn => (turn.observedKind !== 'candidate' || turn.persistedCandidate));

  // Check finalCandidate: complete and last turn is candidate and sourceSha256 matches finalSourceSha256
  const finalTurn = turns.at(-1);
  const finalCandidate = complete
    && finalTurn?.observedKind === 'candidate'
    && finalTurn?.sourceSha256 === report.finalSourceSha256;

  // Check fixedHoldoutPass: finalCandidate and holdout exitCode=0 and stdout has line 'User expectations passed:'
  const fixedHoldoutPass = Boolean(
    finalCandidate
    && evidence.holdout.exitCode === 0
    && evidence.holdout.stdout.split('\n').some(line => line.startsWith('User expectations passed:'))
  );

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

function generateFailVerdict(report, reason = '') {
  return {
    ...report,
    turns: report.turns.map(t => ({ ...t, observedKind: null, persistedCandidate: false })),
    complete: false,
    finalCandidate: false,
    fixedHoldoutPass: false,
    expectedCandidateTurns: 0,
    observedCandidateTurns: 0,
    kindMismatchTurns: [],
    _failReason: reason
  };
}

// CLI entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  (async () => {
    const directory = process.argv[2];
    if (!directory) {
      console.error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');
      process.exit(1);
    }

    const entries = [];
    const reports = [];

    for (const name of (await readdir(directory)).sort()) {
      const dirpath = path.join(directory, name);
      if (!await stat(dirpath).then(s => s.isDirectory()).catch(() => false)) continue;

      // Load required files
      let report, holdoutRaw, sourceRaw;
      try {
        report = JSON.parse(await readFile(path.join(dirpath, 'report.json'), 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') continue;
        throw e;
      }
      try {
        holdoutRaw = JSON.parse(await readFile(path.join(dirpath, 'holdout-result.json'), 'utf8'));
      } catch (e) {
        holdoutRaw = null; // We require holdout later, fail verdict if missing
      }

      try {
        sourceRaw = await readFile(path.join(dirpath, `${name}.ghost.md`));
      } catch (e) {
        sourceRaw = null;
      }

      // Load all turn captures
      let captures;
      try {
        captures = await Promise.all(report.turns.map(turn =>
          readFile(path.join(dirpath, `turn-${turn.turn}.json`), 'utf8').then(JSON.parse)
        ));
      } catch (e) {
        // Missing turn capture means fail verdict
        captures = null;
      }

      // Compose evidence
      const evidence = {};
      if (sourceRaw) evidence.source = sourceRaw;
      if (holdoutRaw && typeof holdoutRaw.exitCode === 'number' && typeof holdoutRaw.stdout === 'string') {
        evidence.holdout = holdoutRaw;
      }

      const verdict = captures ? classifyCase(report, captures, evidence) : generateFailVerdict(report, 'Missing turn captures');

      // Save verdict
      reports.push(verdict);
      entries.push(dirpath);
    }

    // Write outputs
    const verdictSummary = path.join(directory, 'verdict-summary.json');
    try {
      await stat(verdictSummary);
      throw new Error(`Existing verdict evidence: ${verdictSummary}`);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    for (const dir of entries) {
      const p = path.join(dir, 'verdict.json');
      try {
        await stat(p);
        throw new Error(`Existing verdict evidence: ${p}`);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }

    for (let i = 0; i < reports.length; i++) {
      await writeFile(path.join(entries[i], 'verdict.json'), JSON.stringify(reports[i], null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    }
    await writeFile(verdictSummary, JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' });

    // Print summary
    for (const row of reports) {
      process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
    }
    if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
  })();
}
