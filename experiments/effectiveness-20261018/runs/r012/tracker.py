#!/usr/bin/env python3
import hashlib, json, os, sys, tempfile, time, re
from datetime import datetime, timezone
from pathlib import Path
SCHEMA=1
DESCRIPTION={"schema_version":1,"state_schema":{"schema_version":1,"revision":"integer","issues":"array","audit":"array"},"evidence_item":{"path":"relative regular file inside workspace root","sha256":"64 lowercase hex characters"},"operations":{"describe":{"required":[]},"init":{"required":["issues"]},"list":{"required":[]},"show":{"required":["id"]},"create":{"required":["title","goal","parent_id","acceptance"]},"complete":{"required":["id","evidence"]},"reopen":{"required":["id","reason"]},"branch":{"required":["target"]},"register_followups":{"required":["parent_id","actions"]}}}
class Failure(Exception): pass
def err(m): raise Failure(m)
def norm(s): return " ".join(str(s).split()).casefold()
def load(p):
 try:return json.loads(p.read_text())
 except Exception as e:err(f"invalid json: {e}")
def save_atomic(p,d):
 fd,n=tempfile.mkstemp(dir=str(p.parent),prefix='.tracker-')
 try:
  with os.fdopen(fd,'w') as f:json.dump(d,f,ensure_ascii=False,indent=2);f.write('\n')
  os.replace(n,p)
 except Exception:
  try:os.unlink(n)
  except OSError:pass
  raise
def valid_issue(i):return isinstance(i,dict) and isinstance(i.get('id'),str) and isinstance(i.get('title'),str) and bool(i['title'].strip()) and isinstance(i.get('goal'),str) and bool(i['goal'].strip()) and isinstance(i.get('acceptance'),list) and all(isinstance(x,str) and x.strip() for x in i['acceptance'])
def state_ok(s):
 if not isinstance(s,dict) or s.get('schema_version')!=1 or not isinstance(s.get('revision'),int) or not isinstance(s.get('issues'),list) or not isinstance(s.get('audit'),list):err('invalid state')
 ids=set();goals=set()
 for i in s['issues']:
  if not valid_issue(i) or i['id'] in ids or norm(i['goal']) in goals:err('invalid or duplicate issue')
  ids.add(i['id']);goals.add(norm(i['goal']))
 for i in s['issues']:
  if i.get('parent_id') is not None and i['parent_id'] not in ids:err('missing parent')
 for start in ids:
  seen=set();cur=start
  while cur is not None:
   if cur in seen:err('parent cycle')
   seen.add(cur);cur=next(x.get('parent_id') for x in s['issues'] if x['id']==cur)
 return s
def import_ok(s,root):
 for i in s['issues']:
  st=i.get('status','open');ev=i.get('evidence',[])
  if st not in ('open','done'):err('invalid status')
  if not isinstance(ev,list):err('invalid evidence')
  if st=='done' and (not i['acceptance'] or not ev):err('done requires acceptance and evidence')
  for e in ev:
   if not isinstance(e,dict) or not isinstance(e.get('path'),str) or not isinstance(e.get('sha256'),str) or not re.fullmatch('[0-9a-f]{64}',e['sha256']):err('invalid evidence')
   p=Path(e['path']);rp=(root/p).resolve()
   if p.is_absolute() or rp==root or root not in rp.parents or not rp.is_file() or hashlib.sha256(rp.read_bytes()).hexdigest()!=e['sha256']:err('evidence file invalid or hash mismatch')
 for i in s['issues']:
  if i.get('status')=='done' and any(x.get('parent_id')==i['id'] and x.get('status','open')!='done' for x in s['issues']):err('done parent has open child')
def issue(s,x):
 for i in s['issues']:
  if i['id']==x:return i
 err('issue not found')
def nextid(s):return 'T'+str(max([int(i['id'][1:]) for i in s['issues'] if i['id'].startswith('T') and i['id'][1:].isdigit()]+[0])+1)
def reopen_chain(s,i,reason):
 t=[];c=i
 while c is not None and c.get('status')=='done':
  t.append(c);pid=c.get('parent_id');c=next((x for x in s['issues'] if x['id']==pid),None) if pid else None
 prior=[{'id':x['id'],'evidence':x.get('evidence',[])} for x in t]
 for x in t:x['status']='open';x['evidence']=[]
 if t:s['audit'].append({'op':'reopen','id':i['id'],'reason':reason,'prior_evidence':prior})
 return [x['id'] for x in t]
