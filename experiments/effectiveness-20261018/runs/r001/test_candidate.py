import hashlib, json, subprocess, sys, tempfile, unittest
from pathlib import Path
SCRIPT=Path(__file__).with_name('tracker.py')
def call(root, req):
 q=root/'req.json'; q.write_text(json.dumps(req)); return subprocess.run([sys.executable,str(SCRIPT),str(root/'state.json'),str(q)],capture_output=True,text=True)
def issue(i,status='open',evidence=None,parent=None,acceptance=None):
 return {'id':f'T{i}','title':f'Issue {i}','goal':f'goal {i}','parent_id':parent,'acceptance':acceptance if acceptance is not None else ['accepted'],'status':status,'evidence':evidence or []}
class ImportBoundary(unittest.TestCase):
 def setUp(self): self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
 def tearDown(self): self.tmp.cleanup()
 def init(self, issues):
  r=call(self.root,{'op':'init','issues':issues}); return r
 def valid_done(self):
  f=self.root/'proof'; f.write_text('proof'); h=hashlib.sha256(f.read_bytes()).hexdigest()
  return issue(1,'done',[{'path':'proof','sha256':h}]),h
 def test_rejects_done_empty_evidence_atomically(self):
  r=self.init([issue(1,'done')]); self.assertNotEqual(r.returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_import_validates_status_and_evidence_and_descendants(self):
  bad=[issue(1,'wat'),issue(1,'done',[{'path':'x','sha256':'bad'}]),issue(1,'done',[{'path':'../outside','sha256':'0'*64}])]
  for item in bad:
   with self.subTest(item=item):
    self.assertNotEqual(self.init([item]).returncode,0); self.assertFalse((self.root/'state.json').exists())
  parent,_=self.valid_done(); child=issue(2,'open',parent='T1')
  r=self.init([parent,child]); self.assertNotEqual(r.returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_valid_import_can_list_and_reopen_stale_artifact(self):
  done,_=self.valid_done(); self.assertEqual(self.init([done]).returncode,0)
  (self.root/'proof').write_text('changed')
  self.assertEqual(call(self.root,{'op':'list'}).returncode,0)
  r=call(self.root,{'op':'reopen','id':'T1','reason':'recertify'}); self.assertEqual(r.returncode,0)
  state=json.loads((self.root/'state.json').read_text()); self.assertEqual(state['issues'][0]['evidence'],[]); self.assertEqual(state['issues'][0]['status'],'open')
if __name__=='__main__': unittest.main()
