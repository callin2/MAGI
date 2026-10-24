"""Post-hoc semantic reproductions only; never changes frozen main scores."""
import importlib.util,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];EXP=ROOT/'experiments/hard-domains-round2-20261019'
spec=importlib.util.spec_from_file_location('frozen_oracles',ROOT/'scripts/hard_domains2/build_cases.py');oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle)
js="const m=await import(process.argv[1]); const input=JSON.parse(process.argv[3]); try {console.log(JSON.stringify({actual:await m[process.argv[2]](input)}));} catch(e) {console.log(JSON.stringify({error:e.message}));}"
rows=[]
def run(identity,domain,caseid,input,explanation,origin):
 target=EXP/'main'/identity/'solution.mjs';fn={'calendar':'book','events':'sessions'}[domain]
 expected=getattr(oracle,fn)(input)
 p=subprocess.run(['node','--permission',f'--allow-fs-read={target.parent}','--input-type=module','-e',js,target.as_uri(),fn,json.dumps(input)],capture_output=True,text=True,timeout=30,env={'PATH':'/opt/homebrew/bin:/usr/bin:/bin','LANG':'en_US.UTF-8'})
 result=json.loads(p.stdout);rows.append({'run':identity,'domain':domain,'case':caseid,'origin':origin,'input':input,'expected':expected,**result,'exit_code':p.returncode,'matches':result.get('actual')==expected,'explanation':explanation})
for identity,caseid,explanation in [
 ('calendar-luna-G-2','directed-setup-boundary','The submitted code adds transition minutes directly to millisecond timestamps; 5 minutes is accepted even though a→b requires10 minutes.'),
 ('calendar-terra-F-2','consecutive-not-all-pairs','The submitted code prunes a/c as a conflicting pair although the selected middle z makes consecutive transitions a→b→c feasible. Directed transitions need not satisfy triangle inequality.')]:
 c=next(c for c in json.loads((EXP/'source-B/calendar/cases.json').read_text()) if c['id']==caseid);run(identity,'calendar',caseid,c['input'],explanation,'Existing frozen case; no new scoring criterion.')
def u(id,rev,t,amount):return {'kind':'upsert','id':id,'rev':rev,'key':'y','event_time':t,'amount':amount}
minimal={'gap_ms':10,'lateness_ms':10,'records':[u('e',1,3,-1),{'kind':'watermark','time':28},u('c',1,34,-3),u('c',2,15,2)]}
for identity in ['events-luna-G-1','events-luna-F-1']:
 run(identity,'events','sealed-end-double-gap-minimized',minimal,'Sealed e last=3 already has end=13. c time15 is12 from e and its resulting end25 exceeds cutoff18, so it stays open. Candidate compares with end+gap=23 and wrongly rejects the move, leaving c at34. This is a state/acceptance error independent of throw-versus-skip interpretation.','Post-hoc minimized reproduction of frozen mixed-session-history-3; diagnostic only, not added to scores.')
out={'scope':'Frozen raw scores unchanged. Actual candidate functions executed, independent frozen Python oracle used. No model calls or worker feedback.','reproductions':rows}
with (EXP/'semantic-review.json').open('x') as f:json.dump(out,f,ensure_ascii=False,indent=2);f.write('\n')
print(json.dumps({'reproductions':len(rows),'confirmed_mismatches':sum(not r['matches'] for r in rows)}));assert all(not r['matches'] for r in rows)
