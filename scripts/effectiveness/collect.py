"""Use the frozen grader once per settled run; collect cached immutable results."""
import json
from evaluate import EXP,read,grade
rows=[]
for row in read(EXP/'runs.json'):
    run=EXP/'runs'/row['id']
    if not (run/'execution.json').exists():continue
    execution=read(run/'execution.json')
    if (run/'evaluation.json').exists():result=read(run/'evaluation.json')
    else:
        result=grade(run,row['task']);result['settled']=execution['stop']=='settled';result['passed']=result['passed'] and result['settled']
        (run/'evaluation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    rows.append({**{k:row[k] for k in ('id','task','arm','repetition')},'passed':result['passed'],'failed_checks':[x['id'] for x in result['checks'] if not x['passed']],'seconds':execution['elapsed_seconds'],'model_calls':execution['model_calls'],'tool_calls':execution['tool_calls'],'tool_errors':execution['tool_errors'],'stop':execution['stop'],'input_tokens':sum(x.get('input',0) for x in execution['usage'] if x),'output_tokens':sum(x.get('output',0) for x in execution['usage'] if x),'cache_read_tokens':sum(x.get('cacheRead',0) for x in execution['usage'] if x),'cache_write_tokens':sum(x.get('cacheWrite',0) for x in execution['usage'] if x),'reported_total_tokens':sum(x.get('totalTokens',0) for x in execution['usage'] if x)})
(EXP/'results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'graded':len(rows),'passed':sum(r['passed'] for r in rows),'failures':[r for r in rows if not r['passed']]}))
