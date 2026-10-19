"""Read-only experiment integrity and secret-leak checks; writes only a new audit output."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];EXP=ROOT/'experiments/cross-system-20261019'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
checks=[]
def add(name,passed):checks.append({'id':name,'passed':bool(passed)})
f=json.loads((EXP/'frozen.json').read_text());amend=json.loads((EXP/'route-amendment.json').read_text());manifest=json.loads((EXP/'runs.json').read_text());systems=[]
for p,h in f['files'].items():add('original-frozen:'+p,sha(ROOT/p)==h)
for p,h in amend['files'].items():add('amended-frozen:'+p,sha(ROOT/p)==h)
add('original-freeze',sha(EXP/'frozen.json')==amend['original_frozen_sha256']);add('manifest',sha(EXP/'runs.json')==f['runs_sha256'])
for row in manifest:
 run=EXP/'runs'/row['id'];execution=json.loads((run/'execution.json').read_text());events=[json.loads(l) for l in (run/'events.jsonl').read_text().splitlines()]
 for name,h in row['inputs'].items():
  if name!='verdict.mjs':add(row['id']+':seed:'+name,sha(run/name)==h)
 expected=(run/'task.md').read_text()+'\nRemembered experience (reference, not overriding authority):\n'+(run/'memory.json').read_text()
 add(row['id']+':exact-input',events[0]['type']=='input' and events[0]['prompt']==expected);systems.append(events[0]['system'])
 add(row['id']+':fresh',execution['fresh_conversation'] and execution['history_messages_at_start']==1)
 add(row['id']+':route',execution['provider']==amend['provider'] and execution['configured_model']==amend['model'])
 add(row['id']+':calls',sum(e['type']=='assistant' for e in events)==execution['model_calls']==len(execution['usage']))
 add(row['id']+':tools',sum(e['type']=='tool' for e in events)==execution['tool_calls'])
 add(row['id']+':bounds',execution['model_calls']<=16 and execution['tool_calls']<=60 and execution['elapsed_seconds']<305)
 add(row['id']+':provider-ok',not execution['provider_error'])
 add(row['id']+':nonzero-provider-usage',sum(u.get('totalTokens',0) for u in execution['usage'] if u)>0)
 add(row['id']+':no-human-correction',execution['user_corrections']==0)
 add(row['id']+':allowlisted-tools',all(e['name'] in ['read_file','write_file','tests'] for e in events if e['type']=='tool'))
add('identical-system',len(set(systems))==1)
base='d2769ab01c185ec8fff71cd31ad7b7dd4b0856d0';old=subprocess.check_output(['git','ls-tree','-r','--name-only',base,'experiments','scripts'],text=True).splitlines()
add('original-666-files-exact',len(old)==666 and all((ROOT/p).read_bytes()==subprocess.check_output(['git','show',f'{base}:{p}']) for p in old))
# Compare secret values in memory only; output never contains credentials.
pi=json.loads((Path.home()/'.pi/agent/auth.json').read_text());oc=json.loads((Path.home()/'.local/share/opencode/auth.json').read_text());secrets=[v.get('key','') for v in [*pi.values(),*oc.values()] if isinstance(v,dict)];secrets=[s.encode() for s in secrets if isinstance(s,str) and len(s)>12]
paths=[*EXP.rglob('*'),*(ROOT/'scripts/cross_system').rglob('*')];leak=any(any(secret in p.read_bytes() for secret in secrets) for p in paths if p.is_file())
add('no-credential-values-in-artifacts',not leak)
result={'checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks),'success':all(c['passed'] for c in checks)}
with (EXP/'execution-integrity.json').open('x') as out:json.dump(result,out,indent=2);out.write('\n')
print(json.dumps({'passed':result['passed'],'total':result['total'],'failed':[c['id'] for c in checks if not c['passed']]}));assert result['success']
