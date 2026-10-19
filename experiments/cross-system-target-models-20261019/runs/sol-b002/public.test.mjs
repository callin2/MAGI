import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {classifyCase,observedKind} from './verdict.mjs';
const source='# Current fixture\n';const d=createHash('sha256').update(source).digest('hex');
const r={identity:{scriptedTurns:1,currentPinParity:true},turns:[{turn:1,expectedKind:'candidate',exitCode:0,sourceSha256:d}],finalSourceSha256:d,holdout:{exitCode:0,fixedExpectationsPassed:true}};
const c={exitCode:0,stdout:`GHOSTFLOW_RESULT_JSON:{"kind":"candidate"}\nSaved /isolated/case.ghost.md: SHA-256 ${d}.\n`};
test('valid candidate stays accepted',()=>assert.equal(classifyCase(r,[c],{source,holdout:{exitCode:0,stdout:'User expectations passed: 1\n'}}).fixedHoldoutPass,true));
test('parser rejects duplicate responses',()=>assert.equal(observedKind(c.stdout+c.stdout),null));
