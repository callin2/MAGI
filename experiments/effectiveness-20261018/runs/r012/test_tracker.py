import hashlib, json, subprocess, sys, tempfile, unittest
from pathlib import Path

HERE=Path(__file__).parent; SCRIPT=HERE/'tracker.py'
def run(root, req, state='state.json'):
    q=root/'request.json'; q.write_text(json.dumps(req)); return subprocess.run([sys.executable,str(SCRIPT),str(root/state),str(q)],capture_output=True,text=True)
class TrackerTests(unittest.TestCase):
  def setUp(self): self.d=tempfile.TemporaryDirectory(); self.root=Path(self.d.name)
  def tearDown(self): self.d.cleanup()
  def init(self):
    r=run(self.root,{'op':'init','issues':[]}); self.assertEqual(r.returncode,0)
  def test_dedup_and_rollback(self):
    self.init(); before=(self.root/'state.json').read_bytes(); r=run(self.root,{'op':'create','title':'x','goal':'  Same goal ' ,'parent_id':None,'acceptance':['ok']}); self.assertEqual(r.returncode,0)
    r=run(self.root,{'op':'create','title':'y','goal':'same   GOAL','parent_id':None,'acceptance':['ok']}); self.assertNotEqual(r.returncode,0)
    s=json.loads((self.root/'state.json').read_text()); self.assertEqual(len(s['issues']),1); self.assertEqual(s['revision'],1)
  def test_wrong_parent_and_atomic_followups(self):
    self.init(); run(self.root,{'op':'create','title':'p','goal':'parent','parent_id':None,'acceptance':['ok']})
    r=run(self.root,{'op':'register_followups','parent_id':'T1','actions':[{'title':'a','goal':'child','acceptance':['ok']},{'title':'bad','goal':'child','acceptance':[]} ]}); self.assertNotEqual(r.returncode,0)
    self.assertEqual(len(json.loads((self.root/'state.json').read_text())['issues']),1)
  def test_evidence_hash_and_branch_isolation(self):
    self.init(); run(self.root,{'op':'create','title':'p','goal':'goal','parent_id':None,'acceptance':['ok']}); f=self.root/'artifact.txt'; f.write_text('good'); h=hashlib.sha256(f.read_bytes()).hexdigest()
    r=run(self.root,{'op':'complete','id':'T1','evidence':[{'path':'artifact.txt','sha256':'bad'}]}); self.assertNotEqual(r.returncode,0)
    r=run(self.root,{'op':'complete','id':'T1','evidence':[{'path':'artifact.txt','sha256':h}]}); self.assertEqual(r.returncode,0)
    r=run(self.root,{'op':'branch','target':'branch.json'}); self.assertEqual(r.returncode,0); b=json.loads((self.root/'branch.json').read_text()); self.assertEqual(b['issues'][0]['status'],'done')
    r=run(self.root,{'op':'create','title':'q','goal':'other','parent_id':None,'acceptance':['ok']}); self.assertEqual(r.returncode,0); self.assertEqual(len(json.loads((self.root/'branch.json').read_text())['issues']),1)
  def test_path_traversal(self):
    self.init(); r=run(self.root,{'op':'branch','target':'../escape.json'}); self.assertNotEqual(r.returncode,0)
  def test_complete_requires_nonempty_evidence(self):
    self.init(); run(self.root,{'op':'create','title':'p','goal':'goal','parent_id':None,'acceptance':['ok']})
    r=run(self.root,{'op':'complete','id':'T1','evidence':[]}); self.assertNotEqual(r.returncode,0)
    self.assertEqual(json.loads((self.root/'state.json').read_text())['issues'][0]['status'],'open')
  def test_init_rejects_parent_cycle(self):
    r=run(self.root,{'op':'init','issues':[
      {'id':'T1','title':'a','goal':'a','parent_id':'T2','acceptance':['ok'],'status':'open','evidence':[]},
      {'id':'T2','title':'b','goal':'b','parent_id':'T1','acceptance':['ok'],'status':'open','evidence':[]}]})
    self.assertNotEqual(r.returncode,0); self.assertFalse((self.root/'state.json').exists())
  def test_followup_existing_root_parent_conflicts(self):
    self.init(); run(self.root,{'op':'create','title':'p','goal':'parent','parent_id':None,'acceptance':['ok']})
    run(self.root,{'op':'create','title':'x','goal':'child','parent_id':None,'acceptance':['ok']})
    r=run(self.root,{'op':'register_followups','parent_id':'T1','actions':[{'title':'x2','goal':'child','acceptance':['ok']}]})
    self.assertNotEqual(r.returncode,0)
  def test_reopen_recomplete_after_artifact_change(self):
    self.init(); run(self.root,{'op':'create','title':'parent','goal':'parent','parent_id':None,'acceptance':['ok']}); run(self.root,{'op':'create','title':'child','goal':'child','parent_id':'T1','acceptance':['ok']})
    f=self.root/'artifact.txt'; f.write_text('v1'); h1=hashlib.sha256(f.read_bytes()).hexdigest()
    self.assertEqual(run(self.root,{'op':'complete','id':'T2','evidence':[{'path':'artifact.txt','sha256':h1}]}).returncode,0); self.assertEqual(run(self.root,{'op':'complete','id':'T1','evidence':[{'path':'artifact.txt','sha256':h1}]}).returncode,0)
    f.write_text('v2'); h2=hashlib.sha256(f.read_bytes()).hexdigest()
    r=run(self.root,{'op':'complete','id':'T2','evidence':[{'path':'artifact.txt','sha256':h2}]}); self.assertNotEqual(r.returncode,0)
    r=run(self.root,{'op':'reopen','id':'T2','reason':'문서 교정으로 증거가 변경됨'}); self.assertEqual(r.returncode,0)
    s=json.loads((self.root/'state.json').read_text()); self.assertEqual([i['status'] for i in s['issues']],['open','open']); self.assertEqual(s['issues'][1]['evidence'],[]); self.assertTrue(any(a.get('op')=='reopen' and a.get('prior_evidence') for a in s['audit']))
    self.assertEqual(run(self.root,{'op':'complete','id':'T2','evidence':[{'path':'artifact.txt','sha256':h2}]}).returncode,0); self.assertEqual(run(self.root,{'op':'complete','id':'T1','evidence':[{'path':'artifact.txt','sha256':h2}]}).returncode,0)
  def test_describe_without_state_is_read_only(self):
    r=run(self.root,{'op':'describe'}); self.assertEqual(r.returncode,0)
    out=json.loads(r.stdout); self.assertEqual(out['schema_version'],1); self.assertIn('operations',out); self.assertIn('complete',out['operations']); self.assertIn('evidence',out['operations']['complete']['required']); self.assertIn('path',out['evidence_item']); self.assertFalse((self.root/'state.json').exists())
    self.init(); state=(self.root/'state.json').read_bytes(); r=run(self.root,{'op':'describe'}); self.assertEqual(r.returncode,0); self.assertEqual(state,(self.root/'state.json').read_bytes())
  def test_cli_events_record_success_and_failure(self):
    self.init(); self.assertEqual(run(self.root,{'op':'describe'}).returncode,0); self.assertNotEqual(run(self.root,{'op':'unknown'}).returncode,0)
    events=[json.loads(x) for x in (self.root/'tool-events.jsonl').read_text().splitlines()]
    self.assertGreaterEqual(len(events),3); self.assertTrue(all({'request','result','exit_code','elapsed_seconds','at'} <= set(e) for e in events)); self.assertTrue(any(e['request'].get('op')=='describe' and e['exit_code']==0 for e in events)); self.assertTrue(any(e['request'].get('op')=='unknown' and e['exit_code']!=0 for e in events))
  def test_new_child_reopens_done_parent(self):
    self.init(); run(self.root,{'op':'create','title':'p','goal':'parent','parent_id':None,'acceptance':['ok']}); f=self.root/'a'; f.write_text('v'); h=hashlib.sha256(f.read_bytes()).hexdigest(); self.assertEqual(run(self.root,{'op':'complete','id':'T1','evidence':[{'path':'a','sha256':h}]}).returncode,0)
    r=run(self.root,{'op':'create','title':'c','goal':'child','parent_id':'T1','acceptance':['ok']}); self.assertEqual(r.returncode,0); s=json.loads((self.root/'state.json').read_text()); self.assertEqual(s['issues'][0]['status'],'open'); self.assertEqual(s['issues'][0]['evidence'],[])
    self.assertEqual(run(self.root,{'op':'complete','id':'T2','evidence':[{'path':'a','sha256':h}]}).returncode,0); self.assertEqual(run(self.root,{'op':'complete','id':'T1','evidence':[{'path':'a','sha256':h}]}).returncode,0)
if __name__=='__main__': unittest.main()
