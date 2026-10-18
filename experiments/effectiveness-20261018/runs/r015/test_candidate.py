import hashlib, json, subprocess, sys, tempfile, unittest
from pathlib import Path
SCRIPT=Path(__file__).parent/'tracker.py'
def invoke(root, req):
 q=root/'req.json'; q.write_text(json.dumps(req)); return subprocess.run([sys.executable,str(SCRIPT),str(root/'state.json'),str(q)],capture_output=True,text=True)
def issue(i,parent=None,status='open',evidence=None,acceptance=None):
 return {'id':f'T{i}','title':f'Issue {i}','goal':f'goal {i}','parent_id':parent,'acceptance':acceptance if acceptance is not None else ['accepted'],'status':status,'evidence':evidence if evidence is not None else []}
class ImportTests(unittest.TestCase):
 def setUp(self): self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name); (self.root/'artifact').write_text('verified'); self.hash=hashlib.sha256((self.root/'artifact').read_bytes()).hexdigest(); self.ev=[{'path':'artifact','sha256':self.hash}]
 def tearDown(self): self.tmp.cleanup()
 def init(self, issues): return invoke(self.root,{'op':'init','issues':issues})
 def test_rejects_invalid_done_imports_atomically(self):
  cases=[([issue(1,status='done')]),([issue(1,status='done',evidence=self.ev,acceptance=[])]),([issue(1,status='done',evidence=[{'path':'artifact','sha256':'bad'}])]),([issue(1,status='done',evidence=[{'path':'missing','sha256':self.hash}])]),([issue(1,status='done',evidence=[{'path':'../escape','sha256':self.hash}])]),([issue(1,status='done',evidence=self.ev),issue(2,parent='T1')]),([issue(1,status='finished')]),([issue(1,status='done',evidence=[{'path':'artifact','sha256':self.hash.upper()}])])]
  for data in cases:
   with self.subTest(data=data):
    r=self.init(data); self.assertNotEqual(r.returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_accepts_valid_completed_import_and_can_reopen_stale_artifact(self):
  self.assertEqual(self.init([issue(1,status='done',evidence=self.ev)]).returncode,0)
  (self.root/'artifact').write_text('changed')
  self.assertEqual(invoke(self.root,{'op':'list'}).returncode,0)
  r=invoke(self.root,{'op':'reopen','id':'T1','reason':'recertify'}); self.assertEqual(r.returncode,0)
  state=json.loads((self.root/'state.json').read_text()); self.assertEqual(state['issues'][0]['status'],'open'); self.assertEqual(state['issues'][0]['evidence'],[])
 def test_rejects_malformed_evidence_on_open_import(self):
  for ev in ([{}],[{'path':'artifact','sha256':'z'*64}],['not-object']):
   r=self.init([issue(1,evidence=ev)]); self.assertNotEqual(r.returncode,0); self.assertFalse((self.root/'state.json').exists())
if __name__=='__main__': unittest.main()
