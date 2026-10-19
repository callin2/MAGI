import test from 'node:test';
import assert from 'node:assert/strict';
import {book} from './solution.mjs';
const base = (meetings, extra={}) => ({range_start:'2024-01-01T00:00:00Z',range_end:'2024-12-31T23:59:59Z',rooms:['a','b'],transitions:{a:{a:0,b:0},b:{a:0,b:0}},meetings,blocks:[],...extra});
const m = (id, local_start, value, extra={}) => ({id,zone:'UTC',local_start,minutes:30,value,eligible_rooms:['a'],people:[],requires:[],fold:'earlier',...extra});
test('global value beats attractive conflicting single meeting', () => {
 const r=book(base([m('x','2024-02-01T09:00',9,{minutes:60}),m('a','2024-02-01T09:00',5),m('b','2024-02-01T09:30',5)]));
 assert.equal(r.value,10); assert.deepEqual(r.bookings.map(x=>x.meeting_id),['a','b']);
});
test('fold choices resolve actual New York instants and either is one meeting', () => {
 const input=base([m('f','2024-11-03T01:30',4,{zone:'America/New_York',fold:'later'})],{range_start:'2024-11-03T06:00:00Z',range_end:'2024-11-03T07:30:00Z'});
 const r=book(input); assert.equal(r.count,1); assert.equal(r.bookings[0].start,'2024-11-03T06:30:00.000Z');
 const gap=book(base([m('g','2024-03-10T02:30',9,{zone:'America/New_York',fold:'either'})])); assert.equal(gap.count,0);
});
test('transition applies to immediate selected neighbors, and room blocks are half-open', () => {
 const meetings=[m('A','2024-02-01T09:00',2,{people:['p'],minutes:30,eligible_rooms:['a']}),m('C','2024-02-01T09:30',2,{people:['p'],minutes:5,eligible_rooms:['b']}),m('B','2024-02-01T09:35',2,{people:['p'],minutes:20,eligible_rooms:['a']})];
 const transitions={a:{a:30,b:0},b:{a:0,b:0}};
 const r=book(base(meetings,{transitions,blocks:[{room_id:'a',start:'2024-02-01T08:00:00Z',end:'2024-02-01T09:00:00Z'}]}));
 assert.equal(r.value,6); assert.deepEqual(r.bookings.map(x=>x.meeting_id),['A','B','C']);
});
test('requirements must be selected and finish before dependent', () => {
 const r=book(base([m('p','2024-02-01T10:00',3),m('d','2024-02-01T09:00',20,{requires:['p']})]));
 assert.deepEqual(r.bookings.map(x=>x.meeting_id),['p']);
});
