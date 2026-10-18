import hashlib,json,subprocess,sys,tempfile,unittest
from pathlib import Path
SCRIPT=Path(__file__).with_name('tracker.py')
def run(root,req):
 q=root/'req.json';q.write_text(json.dumps(req));return subprocess.run([sys.executable,str(SCRIPT),str(root/'state.json'),str(q)],capture_output=True,text=True)
def item(status='open',acceptance=None,evidence=None,parent=None):
 return {'id':'T1','title':'one','goal':'goal one','parent_id':parent,'acceptance':['accept'] if acceptance is None else acceptance,'status':status,'evidence':[] if evidence is None else evidence}
class ImportBoundary(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
 def tearDown(self):self.tmp.cleanup()
 def rejected(self,issues):
  r=run(self.root,{'op':'init','issues':issues});self.assertNotEqual(r.returncode,0);self.assertFalse((self.root/'state.json').exists())
 def test_rejects_invalid_done_imports_atomically(self):
  self.rejected([item('done')])
  self.rejected([item('done',acceptance=[])])
  self.rejected([item('done',evidence=[{'path':'missing','sha256':'0'*64}])])
 def test_evidence_shape_hash_and_containment(self):
  f=self.root/'artifact';f.write_text('proof');h=hashlib.sha256(f.read_bytes()).hexdigest()
  for ev in ([],[{'path':'artifact','sha256':'bad'}],[{'path':'../outside','sha256':h}],[{'path':'artifact','sha256':'0'*64}],[{'path':'artifact','sha256':h,'extra':1}]):
   self.rejected([item('done',evidence=ev)])
  self.assertEqual(run(self.root,{'op':'init','issues':[item('done',evidence=[{'path':'artifact','sha256':h}])]}).returncode,0)
 def test_rejects_invalid_status_and_done_parent_with_open_descendant(self):
  self.rejected([item('finished')])
  f=self.root/'a';f.write_text('ok');h=hashlib.sha256(f.read_bytes()).hexdigest()
  parent=item('done',evidence=[{'path':'a','sha256':h}]);child={'id':'T2','title':'two','goal':'goal two','parent_id':'T1','acceptance':['yes'],'status':'open','evidence':[]}
  self.rejected([parent,child])
 def test_changed_artifact_can_list_then_reopen_clears_evidence(self):
  f=self.root/'a';f.write_text('v1');h=hashlib.sha256(f.read_bytes()).hexdigest()
  self.assertEqual(run(self.root,{'op':'init','issues':[item('done',evidence=[{'path':'a','sha256':h}])]}).returncode,0)
  f.write_text('v2')
  self.assertEqual(run(self.root,{'op':'list'}).returncode,0)
  self.assertEqual(run(self.root,{'op':'reopen','id':'T1','reason':'recertify'}).returncode,0)
  state=json.loads((self.root/'state.json').read_text());self.assertEqual(state['issues'][0]['status'],'open');self.assertEqual(state['issues'][0]['evidence'],[])
if __name__=='__main__':unittest.main()
