#!/usr/bin/env python3
import hashlib,json,os,sys,tempfile,time
from datetime import datetime,timezone
from pathlib import Path
SCHEMA=1
OPS={"describe":{"required":[]},"init":{"required":["issues"]},"list":{"required":[]},"show":{"required":["id"]},"create":{"required":["title","goal","parent_id","acceptance"]},"complete":{"required":["id","evidence"]},"reopen":{"required":["id","reason"]},"branch":{"required":["target"]},"register_followups":{"required":["parent_id","actions"]}}
DESCRIPTION={"schema_version":1,"state_schema":{"schema_version":1,"revision":"integer","issues":"array","audit":"array"},"evidence_item":{"path":"relative regular file inside workspace root","sha256":"64 lowercase hex characters"},"operations":OPS}
class Failure(Exception):pass
def norm(s):return " ".join(str(s).split()).casefold()
def err(m):raise Failure(m)
def load(p):
 try:return json.loads(p.read_text())
 except Exception as e:err(f"invalid json: {e}")
def save_atomic(p,d):
 fd,n=tempfile.mkstemp(prefix=".tracker-",dir=str(p.parent))
 try:
  with os.fdopen(fd,"w") as f:json.dump(d,f,ensure_ascii=False,indent=2);f.write("\n")
  os.replace(n,p)
 except Exception:
  try:os.unlink(n)
  except OSError:pass
  raise
def valid_issue(i):return isinstance(i,dict) and isinstance(i.get("id"),str) and isinstance(i.get("title"),str) and bool(i["title"].strip()) and isinstance(i.get("goal"),str) and bool(i["goal"].strip()) and isinstance(i.get("acceptance"),list) and all(isinstance(x,str) and x.strip() for x in i["acceptance"])
def evidence_valid(e,root,check):
 if not isinstance(e,dict) or not isinstance(e.get("path"),str) or not e["path"] or not isinstance(e.get("sha256"),str) or len(e["sha256"])!=64 or any(c not in "0123456789abcdef" for c in e["sha256"]):return False
 raw=Path(e["path"])
 if raw.is_absolute():return False
 try:base=root.resolve();p=(root/raw).resolve()
 except Exception:return False
 if p==base or base not in p.parents:return False
 if check:
  try:return p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==e["sha256"]
  except OSError:return False
 return True
def state_ok(s,root=None,check=False):
 if not isinstance(s,dict) or s.get("schema_version")!=SCHEMA or not isinstance(s.get("revision"),int) or not isinstance(s.get("issues"),list) or not isinstance(s.get("audit"),list):err("invalid state")
 ids=set();goals=set();root=root or Path.cwd()
 for i in s["issues"]:
  if not valid_issue(i) or i["id"] in ids or norm(i["goal"]) in goals:err("invalid or duplicate issue")
  ids.add(i["id"]);goals.add(norm(i["goal"]))
  st=i.get("status");ev=i.get("evidence")
  if st not in ("open","done") or not isinstance(ev,list):err("invalid status or evidence")
  if st=="done" and (not i["acceptance"] or not ev):err("done issue requires acceptance and evidence")
  if any(not evidence_valid(e,root,check and st=="done") for e in ev):err("invalid evidence")
 for i in s["issues"]:
  if i.get("parent_id") is not None and i["parent_id"] not in ids:err("missing parent")
 for start in ids:
  seen=set();cur=start
  while cur is not None:
   if cur in seen:err("parent cycle")
   seen.add(cur);cur=next(x.get("parent_id") for x in s["issues"] if x["id"]==cur)
 for i in s["issues"]:
  if i.get("status")=="done" and any(x.get("parent_id")==i["id"] and x.get("status")!="done" for x in s["issues"]):err("done issue has open descendant")
 return s
def issue(s,ident):
 for i in s["issues"]:
  if i["id"]==ident:return i
 err("issue not found")
def nextid(s):return "T"+str(max([int(i["id"][1:]) for i in s["issues"] if i["id"].startswith("T") and i["id"][1:].isdigit()]+[0])+1)
def reopen_chain(s,i,reason):
 targets=[];cur=i
 while cur is not None and cur.get("status")=="done":targets.append(cur);cur=next((x for x in s["issues"] if x["id"]==cur.get("parent_id")),None)
 prior=[{"id":x["id"],"evidence":x["evidence"][:]} for x in targets]
 for x in targets:x["status"]="open";x["evidence"]=[]
 if targets:s["audit"].append({"op":"reopen","id":i["id"],"reason":reason,"prior_evidence":prior})
 return [x["id"] for x in targets]
