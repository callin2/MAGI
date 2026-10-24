import test from 'node:test';
import assert from 'node:assert/strict';
import { replay } from './solution.mjs';
const reserve = (request_id, reservation_id='a', at=0, extra={}) => ({request_id,type:'reserve',reservation_id,at,sku:'s',quantity:3,ttl_ms:10,...extra});
const action = (request_id,type,reservation_id='a',at=0) => ({request_id,type,reservation_id,at});
const adjust = (request_id,delta,at=0) => ({request_id,type:'adjust',sku:'s',delta,at});
const run = operations => replay({stock:{s:10},operations});
const statuses = result => result.outcomes.map(o=>o.status);

test('cancel and commit terminal transitions release/consume exactly once', () => {
  let r=run([reserve('1'),action('2','cancel'),action('3','cancel'),action('4','commit'),reserve('5')]);
  assert.equal(r.available.s,10); assert.equal(r.on_hand.s,10);
  assert.deepEqual(statuses(r),['reserved','cancelled','cancelled','cancelled','cancelled']);
  r=run([reserve('1'),action('2','commit'),action('3','commit'),action('4','cancel'),reserve('5')]);
  assert.equal(r.available.s,7); assert.equal(r.on_hand.s,7);
  assert.deepEqual(statuses(r),['reserved','committed','committed','committed','committed']);
});

test('expiry precedes retries, clock is monotonic, first accepted receipt sets deadline', () => {
  const r=run([adjust('clock',0,20),reserve('1','a',2),reserve('2','a',25),reserve('1','a',30),action('3','commit','a',1),reserve('4','a',0)]);
  assert.equal(r.now,30); assert.equal(r.reservations[0].expires_at,30);
  assert.equal(r.reservations[0].state,'expired'); assert.equal(r.available.s,10);
  assert.deepEqual(statuses(r),['adjusted','reserved','reserved','reserved','expired','expired']);
});

test('unknown cancel tombstones persist; missing commit does not create identity', () => {
  const r=run([action('1','cancel','z'),reserve('2','z'),reserve('3','z',0,{quantity:1}),action('4','commit','a'),reserve('5')]);
  assert.deepEqual(r.reservations[1],{id:'z',sku:null,quantity:0,expires_at:null,state:'cancelled'});
  assert.deepEqual(statuses(r),['cancelled','cancelled','cancelled','missing','reserved']);
  assert.equal(r.available.s,7);
});

test('transport replays failures and successes without repeating effects', () => {
  const r=run([reserve('no','a',0,{quantity:11}),adjust('add',2),reserve('no','a',1,{quantity:11}),reserve('yes','a',1,{quantity:11}),adjust('bad',-2),action('end','cancel','a'),adjust('bad',-2,2),adjust('add',2,2)]);
  assert.deepEqual(statuses(r),['insufficient','adjusted','insufficient','reserved','rejected','cancelled','rejected','adjusted']);
  assert.equal(r.on_hand.s,12); assert.equal(r.available.s,12);
});

test('rejected reserve establishes no terms; distinct equal commands are not transport duplicates', () => {
  const r=run([reserve('1','a',0,{quantity:11}),reserve('2','a'),reserve('3','b')]);
  assert.equal(r.available.s,4); assert.equal(r.reservations.length,2);
});

test('conflicting transport fields throw for every command type', () => {
  for (const [a,b] of [
    [reserve('x'),reserve('x','b')], [reserve('x'),reserve('x','a',0,{ttl_ms:11})],
    [reserve('x'),reserve('x','a',0,{quantity:4})],
    [action('x','cancel'),action('x','commit')],
    [action('x','commit'),action('x','commit','b')],
    [adjust('x',1),adjust('x',2)]
  ]) assert.throws(()=>run([a,b]),Error);
});

test('business term conflicts survive all terminal states', () => {
  for (const ending of [action('end','cancel'),action('end','commit'),adjust('end',0,10)]) {
    assert.throws(()=>run([reserve('1'),ending,reserve('2','a',10,{quantity:4})]),Error);
  }
});

test('adjustments honor active holds, nonnegative physical stock, and expiry boundary', () => {
  const r=run([reserve('1'),adjust('2',-8),adjust('3',-7),adjust('4',-1),adjust('5',-3,10),adjust('6',-1)]);
  assert.deepEqual(statuses(r),['reserved','rejected','adjusted','rejected','adjusted','rejected']);
  assert.equal(r.on_hand.s,0); assert.equal(r.available.s,0);
});

test('pure repeatable replay, sorted ASCII IDs and independent SKUs', () => {
  const input={stock:{s:10,t:4},operations:[reserve('1','z'),reserve('2','A',0,{sku:'t',quantity:4}),action('3','commit','A')]};
  const before=structuredClone(input);
  Object.freeze(input.stock); input.operations.forEach(Object.freeze); Object.freeze(input.operations); Object.freeze(input);
  const result=replay(input);
  assert.deepEqual(input,before); assert.deepEqual(replay(input),result);
  assert.deepEqual(result.reservations.map(r=>r.id),['A','z']);
  assert.deepEqual(result.on_hand,{s:10,t:0}); assert.deepEqual(result.available,{s:7,t:0});
});
