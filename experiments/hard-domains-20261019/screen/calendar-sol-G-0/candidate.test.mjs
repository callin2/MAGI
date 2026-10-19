import test from 'node:test';
import assert from 'node:assert/strict';
import { plan } from './solution.mjs';
const rule = (extra = {}) => ({ id: 'a', weekday: 0, start: '01:30', minutes: 30,
  from: '2024-01-01', through: '2026-12-31', fold: 'both', ...extra });
const query = (zone, date, rules, extra = {}) => ({ zone,
  range_start: `${date}T00:00Z`, range_end: `${date}T23:59Z`,
  rules, exclusions: [], busy: [], ...extra });
const slot = (id, date, start, end) => ({ rule_id: id, local_date: date,
  start: new Date(start).toISOString(), end: new Date(end).toISOString() });

test('New York fall fold: both, earlier, later; duration is elapsed', () => {
  const q = query('America/New_York', '2024-11-03', [rule({minutes: 90})]);
  const both = [slot('a','2024-11-03','2024-11-03T05:30Z','2024-11-03T07:00Z'),
    slot('a','2024-11-03','2024-11-03T06:30Z','2024-11-03T08:00Z')];
  assert.deepEqual(plan(q), both);
  assert.deepEqual(plan({...q, rules:[rule({minutes:90, fold:'earlier'})]}), both.slice(0,1));
  assert.deepEqual(plan({...q, rules:[rule({minutes:90, fold:'later'})]}), both.slice(1));
});

test('fold selection precedes containment and busy filtering', () => {
  const q = query('America/New_York', '2024-11-03', [rule({fold:'earlier'})], {
    range_start:'2024-11-03T06:00Z', range_end:'2024-11-03T07:00Z' });
  assert.deepEqual(plan(q), []);
  assert.equal(plan({...q, rules:[rule({fold:'both'})]}).length, 1);
  assert.deepEqual(plan({...q, range_start:'2024-11-03T00:00Z',
    busy:[{start:'2024-11-03T05:30Z',end:'2024-11-03T06:00Z'}]}), []);
});

test('spring gaps do not emit occurrences in New York and Berlin', () => {
  for (const [zone,date] of [['America/New_York','2025-03-09'],['Europe/Berlin','2026-03-29']]) {
    assert.deepEqual(plan(query(zone,date,[rule({start:'02:30'})])), []);
  }
});

test('Berlin repeated time in 2026', () => {
  assert.deepEqual(plan(query('Europe/Berlin','2026-10-25',[rule({start:'02:30'})])), [
    slot('a','2026-10-25','2026-10-25T00:30Z','2026-10-25T01:00Z'),
    slot('a','2026-10-25','2026-10-25T01:30Z','2026-10-25T02:00Z')]);
});

test('Lord Howe half-hour fold and gap', () => {
  assert.deepEqual(plan(query('Australia/Lord_Howe','2024-04-06',[rule({start:'01:45'})], {
    range_end:'2024-04-07T18:00Z'})), [
    slot('a','2024-04-07','2024-04-06T14:45Z','2024-04-06T15:15Z'),
    slot('a','2024-04-07','2024-04-06T15:15Z','2024-04-06T15:45Z')]);
  assert.deepEqual(plan(query('Australia/Lord_Howe','2024-10-05',[rule({start:'02:15'})], {
    range_end:'2024-10-06T18:00Z'})), []);
});

test('Kathmandu local date, offset endpoints, midnight crossing and inclusive dates', () => {
  assert.deepEqual(plan(query('Asia/Kathmandu','2024-01-06',[
    rule({start:'00:05',from:'2024-01-07',through:'2024-01-07'})], {
    range_start:'2024-01-07T00:05+05:45',range_end:'2024-01-07T00:35+05:45'})), [
    slot('a','2024-01-07','2024-01-06T18:20Z','2024-01-06T18:50Z')]);
  assert.deepEqual(plan(query('UTC','2024-01-07',[rule({start:'23:45',minutes:60})], {
    range_end:'2024-01-08T00:45Z'})), [
    slot('a','2024-01-07','2024-01-07T23:45Z','2024-01-08T00:45Z')]);
});

test('half-open busy intervals and full containment', () => {
  const q = query('UTC','2024-01-07',[rule({start:'09:00'})], {
    range_start:'2024-01-07T09:00Z', range_end:'2024-01-07T09:30Z',
    busy:[{start:'2024-01-07T08:00Z',end:'2024-01-07T09:00Z'},
      {start:'2024-01-07T10:30+01:00',end:'2024-01-07T11:00+01:00'}] });
  assert.equal(plan(q).length, 1);
  assert.deepEqual(plan({...q, range_end:'2024-01-07T09:29Z'}), []);
  assert.deepEqual(plan({...q, busy:[{start:'2024-01-07T09:29Z',end:'2024-01-07T09:31Z'}]}), []);
});

test('rule-scoped exclusions, distinct rules, ASCII sort and immutable input', () => {
  const q = query('UTC','2024-01-07',[
    rule({id:'a'}),rule({id:'Z'}),rule({id:'excluded'})], {
    exclusions:[{rule_id:'excluded',date:'2024-01-07'}] });
  const before = structuredClone(q);
  function freeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } }
  freeze(q);
  assert.deepEqual(plan(q).map(s => s.rule_id), ['Z','a']);
  assert.deepEqual(q, before);
});

test('fourteen elapsed days include successive weekly occurrences', () => {
  const q = query('UTC','2025-12-28',[rule({start:'09:00'})], {
    range_end:'2026-01-11T00:00Z'});
  assert.deepEqual(plan(q).map(s => s.local_date), ['2025-12-28','2026-01-04']);
});
