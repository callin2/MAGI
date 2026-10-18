#!/usr/bin/env python3
import hashlib,json,os,sys,tempfile,time,re
from datetime import datetime,timezone
from pathlib import Path
SCHEMA=1
DESCRIPTION={"schema_version":1,"state_schema":{"schema_version":1,"revision":"integer","issues":"array","audit":"array"},"evidence_item":{"path":"relative regular file inside workspace root","sha256":"64 lowercase hex characters"},"operations":{"describe":{"required":[]},"init":{"required":["issues"]},"list":{"required":[]},"show":{"required":["id"]},"create":{"required":["title","goal","parent_id","acceptance"]},"complete":{"required":["id","evidence"]},"reopen":{"required":["id","reason"]},"branch":{"required":["target"]},"register_followups":{"required":["parent_id","actions"]}},"lifecycle":"reopen clears evidence"}
class Failure(Exception):pass
def err(x):raise Failure(x)
def norm(x):return ' '.join(str(x).split()).casefold()
def load(p):
 try:return json.loads(p.read_text())
 except Exception as e:err('invalid json: '+str(e))
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
def state_ok(s,root=None,validate_done=False):
 if not isinstance(s,dict) or s.get('schema_version')!=1 or not isinstance(s.get('revision'),int) or not isinstance(s.get('issues'),list) or not isinstance(s.get('audit'),list):err('invalid state')
 ids=set();goals=set()
 for i in s['issues']:
  if not valid_issue(i) or i['id'] in ids or norm(i['goal']) in goals:err('invalid or duplicate issue')
  ids.add(i['id']);goals.add(norm(i['goal']))
  if i.get('status') not in ('open','done'):err('invalid status')
  ev=i.get('evidence')
  if not isinstance(ev,list):err('invalid evidence')
  for e in ev:
   if not isinstance(e,dict) or not isinstance(e.get('path'),str) or not e['path'] or not isinstance(e.get('sha256'),str) or not re.fullmatch('[0-9a-f]{64}',e['sha256']):err('invalid evidence')
  if i['status']=='done' and (not i['acceptance'] or not ev):err('done issue requires acceptance and evidence')
 for i in s['issues']:
  if i.get('parent_id') is not None and i['parent_id'] not in ids:err('missing parent')
 for start in ids:
  seen=set();cur=start
  while cur is not None:
   if cur in seen:err('parent cycle')
   seen.add(cur);cur=next(x.get('parent_id') for x in s['issues'] if x['id']==cur)
 for i in s['issues']:
  if i['status']=='done':
   if any(x.get('parent_id')==i['id'] and x.get('status')!='done' for x in s['issues']):err('done issue has open child')
   if validate_done:
    for e in i['evidence']:
     p=(root/e['path']).resolve()
     if root not in p.parents or not p.is_file():err('evidence file invalid')
     if hashlib.sha256(p.read_bytes()).hexdigest()!=e['sha256']:err('evidence hash mismatch')
 return s
def issue(s,x):
 for i in s['issues']:
  if i['id']==x:return i
 err('issue not found')
def nextid(s):return 'T'+str(max([int(i['id'][1:]) for i in s['issues'] if i['id'].startswith('T') and i['id'][1:].isdigit()]+[0])+1)
def reopen_chain(s,i,reason):
 targets=[];cur=i
 while cur is not None and cur.get('status')=='done':
  targets.append(cur);pid=cur.get('parent_id');cur=next((x for x in s['issues'] if x['id']==pid),None) if pid else None
 prior=[{'id':x['id'],'evidence':x.get('evidence',[])} for x in targets]
 for x in targets:x['status']='open';x['evidence']=[]
 if targets:s['audit'].append({'op':'reopen','id':i['id'],'reason':reason,'prior_evidence':prior})
 return [x['id'] for x in targets]
