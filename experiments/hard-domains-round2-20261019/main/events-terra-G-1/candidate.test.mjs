import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';

const run = records => sessions({ gap_ms: 10, lateness_ms: 0, records });

test('gap connectivity uses consecutive events rather than epoch windows', () => {
  assert.deepEqual(run([
    {kind:'upsert',id:'b',rev:1,key:'k',event_time:19,amount:2},
    {kind:'upsert',id:'a',rev:1,key:'k',event_time:9,amount:1},
    {kind:'upsert',id:'c',rev:1,key:'k',event_time:29,amount:-3},
  ]).sessions, [{key:'k',start:9,end:39,total:0,count:3,ids:['a','b','c'],final:false}]);
});

test('a late bridge merges open sessions and its retraction splits them', () => {
  const x = run([
    {kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:1},
    {kind:'upsert',id:'c',rev:1,key:'k',event_time:20,amount:3},
    {kind:'upsert',id:'b',rev:1,key:'k',event_time:10,amount:2},
    {kind:'delete',id:'b',rev:2},
  ]);
  assert.deepEqual(x.sessions, [
    {key:'k',start:0,end:10,total:1,count:1,ids:['a'],final:false},
    {key:'k',start:20,end:30,total:3,count:1,ids:['c'],final:false},
  ]);
});

test('retraction can split then finalize only the old resulting component', () => {
  const x = run([
    {kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:1},
    {kind:'upsert',id:'b',rev:1,key:'k',event_time:10,amount:2},
    {kind:'upsert',id:'c',rev:1,key:'k',event_time:20,amount:3},
    {kind:'watermark',time:15},
    {kind:'delete',id:'b',rev:2},
  ]);
  assert.deepEqual(x.sessions, [
    {key:'k',start:0,end:10,total:1,count:1,ids:['a'],final:true},
    {key:'k',start:20,end:30,total:3,count:1,ids:['c'],final:false},
  ]);
  assert.throws(() => run([
    ...[
      {kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:1}, {kind:'watermark',time:10},
    ], {kind:'delete',id:'a',rev:2}
  ]));
});

test('revision rules and proposed session lateness are atomic', () => {
  const records = [
    {kind:'upsert',id:'new',rev:1,key:'k',event_time:100,amount:4},
    {kind:'watermark',time:105},
    // Individually old but joins the open event, producing end 110 > 105.
    {kind:'upsert',id:'old',rev:1,key:'k',event_time:90,amount:1},
    {kind:'upsert',id:'new',rev:1,key:'different',event_time:100,amount:4},
  ];
  assert.throws(() => run(records));
  const x = run(records.slice(0, 3));
  assert.deepEqual(x.sessions[0].ids, ['new','old']);
  assert.throws(() => run([
    {kind:'upsert',id:'a',rev:1,key:'k',event_time:0,amount:1}, {kind:'watermark',time:10},
    {kind:'upsert',id:'z',rev:1,key:'k',event_time:10,amount:2},
  ]));
});
