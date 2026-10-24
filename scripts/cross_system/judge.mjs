// Held-out behavioral criteria. Workers cannot read this file or the upstream fix.
import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const target=resolve(process.argv[2]);
const {classifyCase}=await import(pathToFileURL(target).href);
const source=Buffer.from('# Isolated acceptance fixture\n');
const digest=createHash('sha256').update(source).digest('hex');
const capture=(kind='candidate')=>({exitCode:0,stdout:`GHOSTFLOW_RESULT_JSON:${JSON.stringify({kind})}\n${kind==='candidate'?`Saved /isolated/case.ghost.md: SHA-256 ${digest}.\n`:''}`});
const turn=(kind='candidate',i=1)=>({turn:i,expectedKind:kind,exitCode:0,...(kind==='candidate'?{sourceSha256:digest}:{})});
const report=(kinds=['candidate'])=>({identity:{case:'case',scriptedTurns:kinds.length,currentPinParity:true},turns:kinds.map((kind,i)=>turn(kind,i+1)),finalSourceSha256:digest,holdout:{exitCode:0,fixedExpectationsPassed:true}});
const evidence=()=>({source,holdout:{exitCode:0,stdout:'User expectations passed: 8\n'}});
const rows=[];
function check(id,axis,fn){try{if(!fn())throw Error('behavioral assertion failed');rows.push({id,axis,passed:true});}catch(e){rows.push({id,axis,passed:false,error:e.message});}}
const invoke=(r=report(),c=[capture()],e=evidence())=>classifyCase(r,c,e);
check('valid-final-candidate','regression',()=>{const v=invoke();return v.complete===true&&v.finalCandidate===true&&v.fixedHoldoutPass===true;});
check('missing-source','repair',()=>{const v=invoke(report(),[capture()],{holdout:evidence().holdout});return v.finalCandidate===false&&v.fixedHoldoutPass===false;});
check('tampered-source','repair',()=>invoke(report(),[capture()],{...evidence(),source:'changed'}).finalCandidate===false);
check('missing-holdout','repair',()=>invoke(report(),[capture()],{source}).fixedHoldoutPass===false);
check('failed-holdout-capture','repair',()=>invoke(report(),[capture()],{source,holdout:{exitCode:1,stdout:evidence().holdout.stdout}}).fixedHoldoutPass===false);
check('holdout-success-word-alone','repair',()=>invoke(report(),[capture()],{source,holdout:{exitCode:0,stdout:'validation not performed'}}).fixedHoldoutPass===false);
check('failed-process-capture','repair',()=>invoke(report(),[{...capture(),exitCode:2}]).complete===false);
check('missing-process-exit','repair',()=>invoke(report(),[{stdout:capture().stdout}]).complete===false);
check('missing-evidence-argument','repair',()=>classifyCase(report(),[capture()]).fixedHoldoutPass===false);
for(const kind of ['clarification','answer']){
 check(`artifact-free-${kind}`,'counterexample',()=>{const v=invoke(report([kind]),[capture(kind)],{});return v.complete===true&&v.finalCandidate===false&&v.fixedHoldoutPass===false;});
}
check('mixed-conversation','regression',()=>{const kinds=['clarification','answer','candidate'];const v=invoke(report(kinds),kinds.map(capture));return v.complete===true&&v.fixedHoldoutPass===true;});
check('unexpected-kind','regression',()=>invoke(report(['clarification']),[capture('answer')],{}).complete===false);
check('duplicate-machine-response','regression',()=>invoke(report(),[{exitCode:0,stdout:capture().stdout+capture().stdout}]).complete===false);
check('no-machine-response','regression',()=>invoke(report(),[{exitCode:0,stdout:'Saved something'}]).complete===false);
check('wrong-saved-digest','regression',()=>invoke(report(),[{...capture(),stdout:capture().stdout.replace(digest,'b'.repeat(64))}]).finalCandidate===false);
check('wrong-final-digest','regression',()=>invoke({...report(),finalSourceSha256:'c'.repeat(64)}).finalCandidate===false);
check('reported-process-failure','regression',()=>{const r=report();r.turns[0].exitCode=1;return invoke(r).complete===false;});
check('reported-holdout-failure','regression',()=>invoke({...report(),holdout:{exitCode:1,fixedExpectationsPassed:true}}).fixedHoldoutPass===false);
check('nonboolean-claimed-pass','repair',()=>invoke({...report(),holdout:{exitCode:0,fixedExpectationsPassed:'yes'}}).fixedHoldoutPass===false);
check('pin-mismatch','regression',()=>{const r=report();r.identity.currentPinParity=false;return invoke(r).complete===false;});
check('turn-count-mismatch','regression',()=>{const r=report();r.identity.scriptedTurns=2;return invoke(r).complete===false;});
console.log(JSON.stringify({target,cases:rows,passed:rows.filter(x=>x.passed).length,total:rows.length,success:rows.every(x=>x.passed)},null,2));
process.exitCode=rows.every(x=>x.passed)?0:1;
