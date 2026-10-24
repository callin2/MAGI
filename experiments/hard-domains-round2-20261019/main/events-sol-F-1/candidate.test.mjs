import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from './solution.mjs';
const u = (id, t, amount = 1, rev = 1, key = 'x') => ({kind:'upsert', id, rev, key, event_time:t, amount});
const d = (id, rev) => ({kind:'delete', id, rev});
const w = time => ({kind:'watermark', time});
const run = (records, lateness_ms = 0, gap_ms = 10) => sessions({gap_ms,lateness_ms,records});
const s = (start,end,ids,total=ids.length,final=false,key='x') => ({key,start,end,total,count:ids.length,ids,final});

test('late bridge merges, delete splits; equality connects and zero totals survive', () => {
  const base = [u('a',0,3),u('z',20,-3),u('m',10,0)];
  assert.deepEqual(run(base), {watermark:null,sessions:[s(0,30,['a','m','z'],0)]});
  assert.deepEqual(run([...base,d('m',2)]).sessions,[s(0,10,['a'],3),s(20,30,['z'],-3)]);
});

test('old event can join an open session; watermark is explicit and monotone', () => {
  assert.deepEqual(run([u('b',15),w(20),w(-100),u('a',5)]),
    {watermark:20,sessions:[s(5,25,['a','b'])]});
  assert.deepEqual(run([u('a',-25),u('b',10000)]).sessions,
    [s(-25,-15,['a']),s(10000,10010,['b'])]);
});

test('retraction finalizes older split and blocks changes to it', () => {
  const records = [u('a',0),u('bridge',10),u('z',20),w(20),d('bridge',2)];
  const expected = {watermark:20,sessions:[s(0,10,['a'],1,true),s(20,30,['z'])]};
  assert.deepEqual(run(records),expected);
  assert.deepEqual(run([...records,d('a',2),u('a',100,999,3),u('new',10),u('left',-10)]),expected);
  // A sealed-touch rejection must not establish a version.
  assert.deepEqual(run([...records,u('new',10,1,4),u('new',31,7,4)]).sessions,
    [s(0,10,['a'],1,true),s(20,30,['z']),s(31,41,['new'],7)]);
});

test('cutoff equality finalizes and lateness delays it', () => {
  assert.deepEqual(run([u('a',-10),w(5)],5).sessions,[s(-10,0,['a'],1,true)]);
  assert.deepEqual(run([u('a',-10),w(4)],5).sessions,[s(-10,0,['a'])]);
  assert.deepEqual(run([w(0),u('a',-10)]).sessions,[]);
});

test('move checks complete proposal without old contribution, rejection is atomic', () => {
  const base = [u('a',20,3),u('b',10,4),w(25)];
  // Removing a at 20 leaves proposed a at 0 connected only to b: end=20, too late.
  assert.deepEqual(run([...base,u('a',0,100,2)]).sessions,[s(10,30,['a','b'],7)]);
  // Reuse the rejected revision with a different payload, then delete it.
  assert.deepEqual(run([...base,u('a',0,100,2),u('a',21,5,2),d('a',3)]).sessions,
    [s(10,20,['b'],4,true)]);
});

test('moves can split source, change keys and finalize remaining component', () => {
  assert.deepEqual(run([u('a',0),u('b',10),u('c',20),w(20),u('b',50,9,2,'y')]).sessions,
    [s(0,10,['a'],1,true),s(20,30,['c']),s(50,60,['b'],9,false,'y')]);
});

test('unknown tombstone retains revision, lower revisions do nothing', () => {
  assert.deepEqual(run([d('a',3),u('a',100,8,2),d('a',3)]).sessions,[]);
  assert.deepEqual(run([d('a',3),u('a',100,8,4),u('a',200,9,1)]).sessions,[s(100,110,['a'],8)]);
  assert.throws(() => run([d('a',3),u('a',100,8,3)]),Error);
});

test('canonical replay and conflicts apply even after finalization', () => {
  const original = u('a',0,0);
  const replay = {amount:0,event_time:0,key:'x',rev:1,id:'a',kind:'upsert'};
  assert.deepEqual(run([original,w(10),replay,u('a',99,2,2),d('a',3)]).sessions,
    [s(0,10,['a'],0,true)]);
  assert.throws(() => run([original,w(10),u('a',0,1)]),Error);
  assert.throws(() => run([original,w(10),d('a',1)]),Error);
  // Rejected greater revisions do not supersede the accepted one.
  assert.throws(() => run([original,w(10),d('a',9),u('a',1,0)]),Error);
});

test('sealed exclusion is per key and covers both boundaries', () => {
  const base = [u('a',0),w(10)];
  assert.deepEqual(run([...base,u('b',10),u('c',-10),u('y',10,2,1,'y')]).sessions,
    [s(0,10,['a'],1,true),s(10,20,['y'],2,false,'y')]);
  assert.deepEqual(run([...base,u('b',11)]).sessions,
    [s(0,10,['a'],1,true),s(11,21,['b'])]);
});

test('distinct equal events, ASCII ordering, independent calls and immutable inputs', () => {
  const records = [u('z',0,0,1,'a'),u('a',0,0,1,'a'),u('Z',0,2,1,'A'),u('A',0,3,1,'a')];
  const copy = structuredClone(records);
  for (const record of records) Object.freeze(record);
  Object.freeze(records);
  const result = run(records);
  assert.deepEqual(result.sessions,[s(0,10,['Z'],2,false,'A'),s(0,10,['A','a','z'],3,false,'a')]);
  assert.deepEqual(records,copy);
  result.sessions[0].ids.push('mutated');
  assert.deepEqual(run(records).sessions[0].ids,['Z']);
  assert.deepEqual(run([]),{watermark:null,sessions:[]});
});