def dispatch(path,r):
 op=r.get("op")
 if op=="describe":return DESCRIPTION
 if op=="init":
  if path.exists():err("state exists")
  a=r.get("issues")
  if not isinstance(a,list):err("issues required")
  s={"schema_version":SCHEMA,"revision":0,"issues":a,"audit":[]};state_ok(s,path.parent,True);save_atomic(path,s);return {"revision":0,"issues":a}
 s=state_ok(load(path),path.parent)
 if op=="list":return {"revision":s["revision"],"issues":s["issues"]}
 if op=="show":return {"revision":s["revision"],"issue":issue(s,r.get("id"))}
 if op in ("create","register_followups"):
  parent_id=r.get("parent_id") if op=="create" else r.get("parent_id")
  parent=issue(s,parent_id) if parent_id is not None else None
  actions=[r] if op=="create" else r.get("actions")
  if not isinstance(actions,list):err("actions required")
  prepared=[];seen=set()
  for a in actions:
   if not isinstance(a,dict) or not isinstance(a.get("title"),str) or not a["title"].strip() or not isinstance(a.get("goal"),str) or not a["goal"].strip() or not isinstance(a.get("acceptance"),list) or not all(isinstance(x,str) and x.strip() for x in a["acceptance"]):err("invalid action")
   g=norm(a["goal"])
   if g in seen or any(norm(x["goal"])==g for x in s["issues"]):err("duplicate goal")
   seen.add(g);prepared.append(a)
  created=[]
  for a in prepared:
   i={"id":nextid(s),"title":a["title"],"goal":a["goal"],"parent_id":parent_id,"acceptance":a["acceptance"],"status":"open","evidence":[]};s["issues"].append(i);created.append(i["id"])
  reopened=reopen_chain(s,parent,"new child requires parent evidence revalidation") if created and parent and parent.get("status")=="done" else []
  if created:s["revision"]+=1;s["audit"].append({"op":op,"created":created});save_atomic(path,s)
  return {"revision":s["revision"],"created_ids":created,"reopened_ids":reopened}
 if op=="complete":
  i=issue(s,r.get("id"));ev=r.get("evidence")
  if i.get("status")=="done":err("already done")
  if not isinstance(ev,list) or not ev or not i["acceptance"] or any(x.get("parent_id")==i["id"] and x.get("status")!="done" for x in s["issues"]):err("evidence, acceptance and closed children required")
  for e in ev:
   if not evidence_valid(e,path.parent,True):err("evidence invalid")
  i["status"]="done";i["evidence"]=ev;s["revision"]+=1;s["audit"].append({"op":op,"id":i["id"]});save_atomic(path,s);return {"revision":s["revision"],"issue":i}
 if op=="reopen":
  i=issue(s,r.get("id"));reason=r.get("reason")
  if i.get("status")!="done" or not isinstance(reason,str) or not reason.strip():err("done issue and reason required")
  ids=reopen_chain(s,i,reason);s["revision"]+=1;save_atomic(path,s);return {"revision":s["revision"],"reopened_ids":ids}
 if op=="branch":
  t=r.get("target")
  if not isinstance(t,str) or not t or os.path.isabs(t) or Path(t).name!=t:err("invalid branch target")
  p=path.parent/t
  if p.exists():err("branch exists")
  save_atomic(p,s);return {"target":t,"revision":s["revision"]}
 err("unknown operation")
def main():
 started=time.perf_counter();path=None;r={};out=None;code=1
 try:
  if len(sys.argv)!=3:raise Failure("usage: tracker.py STATE.json request.json")
  path=Path(sys.argv[1]);r=load(Path(sys.argv[2]));out=dispatch(path,r);print(json.dumps(out,ensure_ascii=False,separators=(",",":")));code=0
 except Exception as e:out={"error":str(e)};print(json.dumps(out,ensure_ascii=False))
 finally:
  if path is not None:
   try:
    with (path.parent/"tool-events.jsonl").open("a") as f:f.write(json.dumps({"at":datetime.now(timezone.utc).isoformat(),"request":r,"result":out,"exit_code":code,"elapsed_seconds":time.perf_counter()-started})+"\n")
   except Exception:pass
 return code
if __name__=="__main__":sys.exit(main())
