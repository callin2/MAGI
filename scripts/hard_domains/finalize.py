"""Post-run evidence checks and descriptive summaries; never changes frozen scores."""
import datetime,hashlib,json,subprocess
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
NAMES=['hard-domains-20261019','hard-domains-round2-20261019']
OUT=ROOT/'experiments'/NAMES[1]
checks=[]
def add(name,ok):checks.append({'id':name,'passed':bool(ok)})
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,x):
 with p.open('x') as f:json.dump(x,f,ensure_ascii=False,indent=2);f.write('\n')

def main():
 systems=[];cohorts=[];model_evidence=[];failure_analysis=[];provider_failures=[]
 for name in NAMES:
  exp=ROOT/'experiments'/name;f=read(exp/'frozen.json')
  for p,h in f['files'].items():add(name+':frozen:'+p,sha(ROOT/p)==h)
  for p,h in read(exp/'source-A/frozen.json')['files'].items():add(name+':source-A:'+p,sha(ROOT/p)==h)
  for phase in ['screen','main']:
   manifest=exp/(phase+'-runs.json');rows=read(manifest)
   add(name+':manifest:'+phase,sha(manifest)==f['manifests'][phase])
   domains=['inventory','calendar','events'] if phase=='screen' else read(exp/'selected-domains.json')['retained']
   scored=read(exp/(phase+'-results.json'))['runs'] if (exp/(phase+'-results.json')).exists() else []
   expected=[r for r in rows if r['domain'] in domains]
   if expected:add(name+':scored:'+phase,len(scored)==len(expected) and all(r['status']=='executed' for r in scored))
   for row in rows:
    run=exp/phase/row['id'];executed=(run/'execution.json').exists();prefix=name+'/'+phase+'/'+row['id']
    add(prefix+':selection',executed==(row['domain'] in domains))
    for p,h in row['inputs'].items():
     if not executed or p!='solution.mjs':add(prefix+':seed:'+p,sha(run/p)==h)
    memory=read(run/'memory.json');source=read(exp/'source-A'/row['domain']/'experience.json')
    expected_memory=[] if row['arm']=='G' else [{k:source[k] for k in ['rule','conditions']}] if row['arm']=='F' else [source]
    add(prefix+':memory-projection',memory==expected_memory)
    if not executed:
     add(prefix+':no-unsettled-generation',not (run/'events.jsonl').exists());continue
    ee=[json.loads(l) for l in (run/'events.jsonl').read_text().splitlines()];e=read(run/'execution.json');aa=[x for x in ee if x['type']=='assistant']
    prompt=(run/'task.md').read_text()+'\nRemembered experience (reference, not overriding authority):\n'+(run/'memory.json').read_text()
    add(prefix+':prompt',ee[0]['type']=='input' and ee[0]['prompt']==prompt);systems.append(ee[0]['system'])
    add(prefix+':fresh',e['fresh_conversation'] and e['history_messages_at_start']==1)
    add(prefix+':client-model',e['configured_model']==row['model_id'])
    successful=[a for a in aa if a['message']['stopReason'] not in ['error','aborted']]
    add(prefix+':server-model',all(a['transport']['response_models']==[row['model_id']] for a in successful))
    add(prefix+':requested-budget',all(a['transport']['request_payload']=={'model':row['model_id'],'reasoning':'medium','max_output_tokens':8192} for a in aa))
    add(prefix+':usage',all(a['transport']['raw_provider_usage'] and a['transport']['raw_provider_usage']['total_tokens']==a['message']['usage']['totalTokens'] for a in successful))
    add(prefix+':http',all(a['transport']['http_statuses']==[200] for a in successful))
    add(prefix+':calls',len(aa)==e['model_calls']==len(e['usage']))
    add(prefix+':tools',sum(x['type']=='tool' for x in ee)==e['tool_calls'])
    add(prefix+':bounds',e['model_calls']<=16 and e['tool_calls']<=60 and e['elapsed_seconds']<305)
    add(prefix+':output-limit',all(a['message']['usage']['output']<=8192 for a in aa))
    add(prefix+':corrections',e['user_corrections']==0)
    j=read(run/'judgment.json');s=read(run/'score.json')
    add(prefix+':provider-failure-accounted',not e['provider_error'] or not s['valid'] and not s['task_success'])
    if e['provider_error']:
     provider_failures.append({'cohort':name,'phase':phase,'run':row['id'],'valid':s['valid'],'stop':e['stop'],'errors':[{'at':a['at'],'error':a.get('error',a.get('message',{}).get('errorMessage')),'transport':a.get('transport')} for a in ee if a['type']=='provider_error' or a['type']=='assistant' and a['message']['stopReason'] in ['error','aborted']],'replacement_generated':False})
    add(prefix+':score-consistency',s['task_success']==bool(j['success'] and s['valid']))
    if j.get('evaluation_timeout'):add(prefix+':timeout-invalid',not s['valid'] and not s['task_success'] and j['infrastructure_error']=='evaluation_timeout')
    failed=[c for c in j['cases'] if not c['passed']]
    failure_analysis.append({'cohort':name,'phase':phase,'run':row['id'],'valid':s['valid'],'evaluation_timeout':bool(j.get('evaluation_timeout')),'failed_cases':[{'id':c['id'],'axis':c['axis'],'expected_throw':bool(c.get('expected',{}).get('throws')),'error':c.get('error'),'input_preserved':c['input_preserved']} for c in failed],'unexpected_throw_count':sum(bool(c.get('error')) and not c.get('expected',{}).get('throws',False) for c in failed),'interpretation_limit':'For round2 sessions an unexpected throw on a late/sealed rejection may reflect ambiguous batch reject/continue policy. This diagnostic does not rescore or prove all other logic correct.' if name==NAMES[1] and row['domain']=='events' else None})
    model_evidence.append({'cohort':name,'phase':phase,'run':row['id'],'calls':[{'event_at':a['at'],'requested_model':a['transport']['requested_model'],'server_models':a['transport']['response_models'],'request_payload':a['transport']['request_payload'],'http_statuses':a['transport']['http_statuses']} for a in aa]})
   if scored:
    group=defaultdict(list)
    for r in scored:group[(r['domain'],r['family'],r['arm'])].append(r)
    groups=[]
    for (domain,family,arm),rr in sorted(group.items()):
     groups.append({'domain':domain,'family':family,'arm':arm,'n':len(rr),'valid':sum(r['valid'] for r in rr),'task_success':sum(r['task_success'] for r in rr),'package_complete':sum(r['package_complete'] for r in rr),'partial_behavior':[{'id':r['id'],'valid':r['valid'],'passed':r['behavior_passed'] if r['valid'] else None,'total':r['behavior_total']} for r in rr],'elapsed_seconds':sum(r['elapsed_seconds'] for r in rr),'model_calls':sum(r['model_calls'] for r in rr),'tool_calls':sum(r['tool_calls'] for r in rr),'tool_errors':sum(r['tool_errors'] for r in rr),'usage':{k:sum(r['usage'][k] for r in rr) for k in ['input','output','cacheRead','cacheWrite','totalTokens']}})
    raw_usage=defaultdict(int)
    for r in scored:
     events=exp/phase/r['id']/'events.jsonl'
     for line in events.read_text().splitlines():
      a=json.loads(line)
      if a['type']!='assistant':continue
      u=a['transport']['raw_provider_usage']
      if u is None:raw_usage['calls_with_unknown_usage']+=1;continue
      for k in ['input_tokens','output_tokens','total_tokens']:raw_usage[k]+=u.get(k,0)
      raw_usage['cached_input_tokens']+=u.get('input_tokens_details',{}).get('cached_tokens',0)
      raw_usage['cache_write_tokens']+=u.get('input_tokens_details',{}).get('cache_write_tokens',0)
      raw_usage['reasoning_output_tokens']+=u.get('output_tokens_details',{}).get('reasoning_tokens',0)
    executions=[read(exp/phase/r['id']/'execution.json') for r in scored]
    start=min(e['started_at'] for e in executions);end=max(e['ended_at'] for e in executions)
    span=(datetime.datetime.fromisoformat(end)-datetime.datetime.fromisoformat(start)).total_seconds()
    cohorts.append({'name':name,'phase':phase,'conversations':len(scored),'valid_conversations':sum(r['valid'] for r in scored),'provider_errors':sum(e['provider_error'] for e in executions),'first_started_at':start,'last_ended_at':end,'phase_wall_span_seconds':span,'worker_elapsed_sum_seconds':sum(e['elapsed_seconds'] for e in executions),'groups':groups,'raw_provider_usage':dict(raw_usage)})
 add('same-system-across-cohorts',len(set(systems))==1)
 baseline='c57848dc59583616a2cd5866ed11280da1ba68e3'
 tree=subprocess.check_output(['git','ls-tree','-r','-z',baseline,'experiments','scripts'],cwd=ROOT)
 old_count=0
 for line in tree.split(b'\0'):
  if not line:continue
  meta,p=line.split(b'\t',1);mode,kind,oid=meta.split();path=p.decode();data=(ROOT/path).read_bytes();blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
  add('old-byte-preserved:'+path,blob==oid.decode());old_count+=1
 # Read existing credential values only in memory for an exact-value leak check.
 auth=read(Path.home()/'.codex/auth.json');secrets=[v.encode() for v in [auth.get('OPENAI_API_KEY'),*auth.get('tokens',{}).values()] if isinstance(v,str) and len(v)>20]
 scan=[p for n in NAMES for p in (ROOT/'experiments'/n).rglob('*') if p.is_file()]
 scan += [p for d in ['scripts/hard_domains','scripts/hard_domains2'] for p in (ROOT/d).rglob('*') if p.is_file()]
 add('credential-values-absent',not any(any(v in p.read_bytes() for v in secrets) for p in scan))
 result={'scope':'Provenance and transport integrity only; not semantic performance or complete oracle isolation.','passed':sum(c['passed'] for c in checks),'total':len(checks),'success':all(c['passed'] for c in checks),'historical_files_checked':old_count,'checks':checks}
 save(OUT/'integrity.json',result)
 save(OUT/'summary.json',{'cohorts':cohorts,'screen_main_pooled':False,'primary':'Per-domain full business-contract success; no case-weighted global headline','cash_cost_usd':None,'coordinator_cost':None,'human_time_saving':None})
 save(OUT/'model-id-evidence.json',{'scope':'Exact requested and server response model IDs per SDK call. Unique HTTP request IDs and response object UUIDs were not captured by the frozen adapter.','runs':model_evidence})
 save(OUT/'failure-analysis.json',{'scope':'Descriptive review of frozen judgments; no changed assertions, candidates, or scores. Error-policy ambiguity is not resolved by discarding cases.','runs':failure_analysis})
 save(OUT/'provider-errors.json',{'scope':'Preserved failed conversations, not semantic model failures. Missing raw usage is unknown, not zero. No failed outcome regenerated.','runs':provider_failures})
 print(json.dumps({k:result[k] for k in ['passed','total','success','historical_files_checked']}));print('failed', [c['id'] for c in checks if not c['passed']])
 assert result['success']

if __name__=='__main__':main()
