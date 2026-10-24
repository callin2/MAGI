"""Deterministic module/real CLI checks, isolated from auth and old experiment data."""
import hashlib,json,os,subprocess,sys,tempfile
from pathlib import Path
SCRIPT=Path(__file__).resolve().parent
NODE='/opt/homebrew/bin/node'
SAFE_ENV={'PATH':'/opt/homebrew/bin:/usr/bin:/bin','LANG':'en_US.UTF-8'}
def invoke(target,files,args,write=None):
 cmd=[NODE,'--permission',f'--allow-fs-read={target.parent}',*[f'--allow-fs-read={p}' for p in files]]
 if write:cmd += [f'--allow-fs-write={write}']
 return subprocess.run([*cmd,*map(str,args)],capture_output=True,text=True,env=SAFE_ENV,timeout=30)
def check(target):
 target=Path(target).resolve()
 lib=invoke(target,[SCRIPT/'judge.mjs'],[SCRIPT/'judge.mjs',target]);raw={'exit_code':lib.returncode,'stdout':lib.stdout,'stderr':lib.stderr}
 try:library=json.loads(lib.stdout);rows=library['cases']
 except Exception:rows=[{'id':'library-load','axis':'infrastructure','passed':False,'error':raw}]
 with tempfile.TemporaryDirectory(prefix='magi-transfer-') as tmp:
  tmp=Path(tmp);source=b'# Isolated acceptance fixture\n';d=hashlib.sha256(source).hexdigest()
  report={'identity':{'case':'case','scriptedTurns':1,'currentPinParity':True},'turns':[{'turn':1,'expectedKind':'candidate','exitCode':0,'sourceSha256':d}],'finalSourceSha256':d,'holdout':{'exitCode':0,'fixedExpectationsPassed':True}}
  cap={'exitCode':0,'stdout':f'GHOSTFLOW_RESULT_JSON:{{"kind":"candidate"}}\nSaved /isolated/case.ghost.md: SHA-256 {d}.\n'}
  for mode in ['valid','tampered','missing-holdout','existing-verdict']:
   root=tmp/mode;c=root/'case';c.mkdir(parents=True)
   (c/'report.json').write_text(json.dumps(report));(c/'turn-1.json').write_text(json.dumps(cap));(c/'case.ghost.md').write_bytes(b'tampered' if mode=='tampered' else source)
   if mode!='missing-holdout':(c/'holdout-result.json').write_text(json.dumps({'exitCode':0,'stdout':'User expectations passed: 8\n'}))
   if mode=='existing-verdict':(c/'verdict.json').write_text('historical evidence\n')
   result=invoke(target,[root],[target,root],root)
   try:
    if mode=='existing-verdict':ok=result.returncode!=0 and (c/'verdict.json').read_text()=='historical evidence\n' and not (root/'verdict-summary.json').exists()
    else:
     v=json.loads((c/'verdict.json').read_text());ok=result.returncode==(0 if mode=='valid' else 1) and v['fixedHoldoutPass']==(mode=='valid')
   except Exception:ok=False
   rows.append({'id':'cli-'+mode,'axis':'integration','passed':ok,'exit_code':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
 return {'target':str(target),'cases':rows,'passed':sum(r['passed'] for r in rows),'total':len(rows),'success':all(r['passed'] for r in rows),'library_raw':raw}
if __name__=='__main__':
 result=check(sys.argv[1]);print(json.dumps(result,ensure_ascii=False,indent=2));sys.exit(0 if result['success'] else 1)
