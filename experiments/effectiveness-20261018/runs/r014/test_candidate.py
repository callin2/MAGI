import hashlib,json,subprocess,sys,tempfile,unittest
from pathlib import Path
SCRIPT=Path(__file__).parent/'tracker.py'
def run(root,req):
 q=root/'q.json';q.write_text(json.dumps(req));return subprocess.run([sys.executable,str(SCRIPT),str(root/'s.json'),str(q)],capture_output=True,text=True)
def issue(status='done',ev=None,parent=None,accept=None):
 return {'id':'T1','title':'i','goal':'goal','parent_id':parent,'acceptance':accept if accept is not None else ['works'],'status':status,'evidence':ev or []}
class ImportTests(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
 def tearDown(self):self.tmp.cleanup()
 def initbad(self,issues):
  r=run(self.root,{'op':'init','issues':issues});self.assertNotEqual(r.returncode,0);self.assertFalse((self.root/'s.json').exists())
 def test_done_invalid_evidence_rejected_atomically(self):
  self.initbad([issue()]);self.initbad([issue(ev=[{'path':'missing','sha256':'0'*64}])]);self.initbad([issue(ev=[{'path':'x','sha256':'bad'}])])
 def test_done_requires_acceptance_and_status_valid(self):
  p=self.root/'x';p.write_text('ok');h=hashlib.sha256(p.read_bytes()).hexdigest()
  self.initbad([issue(ev=[{'path':'x','sha256':h}],accept=[])]);self.initbad([issue(status='weird')])
 def test_done_parent_open_descendant_rejected(self):
  p=self.root/'x';p.write_text('ok');h=hashlib.sha256(p.read_bytes()).hexdigest()
  parent=issue(ev=[{'path':'x','sha256':h}]);child={'id':'T2','title':'c','goal':'child','parent_id':'T1','acceptance':['ok'],'status':'open','evidence':[]}
  self.initbad([parent,child])
 def test_valid_import_and_reopen_after_artifact_changed(self):
  p=self.root/'x';p.write_text('ok');h=hashlib.sha256(p.read_bytes()).hexdigest();self.assertEqual(run(self.root,{'op':'init','issues':[issue(ev=[{'path':'x','sha256':h}])]}).returncode,0)
  p.write_text('changed');self.assertEqual(run(self.root,{'op':'list'}).returncode,0)
  self.assertEqual(run(self.root,{'op':'reopen','id':'T1','reason':'recertify'}).returncode,0)
  s=json.loads((self.root/'s.json').read_text());self.assertEqual(s['issues'][0]['status'],'open');self.assertEqual(s['issues'][0]['evidence'],[])
if __name__=='__main__':unittest.main()
