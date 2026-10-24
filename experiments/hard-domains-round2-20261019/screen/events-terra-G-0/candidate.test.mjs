import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';

const up = (id, rev, key, event_time, amount) => ({kind:'upsert',id,rev,key,event_time,amount});

test('a late bridge merges open components and its retraction splits and seals the old side', () => {
  const result = sessions({gap_ms:10, lateness_ms:0, records:[
    up('a',1,'k',0,2), up('c',1,'k',20,4), up('b',1,'k',10,3),
    {kind:'watermark',time:20}, {kind:'delete',id:'b',rev:2}
  ]});
  assert.deepEqual(result, {watermark:20, sessions:[
    {key:'k',start:0,end:10,total:2,count:1,ids:['a'],final:true},
    {key:'k',start:20,end:30,total:4,count:1,ids:['c'],final:false}
  ]});
  assert.throws(() => sessions({gap_ms:10,lateness_ms:0,records:[
    ...[up('a',1,'k',0,2),up('c',1,'k',20,4),up('b',1,'k',10,3),{kind:'watermark',time:20},{kind:'delete',id:'b',rev:2}],
    up('a',2,'k',1,9)
  ]}), Error);
});

test('session membership uses gaps rather than epoch windows, including equality', () => {
  const r = sessions({gap_ms:10,lateness_ms:0,records:[up('z',1,'x',19,0),up('a',1,'x',9,2),up('q',1,'x',29,-2)]});
  assert.deepEqual(r.sessions, [{key:'x',start:9,end:39,total:0,count:3,ids:['a','q','z'],final:false}]);
});

test('proposal is evaluated after replacing old contribution and may use an open future neighbor', () => {
  const r = sessions({gap_ms:10,lateness_ms:0,records:[up('future',1,'k',95,1),{kind:'watermark',time:100},up('old',1,'k',90,2)]});
  assert.deepEqual(r.sessions, [{key:'k',start:90,end:105,total:3,count:2,ids:['future','old'],final:false}]);
});

test('sealed boundaries reject joining events and revision replay/conflicts behave correctly', () => {
  const base = [up('a',1,'k',0,1),{kind:'watermark',time:10}];
  assert.throws(() => sessions({gap_ms:10,lateness_ms:0,records:[...base,up('b',1,'k',10,1)]}), Error);
  const replay = sessions({gap_ms:10,lateness_ms:0,records:[...base,up('a',1,'k',0,1)]});
  assert.equal(replay.sessions[0].final, true);
  assert.throws(() => sessions({gap_ms:10,lateness_ms:0,records:[...base,up('a',1,'k',0,2)]}), Error);
  // A lower revision is ignored even when it names a sealed ID.
  assert.deepEqual(sessions({gap_ms:10,lateness_ms:0,records:[...base,up('a',0,'k',1,9)]}), replay);
});

test('delete of an unknown id establishes a tombstone and calls are independent', () => {
  const r = sessions({gap_ms:5,lateness_ms:1,records:[{kind:'delete',id:'gone',rev:2},{kind:'watermark',time:99}]});
  assert.deepEqual(r,{watermark:99,sessions:[]});
  assert.throws(() => sessions({gap_ms:5,lateness_ms:1,records:[{kind:'delete',id:'gone',rev:2},up('gone',2,'x',1,1)]}),Error);
  assert.deepEqual(sessions({gap_ms:5,lateness_ms:1,records:[]}),{watermark:null,sessions:[]});
});
