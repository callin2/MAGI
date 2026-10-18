"""Failure-oriented checks for the preregistered artifact grader."""
import hashlib, json, tempfile, unittest
from pathlib import Path
from evaluate import grade

class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.root=Path(self.temp.name)
        self.data={'schema_version':1,'task':'handover','claims':[{'id':k,'status':v,'evidence':['current-readme.md']} for k,v in [('memory-adapter','implemented'),('work-tools','experimental'),('general-runtime','planned'),('expert-routing','planned'),('memory-benefit','unproven'),('human-time-saving','unproven')]],'decisions':[{'id':k,'owner':v,'reason':'Current scope and permission boundary'} for k,v in [('technical-validation','agent'),('revoke-technical-lesson','agent'),('share-private-memory','human')]],'remaining':['Run a controlled effectiveness comparison']}
        self.state={'issues':[{'id':'T1','parent_id':None,'status':'done','evidence':[]},{'id':'T2','parent_id':'T1','status':'done','evidence':[]}]}
        self.write()
    def tearDown(self):self.temp.cleanup()
    def write(self):
        (self.root/'deliverable.json').write_text(json.dumps(self.data),encoding='utf-8')
        (self.root/'notes.md').write_text('A valid schema and a matching hash establish structural integrity, not independent semantic truth or learning efficacy. '*2,encoding='utf-8')
        ev=[{'path':name,'sha256':hashlib.sha256((self.root/name).read_bytes()).hexdigest()} for name in ('deliverable.json','notes.md')]
        for i in self.state['issues']:i['evidence']=ev
        (self.root/'state.json').write_text(json.dumps(self.state),encoding='utf-8')
    def test_valid_structural_fixture(self):self.assertTrue(grade(self.root,'handover')['passed'])
    def test_stale_hash_fails(self):
        (self.root/'notes.md').write_text('changed',encoding='utf-8');self.assertFalse(grade(self.root,'handover')['passed'])
    def test_false_current_claim_fails_even_with_matching_hash(self):
        self.data['claims'][2]['status']='implemented';self.write();self.assertFalse(grade(self.root,'handover')['passed'])
    def test_blanket_human_gate_fails(self):
        self.data['decisions'][0]['owner']='human';self.write();self.assertFalse(grade(self.root,'handover')['passed'])
    def test_duplicate_task_fails(self):
        self.state['issues'].append({'id':'T3','parent_id':'T1','status':'done','evidence':[]});self.write();self.assertFalse(grade(self.root,'handover')['passed'])

if __name__=='__main__':unittest.main()
