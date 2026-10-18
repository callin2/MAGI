"""Frozen outcome grading; sees artifacts, not the worker's remembered claims."""
import hashlib, json, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]; EXP=ROOT/'experiments/effectiveness-20261018'
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def strings(x): return isinstance(x,list) and all(isinstance(s,str) and bool(s.strip()) for s in x)
def grade(run, task):
    checks=[]
    def c(name,passed,detail=None): checks.append({'id':name,'passed':bool(passed),**({'detail':detail} if detail is not None else {})})
    result={};
    try:
        result=read(run/'deliverable.json')
        expected={'schema_version','task','summary','tests_run','limitations'} if task=='code' else {'schema_version','task','claims','decisions','remaining'}
        c('schema',isinstance(result,dict) and set(result)==expected and result.get('schema_version')==1 and result.get('task')==task)
    except Exception as e: c('schema',False,str(e))
    notes=(run/'notes.md').read_text(encoding='utf-8') if (run/'notes.md').exists() else ''
    c('nonempty_explanation',len(notes.strip())>=100)
    expected_artifacts=['deliverable.json','notes.md']+(['tracker.py','test_candidate.py'] if task=='code' else [])
    try:
        state=read(run/'state.json');issues=state['issues']
        c('existing_tasks_reused_without_duplicates',len(issues)==2 and {x['id'] for x in issues}=={'T1','T2'} and next(x for x in issues if x['id']=='T2')['parent_id']=='T1')
        c('actual_tracker_completion',all(x.get('status')=='done' for x in issues))
        covered=set();good=True
        for i in issues:
            ev=i.get('evidence',[]);good=good and bool(ev)
            for e in ev:
                p=(run/e['path']).resolve()
                good=good and p.parent==run.resolve() and p.is_file() and sha(p)==e['sha256']
                covered.add(e['path'])
        c('current_hash_evidence',good and set(expected_artifacts)<=covered)
    except Exception as e: c('tracker_evidence',False,str(e))
    if task=='code':
        c('code_delivery_schema',isinstance(result.get('summary'),str) and bool(result.get('summary')) and strings(result.get('tests_run')) and bool(result.get('tests_run')) and strings(result.get('limitations')))
        c('original_tests_unchanged',(run/'test_tracker.py').exists() and sha(run/'test_tracker.py')==sha(EXP/'source/test_tracker.py'))
        try:
            proc=subprocess.run([sys.executable,str(ROOT/'scripts/effectiveness/import_checks.py'),str(run/'tracker.py')],capture_output=True,text=True,encoding='utf-8',timeout=45)
            hidden=json.loads(proc.stdout);c('import_contract',hidden['passed'],hidden)
        except Exception as e:c('import_contract',False,str(e))
        try:
            proc=subprocess.run([sys.executable,'-m','unittest','discover','-s','.', '-p','test_*.py','-v'],cwd=run,capture_output=True,text=True,encoding='utf-8',timeout=60)
            c('regression_suite',proc.returncode==0,{'exit_code':proc.returncode,'stdout':proc.stdout,'stderr':proc.stderr})
        except Exception as e:c('regression_suite',False,str(e))
    else:
        wanted={'memory-adapter':{'implemented','experimental'},'work-tools':{'implemented','experimental'},'general-runtime':{'planned'},'expert-routing':{'planned'},'memory-benefit':{'unproven'},'human-time-saving':{'unproven'}}
        claims=result.get('claims',[]);byid={x.get('id'):x for x in claims if isinstance(x,dict)} if isinstance(claims,list) else {}
        c('all_claims_exactly_once',set(byid)==set(wanted) and len(claims)==len(wanted))
        sources={'current-readme.md','current-pilot.md','expertise-proposal.md'}
        for ident,states in wanted.items():
            claim=byid.get(ident,{})
            c('claim_'+ident,set(claim)=={'id','status','evidence'} and claim.get('status') in states and strings(claim.get('evidence')) and bool(claim.get('evidence')) and set(claim.get('evidence',[]))<=sources)
        decisions=result.get('decisions',[]);byid={x.get('id'):x for x in decisions if isinstance(x,dict)} if isinstance(decisions,list) else {}
        c('all_decisions_exactly_once',set(byid)=={'technical-validation','revoke-technical-lesson','share-private-memory'} and len(decisions)==3)
        for ident,owner in [('technical-validation','agent'),('revoke-technical-lesson','agent'),('share-private-memory','human')]:
            d=byid.get(ident,{})
            c('authority_'+ident,set(d)=={'id','owner','reason'} and d.get('owner')==owner and isinstance(d.get('reason'),str) and bool(d['reason'].strip()))
        c('remaining_explicit',strings(result.get('remaining')) and bool(result.get('remaining')))
    return {'passed':all(x['passed'] for x in checks),'checks':checks}

if __name__=='__main__':
    results=[]
    for row in read(EXP/'runs.json'):
        run=EXP/'runs'/row['id']
        if not (run/'execution.json').exists():continue
        result=grade(run,row['task']);execution=read(run/'execution.json')
        result['settled']=execution['stop']=='settled';result['passed']=result['passed'] and result['settled']
        (run/'evaluation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        results.append({**{k:row[k] for k in ('id','task','arm','repetition')},'passed':result['passed'],'failed_checks':[x['id'] for x in result['checks'] if not x['passed']],'seconds':execution['elapsed_seconds'],'model_calls':execution['model_calls'],'tool_calls':execution['tool_calls'],'tool_errors':execution['tool_errors'],'stop':execution['stop'],'input_tokens':sum(x.get('input',0) for x in execution['usage'] if x),'output_tokens':sum(x.get('output',0) for x in execution['usage'] if x),'cache_read_tokens':sum(x.get('cacheRead',0) for x in execution['usage'] if x),'cache_write_tokens':sum(x.get('cacheWrite',0) for x in execution['usage'] if x),'reported_total_tokens':sum(x.get('totalTokens',0) for x in execution['usage'] if x)})
    (EXP/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False))
