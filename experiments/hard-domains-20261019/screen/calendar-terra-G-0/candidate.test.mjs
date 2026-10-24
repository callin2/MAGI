import test from 'node:test';
import assert from 'node:assert/strict';
import {plan} from './solution.mjs';

const base = { exclusions: [], busy: [] };
function call(zone, range_start, range_end, rules, extra = {}) {
  return plan({ zone, range_start, range_end, rules, ...base, ...extra });
}

test('New York gap is omitted and fall fold selects each requested instant', () => {
  const spring = call('America/New_York', '2024-03-10T00:00:00Z', '2024-03-11T00:00:00Z', [
    {id:'gap', weekday:0, start:'02:30', minutes:30, from:'2024-03-10', through:'2024-03-10', fold:'both'}
  ]);
  assert.deepEqual(spring, []);
  const rule = {id:'fold', weekday:0, start:'01:30', minutes:30, from:'2024-11-03', through:'2024-11-03', fold:'both'};
  assert.deepEqual(call('America/New_York', '2024-11-03T00:00:00Z', '2024-11-03T08:00:00Z', [rule]).map(x => x.start), [
    '2024-11-03T05:30:00.000Z', '2024-11-03T06:30:00.000Z'
  ]);
  assert.equal(call('America/New_York', '2024-11-03T00:00:00Z', '2024-11-03T08:00:00Z', [{...rule, fold:'later'}])[0].start, '2024-11-03T06:30:00.000Z');
});

test('busy intervals are half-open and exclusions use the local date', () => {
  const rule = {id:'a', weekday:0, start:'09:00', minutes:30, from:'2024-01-07', through:'2024-01-07', fold:'earlier'};
  const args = ['UTC', '2024-01-07T00:00:00Z', '2024-01-08T00:00:00Z', [rule]];
  assert.equal(call(...args, {busy:[{start:'2024-01-07T08:00:00Z', end:'2024-01-07T09:00:00Z'}]}).length, 1);
  assert.equal(call(...args, {busy:[{start:'2024-01-07T09:29:00Z', end:'2024-01-07T10:00:00Z'}]}).length, 0);
  assert.deepEqual(call(...args, {exclusions:[{rule_id:'a', date:'2024-01-07'}]}), []);
});

test('non-hour DST fold in Lord Howe and fixed Kathmandu offset resolve correctly', () => {
  const lord = call('Australia/Lord_Howe', '2024-04-06T12:00:00Z', '2024-04-07T18:00:00Z', [
    {id:'lh', weekday:0, start:'01:45', minutes:20, from:'2024-04-07', through:'2024-04-07', fold:'both'}
  ]);
  assert.deepEqual(lord.map(x => x.start), ['2024-04-06T14:45:00.000Z', '2024-04-06T15:15:00.000Z']);
  const ktm = call('Asia/Kathmandu', '2024-01-06T18:00:00Z', '2024-01-08T00:00:00Z', [
    {id:'k', weekday:0, start:'00:15', minutes:15, from:'2024-01-07', through:'2024-01-07', fold:'earlier'}
  ]);
  assert.equal(ktm[0].start, '2024-01-06T18:30:00.000Z');
});

test('duration is elapsed across a transition and range end equality is retained', () => {
  const result = call('America/New_York', '2024-11-03T05:30:00Z', '2024-11-03T07:00:00Z', [
    {id:'x', weekday:0, start:'01:30', minutes:90, from:'2024-11-03', through:'2024-11-03', fold:'earlier'}
  ]);
  assert.deepEqual(result, [{rule_id:'x', local_date:'2024-11-03', start:'2024-11-03T05:30:00.000Z', end:'2024-11-03T07:00:00.000Z'}]);
});
