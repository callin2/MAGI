"""Read-only integrity/control audit; does not change frozen outcome scores."""
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];EXP=ROOT/'experiments/effectiveness-20261018'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def h(b):return hashlib.sha256(b).hexdigest()
def check(name,passed,detail=None):checks.append({'id':name,'passed':bool(passed),**({'detail':detail} if detail else {})})
checks=[];frozen=read(EXP/'frozen.json');rows=read(EXP/'runs.json')
for name,digest in frozen['files'].items():
    data=(ROOT/name).read_bytes();check('frozen:'+name,h(data)==digest)
    blob=subprocess.check_output(['git','show','6523f77:'+name],cwd=ROOT)
    # Original commit predates a forced index renormalization. Verify both stored bytes
    # and exact LF->CRLF reconstruction against the preregistered Windows byte digest.
    exact=h(blob)==digest;windows=h(blob.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n'))==digest
    check('preregistered_git_content:'+name,exact or windows,{'exact_bytes':exact,'windows_line_ending_reconstruction':windows})
check('manifest_hash',h((EXP/'runs.json').read_bytes())==frozen['runs_sha256'])
check('balanced_primary',all(sum(x['task']==t and x['arm']==a for x in rows)==2 for t in ('code','handover') for a in ('G','F','L','E')))
for row in rows:
    run=EXP/'runs'/row['id'];receipt=read(run/'memory-receipt.json');memory=read(run/'memory.json');arm=row['arm']
    check(row['id']+':task_hash',h((run/'task.md').read_bytes())==row['task_sha256'])
    check(row['id']+':effective_memory_hash',h((run/'memory.json').read_bytes())==row['effective_memory_sha256'])
    check(row['id']+':seed_hash',h((run/'seed.json').read_bytes())==row['seed_sha256'])
    check(row['id']+':receipt_hash',h(json.dumps(receipt['knowledge'],ensure_ascii=False,sort_keys=True).encode())==receipt['input_sha256'])
    check(row['id']+':receipt_identity',all(receipt[k]==row['id'] for k in ('agent_id','binding_id','run_id','session_id')) and receipt['task_id']==row['task'])
    relevant='observed-integration-failures-evidence-gate' if row['task']=='code' else 'observed-document-review-evidence-boundary'
    if arm=='G':check(row['id']+':no_memory',memory==[] and receipt['mode']=='none')
    elif arm=='F':check(row['id']+':fixed_rules',memory==[{'rule':x['rule'],'conditions':x['conditions']} for x in receipt['knowledge']])
    elif arm=='C':
        differences=[(a,b) for a,b in zip(receipt['knowledge'],memory) if a!=b]
        check(row['id']+':single_controlled_poison',len(differences)==1 and differences[0][0]['id']==relevant and {k:v for k,v in differences[0][0].items() if k!='rule'}=={k:v for k,v in differences[0][1].items() if k!='rule'})
    else:check(row['id']+':memory_matches_receipt',memory==receipt['knowledge'])
    if arm in ('A','R'):check(row['id']+':target_absent',relevant not in {x['id'] for x in memory})
    if arm=='R':
        ops=read(run/'memory-operations.json');revokes=[x for x in ops if x['request']['op']=='revoke']
        check(row['id']+':actual_revoke',len(revokes)==1 and revokes[0]['result']['status']=='revoked' and revokes[0]['result']['revision']==receipt['revision'])
    if (run/'execution.json').exists():
        execution=read(run/'execution.json');events=[json.loads(x) for x in (run/'events.jsonl').read_text(encoding='utf-8').splitlines()]
        check(row['id']+':one_fresh_input',sum(x['type']=='input' for x in events)==1 and execution['history_messages_at_start']==1)
        check(row['id']+':model_calls_observed',execution['model_calls']==sum(x['type'] in ('assistant','provider_error') for x in events))
        check(row['id']+':tool_calls_observed',execution['tool_calls']==sum(x['type']=='tool' for x in events))
        check(row['id']+':model_constant',execution['provider']==frozen['provider'] and execution['configured_model']==frozen['model'])
        check(row['id']+':budget',execution['model_calls']<=16 and execution['tool_calls']<=60)
output={'passed':all(x['passed'] for x in checks),'checks':checks,'completed_runs':sum((EXP/'runs'/x['id']/'execution.json').exists() for x in rows)}
(EXP/'integrity.json').write_text(json.dumps(output,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':output['passed'],'checks':len(checks),'failed':[x for x in checks if not x['passed']],'completed_runs':output['completed_runs']}))
sys.exit(0 if output['passed'] else 1)
