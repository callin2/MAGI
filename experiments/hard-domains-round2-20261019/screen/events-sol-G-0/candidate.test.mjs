import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';
const u = (id, t, amount = 1, rev = 1, key = 'x') => ({kind:'upsert',id,rev,key,event_time:t,amount});
const d = (id, rev) => ({kind:'delete',id,rev});
const w = time => ({kind:'watermark',time});
const run = (records, lateness_ms = 0) => sessions({gap_ms:10,lateness_ms,records});
const s = (start,end,ids,total=ids.length,final=false,key='x') => ({key,start,end,total,count:ids.length,ids,final});

test('late bridge merges components; revision retraction splits them', () => {
  const base = [u('a',0),u('c',20),w(5),u('b',10)];
  assert.deepEqual(run(base), {watermark:5,sessions:[s(0,30,['a','b','c'])]});
  assert.deepEqual(run([...base,d('b',2)]), {watermark:5,sessions:[s(0,10,['a']),s(20,30,['c'])]});
});
test('split after retraction immediately finalizes older component', () => {
  const base = [u('a',0),u('b',10),u('c',20),w(25),d('b',2)];
  assert.deepEqual(run(base), {watermark:25,sessions:[s(0,10,['a'],1,true),s(20,30,['c'])]});
  assert.deepEqual(run([...base,u('a',100,9,2),d('a',3),u('z',10),u('z',40)]),
    {watermark:25,sessions:[s(0,10,['a'],1,true),s(20,30,['c']),s(40,50,['z'])]});
});
test('old event can join an open session; standalone late event is rejected', () => {
  assert.deepEqual(run([u('a',20),u('b',30),w(35),u('c',10),u('z',-1)]),
    {watermark:35,sessions:[s(10,40,['a','b','c'])]});
});
test('failed move removes neither old contribution nor revision', () => {
  assert.deepEqual(run([u('a',30),w(35),u('a',0,7,2),u('a',40,9,2)]),
    {watermark:35,sessions:[s(40,50,['a'],9)]});
});
test('move evaluated without its old bridging contribution', () => {
  assert.deepEqual(run([u('a',0),u('b',10),u('c',20),w(25),u('b',-10,8,2)]),
    {watermark:25,sessions:[s(0,30,['a','b','c'])]});
});
test('watermarks monotone, explicit only, lateness and equality finalize', () => {
  assert.deepEqual(run([u('a',-20),w(-15),w(-50),w(-5)],5),
    {watermark:-5,sessions:[s(-20,-10,['a'],1,true)]});
  assert.equal(run([u('a',-100),u('b',100)]).sessions.every(x => !x.final),true);
});
test('sealed boundaries inclusive on both sides; other keys independent', () => {
  assert.deepEqual(run([u('a',0),w(10),u('left',-10),u('right',10),u('left',-11),u('right',11),u('other',10,0,1,'y')]),
    {watermark:10,sessions:[s(0,10,['a'],1,true),s(10,20,['other'],0,false,'y'),s(11,21,['right'])]});
});
test('accepted revision replay and conflict apply to finalized events', () => {
  const base = [u('a',0),w(10),u('a',100,2,2)];
  assert.deepEqual(run([...base,u('a',0)]),run(base));
  assert.throws(() => run([...base,u('a',0,2)]),Error);
  assert.deepEqual(run([u('a',0,1,3),u('a',999,9,1)]),run([u('a',0,1,3)]));
});
test('unknown delete tombstone and canonical payload replay', () => {
  assert.deepEqual(run([d('a',2),u('a',0,3,1),d('a',2)]),{watermark:null,sessions:[]});
  assert.throws(() => run([d('a',2),u('a',0,3,2)]),Error);
  assert.deepEqual(run([u('a',0),{amount:1,event_time:0,key:'x',rev:1,id:'a',kind:'upsert'}]),run([u('a',0)]));
});
test('distinct IDs, zero total, ASCII order and input independence', () => {
  const records = [u('z',0,1),u('A',0,-1),u('q',0,0,1,'Z'),u('r',0,0,1,'a')];
  const original = structuredClone(records);
  records.forEach(Object.freeze); Object.freeze(records);
  const expected = {watermark:null,sessions:[s(0,10,['q'],0,false,'Z'),s(0,10,['r'],0,false,'a'),s(0,10,['A','z'],0)]};
  assert.deepEqual(run(records),expected);
  assert.deepEqual(run(records),expected);
  assert.deepEqual(records,original);
  assert.deepEqual(run([]),{watermark:null,sessions:[]});
});
