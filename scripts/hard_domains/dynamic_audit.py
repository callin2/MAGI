import json,os,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def audit(experiment):
 exp=ROOT/'experiments'/experiment;preload=ROOT/'scripts/hard_domains/audit_preload.mjs';scriptdir='hard_domains2' if 'round2' in experiment else 'hard_domains';judge=ROOT/'scripts'/scriptdir/'judge.mjs';rows=[]
 for phase in ['screen','main']:
  for target in sorted((exp/phase).glob('*/solution.mjs')):
   if not (target.parent/'execution.json').exists():continue
   identity=target.parent.name;domain=identity.split('-')[0];cases=exp/'source-B'/domain/'cases.json'
   prior=target.parent/'judgment.json'
   if prior.exists() and json.loads(prior.read_text()).get('evaluation_timeout'):
    rows.append({'phase':phase,'id':identity,'calls':None,'skipped_known_evaluation_timeout':True});continue
   with tempfile.TemporaryDirectory(prefix='magi-access-') as tmp:
    trace=Path(tmp).resolve()/'trace.json';cmd=['node','--permission',f'--allow-fs-read={target.parent}',f'--allow-fs-read={judge}',f'--allow-fs-read={cases}',f'--allow-fs-read={preload}',f'--allow-fs-write={trace}','--import',str(preload),str(judge),domain,str(target),str(cases)]
    env={'PATH':'/opt/homebrew/bin:/usr/bin:/bin','LANG':'en_US.UTF-8','MAGI_AUDIT_WORKSPACE':str(target.parent),'MAGI_AUDIT_OUTPUT':str(trace)}
    try:p=subprocess.run(cmd,capture_output=True,text=True,timeout=90,env=env);data=json.loads(trace.read_text()) if trace.exists() else {'calls':None,'missing_trace':True};rows.append({'phase':phase,'id':identity,'exit_code':p.returncode,**data})
    except subprocess.TimeoutExpired:rows.append({'phase':phase,'id':identity,'evaluation_timeout':True,'calls':None})
 result={'scope':'Instrumented re-execution for public fs calls; original scores and model generations unchanged. Native/obfuscated bypasses not formally excluded. Same-process oracle-access limitation remains.','runs':rows,'access_call_count':sum(len(r['calls']) for r in rows if isinstance(r.get('calls'),list)),'inconclusive':sum(r.get('calls') is None for r in rows)}
 (exp/'dynamic-access-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'runs':len(rows),'access_calls':result['access_call_count'],'inconclusive':result['inconclusive']}))
if __name__=='__main__':
 import sys;audit(sys.argv[1])
