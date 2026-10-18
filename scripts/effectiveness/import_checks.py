"""Held-out behavioral checks, unavailable to the experimental worker tools."""
import copy, hashlib, importlib.util, json, tempfile, sys
from pathlib import Path

def evaluate(script):
    spec=importlib.util.spec_from_file_location('candidate',script)
    mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    checks=[]
    def check(name, fn):
        try: checks.append({'id':name,'passed':bool(fn())})
        except Exception as e: checks.append({'id':name,'passed':False,'error':type(e).__name__+': '+str(e)})
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp); artifact=root/'artifact.txt'; artifact.write_text('v1',encoding='utf-8')
        digest=hashlib.sha256(artifact.read_bytes()).hexdigest()
        valid={'id':'T1','title':'imported','goal':'imported completed work','parent_id':None,'acceptance':['verified'],'status':'done','evidence':[{'path':'artifact.txt','sha256':digest}]}
        counter=[0]
        def attempt(item, reject=True, items=None):
            counter[0]+=1;p=root/f'state-{counter[0]}.json'
            try: mod.dispatch(p,{'op':'init','issues':items if items is not None else [item]})
            except Exception: return reject and not p.exists()
            return not reject and p.exists()
        check('valid_completed_import',lambda:attempt(copy.deepcopy(valid),False))
        check('empty_import_is_valid',lambda:attempt(None,False,[]))
        for name,change in [
            ('done_without_evidence',{'evidence':[]}),
            ('done_without_acceptance',{'acceptance':[]}),
            ('unknown_status',{'status':'finished-ish'}),
            ('missing_file',{'evidence':[{'path':'missing.txt','sha256':digest}]}),
            ('hash_mismatch',{'evidence':[{'path':'artifact.txt','sha256':'0'*64}]}),
            ('malformed_evidence',{'evidence':['artifact.txt']}),
            ('nonlist_evidence',{'evidence':'artifact.txt'}),
            ('evidence_escape',{'evidence':[{'path':'../escape.txt','sha256':digest}]}),
        ]:
            item=copy.deepcopy(valid);item.update(change)
            check(name,lambda item=item:attempt(item))
        no_status=copy.deepcopy(valid);no_status.pop('status')
        check('missing_status',lambda:attempt(no_status))
        parent=copy.deepcopy(valid); child={'id':'T2','title':'child','goal':'uncompleted child','parent_id':'T1','acceptance':['ok'],'status':'open','evidence':[]}
        check('done_parent_open_child',lambda:attempt(None,items=[parent,child]))
        def reopening():
            p=root/'reopening.json';mod.dispatch(p,{'op':'init','issues':[copy.deepcopy(valid)]})
            artifact.write_text('v2',encoding='utf-8')
            mod.dispatch(p,{'op':'list'})
            mod.dispatch(p,{'op':'reopen','id':'T1','reason':'artifact changed'})
            state=json.loads(p.read_text());return state['issues'][0]['status']=='open' and state['issues'][0]['evidence']==[]
        check('changed_artifact_can_be_listed_and_reopened',reopening)
    return {'passed':all(c['passed'] for c in checks),'checks':checks}

if __name__=='__main__':
    try: print(json.dumps(evaluate(Path(sys.argv[1]))))
    except Exception as e: print(json.dumps({'passed':False,'error':type(e).__name__+': '+str(e),'checks':[]}))
