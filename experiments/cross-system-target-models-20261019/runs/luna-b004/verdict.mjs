import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function observedKind(stdout) {
  const prefix = 'GHOSTFLOW_RESULT_JSON:';
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').filter(line => line.startsWith(prefix));
  if (lines.length !== 1) return null;
  try {
    const response = JSON.parse(lines[0].slice(prefix.length));
    return response && Object.keys(response).length === 1 && ['candidate', 'clarification', 'answer'].includes(response.kind) ? response.kind : null;
  } catch { return null; }
}

const sha256 = value => createHash('sha256').update(value).digest('hex');
export function classifyCase(report, captures, evidence = {}) {
  const source = typeof evidence.source === 'string' || Buffer.isBuffer(evidence.source) ? evidence.source : null;
  const actualHash = source === null ? null : sha256(source);
  const rawTurns = Array.isArray(report?.turns) ? report.turns : [];
  const turns = rawTurns.map((turn, index) => {
    const capture = captures?.[index];
    const kind = observedKind(capture?.stdout);
    const claimedHash = turn.sourceSha256;
    const savedHash = typeof capture?.stdout === 'string' ? capture.stdout.split('\n').map(line => /^Saved .*: SHA-256 ([a-f0-9]{64})\.$/.exec(line)?.[1]).find(Boolean) : null;
    const persistedCandidate = /^[a-f0-9]{64}$/.test(claimedHash ?? '') && savedHash === claimedHash && actualHash === claimedHash;
    return {...turn, observedKind:kind, persistedCandidate};
  });
  const kindMismatchTurns = turns.filter(t => t.expectedKind !== t.observedKind).map(t => t.turn);
  const complete = report?.identity?.currentPinParity === true && turns.length === report?.identity?.scriptedTurns && turns.length > 0 && kindMismatchTurns.length === 0 && turns.every((t,i) => captures?.[i]?.exitCode === 0);
  const last = turns.at(-1);
  const finalCandidate = Boolean(complete && last?.observedKind === 'candidate' && last.persistedCandidate && last.sourceSha256 === report?.finalSourceSha256);
  const holdout = evidence.holdout;
  const holdoutPassed = holdout?.exitCode === 0 && typeof holdout.stdout === 'string' && holdout.stdout.split('\n').some(line => line.startsWith('User expectations passed:'));
  return {...report, turns, complete, finalCandidate, fixedHoldoutPass:Boolean(finalCandidate && report?.holdout?.exitCode === 0 && report?.holdout?.fixedExpectationsPassed === true && holdoutPassed), expectedCandidateTurns:turns.filter(t=>t.expectedKind==='candidate').length, observedCandidateTurns:turns.filter(t=>t.observedKind==='candidate').length, kindMismatchTurns};
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory=process.argv[2];
  if(!directory) throw new Error('Usage: node tools/ghostflow-cli-ten-verdict.mjs PRIVATE_RUN_DIR');
  const {readdir}=await import('node:fs/promises'); const reports=[], reportDirs=[];
  const optional=async file=>{try{return await readFile(file)}catch(e){if(e.code==='ENOENT')return null;throw e}};
  for(const name of (await readdir(directory)).sort()){
    const dir=path.join(directory,name); if(!(await stat(dir)).isDirectory())continue;
    let bytes=await optional(path.join(dir,'report.json')); if(bytes===null)continue;
    const report=JSON.parse(bytes.toString('utf8'));
    const captures=await Promise.all((Array.isArray(report.turns)?report.turns:[]).map(async turn=>{const b=await optional(path.join(dir,`turn-${turn.turn}.json`)); if(b===null)return null; try{return JSON.parse(b.toString('utf8'))}catch{return null}}));
    const source=await optional(path.join(dir,`${report.identity?.case}.ghost.md`));
    let holdout=null; const hb=await optional(path.join(dir,'holdout-result.json')); if(hb!==null){try{holdout=JSON.parse(hb.toString('utf8'))}catch{}}
    reports.push(classifyCase(report,captures,{source,holdout})); reportDirs.push(dir);
  }
  const outputs=[path.join(directory,'verdict-summary.json'),...reportDirs.map(d=>path.join(d,'verdict.json'))];
  for(const output of outputs){try{await stat(output);throw new Error(`Existing verdict evidence: ${output}`)}catch(e){if(e.code!=='ENOENT')throw e}}
  for(const [i,dir] of reportDirs.entries()) await (await import('node:fs/promises')).writeFile(path.join(dir,'verdict.json'),JSON.stringify(reports[i],null,2)+'\n',{mode:0o600,flag:'wx'});
  await (await import('node:fs/promises')).writeFile(path.join(directory,'verdict-summary.json'),JSON.stringify(reports,null,2)+'\n',{mode:0o600,flag:'wx'});
  for(const row of reports)process.stdout.write(`${row.identity.case}: completed=${row.complete} finalCandidate=${row.finalCandidate} holdoutPass=${row.fixedHoldoutPass} kindMismatchTurns=${row.kindMismatchTurns.join(',')}\n`);
  if(reports.length===0||reports.some(row=>!row.fixedHoldoutPass))process.exitCode=1;
}
