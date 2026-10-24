import test from 'node:test';
import assert from 'node:assert/strict';
import {sessions} from './solution.mjs';
const u = (id, t, rev = 1, amount = 1, key = 'x') => ({kind:'upsert',id,rev,key,event_time:t,amount});
const d = (id, rev) => ({kind:'delete',id,rev});
const w = time => ({kind:'watermark',time});
const run = (records, lateness_ms = 0) => sessions({gap_ms:10,lateness_ms,records});
const s = (start,end,ids,total = ids.length,final = false,key = 'x') => ({key,start,end,total,count:ids.length,ids,final});

test('late bridge merges sessions, even across epoch boundaries', () => {
  assert.deepEqual(run([u('a',-1),u('c',19),w(14),u('b',9)],10),
    {watermark:14,sessions:[s(-1,29,['a','b','c'])]});
});
test('bridge retraction splits and immediately seals the old component', () => {
  const prefix = [u('a',0),u('b',10),u('c',20),w(25),d('b',2)];
  assert.deepEqual(run(prefix,10),{watermark:25,sessions:[s(0,10,['a'],1,true),s(20,30,['c'])]});
  // Equality at the sealed join boundary rejects without consuming rev 3.
  assert.deepEqual(run([...prefix,u('b',10,3),u('b',40,3)],10),
    {watermark:25,sessions:[s(0,10,['a'],1,true),s(20,30,['c']),s(40,50,['b'])]});
});
test('individually late event may join a still-open component', () => {
  assert.deepEqual(run([u('a',15),w(25),u('b',5)],5),
    {watermark:25,sessions:[s(5,25,['a','b'])]});
});
test('move evaluates complete proposal and rejection preserves old contribution and revision', () => {
  assert.deepEqual(run([u('a',15),w(25),u('a',5,2),u('a',16,2,4)],5),
    {watermark:25,sessions:[s(16,26,['a'],4)]});
});
test('sealed events cannot move, change amounts, or be deleted', () => {
  assert.deepEqual(run([u('a',0),w(10),u('a',100,2,7,'y'),d('a',3),u('a',0)]),
    {watermark:10,sessions:[s(0,10,['a'],1,true)]});
});
test('sealed join ranges include both equality boundaries, but not a further millisecond', () => {
  assert.deepEqual(run([u('a',0),w(10),u('b',10),u('b',11),u('c',-10),u('z',0,1,2,'y')]),
    {watermark:10,sessions:[s(0,10,['a'],1,true),s(11,21,['b'])]});
});
test('revision replay is canonical, conflicts throw, lower revisions are inert', () => {
  const a = u('a',0,3);
  assert.deepEqual(run([a,{amount:1,event_time:0,key:'x',rev:3,id:'a',kind:'upsert'},u('a',99,2),w(10),a]),
    {watermark:10,sessions:[s(0,10,['a'],1,true)]});
  assert.throws(() => run([a,w(10),u('a',0,3,2)]), Error);
  assert.throws(() => run([d('a',3),u('a',0,3)]), Error);
  assert.deepEqual(run([d('a',3),u('a',0,2),d('a',3),u('a',0,4)]),
    {watermark:null,sessions:[s(0,10,['a'])]});
});
test('watermarks are explicit and monotonic; exact end cutoff seals', () => {
  assert.deepEqual(run([u('a',100),w(115),w(-100),u('b',0)],5),
    {watermark:115,sessions:[s(100,110,['a'],1,true)]});
  assert.deepEqual(run([u('a',-100)]),{watermark:null,sessions:[s(-100,-90,['a'])]});
});
test('key moves remove old contribution and may seal remaining component', () => {
  assert.deepEqual(run([u('a',0),u('b',10),u('c',20),w(25),u('b',30,2,2,'y')],10),
    {watermark:25,sessions:[s(0,10,['a'],1,true),s(20,30,['c']),s(30,40,['b'],2,false,'y')]});
});
test('zero totals, duplicate-content events, ASCII sorting, input preservation and call isolation', () => {
  const records = [u('z',-3,1,0,'a'),u('b',-3,1,2,'Z'),u('A',-3,1,-2,'Z'),u('B',-3,1,0,'Z')];
  const before = structuredClone(records);
  for (const r of records) Object.freeze(r);
  Object.freeze(records);
  const expected = {watermark:null,sessions:[s(-3,7,['A','B','b'],0,false,'Z'),s(-3,7,['z'],0,false,'a')]};
  assert.deepEqual(run(records),expected);
  assert.deepEqual(records,before);
  assert.deepEqual(run([]),{watermark:null,sessions:[]});
  assert.deepEqual(run(records),expected);
});
