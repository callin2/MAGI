import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';

const up = (id, rev, key, event_time, amount) => ({kind:'upsert',id,rev,key,event_time,amount});
const del = (id, rev) => ({kind:'delete',id,rev});
const wm = time => ({kind:'watermark',time});

test('a retractable bridge merges open sessions and its deletion splits them', () => {
  const got = sessions({gap_ms:10,lateness_ms:0,records:[
    up('a',1,'k',0,2), up('b',1,'k',20,3), up('bridge',1,'k',10,4),
    del('bridge',2), wm(15)
  ]});
  assert.deepEqual(got, {watermark:15,sessions:[
    {key:'k',start:0,end:10,total:2,count:1,ids:['a'],final:true},
    {key:'k',start:20,end:30,total:3,count:1,ids:['b'],final:false}
  ]});
});

test('sealed membership is stable and equality at its connecting boundary is late', () => {
  const args = {gap_ms:10,lateness_ms:0,records:[up('a',1,'k',0,1),wm(10)]};
  assert.throws(() => sessions({...args,records:[...args.records,up('x',1,'k',10,9)]}), Error);
  assert.throws(() => sessions({...args,records:[...args.records,del('a',2)]}), Error);
  assert.deepEqual(sessions(args).sessions[0], {key:'k',start:0,end:10,total:1,count:1,ids:['a'],final:true});
});

test('old point is allowed when its complete proposed connected session remains open', () => {
  const got = sessions({gap_ms:10,lateness_ms:0,records:[
    up('new',1,'k',100,5), wm(100), up('old',1,'k',90,2)
  ]});
  assert.deepEqual(got.sessions, [{key:'k',start:90,end:110,total:7,count:2,ids:['new','old'],final:false}]);
});

test('revisions have tombstones, exact replay, lower no-op, and same-revision conflict', () => {
  const base = {gap_ms:5,lateness_ms:0,records:[del('gone',2),up('a',1,'x',20,1),wm(20)]};
  const replay = sessions({...base,records:[...base.records,del('gone',2),up('a',1,'x',20,1),up('a',0,'z',0,99)]});
  assert.deepEqual(replay.sessions, [{key:'x',start:20,end:25,total:1,count:1,ids:['a'],final:false}]);
  assert.throws(() => sessions({...base,records:[...base.records,up('gone',2,'x',0,1)]}), Error);
});
