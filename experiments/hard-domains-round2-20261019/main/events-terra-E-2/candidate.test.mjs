import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';
const run = (records, gap_ms = 10, lateness_ms = 0) => sessions({gap_ms, lateness_ms, records});

test('sessions bridge and a bridge retraction splits open components', () => {
  assert.deepEqual(run([
    {kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:2},
    {kind:'upsert',id:'c',rev:1,key:'k',event_time:20,amount:4},
    {kind:'upsert',id:'b',rev:1,key:'k',event_time:10,amount:3},
    {kind:'delete',id:'b',rev:2}
  ]).sessions, [
    {key:'k',start:0,end:10,total:2,count:1,ids:['a'],final:false},
    {key:'k',start:20,end:30,total:4,count:1,ids:['c'],final:false}
  ]);
});
test('equality to gap connects, and ids are ascii sorted', () => {
  assert.deepEqual(run([
    {kind:'upsert',id:'z',rev:1,key:'x',event_time:10,amount:0},
    {kind:'upsert',id:'A',rev:1,key:'x',event_time:0,amount:-2}
  ]).sessions[0], {key:'x',start:0,end:20,total:-2,count:2,ids:['A','z'],final:false});
});
test('watermark seals and sealed contributions remain immutable', () => {
  const r=[{kind:'upsert',id:'a',rev:1,key:'x',event_time:0,amount:1},{kind:'watermark',time:10}];
  assert.deepEqual(run(r).sessions,[{key:'x',start:0,end:10,total:1,count:1,ids:['a'],final:true}]);
  assert.throws(()=>run(r.concat({kind:'delete',id:'a',rev:2})),Error);
  assert.throws(()=>run(r.concat({kind:'upsert',id:'n',rev:1,key:'x',event_time:10,amount:1})),Error);
});
test('split after retraction can immediately finalize only old side', () => {
  const out=run([
    {kind:'upsert',id:'a',rev:1,key:'x',event_time:0,amount:1},
    {kind:'upsert',id:'b',rev:1,key:'x',event_time:10,amount:1},
    {kind:'upsert',id:'c',rev:1,key:'x',event_time:20,amount:1},
    {kind:'watermark',time:25},
    {kind:'delete',id:'b',rev:2}
  ]);
  assert.deepEqual(out.sessions,[
    {key:'x',start:0,end:10,total:1,count:1,ids:['a'],final:true},
    {key:'x',start:20,end:30,total:1,count:1,ids:['c'],final:false}
  ]);
});
test('proposal evaluates replacement state and rejected revision is reusable', () => {
  const base=[{kind:'upsert',id:'a',rev:1,key:'x',event_time:100,amount:1},{kind:'watermark',time:100}];
  // rev 2 at zero is old and cannot form an open component; it must not consume rev 2.
  assert.throws(()=>run(base.concat({kind:'upsert',id:'a',rev:2,key:'x',event_time:0,amount:7})),Error);
  assert.deepEqual(run(base.concat({kind:'upsert',id:'a',rev:2,key:'x',event_time:101,amount:7})).sessions,
    [{key:'x',start:101,end:111,total:7,count:1,ids:['a'],final:false}]);
});
test('revisions, tombstones, conflicts, and watermark maximum', () => {
  assert.throws(()=>run([{kind:'delete',id:'a',rev:2},{kind:'upsert',id:'a',rev:2,key:'x',event_time:1,amount:1}]),Error);
  const out=run([
    {kind:'delete',id:'a',rev:3}, {kind:'upsert',id:'a',rev:2,key:'x',event_time:1,amount:9},
    {kind:'upsert',id:'a',rev:4,key:'x',event_time:1,amount:0},
    {kind:'watermark',time:3},{kind:'watermark',time:-8}
  ]);
  assert.equal(out.watermark,3);
  assert.deepEqual(out.sessions,[{key:'x',start:1,end:11,total:0,count:1,ids:['a'],final:false}]);
});
test('inputs are not mutated and calls have independent state', () => {
  const input={gap_ms:2,lateness_ms:0,records:[{kind:'upsert',id:'a',rev:1,key:'x',event_time:-3,amount:1}]};
  const frozen=structuredClone(input); Object.freeze(input.records[0]); Object.freeze(input.records); Object.freeze(input);
  assert.deepEqual(sessions(input),{watermark:null,sessions:[{key:'x',start:-3,end:-1,total:1,count:1,ids:['a'],final:false}]});
  assert.deepEqual(input,frozen);
  assert.deepEqual(run([]),{watermark:null,sessions:[]});
});
