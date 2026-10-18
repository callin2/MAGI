#!/usr/bin/env python3
import hashlib,json,os,sys,tempfile,time,re
from datetime import datetime,timezone
from pathlib import Path
SCHEMA=1
DESCRIPTION={"schema_version":1,"state_schema":{"schema_version":1,"revision":"integer","issues":"array","audit":"array"},"evidence_item":{"path":"relative regular file inside workspace root","sha256":"64 lowercase hex characters"},"operations":{"describe":{"required":[],"example":{"op":"describe"}},"init":{"required":["issues"],"example":{"op":"init","issues":[]}},"list":{"required":[],"example":{"op":"list"}},"show":{"required":["id"],"example":{"op":"show","id":"T1"}},"create":{"required":["title","goal","parent_id","acceptance"],"example":{"op":"create","title":"child","goal":"do work","parent_id":"T1","acceptance":["artifact exists"]}},"complete":{"required":["id","evidence"],"example":{"op":"complete","id":"T2","evidence":[{"path":"artifact.txt","sha256":"<sha256>"}]},"condition":"complete leaf issues before their parent; every evidence hash must match"},"reopen":{"required":["id","reason"],"example":{"op":"reopen","id":"T2","reason":"corrected artifact"}},"branch":{"required":["target"],"example":{"op":"branch","target":"branch.json"}},"register_followups":{"required":["parent_id","actions"],"example":{"op":"register_followups","parent_id":"T1","actions":[{"title":"child","goal":"do work","acceptance":["artifact exists"]}]}},},"lifecycle":"creating a new child under a done parent automatically reopens that parent and done ancestors, preserving prior evidence in audit and clearing active evidence; reuse-only followups do not change status"}
class Failure(Exception):pass
def err(x):raise Failure(x)
def norm(s):return ' '.join(str(s).split()).casefold()
def load(p):
 try:return json.loads(p.read_text())
 except Exception as e:err(f'invalid json: {e}')
def save_atomic(p,d):
 fd,n=tempfile.mkstemp(prefix='.tracker-',dir=str(p.parent))
 try:
  with os.fdopen(fd,'w') as f:json.dump(d,f,ensure_ascii=False,indent=2);f.write('\n')
  os.replace(n,p)
 except Exception:
  try:os.unlink(n)
  except OSError:pass
  raise
def valid_issue(i):return isinstance(i,dict) and isinstance(i.get('id'),str) and isinstance(i.get('title'),str) and bool(i['title'].strip()) and isinstance(i.get('goal'),str) and bool(i['goal'].strip()) and isinstance(i.get('acceptance'),list) and all(isinstance(x,str) and x.strip() for x in i['acceptance'])
def descendant(s,x,ident):
 while x.get('parent_id') is not None:
  if x['parent_id']==ident:return True
  x=next((z for z in s['issues'] if z['id']==x['parent_id']),{})
  if not x:return False
 return False
def state_ok(s,root=None):
 if not isinstance(s,dict) or s.get('schema_version')!=SCHEMA or not isinstance(s.get('revision'),int) or not isinstance(s.get('issues'),list) or not isinstance(s.get('audit'),list):err('invalid state')
 ids=set();goals=set()
 for i in s['issues']:
  if not valid_issue(i) or i['id'] in ids or norm(i['goal']) in goals:err('invalid or duplicate issue')
  ids.add(i['id']);goals.add(norm(i['goal']));status=i.get('status','open');ev=i.get('evidence',[])
  if status not in ('open','done'):err('invalid status')
  if not isinstance(ev,list):err('invalid evidence')
  if status=='done':
   if not i['acceptance'] or not ev:err('done requires acceptance and evidence')
   for e in ev:
    if not isinstance(e,dict) or not isinstance(e.get('path'),str) or not e['path'] or not isinstance(e.get('sha256'),str) or not re.fullmatch('[0-9a-f]{64}',e['sha256']):err('invalid evidence')
    if root is not None:
     base=root.resolve();p=(base/e['path']).resolve()
     if base not in p.parents or not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=e['sha256']:err('evidence file invalid or hash mismatch')
  elif ev and any(not isinstance(e,dict) for e in ev):err('invalid evidence')
 for i in s['issues']:
  if i.get('parent_id') is not None and i['parent_id'] not in ids:err('missing parent')
 for i in s['issues']:
  seen=set();cur=i
  while cur:
   if cur['id'] in seen:err('parent cycle')
   seen.add(cur['id']);cur=next((x for x in s['issues'] if x['id']==cur.get('parent_id')),None)
  if i.get('status')=='done' and any(x.get('status')!='done' and descendant(s,x,i['id']) for x in s['issues']):err('done parent has open descendant')
 return s
def issue(s,ident):
 for i in s['issues']:
  if i['id']==ident:return i
 err('issue not found')
def nextid(s):return 'T'+str(max([int(i['id'][1:]) for i in s['issues'] if i['id'].startswith('T') and i['id'][1:].isdigit()]+[0])+1)
def reopen_chain(s,i,reason):
 targets=[];cur=i
 while cur is not None and cur.get('status')=='done':targets.append(cur);pid=cur.get('parent_id');cur=next((x for x in s['issues'] if x['id']==pid),None) if pid else None
 prior=[{'id':x['id'],'evidence':json.loads(json.dumps(x.get('evidence',[])))} for x in targets]
 for x in targets:x['status']='open';x['evidence']=[]
 if targets:s['audit'].append({'op':'reopen','id':i['id'],'reason':reason,'prior_evidence':prior})
 return [x['id'] for x in targets]