def dispatch(path,r):
 op=r.get('op')
 if op=='describe':return DESCRIPTION
 if op=='init':
  if path.exists():err('state exists')
  issues=r.get('issues')
  if not isinstance(issues,list):err('issues required')
  s={'schema_version':1,'revision':0,'issues':issues,'audit':[]};state_ok(s);import_ok(s,path.parent.resolve());save_atomic(path,s);return {'revision':0,'issues':issues}
 s=state_ok(load(path))
 if op=='list':return {'revision':s['revision'],'issues':s['issues']}
 if op=='show':return {'revision':s['revision'],'issue':issue(s,r.get('id'))}
 if op=='create':
  title,goal=r.get('title'),r.get('goal');parent=r.get('parent_id')
  if not isinstance(title,str) or not title.strip() or not isinstance(goal,str) or not goal.strip():err('title and goal required')
  if any(norm(x['goal'])==norm(goal) for x in s['issues']):err('duplicate goal')
  if parent is not None:issue(s,parent)
  i={'id':nextid(s),'title':title,'goal':goal,'parent_id':parent,'acceptance':r.get('acceptance'),'status':'open','evidence':[]}
  if not valid_issue(i):err('invalid acceptance')
  s['issues'].append(i);reopened=reopen_chain(s,issue(s,parent),'new child requires parent evidence revalidation') if parent is not None and issue(s,parent).get('status')=='done' else []
  s['revision']+=1;s['audit'].append({'op':op,'id':i['id']});save_atomic(path,s);return {'revision':s['revision'],'issue':i,'reopened_ids':reopened}
 if op=='complete':
  i=issue(s,r.get('id'));ev=r.get('evidence')
  if i.get('status')=='done':err('already done')
  if not isinstance(ev,list) or not ev or not i.get('acceptance'):err('evidence and acceptance required')
  if any(x.get('parent_id')==i['id'] and x.get('status')!='done' for x in s['issues']):err('open children')
  root=path.parent.resolve();checked=[]
  for e in ev:
   if not isinstance(e,dict) or not isinstance(e.get('path'),str) or not isinstance(e.get('sha256'),str) or not re.fullmatch('[0-9a-f]{64}',e['sha256']):err('invalid evidence')
   p=Path(e['path']);rp=(root/p).resolve()
   if p.is_absolute() or root not in rp.parents or not rp.is_file():err('evidence file invalid')
   h=hashlib.sha256(rp.read_bytes()).hexdigest()
   if h!=e['sha256']:err('evidence hash mismatch')
   checked.append({'path':e['path'],'sha256':h})
  i['status']='done';i['evidence']=checked;s['revision']+=1;s['audit'].append({'op':op,'id':i['id']});save_atomic(path,s);return {'revision':s['revision'],'issue':i}
 if op=='reopen':
  i=issue(s,r.get('id'));reason=r.get('reason')
  if i.get('status')!='done':err('issue is not done')
  if not isinstance(reason,str) or not reason.strip():err('reason required')
  t=reopen_chain(s,i,reason);s['revision']+=1;save_atomic(path,s);return {'revision':s['revision'],'reopened_ids':t}
 if op=='branch':
  target=r.get('target')
  if not isinstance(target,str) or not target or Path(target).name!=target or target in ('.','..') or Path(target).is_absolute():err('invalid branch target')
  p=path.parent/target
  if p.exists():err('branch exists')
  b=json.loads(json.dumps(s));b['audit'].append({'op':'branch','origin_revision':s['revision']});save_atomic(p,b);return {'target':target,'revision':s['revision']}
 if op=='register_followups':
  parent=issue(s,r.get('parent_id'));actions=r.get('actions')
  if not isinstance(actions,list):err('actions required')
  seen=set();prepared=[]
  for a in actions:
   if not isinstance(a,dict) or not isinstance(a.get('title'),str) or not a['title'].strip() or not isinstance(a.get('goal'),str) or not a['goal'].strip() or not isinstance(a.get('acceptance'),list) or not all(isinstance(x,str) and x.strip() for x in a['acceptance']):err('invalid action')
   g=norm(a['goal'])
   if g in seen:err('duplicate action goal')
   seen.add(g);x=next((x for x in s['issues'] if norm(x['goal'])==g),None)
   if x and x.get('parent_id')!=parent['id']:err('parent conflict')
   prepared.append((a,x))
  created=[];reused=[]
  for a,x in prepared:
   if x:reused.append(x['id']);continue
   i={'id':nextid(s),'title':a['title'],'goal':a['goal'],'parent_id':parent['id'],'acceptance':a['acceptance'],'status':'open','evidence':[]};s['issues'].append(i);created.append(i['id'])
  reopened=reopen_chain(s,parent,'new followup requires parent evidence revalidation') if created and parent.get('status')=='done' else []
  if created:s['revision']+=1;s['audit'].append({'op':op,'parent_id':parent['id'],'created':created});save_atomic(path,s)
  return {'revision':s['revision'],'created_ids':created,'reused_ids':reused,'reopened_ids':reopened}
 err('unknown operation')
def main():
 started=time.perf_counter();path=None;r={};result=None;code=1
 try:
  if len(sys.argv)!=3:raise Failure('usage: tracker.py STATE.json request.json')
  path=Path(sys.argv[1]);r=load(Path(sys.argv[2]));result=dispatch(path,r);print(json.dumps(result,ensure_ascii=False,separators=(',',':')));code=0
 except Exception as e:result={'error':str(e)};print(json.dumps(result,ensure_ascii=False))
 finally:
  if path is not None:
   event={'at':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'request':r,'result':result,'exit_code':code,'elapsed_seconds':time.perf_counter()-started}
   try:
    with (path.parent/'tool-events.jsonl').open('a',encoding='utf-8') as f:f.write(json.dumps(event,ensure_ascii=False,separators=(',',':'))+'\n')
   except Exception as e:print(f'warning: {e}',file=sys.stderr)
 return code
if __name__=='__main__':sys.exit(main())
