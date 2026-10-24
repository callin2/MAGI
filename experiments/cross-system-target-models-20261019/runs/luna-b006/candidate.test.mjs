import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase } from './verdict.mjs';
const source = '# candidate\n';
const hash = createHash('sha256').update(source).digest('hex');
const result = kind => `GHOSTFLOW_RESULT_JSON:{"kind":"${kind}"}\n`;
const base = (kind='candidate') => ({ identity:{scriptedTurns:1,currentPinParity:true,case:'x'}, turns:[{turn:1,expectedKind:kind,exitCode:0,sourceSha256:hash}], finalSourceSha256:hash, holdout:{exitCode:0,fixedExpectationsPassed:true} });
const candidateCapture = {exitCode:0,stdout:result('candidate')+`Saved /tmp/x.ghost.md: SHA-256 ${hash}.\n`};
test('candidate final and fixed holdout require actual corroborating evidence',()=>{
 const report=base();
 assert.equal(classifyCase(report,[candidateCapture]).complete,true);
 assert.equal(classifyCase(report,[candidateCapture]).finalCandidate,false);
 const v=classifyCase(report,[candidateCapture],{source,holdout:{exitCode:0,stdout:'User expectations passed: 2\n'}});
 assert.equal(v.finalCandidate,true); assert.equal(v.fixedHoldoutPass,true);
 assert.equal(classifyCase(report,[candidateCapture],{source:'# altered',holdout:{exitCode:0,stdout:'User expectations passed: 2'}}).finalCandidate,false);
 assert.equal(classifyCase(report,[candidateCapture],{source,holdout:{exitCode:0,stdout:'not passed'}}).fixedHoldoutPass,false);
});
test('clarification completes without candidate or source',()=>{
 const r=base('clarification'); r.turns[0].expectedKind='clarification'; delete r.turns[0].sourceSha256;
 const v=classifyCase(r,[{exitCode:0,stdout:result('clarification')}]);
 assert.equal(v.complete,true); assert.equal(v.finalCandidate,false); assert.equal(v.fixedHoldoutPass,false);
});
test('report claims cannot override failed process captures or missing scripted turns',()=>{
 const r=base();
 assert.equal(classifyCase(r,[{...candidateCapture,exitCode:1}],{source,holdout:{exitCode:0,stdout:'User expectations passed:'}}).complete,false);
 assert.equal(classifyCase(r,[],{source,holdout:{exitCode:0,stdout:'User expectations passed:'}}).complete,false);
});
test('candidate persistence requires matching saved hash and expected kind',()=>{
 const r=base();
 const v=classifyCase(r,[{exitCode:0,stdout:result('candidate')+'Saved x: SHA-256 '+'0'.repeat(64)+'.'}],{source,holdout:{exitCode:0,stdout:'User expectations passed:'}});
 assert.equal(v.turns[0].persistedCandidate,false); assert.equal(v.finalCandidate,false);
});
