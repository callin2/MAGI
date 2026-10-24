import hashlib, json, subprocess, sys, tempfile, unittest
from pathlib import Path
SCRIPT=Path(__file__).with_name('tracker.py')
def run(root, req):
 q=root/'q.json'; q.write_text(json.dumps(req)); return subprocess.run([sys.executable,str(SCRIPT),str(root/'state.json'),str(q)],capture_output=True,text=True)
def issue(status='done', acceptance=None, evidence=None, parent=None, ident='T1', goal='g'):
 return {'id':ident,'title':goal,'goal':goal,'parent_id':parent,'acceptance':['ok'] if acceptance is None else acceptance,'status':status,'evidence':[] if evidence is None else evidence}
class ImportTests(unittest.TestCase):
 def setUp(self): self.t=tempfile.TemporaryDirectory(); self.root=Path(self.t.name)
 def tearDown(self): self.t.cleanup()
 def initbad(self, issues):
  r=run(self.root,{'op':'init','issues':issues}); self.assertNotEqual(r.returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_invalid_done_imports_atomic(self):
  self.initbad([issue()])
  self.initbad([issue(evidence=[{'path':'absent','sha256':'0'*64}])])
  f=self.root/'a'; f.write_text('x'); h=hashlib.sha256(f.read_bytes()).hexdigest()
  self.initbad([issue(evidence=[{'path':'a','sha256':h}]),issue('open',ident='T2',goal='child',parent='T1')])
  self.initbad([issue(evidence=[{'path':'a','sha256':'bad'}])])
  self.initbad([issue(status='finished')])
 def test_import_valid_and_stale_artifact_reopen(self):
  f=self.root/'a'; f.write_text('v1'); h=hashlib.sha256(f.read_bytes()).hexdigest()
  self.assertEqual(run(self.root,{'op':'init','issues':[issue(evidence=[{'path':'a','sha256':h}])] }).returncode,0)
  f.write_text('v2'); self.assertEqual(run(self.root,{'op':'list'}).returncode,0)
  self.assertEqual(run(self.root,{'op':'reopen','id':'T1','reason':'recertify'}).returncode,0)
  s=json.loads((self.root/'state.json').read_text()); self.assertEqual(s['issues'][0]['evidence'],[])
if __name__=='__main__': unittest.main()
