import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';
const u = (id, t, amount = 1, rev = 1, key = 'x') => ({kind:'upsert',id,rev,key,event_time:t,amount});
const d = (id, rev) => ({kind:'delete',id,rev});
const w = time => ({kind:'watermark',time});
const run = (records, lateness_ms = 0, gap_ms = 10) => sessions({gap_ms,lateness_ms,records});
const s = (start,end,ids,total = ids.length,final = false,key = 'x') => ({key,start,end,total,count:ids.length,ids,final});

test('late bridge joins sessions; retraction splits them', () => {
  const base = [u('a',0),u('c',20),w(15),u('b',10)];
  // Lateness keeps the first component open while the bridge arrives.
  assert.deepEqual(run(base,10), {watermark:15,sessions:[s(0,30,['a','b','c'])]});
  assert.deepEqual(run([...base,d('b',2)],10).sessions,[s(0,10,['a']),s(20,30,['c'])]);
});
test('splitting an open session immediately seals the older result', () => {
  const base = [u('a',0),u('b',10),u('c',20),w(20),d('b',2)];
  assert.deepEqual(run([...base,u('a',100,9,2),d('a',3)]).sessions,
    [s(0,10,['a'],1,true),s(20,30,['c'])]);
});
test('old event accepted by resulting session end, not individual time', () => {
  assert.deepEqual(run([u('a',15),w(20),u('b',5)]).sessions,[s(5,25,['a','b'])]);
});
test('proposal removes the old contribution before testing lateness', () => {
  assert.deepEqual(run([u('a',15),w(20),u('a',5,9,2),u('a',25,4,2)]).sessions,
    [s(25,35,['a'],4)]);
});
test('sealed neighborhood equality on both sides; rejected revisions reusable', () => {
  const base = [u('a',0),w(10),u('b',10,5),u('c',-10,7)];
  assert.deepEqual(run(base).sessions,[s(0,10,['a'],1,true)]);
  assert.deepEqual(run([...base,u('b',11,5),u('c',21,7)]).sessions,
    [s(0,10,['a'],1,true),s(11,31,['b','c'],12)]);
});
test('moves to sealed target reject atomically and preserve revision', () => {
  assert.deepEqual(run([u('a',0),u('b',50),w(10),u('b',10,8,2),u('b',60,3,2)]).sessions,
    [s(0,10,['a'],1,true),s(60,70,['b'],3)]);
});
test('replays and conflicts are resolved even after sealing', () => {
  const base = [u('a',0),w(10)];
  assert.deepEqual(run([...base,u('a',0),u('a',100,9,2)]).sessions,[s(0,10,['a'],1,true)]);
  assert.throws(() => run([...base,u('a',0,2)]),Error);
  assert.throws(() => run([...base,d('a',1)]),Error);
});
test('tombstone revision ordering, resurrection, and canonical property order', () => {
  assert.deepEqual(run([d('a',3),u('a',0,1,2),d('a',3)]).sessions,[]);
  assert.throws(() => run([d('a',3),u('a',0,1,3)]),Error);
  assert.deepEqual(run([d('a',3),u('a',0,4,4),{amount:4,event_time:0,key:'x',rev:4,id:'a',kind:'upsert'},u('a',50,9,2)]).sessions,
    [s(0,10,['a'],4)]);
});
test('explicit signed monotonic watermark, cutoff equality and no inference', () => {
  assert.deepEqual(run([u('a',-20),u('b',100)]).sessions,
    [s(-20,-10,['a']),s(100,110,['b'])]);
  assert.deepEqual(run([u('a',-20),w(-5),w(-30)],5),
    {watermark:-5,sessions:[s(-20,-10,['a'],1,true)]});
  assert.deepEqual(run([w(0),u('a',-10),u('b',-9)]).sessions,[s(-9,1,['b'])]);
});
test('zero sums, duplicate-content IDs, key separation and ASCII order', () => {
  assert.deepEqual(run([u('z',-1,0,1,'a'),u('A',-1,0,1,'a'),u('b',-1,2,1,'Z'),u('c',9,-2,1,'Z')]).sessions,
    [s(-1,19,['b','c'],0,false,'Z'),s(-1,9,['A','z'],0,false,'a')]);
});
test('key-changing bridge move splits source and merges target', () => {
  assert.deepEqual(run([u('a',0),u('b',10),u('c',20),u('d',0,2,1,'y'),u('e',20,2,1,'y'),u('b',10,3,2,'y')]).sessions,
    [s(0,10,['a']),s(0,30,['b','d','e'],7,false,'y'),s(20,30,['c'])]);
});
test('inputs are immutable and invocations independent', () => {
  const records = Object.freeze([Object.freeze(u('a',0)),Object.freeze(w(10))]);
  const input = Object.freeze({gap_ms:10,lateness_ms:0,records});
  const first = sessions(input);
  first.sessions[0].ids.push('corrupt');
  assert.deepEqual(sessions(input),{watermark:10,sessions:[s(0,10,['a'],1,true)]});
  assert.deepEqual(run([]),{watermark:null,sessions:[]});
});
