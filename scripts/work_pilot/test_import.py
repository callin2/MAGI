import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from tracker import dispatch, Failure, validate_import

class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.state=self.root/'state.json';self.artifact=self.root/'proof.txt';self.artifact.write_text('v1',encoding='utf-8')
        self.digest=hashlib.sha256(self.artifact.read_bytes()).hexdigest()
    def tearDown(self):self.tmp.cleanup()
    def item(self, **changes):
        return {'id':'T1','title':'work','goal':'work','parent_id':None,'acceptance':['proof'],'status':'done','evidence':[{'path':'proof.txt','sha256':self.digest}],**changes}
    def init(self, items):return dispatch(self.state,{'op':'init','issues':items})
    def test_invalid_imports_are_atomic(self):
        invalid=[{'evidence':[]},{'acceptance':[]},{'status':'unknown'},{'evidence':'proof.txt'},{'evidence':['proof.txt']},{'evidence':[{'path':'proof.txt','sha256':'0'*64}]},{'evidence':[{'path':'absent','sha256':self.digest}]},{'evidence':[{'path':'../outside','sha256':self.digest}]}]
        for changes in invalid:
            with self.subTest(changes=changes):
                with self.assertRaises(Failure):self.init([self.item(**changes)])
                self.assertFalse(self.state.exists())
    def test_valid_import_does_not_overwrite_existing_state(self):
        self.init([self.item()]);before=self.state.read_bytes()
        with self.assertRaises(Failure):self.init([])
        self.assertEqual(before,self.state.read_bytes())
    def test_done_parent_rejects_open_child(self):
        child=self.item(id='T2',title='child',goal='child',parent_id='T1',status='open',evidence=[])
        with self.assertRaises(Failure):self.init([self.item(),child])
        self.assertFalse(self.state.exists())
    def test_absolute_path_inside_root_is_still_not_relative(self):
        with self.assertRaises(Failure):self.init([self.item(evidence=[{'path':str(self.artifact.resolve()),'sha256':self.digest}])])
        self.assertFalse(self.state.exists())
    def test_changed_or_deleted_artifact_can_be_reopened(self):
        for remove in (False,True):
            with self.subTest(remove=remove):
                self.artifact.write_text('v1',encoding='utf-8');self.init([self.item()])
                if remove:self.artifact.unlink()
                else:self.artifact.write_text('v2',encoding='utf-8')
                dispatch(self.state,{'op':'list'});dispatch(self.state,{'op':'reopen','id':'T1','reason':'artifact revised'})
                item=json.loads(self.state.read_text())['issues'][0]
                self.assertEqual(item['status'],'open');self.assertEqual(item['evidence'],[])
                self.state.unlink()
    def test_deep_valid_chain_does_not_use_recursive_descendant_walk(self):
        # state_ok owns acyclicity; this independently checks the completion-boundary walk.
        items=[self.item(id=f'T{i}',goal=f'goal {i}',parent_id=f'T{i-1}' if i else None) for i in range(1100)]
        validate_import({'issues':items},self.root.resolve())
    def test_open_issue_and_empty_import_remain_legal(self):
        self.init([self.item(status='open',evidence=[],acceptance=[])]);self.state.unlink();self.init([])

if __name__=='__main__':unittest.main()
