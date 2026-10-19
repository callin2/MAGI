import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {classifyCase} from './verdict.mjs';
const source='# candidate\n', hash=createHash('sha256').update(source).digest('hex');
const candidateReport={identity:{case:'x',scriptedTurns:1,currentPinParity:true},turns:[{turn:1,expectedKind:'candidate',exitCode:0,sourceSha256:hash}],finalSourceSha256:hash,holdout:{exitCode:0,fixedExpectationsPassed:true}};
const turn={exitCode:0,stdout:`GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /x.ghost.md: SHA-256 ${hash}.\n`};
const holdout={exitCode:0,stdout:'User expectations passed: 2\n'};
test('candidate requires actual source matching claimed digest',()=>{
 assert.equal(classifyCase(candidateReport,[turn],{source,holdout}).fixedHoldoutPass,true);
 assert.equal(classifyCase(candidateReport,[turn],{source:'# forged',holdout}).finalCandidate,false);
 assert.equal(classifyCase(candidateReport,[turn],{holdout}).finalCandidate,false);
});
test('report claims cannot establish holdout success',()=>assert.equal(classifyCase(candidateReport,[turn],{source,holdout:{exitCode:0,stdout:'all good'}}).fixedHoldoutPass,false));
test('clarification can complete without candidate evidence',()=>{
 const report={identity:{scriptedTurns:1,currentPinParity:true},turns:[{turn:1,expectedKind:'clarification',exitCode:0}]};
 const result=classifyCase(report,[{exitCode:0,stdout:'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}'}]);
 assert.equal(result.complete,true); assert.equal(result.finalCandidate,false);
});
test('nonzero actual process exit prevents completion despite report claim',()=>assert.equal(classifyCase(candidateReport,[{...turn,exitCode:9}],{source,holdout}).complete,false));
