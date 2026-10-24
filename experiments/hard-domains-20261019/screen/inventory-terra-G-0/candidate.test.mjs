import test from 'node:test';
import assert from 'node:assert/strict';
import { replay } from './solution.mjs';

test('watermark expiry, duplicate cancellation, and duplicate reserve are idempotent', () => {
  const result = replay({
    stock: { s: 5 },
    operations: [
      { request_id: 'reserve', type: 'reserve', at: 5, reservation_id: 'a', sku: 's', quantity: 3, ttl_ms: 10 },
      { request_id: 'cancel', type: 'cancel', at: 6, reservation_id: 'a' },
      { request_id: 'cancel', type: 'cancel', at: 7, reservation_id: 'a' },
      // It is a transport replay, so it reports reserved despite cancellation.
      { request_id: 'reserve', type: 'reserve', at: 99, reservation_id: 'a', sku: 's', quantity: 3, ttl_ms: 10 },
    ],
  });
  assert.deepEqual(result, {
    now: 99, on_hand: { s: 5 }, available: { s: 5 },
    reservations: [{ id: 'a', sku: 's', quantity: 3, expires_at: 15, state: 'cancelled' }],
    outcomes: [
      { request_id: 'reserve', status: 'reserved' }, { request_id: 'cancel', status: 'cancelled' },
      { request_id: 'cancel', status: 'cancelled' }, { request_id: 'reserve', status: 'reserved' },
    ],
  });
});

test('expiry occurs at the receipt watermark before its command and old delivery times do not rewind it', () => {
  const result = replay({ stock: { s: 4 }, operations: [
    { request_id: 'r', type: 'reserve', at: 10, reservation_id: 'x', sku: 's', quantity: 4, ttl_ms: 5 },
    { request_id: 'late', type: 'commit', at: 15, reservation_id: 'x' },
    { request_id: 'new', type: 'reserve', at: 2, reservation_id: 'y', sku: 's', quantity: 4, ttl_ms: 1 },
  ] });
  assert.equal(result.now, 15);
  assert.deepEqual(result.outcomes.map((x) => x.status), ['reserved', 'expired', 'reserved']);
  assert.deepEqual(result.available, { s: 0 });
  assert.deepEqual(result.reservations, [
    { id: 'x', sku: 's', quantity: 4, expires_at: 15, state: 'expired' },
    { id: 'y', sku: 's', quantity: 4, expires_at: 16, state: 'reserved' },
  ]);
});

test('cancel-before-create tombstone blocks reserve and adjustments protect active holds', () => {
  const result = replay({ stock: { s: 6 }, operations: [
    { request_id: 'c', type: 'cancel', at: 1, reservation_id: 'gone' },
    { request_id: 'r', type: 'reserve', at: 1, reservation_id: 'gone', sku: 's', quantity: 2, ttl_ms: 5 },
    { request_id: 'a', type: 'reserve', at: 1, reservation_id: 'live', sku: 's', quantity: 4, ttl_ms: 20 },
    { request_id: 'down', type: 'adjust', at: 2, sku: 's', delta: -3 },
    { request_id: 'up', type: 'adjust', at: 2, sku: 's', delta: 2 },
  ] });
  assert.deepEqual(result.outcomes.map((x) => x.status), ['cancelled', 'cancelled', 'reserved', 'rejected', 'adjusted']);
  assert.deepEqual(result.on_hand, { s: 8 });
  assert.deepEqual(result.available, { s: 4 });
  assert.deepEqual(result.reservations[0], { id: 'gone', sku: null, quantity: 0, expires_at: null, state: 'cancelled' });
});

test('request command conflict and reservation term conflict throw', () => {
  assert.throws(() => replay({ stock: { s: 2 }, operations: [
    { request_id: 'q', type: 'adjust', at: 0, sku: 's', delta: 1 },
    { request_id: 'q', type: 'adjust', at: 1, sku: 's', delta: 2 },
  ] }), Error);
  assert.throws(() => replay({ stock: { s: 2 }, operations: [
    { request_id: 'one', type: 'reserve', at: 0, reservation_id: 'z', sku: 's', quantity: 1, ttl_ms: 2 },
    { request_id: 'two', type: 'reserve', at: 1, reservation_id: 'z', sku: 's', quantity: 2, ttl_ms: 2 },
  ] }), Error);
});
