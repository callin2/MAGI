"""Score frozen three-model cohort separately; never pool previous GPT-4.1 results."""
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];EXP=ROOT/'experiments/cross-system-target-models-20261019';OLD=ROOT/'experiments/cross-system-20261019'
sys.path.insert(0,str(ROOT/'scripts/cross_system'))
from check import check
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,value):
 with p.open('x') as out:json.dump(value,out,ensure_ascii=False,indent=2);out.write('\n')
def main():
 f=json.loads((EXP/'frozen.json').read_text());assert all(sha(ROOT/p)==h for p,h in f['files'].items());assert sha(ROOT/'scripts/cross_system/judge.mjs')==f['judge_sha256'] and sha(ROOT/'scripts/cross_system/check.py')==f['checker_sha256'];assert sha(OLD/'frozen.json')==f['original_freeze_sha256']
 rows=json.loads((EXP/'runs.json').read_text());results=[]
 for row in rows:
  run=EXP/'runs'/row['id']
  if not (run/'execution.json').exists():results.append({'id':row['id'],'family':row['family'],'model_id':row['model_id'],'arm':row['arm'],'status':'not_run'});continue
  e=json.loads((run/'execution.json').read_text());events=[json.loads(l) for l in (run/'events.jsonl').read_text().splitlines()];judge=check(run/'verdict.mjs');save(run/'judgment.json',judge)
  try:
   d=json.loads((run/'deliverable.json').read_text());schema=set(d)=={'schema_version','summary','tests_run','limitations'} and type(d['schema_version']) is int and d['schema_version']==1 and isinstance(d['summary'],str) and all(isinstance(d[k],list) and all(isinstance(x,str) for x in d[k]) for k in ['tests_run','limitations'])
  except Exception:schema=False
  artifacts=all((run/p).exists() and (run/p).stat().st_size>0 for p in ['notes.md','candidate.test.mjs']);tests=any(x['type']=='tool' and x['name']=='tests' and x['result'].get('exit_code')==0 for x in events);integrity=all(sha(run/p)==h for p,h in row['inputs'].items() if p!='verdict.mjs')
  axes={a:{'passed':sum(c['passed'] for c in judge['cases'] if c['axis']==a),'total':sum(c['axis']==a for c in judge['cases'])} for a in sorted({c['axis'] for c in judge['cases']})};usage={k:sum(u.get(k,0) for u in e['usage'] if u) for k in ['input','output','cacheRead','cacheWrite','totalTokens']}
  response_models=sorted({m for x in events if x['type']=='assistant' for m in x.get('transport',{}).get('response_models',[])})
  result={'id':row['id'],'family':row['family'],'model_id':row['model_id'],'response_models':response_models,'arm':row['arm'],'repetition':row['repetition'],'status':'provider_error' if e['provider_error'] else 'executed','success':judge['success'] and schema and artifacts and tests and integrity and not e['provider_error'],'behavior_success':judge['success'],'behavior_passed':judge['passed'],'behavior_total':judge['total'],'axes':axes,'wrong_analogy_counterexample_failure':any(not c['passed'] for c in judge['cases'] if c['axis']=='counterexample'),'new_regression_count':sum(not c['passed'] for c in judge['cases'] if c['axis']=='regression'),'schema_valid':schema,'artifacts_present':artifacts,'successful_worker_test_call':tests,'immutable_inputs_preserved':integrity,'elapsed_seconds':e['elapsed_seconds'],'model_calls':e['model_calls'],'tool_calls':e['tool_calls'],'tool_errors':e['tool_errors'],'stop':e['stop'],'usage':usage,'user_corrections':0,'cash_cost_usd':None,'human_time_saving':None}
  save(run/'score.json',result);results.append(result)
 summary={}
 for family in ['luna','terra','sol']:
  summary[family]={}
  for arm in ['G','F','E']:
   rr=[r for r in results if r['family']==family and r['arm']==arm and r['status']=='executed'];summary[family][arm]={'executed':len(rr),'successes':sum(r['success'] for r in rr),'behavior_passed':sum(r['behavior_passed'] for r in rr),'behavior_total':sum(r['behavior_total'] for r in rr),'wrong_analogy_runs':sum(r['wrong_analogy_counterexample_failure'] for r in rr),'new_regressions':sum(r['new_regression_count'] for r in rr),'elapsed_seconds':sum(r['elapsed_seconds'] for r in rr),'model_calls':sum(r['model_calls'] for r in rr),'tool_calls':sum(r['tool_calls'] for r in rr),'tool_errors':sum(r['tool_errors'] for r in rr),'usage':{k:sum(r['usage'][k] for r in rr) for k in ['input','output','cacheRead','cacheWrite','totalTokens']}}
 output={'status':'completed' if all(r['status']=='executed' for r in results) else 'incomplete','planned':len(rows),'executed':sum(r['status']=='executed' for r in results),'models':f['models'],'previous_gpt41_cohort_pooled':False,'runs':results,'summary':summary,'cash_cost_usd':None,'human_time_saving':None}
 save(EXP/'execution-results.json',output);print(json.dumps(output,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
