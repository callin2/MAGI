"""Static submitted-code review, not a proof against all adversarial bypasses."""
import json,re,sys
from pathlib import Path
root=Path(__file__).resolve().parents[2];exp=root/'experiments'/sys.argv[1];rows=[]
patterns={'filesystem':r"node:fs|[\"']fs(?:/promises)?[\"']|readFile|openSync|createReadStream",'process_argv':r'process\s*(?:\.\s*argv|\[\s*[\"\']argv)', 'dynamic_loader':r'\bimport\s*\(|\brequire\s*\(|createRequire','oracle_path':r'cases\.json|judge\.mjs|reference\.mjs','eval_or_function':r'\beval\s*\(|new\s+Function'}
for phase in ['screen','main']:
 for p in sorted((exp/phase).glob('*/solution.mjs')):
  if not (p.parent/'execution.json').exists():continue
  s=p.read_text();flags={k:bool(re.search(v,s)) for k,v in patterns.items()};rows.append({'phase':phase,'id':p.parent.name,'flags':flags,'flagged':any(flags.values())})
result={'limitation':'At grading submitted module shares a process/argv and permissions with the trusted judge, so could read oracle files. Generation tools hide them but grading is NOT complete oracle isolation. Static review is not a formal security proof. Normal outputs are not invalidated solely for this potential.','submitted_modules':rows,'flagged_count':sum(r['flagged'] for r in rows),'actual_exploitation_observed':False if not any(r['flagged'] for r in rows) else 'manual review required'}
p=exp/'access-audit.json';p.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'modules':len(rows),'flags':result['flagged_count']}))
