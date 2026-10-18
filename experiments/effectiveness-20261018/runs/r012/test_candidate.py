import hashlib, json, subprocess, sys, tempfile, unittest
from pathlib import Path
SCRIPT=Path(__file__).with_name('tracker.py')
def run(root,req):
 q=root/'req.json';q.write_text(json.dumps(req));return subprocess.run([sys.executable,str(SCRIPT),str(root/'state.json'),str(q)],capture_output=True,text=True)
class ImportCompletionRegression(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
 def tearDown(self):self.tmp.cleanup()
 def imported(self, status='done', evidence=None, acceptance=None, children=None):
  ev=evidence if evidence is not None else [{'path':'artifact','sha256':hashlib.sha256(b'x').hexdigest()}]
  (self.root/'artifact').write_bytes(b'x')
  i={'id':'T1','title':'item','goal':'goal','parent_id':None,'acceptance':['accepted'] if acceptance is None else acceptance,'status':status,'evidence':ev}
  if children:i['parent_id']=None; children[0]['parent_id']='T1';issues=[i]+children
  else:issues=[i]
  return issues
 def test_reject_done_missing_acceptance_or_evidence_atomically(self):
  for ev,ac in (([],['ok']),([{'path':'artifact','sha256':hashlib.sha256(b'x').hexdigest()}],[])):
   r=run(self.root,{'op':'init','issues':self.imported(evidence=ev,acceptance=ac)});self.assertNotEqual(r.returncode,0);self.assertFalse((self.root/'state.json').exists())
 def test_reject_bad_hash_status_and_open_descendant(self):
  for issues in (self.imported(evidence=[{'path':'artifact','sha256':'bad'}]),self.imported(status='bogus'),self.imported(children=[{'id':'T2','title':'child','goal':'child','acceptance':['ok'],'status':'open','evidence':[]}])):
   r=run(self.root,{'op':'init','issues':issues});self.assertNotEqual(r.returncode,0);self.assertFalse((self.root/'state.json').exists())
 def test_valid_done_then_changed_artifact_list_and_reopen(self):
  issues=self.imported();self.assertEqual(run(self.root,{'op':'init','issues':issues}).returncode,0)
  (self.root/'artifact').write_bytes(b'changed')
  self.assertEqual(run(self.root,{'op':'list'}).returncode,0)
  r=run(self.root,{'op':'reopen','id':'T1','reason':'recertify'});self.assertEqual(r.returncode,0)
  state=json.loads((self.root/'state.json').read_text());self.assertEqual(state['issues'][0]['evidence'],[]);self.assertEqual(state['issues'][0]['status'],'open')
 def test_valid_open_import(self):
  issues=self.imported(status='open',evidence=[]);self.assertEqual(run(self.root,{'op':'init','issues':issues}).returncode,0)
if __name__=='__main__':unittest.main()
