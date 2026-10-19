import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from './solution.mjs';

const run = (records, window_ms = 10, lateness_ms = 0) =>
  aggregate({ window_ms, lateness_ms, records });

test('retransmissions are idempotent and replacement removes full old contribution', () => {
  const result = run([
    { kind: 'upsert', id: 'a', rev: 1, key: 'old', event_time: 1, amount: 7 },
    { kind: 'upsert', id: 'a', rev: 1, key: 'old', event_time: 1, amount: 7 },
    { kind: 'upsert', id: 'a', rev: 2, key: 'new', event_time: 12, amount: -3 },
    { kind: 'upsert', id: 'a', rev: 1, key: 'ignored', event_time: 1, amount: 99 },
  ]);
  assert.deepEqual(result, { watermark: null, windows: [
    { key: 'new', start: 10, end: 20, total: -3, count: 1, final: false },
  ] });
});

test('same accepted revision conflicts, including upsert versus delete', () => {
  assert.throws(() => run([
    { kind: 'delete', id: 'x', rev: 1 },
    { kind: 'upsert', id: 'x', rev: 1, key: 'k', event_time: 0, amount: 1 },
  ]), Error);
});

test('watermarks only advance and finalized windows reject atomic corrections and deletes', () => {
  const result = run([
    { kind: 'upsert', id: 'a', rev: 1, key: 'k', event_time: 2, amount: 4 },
    { kind: 'watermark', time: 10 },
    { kind: 'watermark', time: 2 },
    // Both would change a finalized old window; neither revision is accepted.
    { kind: 'upsert', id: 'a', rev: 2, key: 'later', event_time: 15, amount: 9 },
    { kind: 'delete', id: 'a', rev: 3 },
    // Repeating rejected rev 2 is not an accepted-revision conflict.
    { kind: 'upsert', id: 'a', rev: 2, key: 'later', event_time: 15, amount: 9 },
  ]);
  assert.deepEqual(result, { watermark: 10, windows: [
    { key: 'k', start: 0, end: 10, total: 4, count: 1, final: true },
  ] });
});

test('late new upserts are rejected, but unknown deletes create usable tombstones', () => {
  const result = run([
    { kind: 'watermark', time: 25 },
    { kind: 'upsert', id: 'late', rev: 1, key: 'x', event_time: 1, amount: 3 },
    { kind: 'delete', id: 'gone', rev: 4 },
    { kind: 'upsert', id: 'gone', rev: 3, key: 'x', event_time: 21, amount: 8 },
    { kind: 'upsert', id: 'gone', rev: 5, key: 'x', event_time: 21, amount: 8 },
  ]);
  assert.deepEqual(result.windows, [
    { key: 'x', start: 20, end: 30, total: 8, count: 1, final: false },
  ]);
  assert.equal(result.watermark, 25);
});

test('negative event times use floor windows and distinct ids count separately', () => {
  const input = { kind: 'upsert', id: 'a', rev: 1, key: 'z', event_time: -1, amount: 0 };
  const result = run([input, { ...input, id: 'b' }]);
  assert.deepEqual(result.windows, [
    { key: 'z', start: -10, end: 0, total: 0, count: 2, final: false },
  ]);
  assert.equal(input.event_time, -1);
});

test('lateness controls finality and output ordering', () => {
  const result = run([
    { kind: 'upsert', id: '1', rev: 1, key: 'z', event_time: 1, amount: 1 },
    { kind: 'upsert', id: '2', rev: 1, key: 'A', event_time: 1, amount: 1 },
    { kind: 'watermark', time: 14 },
  ], 10, 5);
  assert.deepEqual(result.windows.map(({ key, final }) => ({ key, final })), [
    { key: 'A', final: false }, { key: 'z', final: false },
  ]);
});
