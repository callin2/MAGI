import hashlib, json, subprocess, sys, tempfile, unittest
from pathlib import Path
SCRIPT=Path(__file__).with_name('tracker.py')
def run(root, req):
 q=root/'req.json'; q.write_text(json.dumps(req)); return subprocess.run([sys.executable,str(SCRIPT),str(root/'state.json'),str(q)],capture_output=True,text=True)
def issue(status='done', evidence=None, acceptance=None, parent=None, ident='T1', goal='g'):
 return {'id':ident,'title':goal,'goal':goal,'parent_id':parent,'acceptance':acceptance if acceptance is not None else ['accepted'],'status':status,'evidence':evidence if evidence is not None else []}
class ImportBoundary(unittest.TestCase):
 def setUp(self): self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name); self.f=self.root/'a'; self.f.write_text('valid'); self.ev=[{'path':'a','sha256':hashlib.sha256(self.f.read_bytes()).hexdigest()}]
 def tearDown(self): self.tmp.cleanup()
 def init(self, issues): return run(self.root,{'op':'init','issues':issues})
 def test_rejects_invalid_done_import_atomically(self):
  for i in [issue(evidence=[]),issue(evidence=self.ev,acceptance=[]),issue(evidence=[{'path':'a','sha256':'bad'}]),issue(evidence=[{'path':'missing','sha256':'0'*64}])]:
   self.assertNotEqual(self.init([i]).returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_rejects_open_descendant_under_done_parent(self):
  parent=issue(evidence=self.ev); child=issue(status='open',evidence=[],parent='T1',ident='T2',goal='child')
  self.assertNotEqual(self.init([parent,child]).returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_valid_import_then_changed_artifact_can_list_and_reopen(self):
  self.assertEqual(self.init([issue(evidence=self.ev)]).returncode,0)
  self.f.write_text('changed')
  self.assertEqual(run(self.root,{'op':'list'}).returncode,0)
  r=run(self.root,{'op':'reopen','id':'T1','reason':'recertify'}); self.assertEqual(r.returncode,0)
  self.assertEqual(json.loads((self.root/'state.json').read_text())['issues'][0]['evidence'],[])
