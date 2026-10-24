import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function observedKind(stdout) {
  const prefix = 'GHOSTFLOW_RESULT_JSON:';
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith(prefix));
  if (lines.length !== 1) return null;
  try { const response = JSON.parse(lines[0].slice(prefix.length)); return response && Object.keys(response).length === 1 && ['candidate','clarification','answer'].includes(response.kind) ? response.kind : null; } catch { return null; }
}
const sha256 = value => createHash('sha256').update(value).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function classifyCase(report, captures, evidence = {}) {
  report ??= {}; captures = Array.isArray(captures) ? captures : [];
  const turns = (Array.isArray(report.turns) ? report.turns : []).map((turn, index) => {
    const stdout = captures[index]?.stdout, kind = observedKind(stdout);
    const savedHash = typeof stdout === 'string' ? stdout.split('\n').map(line => /^Saved .+: SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1]).find(Boolean) : undefined;
    return { ...turn, observedKind:kind, persistedCandidate:kind === 'candidate' && validHash(turn?.sourceSha256) && savedHash === turn.sourceSha256 };
  });
  const kindMismatchTurns = turns.filter(t => t.expectedKind !== t.observedKind).map(t => t.turn);
  const complete = report.identity?.currentPinParity === true && turns.length > 0 && turns.length === report.identity?.scriptedTurns && kindMismatchTurns.length === 0 && turns.every((t,i) => captures[i]?.exitCode === 0);
  const source = evidence?.source, sourceHash = typeof source === 'string' || Buffer.isBuffer(source) ? sha256(source) : null, last = turns.at(-1);
  const finalCandidate = Boolean(complete && last?.observedKind === 'candidate' && last.persistedCandidate && validHash(report.finalSourceSha256) && last.sourceSha256 === report.finalSourceSha256 && sourceHash === report.finalSourceSha256);
  const holdout = evidence?.holdout;
  const actualPass = holdout?.exitCode === 0 && typeof holdout.stdout === 'string' && holdout.stdout.split(/\r?\n/).some(line => line.startsWith('User expectations passed:'));
  const fixedHoldoutPass = Boolean(finalCandidate && report.holdout?.exitCode === 0 && report.holdout?.fixedExpectationsPassed === true && actualPass);
  return { ...report, turns, complete, finalCandidate, fixedHoldoutPass, expectedCandidateTurns:turns.filter(t=>t.expectedKind==='candidate').length, observedCandidateTurns:turns.filter(t=>t.observedKind==='candidate').length, kindMismatchTurns };
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory=process.argv[2]; if(!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');
  const {readdir}=await import('node:fs/promises'); const reports=[], reportDirs=[];
  for(const name of (await readdir(directory)).sort()) { const dir=path.join(directory,name); if(!(await stat(dir)).isDirectory()) continue;
    let report; try{report=JSON.parse(await readFile(path.join(dir,'report.json'),'utf8'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
    const captures=await Promise.all((Array.isArray(report.turns)?report.turns:[]).map(t=>readFile(path.join(dir,`turn-${t.turn}.json`),'utf8').then(JSON.parse)));
    let source,holdout; try{source=await readFile(path.join(dir,`${name}.ghost.md`));}catch(e){if(e.code!=='ENOENT')throw e;}
    try{holdout=JSON.parse(await readFile(path.join(dir,'holdout-result.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    reports.push(classifyCase(report,captures,{source,holdout})); reportDirs.push(dir);
  }
  const outputs=[path.join(directory,'verdict-summary.json'),...reportDirs.map(d=>path.join(d,'verdict.json'))];
  for(const output of outputs){try{await stat(output);throw new Error(`Existing verdict evidence: ${output}`);}catch(e){if(e.code!=='ENOENT')throw e;}}
  for(const [i,dir] of reportDirs.entries()) await writeFile(path.join(dir,'verdict.json'),JSON.stringify(reports[i],null,2)+'\n',{mode:0o600,flag:'wx'});
  await writeFile(path.join(directory,'verdict-summary.json'),JSON.stringify(reports,null,2)+'\n',{mode:0o600,flag:'wx'});
  for(const row of reports) process.stdout.write(`${row.identity?.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if(!reports.length||reports.some(row=>!row.fixedHoldoutPass)) process.exitCode=1;
}
