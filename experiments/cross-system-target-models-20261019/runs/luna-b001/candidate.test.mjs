import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyCase } from './verdict.mjs';
const source = '# final candidate\n', hash = createHash('sha256').update(source).digest('hex');
const report = { identity:{scriptedTurns:1,currentPinParity:true}, turns:[{turn:1,expectedKind:'candidate',exitCode:0,sourceSha256:hash}], finalSourceSha256:hash, holdout:{exitCode:0,fixedExpectationsPassed:true} };
const capture = {exitCode:0,stdout:`GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /x: SHA-256 ${hash}.\n`};
const holdout = {exitCode:0,stdout:'User expectations passed: 1'};
test('claims cannot replace actual source and holdout',()=>{
 assert.equal(classifyCase(report,[capture]).finalCandidate,false);
 assert.equal(classifyCase(report,[capture],{source:'# forged',holdout}).finalCandidate,false);
 assert.equal(classifyCase(report,[capture],{source,holdout:{exitCode:0,stdout:'looks good'}}).fixedHoldoutPass,false);
});
test('actual evidence corroborates the candidate',()=>{
 const got=classifyCase(report,[capture],{source,holdout});
 assert.equal(got.complete,true); assert.equal(got.finalCandidate,true); assert.equal(got.fixedHoldoutPass,true);
});
test('clarification can complete without a saved candidate',()=>{
 const r={identity:{scriptedTurns:1,currentPinParity:true},turns:[{turn:1,expectedKind:'clarification'}]};
 assert.equal(classifyCase(r,[{exitCode:0,stdout:'GHOSTFLOW_RESULT_JSON:{"kind":"clarification"}'}]).complete,true);
});
test('nonzero real process invalidates completion despite report claim',()=>{
 assert.equal(classifyCase(report,[{...capture,exitCode:1}],{source,holdout}).complete,false);
});
