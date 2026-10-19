import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';
const run = (records, gap_ms = 10, lateness_ms = 0) => sessions({gap_ms, lateness_ms, records});

test('bridges merge open sessions and retraction splits them', () => {
  assert.deepEqual(run([
    {kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:2},
    {kind:'upsert',id:'c',rev:1,key:'k',event_time:20,amount:4},
    {kind:'upsert',id:'b',rev:1,key:'k',event_time:10,amount:3},
    {kind:'delete',id:'b',rev:2},
  ]).sessions, [
    {key:'k',start:0,end:10,total:2,count:1,ids:['a'],final:false},
    {key:'k',start:20,end:30,total:4,count:1,ids:['c'],final:false},
  ]);
});

test('a retraction can split an open session and finalize just its older part', () => {
  const r = run([
    {kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:1},
    {kind:'upsert',id:'b',rev:1,key:'k',event_time:10,amount:2},
    {kind:'upsert',id:'c',rev:1,key:'k',event_time:20,amount:3},
    {kind:'watermark',time:25}, // connected end is 30, so it remains open
    {kind:'delete',id:'b',rev:2},
  ]);
  assert.deepEqual(r.sessions, [
    {key:'k',start:0,end:10,total:1,count:1,ids:['a'],final:true},
    {key:'k',start:20,end:30,total:3,count:1,ids:['c'],final:false},
  ]);
});

test('watermark finalizes components, and bridge at sealed boundary is rejected', () => {
  const r = run([
    {kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:1},
    {kind:'watermark',time:10},
    {kind:'upsert',id:'b',rev:1,key:'k',event_time:10,amount:7},
    {kind:'delete',id:'a',rev:2},
  ]);
  assert.deepEqual(r, {watermark:10,sessions:[{key:'k',start:0,end:10,total:1,count:1,ids:['a'],final:true}]});
});

test('replacement is evaluated after old contribution removal and rejected changes do not consume revision', () => {
  const r = run([
    {kind:'upsert',id:'x',rev:1,key:'k',event_time:100,amount:1},
    {kind:'watermark',time:105}, // x end 110 still open
    {kind:'upsert',id:'x',rev:2,key:'k',event_time:0,amount:9}, // old target ends 10, reject
    {kind:'upsert',id:'x',rev:2,key:'k',event_time:110,amount:3},
  ]);
  assert.deepEqual(r.sessions, [{key:'k',start:110,end:120,total:3,count:1,ids:['x'],final:false}]);
});

test('an old event is allowed when it joins an open component with a new end', () => {
  const r = run([
    {kind:'upsert',id:'new',rev:1,key:'k',event_time:100,amount:2},
    {kind:'watermark',time:105},
    {kind:'upsert',id:'old',rev:1,key:'k',event_time:90,amount:4},
  ]);
  assert.deepEqual(r.sessions, [{key:'k',start:90,end:110,total:6,count:2,ids:['new','old'],final:false}]);
});

test('revision replay, conflicts, tombstones, ordering and zero total', () => {
  const records = [
    {kind:'delete',id:'z',rev:2}, {kind:'upsert',id:'z',rev:1,key:'x',event_time:1,amount:5},
    {kind:'upsert',id:'b',rev:1,key:'b',event_time:-5,amount:2},
    {kind:'upsert',id:'a',rev:1,key:'a',event_time:-5,amount:-2},
    {kind:'upsert',id:'b',rev:1,key:'b',event_time:-5,amount:2},
  ];
  assert.deepEqual(run(records).sessions, [
    {key:'a',start:-5,end:5,total:-2,count:1,ids:['a'],final:false},
    {key:'b',start:-5,end:5,total:2,count:1,ids:['b'],final:false},
  ]);
  assert.throws(() => run([{kind:'delete',id:'z',rev:1},{kind:'upsert',id:'z',rev:1,key:'x',event_time:0,amount:0}]));
});

test('watermark is monotonic and calls do not mutate inputs', () => {
  const input = {gap_ms:2,lateness_ms:0,records:[{kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:0},{kind:'watermark',time:2},{kind:'watermark',time:-1}]};
  const saved = structuredClone(input);
  assert.deepEqual(sessions(input), {watermark:2,sessions:[{key:'k',start:0,end:2,total:0,count:1,ids:['a'],final:true}]});
  assert.deepEqual(input, saved);
  assert.deepEqual(run([]), {watermark:null,sessions:[]});
});