def dispatch(p,r):
 op=r.get('op')
 if op=='describe':return DESCRIPTION
 if op=='init':
  if p.exists():err('state exists')
  issues=r.get('issues')
  if not isinstance(issues,list):err('issues required')
  s={'schema_version':1,'revision':0,'issues':issues,'audit':[]};state_ok(s,p.parent.resolve(),True);save_atomic(p,s);return {'revision':0,'issues':issues}
 s=state_ok(load(p))
 if op=='list':return {'revision':s['revision'],'issues':s['issues']}
 if op=='show':return {'revision':s['revision'],'issue':issue(s,r.get('id'))}
 if op=='create':
  title,goal=r.get('title'),r.get('goal');parent=r.get('parent_id')
  if not isinstance(title,str) or not title.strip() or not isinstance(goal,str) or not goal.strip():err('title and goal required')
  if any(norm(i['goal'])==norm(goal) for i in s['issues']):err('duplicate goal')
  if parent is not None:issue(s,parent)
  i={'id':nextid(s),'title':title,'goal':goal,'parent_id':parent,'acceptance':r.get('acceptance'),'status':'open','evidence':[]}
  if not valid_issue(i):err('invalid acceptance')
  s['issues'].append(i);opened=reopen_chain(s,issue(s,parent),'new child requires parent evidence revalidation') if parent and issue(s,parent)['status']=='done' else []
  s['revision']+=1;s['audit'].append({'op':op,'id':i['id']});save_atomic(p,s);return {'revision':s['revision'],'issue':i,'reopened_ids':opened}
 if op=='complete':
  i=issue(s,r.get('id'));ev=r.get('evidence')
  if i.get('status')=='done':err('already done')
  if not isinstance(ev,list) or not ev or not i.get('acceptance'):err('evidence and acceptance required')
  if any(x.get('parent_id')==i['id'] and x.get('status')!='done' for x in s['issues']):err('open children')
  root=p.parent.resolve();checked=[]
  for e in ev:
   if not isinstance(e,dict) or not isinstance(e.get('path'),str) or not isinstance(e.get('sha256'),str):err('invalid evidence')
   f=(root/e['path']).resolve()
   if root not in f.parents or not f.is_file():err('evidence file invalid')
   h=hashlib.sha256(f.read_bytes()).hexdigest()
   if h!=e['sha256']:err('evidence hash mismatch')
   checked.append({'path':e['path'],'sha256':h})
  i['status']='done';i['evidence']=checked;s['revision']+=1;s['audit'].append({'op':op,'id':i['id']});save_atomic(p,s);return {'revision':s['revision'],'issue':i}
 if op=='reopen':
  i=issue(s,r.get('id'));reason=r.get('reason')
  if i.get('status')!='done':err('issue is not done')
  if not isinstance(reason,str) or not reason.strip():err('reason required')
  ids=reopen_chain(s,i,reason);s['revision']+=1;save_atomic(p,s);return {'revision':s['revision'],'reopened_ids':ids}
 if op=='branch':
  target=r.get('target')
  if not isinstance(target,str) or not target or os.path.isabs(target) or Path(target).name!=target or target in ('.','..'):err('invalid branch target')
  b=p.parent/target
  if b.exists():err('branch exists')
  s['audit'].append({'op':'branch','origin_revision':s['revision']});save_atomic(b,s);return {'target':target,'revision':s['revision']}
 if op=='register_followups':
  parent=issue(s,r.get('parent_id'));actions=r.get('actions')
  if not isinstance(actions,list):err('actions required')
  prepared=[];seen=set()
  for a in actions:
   if not isinstance(a,dict) or not isinstance(a.get('title'),str) or not a['title'].strip() or not isinstance(a.get('goal'),str) or not a['goal'].strip() or not isinstance(a.get('acceptance'),list) or not all(isinstance(x,str) and x.strip() for x in a['acceptance']):err('invalid action')
   g=norm(a['goal'])
   if g in seen:err('duplicate action goal')
   seen.add(g);old=next((x for x in s['issues'] if norm(x['goal'])==g),None)
   if old and old.get('parent_id')!=parent['id']:err('parent conflict')
   prepared.append((a,old))
  created=[];reused=[]
  for a,old in prepared:
   if old:reused.append(old['id']);continue
   i={'id':nextid(s),'title':a['title'],'goal':a['goal'],'parent_id':parent['id'],'acceptance':a['acceptance'],'status':'open','evidence':[]};s['issues'].append(i);created.append(i['id'])
  reopened=reopen_chain(s,parent,'new followup requires parent evidence revalidation') if created and parent['status']=='done' else []
  if created:s['revision']+=1;s['audit'].append({'op':op,'parent_id':parent['id'],'created':created});save_atomic(p,s)
  return {'revision':s['revision'],'created_ids':created,'reused_ids':reused,'reopened_ids':reopened}
 err('unknown operation')
def main():
 started=time.perf_counter();p=None;r={};out=None;code=1
 try:
  if len(sys.argv)!=3:raise Failure('usage: tracker.py STATE.json request.json')
  p=Path(sys.argv[1]);r=load(Path(sys.argv[2]));out=dispatch(p,r);print(json.dumps(out,ensure_ascii=False,separators=(',',':')));code=0
 except Exception as e:out={'error':str(e)};print(json.dumps(out,ensure_ascii=False))
 finally:
  if p is not None:
   event={'at':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'request':r,'result':out,'exit_code':code,'elapsed_seconds':time.perf_counter()-started}
   try:
    with (p.parent/'tool-events.jsonl').open('a',encoding='utf-8') as f:f.write(json.dumps(event,ensure_ascii=False,separators=(',',':'))+'\n')
   except Exception:pass
 return code
if __name__=='__main__':sys.exit(main())
