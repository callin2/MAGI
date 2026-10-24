// Post-score explanatory reproduction; never replaces frozen judgments or scores.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const {classifyCase}=await import(pathToFileURL(resolve(process.argv[2])).href);
const source=Buffer.from('# Isolated acceptance fixture\n');const digest=createHash('sha256').update(source).digest('hex');
const capture=(kind='candidate')=>({exitCode:0,stdout:`GHOSTFLOW_RESULT_JSON:${JSON.stringify({kind})}\n${kind==='candidate'?`Saved /isolated/case.ghost.md: SHA-256 ${digest}.\n`:''}`});
const report=(kind='candidate')=>({identity:{case:'case',scriptedTurns:1,currentPinParity:true},turns:[{turn:1,expectedKind:kind,exitCode:0,...(kind==='candidate'?{sourceSha256:digest}:{})}],finalSourceSha256:digest,holdout:{exitCode:0,fixedExpectationsPassed:true}});
const evidence=()=>({source,holdout:{exitCode:0,stdout:'User expectations passed: 8\n'}});
const scenarios=[
['valid',report(),[capture()],evidence()],
['missing-source',report(),[capture()],{holdout:evidence().holdout}],
['tampered-source',report(),[capture()],{...evidence(),source:'changed'}],
['failed-process-capture',report(),[{...capture(),exitCode:2}],evidence()],
['missing-process-exit',report(),[{stdout:capture().stdout}],evidence()],
['reported-process-failure',{...report(),turns:[{...report().turns[0],exitCode:1}]},[capture()],evidence()],
['reported-holdout-failure',{...report(),holdout:{exitCode:1,fixedExpectationsPassed:true}},[capture()],evidence()],
['nonboolean-claimed-pass',{...report(),holdout:{exitCode:0,fixedExpectationsPassed:'yes'}},[capture()],evidence()],
...['clarification','answer'].map(k=>['artifact-free-'+k,report(k),[capture(k)],{}])];
console.log(JSON.stringify(scenarios.map(([id,r,c,e])=>{const v=classifyCase(r,c,e);return {id,complete:v.complete,finalCandidate:v.finalCandidate,fixedHoldoutPass:v.fixedHoldoutPass};}),null,2));
