"""Post-run scoring only; no model API, auth or modification of initial blocked status."""
import collections,difflib,hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];EXP=ROOT/'experiments/cross-system-20261019'
sys.path.insert(0,str(ROOT/'scripts/cross_system'))
from check import check

def dump_new(path,value):
 with path.open('x') as f:json.dump(value,f,ensure_ascii=False,indent=2);f.write('\n')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
 frozen=json.loads((EXP/'frozen.json').read_text());amend=json.loads((EXP/'route-amendment.json').read_text());manifest=json.loads((EXP/'runs.json').read_text())
 assert sha(EXP/'frozen.json')==amend['original_frozen_sha256']
 assert all(sha(ROOT/p)==h for p,h in frozen['files'].items())
 assert all(sha(ROOT/p)==h for p,h in amend['files'].items())
 results=[]
 for row in manifest:
  run=EXP/'runs'/row['id'];p=run/'execution.json'
  if not p.exists():results.append({'id':row['id'],'arm':row['arm'],'status':'not_run'});continue
  execution=json.loads(p.read_text());events=[json.loads(s) for s in (run/'events.jsonl').read_text().splitlines()];integrity=[]
  for name,h in row['inputs'].items():
   if name!='verdict.mjs':integrity.append(sha(run/name)==h)
  judge=check(run/'verdict.mjs');dump_new(run/'judgment.json',judge)
  try:
   d=json.loads((run/'deliverable.json').read_text());schema=set(d)=={'schema_version','summary','tests_run','limitations'} and type(d['schema_version']) is int and d['schema_version']==1 and isinstance(d['summary'],str) and all(isinstance(d[k],list) and all(isinstance(x,str) for x in d[k]) for k in ['tests_run','limitations'])
  except Exception:schema=False
  artifacts=all((run/p).exists() and (run/p).stat().st_size>0 for p in ['notes.md','candidate.test.mjs'])
  tests=any(e['type']=='tool' and e['name']=='tests' and e['result'].get('exit_code')==0 for e in events)
  axes={axis:{'passed':sum(c['passed'] for c in judge['cases'] if c['axis']==axis),'total':sum(c['axis']==axis for c in judge['cases'])} for axis in sorted({c['axis'] for c in judge['cases']})}
  tokens={k:sum(u.get(k,0) for u in execution['usage'] if u) for k in ['input','output','cacheRead','cacheWrite','totalTokens']}
  code=run/'verdict.mjs';before=(EXP/'source/verdict-before.mjs').read_text().splitlines();after=code.read_text().splitlines();diff=list(difflib.unified_diff(before,after));edit_lines=sum(x.startswith(('+','-')) and not x.startswith(('+++','---')) for x in diff)
  result={'id':row['id'],'arm':row['arm'],'repetition':row['repetition'],'status':'provider_error' if execution['provider_error'] else 'executed','success':judge['success'] and schema and artifacts and tests and all(integrity) and not execution['provider_error'],'behavior_success':judge['success'],'axes':axes,'wrong_analogy_counterexample_failure':any(not c['passed'] for c in judge['cases'] if c['axis']=='counterexample'),'new_regression_count':sum(not c['passed'] for c in judge['cases'] if c['axis']=='regression'),'schema_valid':schema,'artifacts_present':artifacts,'successful_worker_test_call':tests,'immutable_inputs_preserved':all(integrity),'elapsed_seconds':execution['elapsed_seconds'],'model_calls':execution['model_calls'],'tool_calls':execution['tool_calls'],'tool_errors':execution['tool_errors'],'stop':execution['stop'],'usage':tokens,'edited_lines':edit_lines,'user_corrections':0,'api_cost_usd':None,'human_time_saving':None}
  dump_new(run/'score.json',result);results.append(result)
 summary={}
 for arm in ['G','F','E']:
  rr=[r for r in results if r['arm']==arm];executed=[r for r in rr if r['status']=='executed']
  summary[arm]={'executed':len(executed),'successes':sum(r['success'] for r in executed),'behavior_successes':sum(r['behavior_success'] for r in executed),'wrong_analogy_runs':sum(r['wrong_analogy_counterexample_failure'] for r in executed),'new_regressions':sum(r['new_regression_count'] for r in executed),'elapsed_seconds':sum(r['elapsed_seconds'] for r in executed),'model_calls':sum(r['model_calls'] for r in executed),'tool_calls':sum(r['tool_calls'] for r in executed),'tool_errors':sum(r['tool_errors'] for r in executed),'usage':{k:sum(r['usage'][k] for r in executed) for k in ['input','output','cacheRead','cacheWrite','totalTokens']}}
 output={'provider':amend['provider'],'model':amend['model'],'status':'completed' if all(r['status']=='executed' for r in results) else 'incomplete','executed':sum(r['status']=='executed' for r in results),'planned':len(manifest),'runs':results,'summary':summary,'cash_cost_usd':None,'human_time_saving':None,'source_experience_creation_and_coordinator_cost':None,'causal_reasoning_mechanism':'unobserved; behavioral outcomes only','original_blocked_snapshot':'results.json'}
 dump_new(EXP/'execution-results.json',output);print(json.dumps(output,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
