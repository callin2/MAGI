"""Same frozen tasks/memory/oracle, three explicit models, fresh separate cohort."""
import hashlib,json,platform,shutil,subprocess
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];EXP=ROOT/'experiments/cross-system-target-models-20261019';OLD=ROOT/'experiments/cross-system-20261019'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def main():
 if (EXP/'frozen.json').exists():raise SystemExit('Already frozen')
 selected=json.loads((EXP/'selected-models.json').read_text());assert {m['family'] for m in selected['models']}=={'luna','terra','sol'} and len(selected['models'])==3
 original=json.loads((OLD/'frozen.json').read_text());assert all(sha(ROOT/p)==h for p,h in original['files'].items())
 source=EXP/'source';source.mkdir(exist_ok=True)
 for name in ['task.md','public.test.mjs','experience-A.json','verdict-before.mjs','verdict-upstream-reference.mjs','preregistration.md','provenance.json']:shutil.copyfile(OLD/'source'/name,source/name)
 rows=[]
 for model in selected['models']:
  for prior in json.loads((OLD/'runs.json').read_text()):
   ident=model['family']+'-'+prior['id'];run=EXP/'runs'/ident;run.mkdir(parents=True)
   for name in ['task.md','memory.json','public.test.mjs']:shutil.copyfile(OLD/'runs'/prior['id']/name,run/name)
   shutil.copyfile(OLD/'source/verdict-before.mjs',run/'verdict.mjs')
   rows.append({'id':ident,'family':model['family'],'model_id':model['id'],'provider':'openai-codex','arm':prior['arm'],'repetition':prior['repetition'],'original_seed_id':prior['id'],'inputs':{p.name:sha(p) for p in run.iterdir()}})
 save(EXP/'runs.json',rows)
 save(EXP/'machine.json',{'hostname':platform.node(),'os':platform.platform(),'machine':platform.machine(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'provider':'existing-codex-chatgpt','models':selected['models'],'auth_refresh':False,'credential_relocation':False,'settings_changed':False})
 paths=[*(ROOT/'scripts/cross_system/target_models').glob('*.*'),*(source.glob('*')),EXP/'selected-models.json',EXP/'protocol.md']
 save(EXP/'frozen.json',{'frozen_at':datetime.now(timezone.utc).isoformat(),'models':selected['models'],'reasoning':'medium for every model and arm','original_freeze_sha256':sha(OLD/'frozen.json'),'original_task_sha256':sha(OLD/'source/task.md'),'judge_sha256':sha(ROOT/'scripts/cross_system/judge.mjs'),'checker_sha256':sha(ROOT/'scripts/cross_system/check.py'),'runs_sha256':sha(EXP/'runs.json'),'files':{str(p.relative_to(ROOT)):sha(p) for p in paths if p.is_file()},'limits':original['limits'],'comparison':'three-model cohort only; never pool prior GPT-4.1 Mini runs'})
 print('Frozen new runs:',len(rows))
if __name__=='__main__':main()
