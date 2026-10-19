import test from 'node:test';
import assert from 'node:assert/strict';
import {sessions} from './solution.mjs';
const u = (id, time, amount=1, rev=1, key='x') => ({kind:'upsert',id,rev,key,event_time:time,amount});
const d = (id, rev) => ({kind:'delete',id,rev});
const w = time => ({kind:'watermark',time});
const run = (records, lateness_ms=0, gap_ms=10) => sessions({gap_ms,lateness_ms,records});
const s = (start,end,ids,total=ids.length,final=false,key='x') => ({key,start,end,total,count:ids.length,ids,final});

test('late bridge merges, bridge delete splits, equality connects', () => {
  const prefix = [u('a',0),u('c',20),w(15),u('b',10)];
  assert.deepEqual(run(prefix,10), {watermark:15,sessions:[s(0,30,['a','b','c'])]});
  assert.deepEqual(run([...prefix,d('b',2)],10), {watermark:15,sessions:[s(0,10,['a']),s(20,30,['c'])]});
});

test('split immediately finalizes old component and seals its membership', () => {
  const prefix = [u('a',0),u('b',10),u('c',20),w(15),d('b',2)];
  assert.deepEqual(run([...prefix,u('a',100,9,2),d('a',3),u('z',10),u('y',-10)]),
    {watermark:15,sessions:[s(0,10,['a'],1,true),s(20,30,['c'])]});
});

test('individually late event can join an open session', () => {
  assert.deepEqual(run([u('a',10),w(15),u('b',0,4)]),
    {watermark:15,sessions:[s(0,20,['a','b'],5)]});
});

test('proposal removes old contribution; rejected move preserves version', () => {
  const records = [u('a',0),u('b',10),w(15),u('b',-10,5,2),u('b',11,7,2)];
  assert.deepEqual(run(records),{watermark:15,sessions:[s(0,10,['a'],1,true),s(11,21,['b'],7)]});
});

test('rejected move toward sealed key leaves source intact; revision reusable', () => {
  const records = [u('a',0),u('b',50,2,1,'y'),w(10),u('b',10,99,2),u('b',51,3,2,'y')];
  assert.deepEqual(run(records), {watermark:10,sessions:[s(0,10,['a'],1,true),s(51,61,['b'],3,false,'y')]});
});

test('sealed boundaries are inclusive, but more distant open event is allowed', () => {
  assert.deepEqual(run([u('a',0),w(10),u('left',-10),u('right',10),u('ok',11)]),
    {watermark:10,sessions:[s(0,10,['a'],1,true),s(11,21,['ok'])]});
});

test('canonical replay, stale revisions and finalized conflicts', () => {
  const a = u('a',0,1,2);
  assert.deepEqual(run([a,{amount:1,event_time:0,key:'x',rev:2,id:'a',kind:'upsert'},w(10),a,u('a',100,9,1)]),
    {watermark:10,sessions:[s(0,10,['a'],1,true)]});
  assert.throws(() => run([a,w(10),u('a',0,2,2)]), Error);
  assert.throws(() => run([a,w(10),d('a',2)]), Error);
});

test('unknown deletes persist as revision tombstones', () => {
  assert.deepEqual(run([d('a',3),u('a',0,1,2),d('a',3)]),{watermark:null,sessions:[]});
  assert.throws(() => run([d('a',3),u('a',0,1,3)]),Error);
  assert.deepEqual(run([d('a',3),u('a',0,1,4)]).sessions,[s(0,10,['a'])]);
});

test('rejected new upsert does not establish revision or canonical payload', () => {
  assert.deepEqual(run([w(10),u('a',0,1,9),u('a',11,2,1)]),
    {watermark:10,sessions:[s(11,21,['a'],2)]});
});

test('watermarks explicit, monotone and signed; lateness exact boundary', () => {
  assert.deepEqual(run([u('a',-20),w(-5),w(-100)],5),
    {watermark:-5,sessions:[s(-20,-10,['a'],1,true)]});
  assert.deepEqual(run([u('a',-20),w(-6)],5),
    {watermark:-6,sessions:[s(-20,-10,['a'])]});
  assert.equal(run([u('a',100000)]).watermark,null);
});

test('replacement and key move are not additions; zero sums remain', () => {
  assert.deepEqual(run([u('b',-7,3),u('a',-7,-3),u('z',-7,0)]).sessions,
    [s(-7,3,['a','b','z'],0)]);
  assert.deepEqual(run([u('a',0,3),u('a',10,0,2,'y'),d('a',3)]).sessions,[]);
  assert.deepEqual(run([u('a',0,3),u('a',10,0,2,'y')]).sessions,[s(10,20,['a'],0,false,'y')]);
});

test('ASCII sorting and delimiter-like keys, identical payload distinct IDs', () => {
  assert.deepEqual(run([u('z',0,1,1,'a'),u('A',0,1,1,'a'),u('k',0,1,1,'Z'),u('q',0,1,1,'a|0')]).sessions,
    [s(0,10,['k'],1,false,'Z'),s(0,10,['A','z'],2,false,'a'),s(0,10,['q'],1,false,'a|0')]);
});

test('frozen inputs preserved and calls independent', () => {
  const records = Object.freeze([Object.freeze(u('a',0)),Object.freeze(w(10))]);
  const input = Object.freeze({gap_ms:10,lateness_ms:0,records});
  assert.deepEqual(sessions(input),sessions(input));
  assert.deepEqual(run([]),{watermark:null,sessions:[]});
});
