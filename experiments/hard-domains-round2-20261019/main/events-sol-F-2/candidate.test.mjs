import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';
const u = (id, t, amount = 1, rev = 1, key = 'x') => ({kind:'upsert',id,rev,key,event_time:t,amount});
const d = (id, rev) => ({kind:'delete',id,rev});
const w = time => ({kind:'watermark',time});
const run = (records, lateness_ms = 0) => sessions({gap_ms:10,lateness_ms,records});
const s = (start,end,ids,total=ids.length,final=false,key='x') => ({key,start,end,total,count:ids.length,ids,final});

test('transitive equality connectivity, distinct IDs and zero totals', () => {
  assert.deepEqual(run([u('c',20,-2),u('a',0,1),u('b',10,1),u('d',20,0)]),
    {watermark:null,sessions:[s(0,30,['a','b','c','d'],0)]});
});
test('late bridge merges two open sessions; delete splits', () => {
  const prefix=[u('a',0),u('c',20),w(9),u('b',10)];
  assert.deepEqual(run(prefix),{watermark:9,sessions:[s(0,30,['a','b','c'])]});
  assert.deepEqual(run([...prefix,d('b',2)]),{watermark:9,sessions:[s(0,10,['a']),s(20,30,['c'])]});
});
test('retraction finalizes the older split immediately', () => {
  const prefix=[u('a',0),u('b',10),u('c',20),w(25),d('b',2)];
  assert.deepEqual(run(prefix),{watermark:25,sessions:[s(0,10,['a'],1,true),s(20,30,['c'])]});
  assert.deepEqual(run([...prefix,u('b',10,9,3),d('a',2),u('a',100,9,3)]),run(prefix));
});
test('individually late event can join an open component', () => {
  assert.deepEqual(run([u('b',10),w(15),u('a',0)]),
    {watermark:15,sessions:[s(0,20,['a','b'])]});
});
test('proposal removes old contribution before lateness evaluation', () => {
  const records=[u('a',0),u('b',10),u('c',20),w(25),u('c',-10,7,2)];
  assert.deepEqual(run(records),run(records.slice(0,-1)));
});
test('rejected moves preserve both value and version', () => {
  const prefix=[u('a',100,3),w(50),u('a',0,99,2,'y')];
  assert.deepEqual(run(prefix),{watermark:50,sessions:[s(100,110,['a'],3)]});
  assert.deepEqual(run([...prefix,u('a',110,4,2)]),
    {watermark:50,sessions:[s(110,120,['a'],4)]});
});
test('sealed session rejects extensions including equality; nearby disjoint event allowed', () => {
  assert.deepEqual(run([u('a',100,2),w(110),u('b',110,8),u('c',111,3),u('a',200,7,2),d('a',3)]),
    {watermark:110,sessions:[s(100,110,['a'],2,true),s(111,121,['c'],3)]});
});
test('accepted-revision replay and conflict survive finalization; lower revisions ignored', () => {
  const prefix=[u('a',0,1,2),w(10)];
  assert.deepEqual(run([...prefix,u('a',0,1,2),u('a',100,9,1)]),run(prefix));
  assert.throws(() => run([...prefix,u('a',0,2,2)]),Error);
  assert.throws(() => run([...prefix,d('a',2)]),Error);
});
test('unknown deletes establish revision tombstones and canonical delete replay', () => {
  const prefix=[d('a',3),d('a',3),u('a',0,1,2)];
  assert.deepEqual(run(prefix),{watermark:null,sessions:[]});
  assert.throws(() => run([...prefix,u('a',0,1,3)]),Error);
  assert.deepEqual(run([...prefix,u('a',0,0,4)]),{watermark:null,sessions:[s(0,10,['a'],0)]});
});
test('rejected insert establishes no revision or payload', () => {
  assert.deepEqual(run([w(20),u('a',0,1,9),u('a',20,2,1)]),
    {watermark:20,sessions:[s(20,30,['a'],2)]});
});
test('explicit monotone watermark and lateness equality, including negative times', () => {
  const prefix=[u('a',-20),w(-6),w(-100)];
  assert.deepEqual(run(prefix,5),{watermark:-6,sessions:[s(-20,-10,['a'])]});
  assert.deepEqual(run([...prefix,w(-5)],5),{watermark:-5,sessions:[s(-20,-10,['a'],1,true)]});
});
test('ASCII key/id ordering, key moves, purity and independent calls', () => {
  const records=[u('z',0,1,1,'a'),u('A',0,1,1,'Z'),u('a',0,1,1,'Z'),u('move',30),u('move',0,0,2,'Z')];
  const before=structuredClone(records);
  for(const r of records) Object.freeze(r);
  Object.freeze(records);
  const expected={watermark:null,sessions:[s(0,10,['A','a','move'],2,false,'Z'),s(0,10,['z'],1,false,'a')]};
  assert.deepEqual(run(records),expected);
  assert.deepEqual(records,before);
  assert.deepEqual(run([]),{watermark:null,sessions:[]});
  assert.deepEqual(run(records),expected);
});
