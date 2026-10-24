import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

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

function sha256(source) {
  if (!(typeof source === 'string' || Buffer.isBuffer(source))) return null;
  return createHash('sha256').update(source).digest('hex');
}

function savedHash(stdout) {
  if (typeof stdout !== 'string') return null;
  const hashes = stdout.split('\n').flatMap(line => {
    const match = /^Saved .+: SHA-256 ([a-f0-9]{64})\.$/.exec(line);
    return match ? [match[1]] : [];
  });
  // A process capture with conflicting save claims cannot corroborate either one.
  return hashes.length === 1 ? hashes[0] : null;
}

function successfulCapture(capture) {
  return Boolean(capture && typeof capture.exitCode === 'number' && capture.exitCode === 0);
}

export function classifyCase(report, captures, evidence = {}) {
  const reportTurns = Array.isArray(report?.turns) ? report.turns : [];
  const suppliedCaptures = Array.isArray(captures) ? captures : [];
  const turns = reportTurns.map((turn, index) => {
    const capture = suppliedCaptures[index];
    const observed = observedKind(capture?.stdout);
    const claimedHash = typeof turn?.sourceSha256 === 'string' ? turn.sourceSha256 : null;
    return {
      ...turn,
      observedKind: observed,
      // This records what the process capture says; source bytes are checked below
      // for the final candidate rather than trusting this report-associated claim.
      persistedCandidate: Boolean(claimedHash && /^[a-f0-9]{64}$/.test(claimedHash)
        && savedHash(capture?.stdout) === claimedHash),
    };
  });
  const kindMismatchTurns = turns
    .filter(turn => turn.expectedKind !== turn.observedKind)
    .map(turn => turn.turn);
  const identity = report?.identity ?? {};
  const complete = identity.currentPinParity === true
    && Number.isInteger(identity.scriptedTurns)
    && turns.length === identity.scriptedTurns
    && kindMismatchTurns.length === 0
    // Only scripted turns matter; a caller may retain unrelated extra captures.
    && turns.every((turn, index) => successfulCapture(suppliedCaptures[index]));

  const finalTurn = turns.at(-1);
  const finalClaim = typeof report?.finalSourceSha256 === 'string' ? report.finalSourceSha256 : null;
  const sourceHash = sha256(evidence?.source);
  const finalCandidate = Boolean(complete
    && finalTurn?.observedKind === 'candidate'
    && /^[a-f0-9]{64}$/.test(finalClaim ?? '')
    && finalTurn.sourceSha256 === finalClaim
    && savedHash(suppliedCaptures.at(-1)?.stdout) === finalClaim
    && sourceHash === finalClaim);

  const holdout = evidence?.holdout;
  const actualHoldoutPassed = successfulCapture(holdout)
    && typeof holdout.stdout === 'string'
    && holdout.stdout.split('\n').some(line => line.startsWith('User expectations passed:'));
  const fixedHoldoutPass = Boolean(finalCandidate
    && report?.holdout?.exitCode === 0
    && report?.holdout?.fixedExpectationsPassed === true
    && actualHoldoutPassed);

  return { ...report, turns, complete, finalCandidate, fixedHoldoutPass,
    expectedCandidateTurns: turns.filter(turn => turn.expectedKind === 'candidate').length,
    observedCandidateTurns: turns.filter(turn => turn.observedKind === 'candidate').length,
    kindMismatchTurns,
  };
}

async function optionalRead(file, encoding) {
  try { return await readFile(file, encoding); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

async function optionalJson(file) {
  const text = await optionalRead(file, 'utf8');
  if (text === undefined) return undefined;
  try { return JSON.parse(text); }
  catch { return undefined; }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');
  const { readdir } = await import('node:fs/promises');
  const reports = [];
  const reportDirs = [];
  for (const name of (await readdir(directory)).sort()) {
    if (!(await stat(path.join(directory, name))).isDirectory()) continue;
    let report;
    try { report = JSON.parse(await readFile(path.join(directory, name, 'report.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const turnList = Array.isArray(report.turns) ? report.turns : [];
    const captures = await Promise.all(turnList.map(turn => optionalJson(path.join(directory, name, `turn-${turn?.turn}.json`))));
    const caseName = report?.identity?.case;
    const source = typeof caseName === 'string'
      ? await optionalRead(path.join(directory, name, `${caseName}.ghost.md`))
      : undefined;
    const holdout = await optionalJson(path.join(directory, name, 'holdout-result.json'));
    reports.push(classifyCase(report, captures, { source, holdout }));
    reportDirs.push(path.join(directory, name));
  }
  const outputs = [path.join(directory, 'verdict-summary.json'), ...reportDirs.map(dir => path.join(dir, 'verdict.json'))];
  for (const output of outputs) {
    try { await stat(output); throw new Error(`Existing verdict evidence: ${output}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const [index, dir] of reportDirs.entries()) {
    await writeFile(path.join(dir, 'verdict.json'), JSON.stringify(reports[index], null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  }
  await writeFile(path.join(directory, 'verdict-summary.json'), JSON.stringify(reports, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  for (const row of reports) process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if (reports.length === 0 || reports.some(row => !row.fixedHoldoutPass)) process.exitCode = 1;
}
