import hashlib, json, subprocess, sys, tempfile, unittest
from pathlib import Path
SCRIPT=Path(__file__).parent/'tracker.py'
def run(root, req):
 q=root/'request.json'; q.write_text(json.dumps(req)); return subprocess.run([sys.executable,str(SCRIPT),str(root/'state.json'),str(q)],capture_output=True,text=True)
class ImportCompletionTests(unittest.TestCase):
 def setUp(self): self.t=tempfile.TemporaryDirectory(); self.root=Path(self.t.name)
 def tearDown(self): self.t.cleanup()
 def item(self,status='done', evidence=None, acceptance=None):
  return {'id':'T1','title':'t','goal':'goal','parent_id':None,'acceptance':['accept'] if acceptance is None else acceptance,'status':status,'evidence':[] if evidence is None else evidence}
 def init(self, issues): return run(self.root,{'op':'init','issues':issues})
 def test_invalid_done_imports_are_atomic(self):
  f=self.root/'proof'; f.write_text('proof'); h=hashlib.sha256(f.read_bytes()).hexdigest()
  cases=[self.item(evidence=[]),self.item(evidence=[{'path':'proof','sha256':'bad'}]),self.item(evidence=[{'path':'missing','sha256':h}]),self.item(evidence=[{'path':'../outside','sha256':h}]),self.item(acceptance=[] , evidence=[{'path':'proof','sha256':h}]),self.item(status='mystery')]
  for i in cases:
   with self.subTest(issue=i):
    self.assertNotEqual(self.init([i]).returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_done_parent_with_open_child_rejected(self):
  f=self.root/'proof';f.write_text('x');h=hashlib.sha256(f.read_bytes()).hexdigest()
  p=self.item(evidence=[{'path':'proof','sha256':h}]); c={'id':'T2','title':'c','goal':'child','parent_id':'T1','acceptance':['ok'],'status':'open','evidence':[]}
  self.assertNotEqual(self.init([p,c]).returncode,0);self.assertFalse((self.root/'state.json').exists())
 def test_valid_import_and_reopen_after_artifact_mutation(self):
  f=self.root/'proof';f.write_text('one');h=hashlib.sha256(f.read_bytes()).hexdigest()
  self.assertEqual(self.init([self.item(evidence=[{'path':'proof','sha256':h}])]).returncode,0)
  f.write_text('two')
  self.assertEqual(run(self.root,{'op':'list'}).returncode,0)
  self.assertEqual(run(self.root,{'op':'reopen','id':'T1','reason':'recertify'}).returncode,0)
  s=json.loads((self.root/'state.json').read_text());self.assertEqual(s['issues'][0]['status'],'open');self.assertEqual(s['issues'][0]['evidence'],[])
if __name__=='__main__':unittest.main()
