"""Screen selection and fresh main results remain disjoint. No model API calls."""
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];EXP=ROOT/'experiments/hard-domains-round2-20261019';sys.path.insert(0,str(ROOT/'scripts/hard_domains2'))
from check import check
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):
 with p.open('x') as out:json.dump(v,out,ensure_ascii=False,indent=2);out.write('\n')
def main(phase):
 f=json.loads((EXP/'frozen.json').read_text());assert all(sha(ROOT/p)==h for p,h in f['files'].items());rows=json.loads((EXP/(phase+'-runs.json')).read_text());domains=['inventory','calendar','events'] if phase=='screen' else json.loads((EXP/'selected-domains.json').read_text())['retained'];results=[]
 for row in rows:
  if row['domain'] not in domains:continue
  run=EXP/phase/row['id']
  if not (run/'execution.json').exists():results.append({**row,'status':'not_run'});continue
  e=json.loads((run/'execution.json').read_text());ee=[json.loads(l) for l in (run/'events.jsonl').read_text().splitlines()];j=check(row['domain'],run/'solution.mjs');save(run/'judgment.json',j)
  try:
   d=json.loads((run/'deliverable.json').read_text());schema=set(d)=={'schema_version','summary','tests_run','limitations'} and type(d['schema_version']) is int and d['schema_version']==1 and isinstance(d['summary'],str) and all(isinstance(d[k],list) and all(isinstance(v,str) for v in d[k]) for k in ['tests_run','limitations'])
  except Exception:schema=False
  artifacts=all((run/p).exists() and (run/p).stat().st_size for p in ['notes.md','candidate.test.mjs']);tests=any(x['type']=='tool' and x['name']=='tests' and x['result'].get('exit_code')==0 for x in ee)
  integrity=all(sha(run/p)==h for p,h in row['inputs'].items() if p!='solution.mjs');valid=not e['provider_error'] and integrity and not j.get('infrastructure_error')
  raw=[x for x in ee if x['type']=='assistant'];models=sorted({m for x in raw for m in x.get('transport',{}).get('response_models',[])})
  valid=valid and models==[row['model_id']]
  result={k:row[k] for k in ['id','phase','domain','family','model_id','arm','repetition']};result.update(status='executed',valid=bool(valid),task_success=bool(j['success'] and valid),package_complete=bool(j['success'] and valid and schema and artifacts and tests),behavior_passed=j['passed'],behavior_total=j['total'],axes={a:{'passed':sum(x['passed'] for x in j['cases'] if x['axis']==a),'total':sum(x['axis']==a for x in j['cases'])} for a in sorted({x['axis'] for x in j['cases']})},schema_valid=bool(schema),artifacts_present=bool(artifacts),successful_worker_test=bool(tests),response_models=models,elapsed_seconds=e['elapsed_seconds'],model_calls=e['model_calls'],tool_calls=e['tool_calls'],tool_errors=e['tool_errors'],stop=e['stop'],usage={k:sum(u.get(k,0) for u in e['usage'] if u) for k in ['input','output','cacheRead','cacheWrite','totalTokens']},user_corrections=0,cash_cost_usd=None,human_time_saving=None)
  save(run/'score.json',result);results.append(result)
 output={'phase':phase,'screen_and_main_pooled':False,'runs':results,'domains':domains,'primary':'per-domain full semantic business-contract success; package/schema separate'};save(EXP/(phase+'-results.json'),output)
 if phase=='screen':
  decisions=[]
  for domain in domains:
   rr=[r for r in results if r['domain']==domain];valid=len(rr)==3 and all(r.get('valid') for r in rr);easy=valid and all(r['task_success'] for r in rr);decisions.append({'domain':domain,'valid_screens':valid,'excluded_as_easy':easy,'retained':valid and not easy,'reason':'all three valid G screens passed every business criterion' if easy else 'at least one valid G screen failed the business contract' if valid else 'infrastructure/route invalid: not evidence of difficulty','screen_ids':[r['id'] for r in rr]})
  save(EXP/'selected-domains.json',{'retained':[d['domain'] for d in decisions if d['retained']],'decisions':decisions,'selection_bias':'Screen-selected task set, not general capability estimate. A single G success is only a heuristic. No assertions removed.'})
 print(json.dumps(output,ensure_ascii=False,indent=2))
if __name__=='__main__':main(sys.argv[1])
