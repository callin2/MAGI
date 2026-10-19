import test from 'node:test';
import assert from 'node:assert/strict';
import {sessions} from './solution.mjs';
const u=(id,rev,t,key='k',amount=1)=>({kind:'upsert',id,rev,event_time:t,key,amount});
test('late bridge merges open components; retraction splits',()=>{const x=sessions({gap_ms:5,lateness_ms:0,records:[u('a',1,0),u('b',1,10),u('c',1,5)]});assert.equal(x.sessions.length,1);assert.deepEqual(x.sessions[0].ids,['a','b','c']);const y=sessions({gap_ms:5,lateness_ms:0,records:[u('a',1,0),u('b',1,10),u('c',1,5),{kind:'delete',id:'c',rev:2}]});assert.equal(y.sessions.length,2);});
test('finalized events reject edits; sealed membership stable',()=>{assert.throws(()=>sessions({gap_ms:5,lateness_ms:0,records:[u('a',1,0),{kind:'watermark',time:5},u('a',2,20)]}),/finalized/);const x=sessions({gap_ms:5,lateness_ms:0,records:[u('a',1,0),{kind:'watermark',time:5},u('b',1,20)]});assert.deepEqual(x.sessions.map(s=>s.final),[true,false]);});
test('revision replay/conflict and tombstone',()=>{assert.throws(()=>sessions({gap_ms:2,lateness_ms:0,records:[u('a',1,1),u('a',1,2)]}),/conflicting/);const x=sessions({gap_ms:2,lateness_ms:0,records:[{kind:'delete',id:'z',rev:1},u('z',2,1),u('z',1,2)]});assert.equal(x.sessions.length,1);});
test('watermark monotonic; zero totals and deterministic sort',()=>{const x=sessions({gap_ms:2,lateness_ms:0,records:[u('b',1,8,'z',0),u('a',1,-1,'a',0),{kind:'watermark',time:0},{kind:'watermark',time:-5}]});assert.equal(x.watermark,0);assert.equal(x.sessions.length,2);assert.equal(x.sessions[0].total,0);});
