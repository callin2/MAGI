import hashlib, json, subprocess, sys, tempfile, unittest
from pathlib import Path
SCRIPT=Path(__file__).parent/'tracker.py'
def run(root,req):
 q=root/'req.json'; q.write_text(json.dumps(req)); return subprocess.run([sys.executable,str(SCRIPT),str(root/'state.json'),str(q)],capture_output=True,text=True)
class ImportBoundary(unittest.TestCase):
 def setUp(self): self.t=tempfile.TemporaryDirectory(); self.root=Path(self.t.name)
 def tearDown(self): self.t.cleanup()
 def base(self,status='done',evidence=None,acceptance=None):
  return {'id':'T1','title':'one','goal':'one','parent_id':None,'acceptance':['ok'] if acceptance is None else acceptance,'status':status,'evidence':[] if evidence is None else evidence}
 def rejected_without_state(self,issues):
  r=run(self.root,{'op':'init','issues':issues}); self.assertNotEqual(r.returncode,0); self.assertFalse((self.root/'state.json').exists())
 def test_reject_missing_evidence_and_acceptance(self):
  self.rejected_without_state([self.base()])
  self.rejected_without_state([self.base(evidence=[{'path':'x','sha256':'0'*64}],acceptance=[])])
 def test_reject_invalid_status_evidence_and_missing_file(self):
  self.rejected_without_state([self.base('pending')])
  self.rejected_without_state([self.base(evidence=[{'path':'x','sha256':'no'}])])
  self.rejected_without_state([self.base(evidence=[{'path':'missing','sha256':'0'*64}])])
 def test_reject_bad_hash_and_done_parent_open_descendant(self):
  f=self.root/'proof'; f.write_text('actual'); wrong='0'*64
  self.rejected_without_state([self.base(evidence=[{'path':'proof','sha256':wrong}])])
  self.rejected_without_state([self.base(evidence=[{'path':'proof','sha256':hashlib.sha256(f.read_bytes()).hexdigest()}]), {'id':'T2','title':'two','goal':'two','parent_id':'T1','acceptance':['ok'],'status':'open','evidence':[]}])
 def test_valid_import_then_changed_artifact_list_and_reopen(self):
  f=self.root/'proof'; f.write_text('v1'); h=hashlib.sha256(f.read_bytes()).hexdigest()
  r=run(self.root,{'op':'init','issues':[self.base(evidence=[{'path':'proof','sha256':h}])]}); self.assertEqual(r.returncode,0)
  f.write_text('v2'); self.assertEqual(run(self.root,{'op':'list'}).returncode,0)
  r=run(self.root,{'op':'reopen','id':'T1','reason':'recertify'}); self.assertEqual(r.returncode,0)
  state=json.loads((self.root/'state.json').read_text()); self.assertEqual(state['issues'][0]['evidence'],[]); self.assertEqual(state['issues'][0]['status'],'open')
if __name__=='__main__': unittest.main()
