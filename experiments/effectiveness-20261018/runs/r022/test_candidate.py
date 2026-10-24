import hashlib, json, subprocess, sys, tempfile, unittest
from pathlib import Path
SCRIPT=Path(__file__).with_name('tracker.py')
def run(root, req):
 q=root/'req.json'; q.write_text(json.dumps(req)); return subprocess.run([sys.executable,str(SCRIPT),str(root/'state.json'),str(q)],capture_output=True,text=True)
def issue(status='open', evidence=None, acceptance=None, parent=None, ident='T1', goal='g'):
 return {'id':ident,'title':ident,'goal':goal,'parent_id':parent,'acceptance':['check'] if acceptance is None else acceptance,'status':status,'evidence':[] if evidence is None else evidence}
class ImportRegression(unittest.TestCase):
 def setUp(self): self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
 def tearDown(self): self.tmp.cleanup()
 def init(self, issues): return run(self.root,{'op':'init','issues':issues})
 def test_done_missing_acceptance_or_evidence_is_atomic(self):
  for i in [issue('done',[]),issue('done',[{'path':'a','sha256':'0'*64}],acceptance=[])]:
   with self.subTest(i=i):
    self.assertNotEqual(self.init([i]).returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_invalid_status_evidence_and_missing_or_mismatched_file(self):
  good=issue('done',[{'path':'a','sha256':'0'*64}])
  for edit in [lambda x:x.update(status='finished'),lambda x:x.update(evidence=[{}]),lambda x:x.update(evidence=[{'path':'absent','sha256':'0'*64}])]:
   i=json.loads(json.dumps(good)); edit(i); self.assertNotEqual(self.init([i]).returncode,0); self.assertFalse((self.root/'state.json').exists())
  (self.root/'a').write_text('right'); self.assertNotEqual(self.init([good]).returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_import_rejects_done_parent_open_descendant(self):
  p=issue('done',[{'path':'a','sha256':'x'*64}]); c=issue(parent='T1',ident='T2',goal='c')
  self.assertNotEqual(self.init([p,c]).returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_import_valid_and_reopen_after_artifact_changed(self):
  f=self.root/'a'; f.write_text('v1'); h=hashlib.sha256(f.read_bytes()).hexdigest(); i=issue('done',[{'path':'a','sha256':h}])
  self.assertEqual(self.init([i]).returncode,0); f.write_text('v2')
  self.assertEqual(run(self.root,{'op':'list'}).returncode,0)
  self.assertEqual(run(self.root,{'op':'reopen','id':'T1','reason':'recertify'}).returncode,0)
  s=json.loads((self.root/'state.json').read_text()); self.assertEqual(s['issues'][0]['status'],'open'); self.assertEqual(s['issues'][0]['evidence'],[])
if __name__=='__main__': unittest.main()
