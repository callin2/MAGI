"""Freeze six clean conversations from existing source A, without target answers in memory."""
import hashlib,json,platform,random,shutil,subprocess,sys
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
EXP=ROOT/'experiments/cross-system-20261019'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
TASK='''Repair the supplied historical farm_studio_api CLI acceptance verdict, using only the tools and files provided. This is a different repository from MAGI. Current task semantics outrank remembered experience.

Problem: the standalone verdict can certify a generated candidate and fixed holdout from a report's claims even when stored source or real process/check captures do not substantiate them. Harden the real classifier and its CLI file-loading path. Preserve the exported observedKind and classifyCase entry points and existing returned status/count fields. Extend classifyCase(report,captures,evidence={}) to accept evidence.source (Buffer or string) and evidence.holdout (the actual {exitCode,stdout} capture). The CLI's case files are report.json, turn-N.json, CASE_NAME.ghost.md, and holdout-result.json. Missing evidence must produce a failed verdict rather than fabricated success. Source SHA-256 must match the final source claim; report labels alone do not prove process or fixed-holdout success. Captures use numeric exitCode and stdout; a real successful holdout emits a line starting User expectations passed:. Keep compiler-pin, response-kind, final-candidate, and historical-verdict overwrite protections.

The three statuses differ: complete means all scripted conversational turns matched their expected result kinds and exited successfully; finalCandidate additionally requires a final saved candidate corroborated by its source; fixedHoldoutPass additionally requires the report and actual fixed-holdout capture to establish success. A legitimate clarification or answer can complete without producing a candidate file. Do not impose the old tracker's evidence-array schema on this system.

Inspect verdict.mjs and public.test.mjs, write the repaired verdict.mjs, add candidate.test.mjs with meaningful regression coverage, and use tests to run public and candidate tests. Write deliverable.json with exactly schema_version:1, summary:string, tests_run:array of strings, limitations:array of strings. Write notes.md explaining the cause, actual checks, any experience used and where it does not apply. Do not claim checks not run. No external systems or access beyond the supplied tools. No human follow-up will arrive. A final chat answer alone is not completion. Stop within 16 model turns, 60 tool calls and 300 seconds.\n'''
PUBLIC='''import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {classifyCase,observedKind} from './verdict.mjs';
const source='# Current fixture\\n';const d=createHash('sha256').update(source).digest('hex');
const r={identity:{scriptedTurns:1,currentPinParity:true},turns:[{turn:1,expectedKind:'candidate',exitCode:0,sourceSha256:d}],finalSourceSha256:d,holdout:{exitCode:0,fixedExpectationsPassed:true}};
const c={exitCode:0,stdout:`GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\\nSaved /isolated/case.ghost.md: SHA-256 ${d}.\\n`};
test('valid candidate stays accepted',()=>assert.equal(classifyCase(r,[c],{source,holdout:{exitCode:0,stdout:'User expectations passed: 1\\n'}}).fixedHoldoutPass,true));
test('parser rejects duplicate responses',()=>assert.equal(observedKind(c.stdout+c.stdout),null));
'''
def main():
 if (EXP/'frozen.json').exists():raise SystemExit('Already frozen; no overwrite')
 src=EXP/'source';src.mkdir(parents=True,exist_ok=True)
 old=ROOT/'experiments/effectiveness-20261018/runs/r005/memory.json'
 lesson=next(x for x in json.loads(old.read_text()) if x['id']=='observed-integration-failures-evidence-gate')
 # Exact historical lesson fields; do not add target-specific vocabulary or constraints.
 save(src/'experience-A.json',lesson)
 (src/'task.md').write_text(TASK);(src/'public.test.mjs').write_text(PUBLIC)
 target=Path(sys.argv[1]);before='95b2388f8c233b60007aa2b0df8f82a80d7efbf9';after='ec21d3f5b6921d4a62d7f74782caa6bc9cba4856'
 for name,rev in [('verdict-before.mjs',before),('verdict-upstream-reference.mjs',after)]:
  (src/name).write_bytes(subprocess.check_output(['git','show',f'{rev}:tools/ghostflow-cli-ten-verdict.mjs'],cwd=target))
 save(src/'provenance.json',{'source_A':{'repository':'https://github.com/callin2/MAGI','commit':'d2769ab01c185ec8fff71cd31ad7b7dd4b0856d0','file':str(old.relative_to(ROOT)),'file_sha256':sha(old),'selected_id':lesson['id']},'target_B':{'repository':'https://github.com/callin2/farm_studio_api','defect_commit':before,'upstream_fix_commit':after,'file':'tools/ghostflow-cli-ten-verdict.mjs','selection':'Historical real defect, not injected mutation. Coordinator saw upstream fix; workers cannot read it. Selection/author knowledge limits are disclosed.'}})
 rows=[(a,r) for a in ('G','F','E') for r in (1,2)];random.Random(20261019).shuffle(rows);manifest=[]
 for n,(arm,rep) in enumerate(rows,1):
  ident=f'b{n:03d}';run=EXP/'runs'/ident;run.mkdir(parents=True)
  memory=[] if arm=='G' else [{'rule':lesson['rule'],'conditions':lesson['conditions']}] if arm=='F' else [lesson]
  shutil.copyfile(src/'verdict-before.mjs',run/'verdict.mjs');shutil.copyfile(src/'public.test.mjs',run/'public.test.mjs');shutil.copyfile(src/'task.md',run/'task.md');save(run/'memory.json',memory)
  manifest.append({'id':ident,'arm':arm,'repetition':rep,'inputs':{p.name:sha(p) for p in run.iterdir() if p.is_file()}})
 save(EXP/'runs.json',manifest)
 save(EXP/'machine.json',{'hostname':platform.node(),'os':platform.platform(),'machine':platform.machine(),'python':platform.python_version(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'pi_version':json.loads(Path('/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/package.json').read_text())['version'],'provider':'zai','model':'glm-4.7','existing_auth_only':True,'central_shared_context':'No work_status/shared_context/fleet tools exposed. Open GitHub issues and PR25 read before preparation.'})
 paths=sorted([*src.glob('*'),* (ROOT/'scripts/cross_system').glob('*.*')])
 save(EXP/'frozen.json',{'frozen_at':datetime.now(timezone.utc).isoformat(),'base_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'provider':'zai','model':'glm-4.7','reasoning':'minimal (Pi zai route disables thinking)','limits':{'model_turns':16,'tool_calls':60,'seconds':300,'max_output_tokens_per_turn':8192},'runs_sha256':sha(EXP/'runs.json'),'files':{str(p.relative_to(ROOT)):sha(p) for p in paths if p.is_file()}})
 print(json.dumps({'frozen_runs':len(manifest),'root':str(EXP)}))
if __name__=='__main__':main()
