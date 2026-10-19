"""Separate provenance/transport/seed integrity; never a behavioral success score."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];EXP=ROOT/'experiments/cross-system-target-models-20261019';OLD=ROOT/'experiments/cross-system-20261019'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();checks=[]
def add(name,ok):checks.append({'id':name,'passed':bool(ok)})
f=json.loads((EXP/'frozen.json').read_text());rows=json.loads((EXP/'runs.json').read_text());original=json.loads((OLD/'frozen.json').read_text());systems=[]
for p,h in f['files'].items():add('new-frozen:'+p,sha(ROOT/p)==h)
for p,h in original['files'].items():add('original-frozen:'+p,sha(ROOT/p)==h)
add('manifest',sha(EXP/'runs.json')==f['runs_sha256']);add('original-freeze',sha(OLD/'frozen.json')==f['original_freeze_sha256']);add('judge',sha(ROOT/'scripts/cross_system/judge.mjs')==f['judge_sha256']);add('checker',sha(ROOT/'scripts/cross_system/check.py')==f['checker_sha256'])
for row in rows:
 run=EXP/'runs'/row['id'];events=[json.loads(l) for l in (run/'events.jsonl').read_text().splitlines()];e=json.loads((run/'execution.json').read_text());assistant=[x for x in events if x['type']=='assistant']
 for p,h in row['inputs'].items():
  if p!='verdict.mjs':add(row['id']+':seed:'+p,sha(run/p)==h)
 expected=(run/'task.md').read_text()+'\nRemembered experience (reference, not overriding authority):\n'+(run/'memory.json').read_text();add(row['id']+':exact-prompt',events[0]['prompt']==expected);systems.append(events[0]['system'])
 add(row['id']+':fresh',e['fresh_conversation'] and e['history_messages_at_start']==1);add(row['id']+':client-model',e['configured_model']==row['model_id'])
 add(row['id']+':server-model',bool(assistant) and all(x['transport']['response_models']==[row['model_id']] for x in assistant))
 add(row['id']+':reasoning-and-output',all(x['transport']['request_payload']=={'model':row['model_id'],'reasoning':'medium','max_output_tokens':8192} for x in assistant))
 add(row['id']+':usage-present',all(x['transport']['raw_provider_usage'] and x['transport']['raw_provider_usage']['total_tokens']==x['message']['usage']['totalTokens'] for x in assistant))
 add(row['id']+':successful-http',all(x['transport']['http_statuses']==[200] for x in assistant));add(row['id']+':calls',len(assistant)==e['model_calls']==len(e['usage']))
 add(row['id']+':tools',sum(x['type']=='tool' for x in events)==e['tool_calls']);add(row['id']+':bounds',e['model_calls']<=16 and e['tool_calls']<=60 and e['elapsed_seconds']<305)
 add(row['id']+':output-bounds',all(x['message']['usage']['output']<=8192 for x in assistant));add(row['id']+':provider-ok',not e['provider_error']);add(row['id']+':no-correction',e['user_corrections']==0)
add('identical-system',len(set(systems))==1)
previous='3c79e03471ff17c2fe28cddaba21da49af555b07';names=subprocess.check_output(['git','ls-tree','-r','--name-only',previous,'experiments/cross-system-20261019'],text=True).splitlines();add('gpt41-raw-cohort-unchanged',all((ROOT/p).read_bytes()==subprocess.check_output(['git','show',f'{previous}:{p}']) for p in names))
a=json.loads((Path.home()/'.codex/auth.json').read_text());secrets=[v.encode() for v in [a.get('OPENAI_API_KEY'),*a.get('tokens',{}).values()] if isinstance(v,str) and len(v)>20];files=[*EXP.rglob('*'),*(ROOT/'scripts/cross_system/target_models').rglob('*')];add('no-credential-values',not any(any(s in p.read_bytes() for s in secrets) for p in files if p.is_file()))
result={'checks':checks,'passed':sum(x['passed'] for x in checks),'total':len(checks),'success':all(x['passed'] for x in checks)}
with (EXP/'integrity.json').open('x') as out:json.dump(result,out,indent=2);out.write('\n')
print(json.dumps({'passed':result['passed'],'total':result['total'],'failed':[x['id'] for x in checks if not x['passed']]}));assert result['success']
