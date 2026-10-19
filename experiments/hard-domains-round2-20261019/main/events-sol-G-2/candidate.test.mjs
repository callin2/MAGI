import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';
const up = (id, time, amount = 1, rev = 1, key = 'x') => ({kind:'upsert',id,rev,key,event_time:time,amount});
const del = (id, rev) => ({kind:'delete',id,rev});
const wm = time => ({kind:'watermark',time});
const run = (records, lateness_ms = 0, gap_ms = 10) => sessions({gap_ms,lateness_ms,records});
const s = (start,end,ids,total=ids.length,final=false,key='x') => ({key,start,end,total,count:ids.length,ids,final});

test('late bridge merges, retraction splits and immediately seals older component', () => {
  const prefix = [up('a',0),up('c',20),up('b',10),wm(25)];
  assert.deepEqual(run(prefix), {watermark:25,sessions:[s(0,30,['a','b','c'])]});
  assert.deepEqual(run([...prefix,del('b',2)]), {watermark:25,sessions:[s(0,10,['a'],1,true),s(20,30,['c'])]});
});

test('old individual event joins open component, but isolated old event is rejected', () => {
  assert.deepEqual(run([up('b',10),wm(15),up('a',0),up('old',-20)]), {
    watermark:15,sessions:[s(0,20,['a','b'])]
  });
});

test('proposal removes previous contribution before assessing lateness; rejected revision remains reusable', () => {
  const prefix=[up('a',0),up('b',10),up('c',20),wm(25),up('c',-5,9,2)];
  assert.deepEqual(run(prefix).sessions,[s(0,30,['a','b','c'])]);
  assert.deepEqual(run([...prefix,del('c',2)]).sessions,[s(0,20,['a','b'],2,true)]);
});

test('sealed members and both inclusive join boundaries cannot change', () => {
  const prefix=[up('a',0),wm(10)];
  assert.deepEqual(run([...prefix,del('a',2),up('a',100,5,3),up('left',-10),up('right',10),up('ok',11)]), {
    watermark:10,sessions:[s(0,10,['a'],1,true),s(11,21,['ok'])]
  });
  // Rejected updates to sealed IDs did not replace the accepted revision.
  assert.throws(() => run([...prefix,del('a',2),up('a',1,1,1)]), Error);
});

test('revision replay, stale revision, canonical property order and accepted conflict', () => {
  const original=up('a',-5,0,2);
  const reordered={amount:0,event_time:-5,key:'x',rev:2,id:'a',kind:'upsert'};
  assert.deepEqual(run([original,reordered,up('a',300,100,1)]).sessions,[s(-5,5,['a'],0)]);
  assert.throws(() => run([original,up('a',-5,1,2)]), Error);
  assert.throws(() => run([original,del('a',2)]), Error);
});

test('unknown deletes establish tombstones, and rejected new revisions do not', () => {
  assert.deepEqual(run([del('a',3),up('a',50,1,2)]).sessions,[]);
  assert.throws(() => run([del('a',3),up('a',50,1,3)]),Error);
  assert.deepEqual(run([wm(20),up('a',0,1,9),up('a',30,2,1)]).sessions,[s(30,40,['a'],2)]);
});

test('watermark max is explicit; lateness threshold equality finalizes', () => {
  assert.deepEqual(run([up('a',-20),wm(-5),wm(-100)],5), {watermark:-5,sessions:[s(-20,-10,['a'],1,true)]});
  assert.equal(run([up('a',-100),up('b',1000)]).watermark,null);
  assert.deepEqual(run([wm(15),up('a',0)],5).sessions,[]);
});

test('ASCII ordering, equal-time distinct IDs, zero totals and key isolation', () => {
  assert.deepEqual(run([up('z',-1,-4,1,'a'),up('A',-1,4,1,'a'),up('B',-1,0,1,'Z')]).sessions, [
    s(-1,9,['B'],0,false,'Z'),s(-1,9,['A','z'],0,false,'a')
  ]);
});

test('cross-key move is atomic on rejection and accepted moves regroup old key', () => {
  const prefix=[up('a',0),up('b',10),up('c',20),wm(25)];
  assert.deepEqual(run([...prefix,up('b',0,10,2,'other')]).sessions,[s(0,30,['a','b','c'])]);
  assert.deepEqual(run([...prefix,up('b',40,10,2,'other')]).sessions,[s(0,10,['a'],1,true),s(20,30,['c']),s(40,50,['b'],10,false,'other')]);
});

test('inputs are preserved and invocations independent', () => {
  const records=[up('b',10),up('a',0),wm(20)];
  const before=JSON.stringify(records);
  for (const r of records) Object.freeze(r);
  Object.freeze(records);
  const first=run(records);
  assert.equal(JSON.stringify(records),before);
  first.sessions[0].ids.push('not-an-event');
  assert.deepEqual(run(records).sessions,[s(0,20,['a','b'],2,true)]);
  assert.deepEqual(run([]),{watermark:null,sessions:[]});
});