def dispatch(path,r):
 op=r.get('op')
 if op=='describe':return DESCRIPTION
 if op=='init':
  if path.exists():err('state exists')
  issues=r.get('issues')
  if not isinstance(issues,list):err('issues required')
  s={'schema_version':SCHEMA,'revision':0,'issues':issues,'audit':[]};state_ok(s,path.parent);save_atomic(path,s);return {'revision':0,'issues':issues}
 s=state_ok(load(path))
 if op=='list':return {'revision':s['revision'],'issues':s['issues']}
 if op=='show':return {'revision':s['revision'],'issue':issue(s,r.get('id'))}
 if op=='reopen':
  i=issue(s,r.get('id'));reason=r.get('reason')
  if i.get('status')!='done':err('issue is not done')
  if not isinstance(reason,str) or not reason.strip():err('reason required')
  ids=reopen_chain(s,i,reason);s['revision']+=1;save_atomic(path,s);return {'revision':s['revision'],'reopened_ids':ids}
 if op=='complete':
  i=issue(s,r.get('id'));ev=r.get('evidence')
  if i.get('status')=='done':err('already done')
  if not isinstance(ev,list) or not ev or not i.get('acceptance'):err('evidence and acceptance required')
  if any(x.get('parent_id')==i['id'] and x.get('status')!='done' for x in s['issues']):err('open children')
  state_ok({'schema_version':1,'revision':0,'issues':[dict(i,status='done',evidence=ev) if x is i else x for x in s['issues']],'audit':[]},path.parent)
  i['status']='done';i['evidence']=ev;s['revision']+=1;s['audit'].append({'op':op,'id':i['id']});save_atomic(path,s);return {'revision':s['revision'],'issue':i}
 if op=='create':
  title,goal=r.get('title'),r.get('goal');parent=r.get('parent_id')
  if not isinstance(title,str) or not title.strip() or not isinstance(goal,str) or not goal.strip():err('title and goal required')
  if any(norm(x['goal'])==norm(goal) for x in s['issues']):err('duplicate goal')
  if parent is not None:issue(s,parent)
  i={'id':nextid(s),'title':title,'goal':goal,'parent_id':parent,'acceptance':r.get('acceptance'),'status':'open','evidence':[]}
  if not valid_issue(i):err('invalid acceptance')
  s['issues'].append(i);reopened=reopen_chain(s,issue(s,parent),'new child requires parent evidence revalidation') if parent is not None and issue(s,parent).get('status')=='done' else []
  s['revision']+=1;s['audit'].append({'op':op,'id':i['id']});save_atomic(path,s);return {'revision':s['revision'],'issue':i,'reopened_ids':reopened}
 if op=='branch':
  t=r.get('target')
  if not isinstance(t,str) or not t or os.path.isabs(t) or Path(t).name!=t or t in ('.','..'):err('invalid branch target')
  p=path.parent/t
  if p.exists():err('branch exists')
  b=json.loads(json.dumps(s));b['audit'].append({'op':'branch','origin_revision':s['revision']});save_atomic(p,b);return {'target':t,'revision':s['revision']}
 if op=='register_followups':
  parent=issue(s,r.get('parent_id'));acts=r.get('actions')
  if not isinstance(acts,list):err('actions required')
  made=[];reuse=[];seen=set()
  for a in acts:
   if not isinstance(a,dict) or not isinstance(a.get('title'),str) or not a['title'].strip() or not isinstance(a.get('goal'),str) or not a['goal'].strip() or not isinstance(a.get('acceptance'),list) or not all(isinstance(x,str) and x.strip() for x in a['acceptance']):err('invalid action')
   g=norm(a['goal'])
   if g in seen:err('duplicate action goal')
   seen.add(g);old=next((x for x in s['issues'] if norm(x['goal'])==g),None)
   if old:
    if old.get('parent_id')!=parent['id']:err('parent conflict')
    reuse.append(old['id'])
   else:
    i={'id':nextid(s),'title':a['title'],'goal':a['goal'],'parent_id':parent['id'],'acceptance':a['acceptance'],'status':'open','evidence':[]};s['issues'].append(i);made.append(i['id'])
  reopened=reopen_chain(s,parent,'new followup requires parent evidence revalidation') if made and parent.get('status')=='done' else []
  if made:s['revision']+=1;s['audit'].append({'op':op,'parent_id':parent['id'],'created':made});save_atomic(path,s)
  return {'revision':s['revision'],'created_ids':made,'reused_ids':reuse,'reopened_ids':reopened}
 err('unknown operation')
def main():
 started=time.perf_counter();path=None;r={};out=None;code=1
 try:
  if len(sys.argv)!=3:raise Failure('usage: tracker.py STATE.json request.json')
  path=Path(sys.argv[1]);r=load(Path(sys.argv[2]));out=dispatch(path,r);print(json.dumps(out,ensure_ascii=False,separators=(',',':')));code=0
 except Exception as e:out={'error':str(e)};print(json.dumps(out,ensure_ascii=False))
 finally:
  if path is not None:
   event={'at':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'request':r,'result':out,'exit_code':code,'elapsed_seconds':time.perf_counter()-started}
   try:
    with (path.parent/'tool-events.jsonl').open('a',encoding='utf-8') as f:f.write(json.dumps(event,ensure_ascii=False,separators=(',',':'))+'\n')
   except Exception as e:print(f'warning: could not write tool-events.jsonl: {e}',file=sys.stderr)
 return code
if __name__=='__main__':sys.exit(main())
