import test from 'node:test';
import assert from 'node:assert/strict';
import { replay } from './solution.mjs';

test('duplicate delivery advances clock/expiry but does not repeat command', () => {
  const result = replay({ stock: { s: 5 }, operations: [
    { request_id: 'a', type: 'reserve', at: 2, reservation_id: 'h', sku: 's', quantity: 3, ttl_ms: 4 },
    { request_id: 'a', type: 'reserve', at: 10, reservation_id: 'h', sku: 's', quantity: 3, ttl_ms: 4 },
  ] });
  assert.equal(result.now, 10);
  assert.deepEqual(result.outcomes.map(x => x.status), ['reserved', 'reserved']);
  assert.equal(result.available.s, 5);
  assert.equal(result.reservations[0].state, 'expired');
});

test('cancel tombstone blocks later create, and terminal reservation cannot resurrect', () => {
  const result = replay({ stock: { s: 8 }, operations: [
    { request_id: 'c', type: 'cancel', at: 0, reservation_id: 'x' },
    { request_id: 'r', type: 'reserve', at: 1, reservation_id: 'x', sku: 's', quantity: 2, ttl_ms: 20 },
    { request_id: 'r2', type: 'reserve', at: 2, reservation_id: 'y', sku: 's', quantity: 4, ttl_ms: 20 },
    { request_id: 'c2', type: 'cancel', at: 3, reservation_id: 'y' },
    { request_id: 'r3', type: 'reserve', at: 4, reservation_id: 'y', sku: 's', quantity: 4, ttl_ms: 20 },
  ] });
  assert.deepEqual(result.outcomes.map(x => x.status), ['cancelled', 'cancelled', 'reserved', 'cancelled', 'cancelled']);
  assert.equal(result.available.s, 8);
  assert.equal(result.reservations[0].sku, null);
});

test('rejects stock reducing adjust below active holds and detects identity conflicts', () => {
  const base = { stock: { s: 4 }, operations: [
    { request_id: 'r', type: 'reserve', at: 0, reservation_id: 'h', sku: 's', quantity: 3, ttl_ms: 10 },
    { request_id: 'a', type: 'adjust', at: 1, sku: 's', delta: -2 },
  ] };
  assert.deepEqual(replay(base).outcomes.map(x => x.status), ['reserved', 'rejected']);
  assert.throws(() => replay({ stock: { s: 4 }, operations: [
    { request_id: 'z', type: 'adjust', at: 0, sku: 's', delta: 0 },
    { request_id: 'z', type: 'adjust', at: 1, sku: 's', delta: 1 },
  ] }), Error);
});
