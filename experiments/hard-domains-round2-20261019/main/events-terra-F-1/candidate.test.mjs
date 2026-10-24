import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';
const R = records => sessions({gap_ms:10,lateness_ms:0,records});

test('bridge deletion splits connected sessions', () => {
 const base=[
  {kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:2},
  {kind:'upsert',id:'c',rev:1,key:'k',event_time:20,amount:4},
  {kind:'upsert',id:'b',rev:1,key:'k',event_time:10,amount:3}
 ];
 assert.deepEqual(R(base).sessions,[{key:'k',start:0,end:30,total:9,count:3,ids:['a','b','c'],final:false}]);
 const split=R(base.concat({kind:'delete',id:'b',rev:2}));
 assert.deepEqual(split.sessions,[
  {key:'k',start:0,end:10,total:2,count:1,ids:['a'],final:false},
  {key:'k',start:20,end:30,total:4,count:1,ids:['c'],final:false}
 ]);
});

test('split can seal the old side', () => {
 const out=R([
  {kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:1},
  {kind:'upsert',id:'b',rev:1,key:'k',event_time:10,amount:1},
  {kind:'upsert',id:'c',rev:1,key:'k',event_time:20,amount:1},
  {kind:'watermark',time:25},
  {kind:'delete',id:'b',rev:2}
 ]);
 assert.deepEqual(out.sessions,[
  {key:'k',start:0,end:10,total:1,count:1,ids:['a'],final:true},
  {key:'k',start:20,end:30,total:1,count:1,ids:['c'],final:false}
 ]);
});

test('revisions, immutable final membership, and zero totals', () => {
 const prefix=[{kind:'upsert',id:'a',rev:2,key:'x',event_time:0,amount:0},{kind:'watermark',time:10}];
 assert.throws(()=>R(prefix.concat({kind:'delete',id:'a',rev:3})));
 const replay=R(prefix.concat({kind:'upsert',id:'a',rev:2,key:'x',event_time:0,amount:0},{kind:'upsert',id:'a',rev:1,key:'z',event_time:4,amount:9}));
 assert.deepEqual(replay.sessions,[{key:'x',start:0,end:10,total:0,count:1,ids:['a'],final:true}]);
 assert.throws(()=>R(prefix.concat({kind:'upsert',id:'a',rev:2,key:'x',event_time:1,amount:0})));
});

test('old point can be accepted when its proposed connected session stays open', () => {
 const out=R([
  {kind:'upsert',id:'new',rev:1,key:'k',event_time:100,amount:1},
  {kind:'watermark',time:105},
  {kind:'upsert',id:'old',rev:1,key:'k',event_time:90,amount:2}
 ]);
 assert.deepEqual(out.sessions,[{key:'k',start:90,end:110,total:3,count:2,ids:['new','old'],final:false}]);
});

test('unknown delete tombstones and sealed boundary rejects new event', () => {
 const p=[{kind:'delete',id:'gone',rev:4},{kind:'upsert',id:'s',rev:1,key:'k',event_time:0,amount:1},{kind:'watermark',time:10}];
 assert.equal(R(p.concat({kind:'upsert',id:'gone',rev:3,key:'k',event_time:100,amount:1})).sessions.length,1);
 assert.throws(()=>R(p.concat({kind:'upsert',id:'n',rev:1,key:'k',event_time:20,amount:1})));
});
