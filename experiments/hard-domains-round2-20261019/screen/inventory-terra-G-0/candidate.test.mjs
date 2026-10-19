import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate } from './solution.mjs';

test('finds global optimum rather than greedily taking a high single order', () => {
  const result = allocate({
    now: 100, on_hand: { a: 3, b: 1 }, holds: [],
    orders: [
      { id: 'big', value: 10, group: null, choices: [{ id: 'all', items: { a: 3, b: 1 } }] },
      { id: 'one', value: 6, group: null, choices: [{ id: 'a', items: { a: 2 } }] },
      { id: 'two', value: 6, group: null, choices: [{ id: 'ab', items: { a: 1, b: 1 } }] },
    ],
  });
  assert.deepEqual(result, {
    value: 12, count: 2,
    allocations: [{ order_id: 'one', choice_id: 'a' }, { order_id: 'two', choice_id: 'ab' }],
    remaining: { a: 0, b: 0 },
  });
});

test('uses only active reservations as capacity, while enforcing all terminal eligibility rules', () => {
  const result = allocate({
    now: 10, on_hand: { s: 5 },
    holds: [
      { id: 'h1', order_id: 'other', sku: 's', quantity: 2, state: 'reserved', expires_at: 11 },
      { id: 'h2', order_id: 'committed-order', sku: 's', quantity: 4, state: 'committed', expires_at: 99 },
      { id: 'h3', order_id: 'expired-order', sku: 's', quantity: 1, state: 'reserved', expires_at: 10 },
      { id: 'h4', order_id: 'cancelled-order', sku: 's', quantity: 1, state: 'cancelled', expires_at: 99 },
    ],
    orders: [
      { id: 'committed-order', value: 100, group: null, choices: [{ id: 'x', items: { s: 1 } }] },
      { id: 'cancelled-order', value: 100, group: null, choices: [{ id: 'x', items: { s: 1 } }] },
      { id: 'expired-order', value: 7, group: null, choices: [{ id: 'fresh', items: { s: 3 } }] },
    ],
  });
  assert.deepEqual(result, { value: 7, count: 1, allocations: [{ order_id: 'expired-order', choice_id: 'fresh' }], remaining: { s: 0 } });
});

test('deduplicates equivalent order snapshots and applies group and lexical tie breaks', () => {
  const duplicate = { id: 'a', value: 4, group: 'g', choices: [{ id: 'z', items: { y: 1, x: 1 } }, { id: 'a', items: { x: 1 } }] };
  const reordered = { id: 'a', value: 4, group: 'g', choices: [{ id: 'a', items: { x: 1 } }, { id: 'z', items: { x: 1, y: 1 } }] };
  const result = allocate({
    now: 0, on_hand: { x: 2, y: 1 }, holds: [],
    orders: [duplicate, reordered,
      { id: 'b', value: 4, group: 'g', choices: [{ id: 'b', items: { x: 1 } }] },
      { id: 'c', value: 4, group: null, choices: [{ id: 'c', items: { x: 1 } }] },
    ],
  });
  // a+c and b+c tie; a is lexically first. Choice a beats choice z for order a.
  assert.deepEqual(result.allocations, [{ order_id: 'a', choice_id: 'a' }, { order_id: 'c', choice_id: 'c' }]);
  assert.equal(result.value, 8);
  assert.equal(result.count, 2);
  assert.deepEqual(result.remaining, { x: 0, y: 1 });
});

test('rejects conflicting duplicate order IDs', () => {
  assert.throws(() => allocate({ now: 0, on_hand: { s: 2 }, holds: [], orders: [
    { id: 'same', value: 1, group: null, choices: [{ id: 'c', items: { s: 1 } }] },
    { id: 'same', value: 2, group: null, choices: [{ id: 'c', items: { s: 1 } }] },
  ] }), Error);
});
