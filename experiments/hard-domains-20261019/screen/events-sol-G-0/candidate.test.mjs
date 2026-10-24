import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from './solution.mjs';
const u = (id, rev, key = 'x', event_time = 1, amount = 3) => ({kind:'upsert',id,rev,key,event_time,amount});
const d = (id, rev) => ({kind:'delete',id,rev});
const wm = time => ({kind:'watermark',time});
const run = (records, lateness_ms = 0) => aggregate({window_ms:10,lateness_ms,records});
const w = (key,start,total,count,final=false) => ({key,start,end:start+10,total,count,final});

test('retransmissions deduplicate by id/revision, not by payload', () => {
  assert.deepEqual(run([u('a',1),u('a',1),u('b',1)]), {watermark:null,windows:[w('x',0,6,2)]});
});
test('corrections replace all fields; older versions cannot restore old values', () => {
  assert.deepEqual(run([u('a',1),u('b',1),u('a',3,'y',12,-4),u('a',2,'z',-1,100)]),
    {watermark:null,windows:[w('x',0,3,1),w('y',10,-4,1)]});
});
test('tombstones suppress stale arrivals and allow later resurrection', () => {
  assert.deepEqual(run([d('a',3),u('a',2),d('a',3),u('a',4,'y',0,0),d('b',1)]),
    {watermark:null,windows:[w('y',0,0,1)]});
  assert.deepEqual(run([u('a',1),d('a',2),u('a',1)]).windows, []);
});
test('canonical payload conflicts include each upsert field and kind', () => {
  for (const changed of [u('a',1,'y'),u('a',1,'x',2),u('a',1,'x',1,4),d('a',1)]) {
    assert.throws(() => run([u('a',1),changed]), Error);
  }
  assert.throws(() => run([d('a',1),u('a',1)]), Error);
  assert.doesNotThrow(() => run([u('a',2),d('a',1)]));
  assert.doesNotThrow(() => run([u('a',1),{amount:3,event_time:1,key:'x',rev:1,id:'a',kind:'upsert',ignored:true}]));
});
test('negative time floors windows and ASCII keys sort deterministically', () => {
  assert.deepEqual(run([u('a',1,'a',-1),u('b',1,'Z',-10),u('c',1,'|',-11),u('d',1,'A',0)]).windows,
    [w('|',-20,3,1),w('Z',-10,3,1),w('a',-10,3,1),w('A',0,3,1)]);
});
test('watermark is monotone, explicit, and closes exactly at end plus lateness', () => {
  assert.equal(run([u('a',1,'x',10000)]).watermark,null);
  assert.deepEqual(run([u('a',1),wm(14),wm(2)],5),{watermark:14,windows:[w('x',0,3,1)]});
  assert.deepEqual(run([u('a',1),wm(15),wm(-5)],5),{watermark:15,windows:[w('x',0,3,1,true)]});
  assert.deepEqual(run([wm(-10),u('a',1,'x',-21),u('b',1,'x',-10)]),
    {watermark:-10,windows:[w('x',-10,3,1)]});
});
test('closed old window prevents corrections and deletes; replay still checked', () => {
  const prefix = [u('a',1),wm(10)];
  assert.deepEqual(run([...prefix,u('a',2,'y',21,8),d('a',3),u('a',1)]),
    {watermark:10,windows:[w('x',0,3,1,true)]});
  assert.throws(() => run([...prefix,u('a',1,'y')]),Error);
});
test('closed target rejects atomically without establishing revision or payload', () => {
  assert.deepEqual(run([u('a',1,'x',11,5),wm(10),u('a',3,'y',1,9),u('a',2,'z',21,7)]),
    {watermark:10,windows:[w('z',20,7,1)]});
  assert.deepEqual(run([wm(10),u('a',4,'x',1,9),u('a',4,'y',11,8)]),
    {watermark:10,windows:[w('y',10,8,1)]});
});
test('unknown and already tombstoned deletes remain accepted after watermark', () => {
  assert.deepEqual(run([wm(100),d('a',4),d('a',5),u('a',4,'x',101),u('a',6,'x',101)]),
    {watermark:100,windows:[w('x',100,3,1)]});
  assert.throws(() => run([wm(100),d('a',5),u('a',5,'x',101)]),Error);
});
test('nonempty zero totals survive, emptied windows disappear', () => {
  assert.deepEqual(run([u('a',1,'x',1,4),u('b',1,'x',2,-4),u('c',1,'y',1,0)]).windows,
    [w('x',0,0,2),w('y',0,0,1)]);
  assert.deepEqual(run([u('a',1),u('a',2,'y',1,0),d('a',3)]).windows,[]);
});
test('inputs are unchanged and calls have independent state', () => {
  const records = Object.freeze([Object.freeze(u('a',1)),Object.freeze(wm(10))]);
  const before = JSON.stringify(records);
  const first = run(records);
  first.windows[0].total = 999;
  assert.deepEqual(run(records),{watermark:10,windows:[w('x',0,3,1,true)]});
  assert.deepEqual(run([]),{watermark:null,windows:[]});
  assert.equal(JSON.stringify(records),before);
});
