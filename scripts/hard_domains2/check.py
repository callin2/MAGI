import json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];EXP=ROOT/'experiments/hard-domains-round2-20261019';JUDGE=ROOT/'scripts/hard_domains2/judge.mjs'
def check(domain,target):
 target=Path(target).resolve();cases=EXP/'source-B'/domain/'cases.json';cmd=['node','--permission',f'--allow-fs-read={target.parent}',f'--allow-fs-read={JUDGE}',f'--allow-fs-read={cases}',str(JUDGE),domain,str(target),str(cases)]
 try:p=subprocess.run(cmd,capture_output=True,text=True,timeout=90,env={'PATH':'/opt/homebrew/bin:/usr/bin:/bin','LANG':'en_US.UTF-8'})
 except subprocess.TimeoutExpired as e:return {'domain':domain,'success':False,'passed':0,'total':len(json.loads(cases.read_text())),'cases':[],'infrastructure_error':'evaluation_timeout','evaluation_timeout':True,'timeout_seconds':90,'partial_stdout':(e.stdout or b'').decode('utf-8','replace') if isinstance(e.stdout,bytes) else e.stdout,'partial_stderr':(e.stderr or b'').decode('utf-8','replace') if isinstance(e.stderr,bytes) else e.stderr}
 try:r=json.loads(p.stdout)
 except Exception:r={'domain':domain,'success':False,'passed':0,'total':len(json.loads(cases.read_text())),'infrastructure_error':p.stderr or p.stdout,'cases':[]}
 return r
if __name__=='__main__':
 import sys
 r=check(sys.argv[1],sys.argv[2]);print(json.dumps(r,ensure_ascii=False,indent=2));sys.exit(0 if r['success'] else 1)
