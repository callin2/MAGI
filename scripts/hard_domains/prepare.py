import hashlib,json,platform,random,shutil,subprocess
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2];EXP=ROOT/'experiments/hard-domains-20261019';MODELS={'luna':'gpt-6-luna','terra':'gpt-5.6-terra','sol':'gpt-6.1-sol'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def main():
 if (EXP/'frozen.json').exists():raise SystemExit('Already frozen')
 af=json.loads((EXP/'source-A/frozen.json').read_text());assert all(sha(ROOT/p)==h for p,h in af['files'].items())
 common=[(domain,rep,arm) for domain in ['inventory','calendar','events'] for rep in [1,2] for arm in ['G','F','E']];random.Random(20261019).shuffle(common);screen=[];main=[]
 for family,model in MODELS.items():
  for phase,items,manifest in [('screen',[(d,0,'G') for d in ['inventory','calendar','events']],screen),('main',common,main)]:
   for domain,rep,arm in items:
    ident=f'{domain}-{family}-{arm}-{rep}';run=EXP/phase/ident;run.mkdir(parents=True);src=EXP/'source-B'/domain
    for name in ['task.md','solution.mjs','public.test.mjs']:shutil.copyfile(src/name,run/name)
    lesson=json.loads((EXP/'source-A'/domain/'experience.json').read_text());memory=[] if arm=='G' else [{'rule':lesson['rule'],'conditions':lesson['conditions']}] if arm=='F' else [lesson];save(run/'memory.json',memory)
    manifest.append({'id':ident,'phase':phase,'domain':domain,'family':family,'model_id':model,'arm':arm,'repetition':rep,'inputs':{p.name:sha(p) for p in run.iterdir()}})
 save(EXP/'screen-runs.json',screen);save(EXP/'main-runs.json',main)
 save(EXP/'machine.json',{'hostname':platform.node(),'os':platform.platform(),'machine':platform.machine(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'python':platform.python_version(),'runtime_versions':json.loads(subprocess.check_output(['node','-p','JSON.stringify(process.versions)'],text=True)),'models':MODELS,'provider':'existing-codex-chatgpt','reasoning':'medium','auth_changed':False})
 external=[ROOT/'scripts/cross_system/target_models/provider.mjs',ROOT/'scripts/cross_system/provider.mjs',ROOT/'experiments/cross-system-target-models-20261019/selected-models.json',ROOT/'experiments/cross-system-target-models-20261019/inventory.json']
 paths=[*(ROOT/'scripts/hard_domains').glob('*.*'),*(EXP/'source-A').rglob('*'),*(EXP/'source-B').rglob('*'),EXP/'protocol.md',*external]
 save(EXP/'frozen.json',{'at':datetime.now(timezone.utc).isoformat(),'source_A_commit':'fc98c5c','B_draft_commit':'d3bc7ce','synthetic_tasks':True,'models':MODELS,'reasoning':'medium','limits':{'model_calls':16,'tool_calls':60,'seconds':300,'max_output_tokens':8192},'manifests':{phase:sha(EXP/(phase+'-runs.json')) for phase in ['screen','main']},'files':{str(p.relative_to(ROOT)):sha(p) for p in paths if p.is_file()},'selection':'Three valid G screens all semantic cases pass => exclude entire task, never remove regression assertions. Invalid screens are not evidence of difficulty. Main G/F/E x2 fresh runs only in retained domains. Per-domain full success; no case-count weighted global headline.'})
 print(json.dumps({'screen':len(screen),'main_prepared':len(main),'models':MODELS}))
if __name__=='__main__':main()
