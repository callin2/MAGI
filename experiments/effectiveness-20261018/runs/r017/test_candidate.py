import hashlib,json,subprocess,sys,tempfile,unittest
from pathlib import Path
SCRIPT=Path(__file__).parent/'tracker.py'
def run(root,req):
 q=root/'req.json';q.write_text(json.dumps(req));return subprocess.run([sys.executable,str(SCRIPT),str(root/'state.json'),str(q)],capture_output=True,text=True)
def issue(status='done',evidence=None,parent=None,acceptance=None):
 return {'id':'T1','title':'x','goal':'goal','parent_id':parent,'acceptance':acceptance if acceptance is not None else ['ok'],'status':status,'evidence':evidence if evidence is not None else []}
class ImportRegressions(unittest.TestCase):
 def test_invalid_done_import_atomic(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d)
   for item in [issue(),issue(acceptance=[]),issue(evidence=[{'path':'missing','sha256':'0'*64}]),issue(evidence=[{'path':'../outside','sha256':'0'*64}]),issue(status='bogus')]:
    r=run(root,{'op':'init','issues':[item]});self.assertNotEqual(r.returncode,0);self.assertFalse((root/'state.json').exists())
 def test_valid_import_then_changed_file_list_reopen_clears(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);f=root/'a';f.write_text('old');h=hashlib.sha256(f.read_bytes()).hexdigest()
   r=run(root,{'op':'init','issues':[issue(evidence=[{'path':'a','sha256':h}])]});self.assertEqual(r.returncode,0)
   f.write_text('new');self.assertEqual(run(root,{'op':'list'}).returncode,0)
   self.assertEqual(run(root,{'op':'reopen','id':'T1','reason':'recertify'}).returncode,0)
   state=json.loads((root/'state.json').read_text());self.assertEqual(state['issues'][0]['evidence'],[])
 def test_done_parent_open_child_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);f=root/'a';f.write_text('x');h=hashlib.sha256(f.read_bytes()).hexdigest()
   p=issue(evidence=[{'path':'a','sha256':h}]);c={'id':'T2','title':'c','goal':'child','parent_id':'T1','acceptance':['ok'],'status':'open','evidence':[]}
   self.assertNotEqual(run(root,{'op':'init','issues':[p,c]}).returncode,0);self.assertFalse((root/'state.json').exists())
if __name__=='__main__':unittest.main()
