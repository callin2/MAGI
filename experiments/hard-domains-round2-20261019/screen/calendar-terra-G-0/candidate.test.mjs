import test from 'node:test';
import assert from 'node:assert/strict';
import {book} from './solution.mjs';
const base={range_start:'2024-01-01T00:00:00Z',range_end:'2024-01-03T00:00:00Z',rooms:['A','B'],transitions:{A:{A:0,B:20},B:{A:0,B:0}},blocks:[]};
function m(id,time,minutes,value,rooms,people=[],requires=[]){return {id,zone:'UTC',local_start:time,minutes,value,eligible_rooms:rooms,people,requires,fold:'earlier'};}
test('optimizes globally, honors dependency and directed transition',()=>{
 const x={...base,meetings:[
  m('high','2024-01-01T09:00',60,11,['A'],['p']),
  m('one','2024-01-01T09:00',30,6,['B'],['p']),
  m('two','2024-01-01T09:30',30,6,['A'],['p']), // B->A needs no setup
  m('need','2024-01-01T11:00',20,20,['A'],[],['missing']),
  m('missing','2024-01-01T11:30',20,1,['A'])
 ]};
 const r=book(x);
 assert.equal(r.value,13); // one + two + missing; dependent occurs before its prerequisite
 assert.deepEqual(r.bookings.map(b=>b.meeting_id),['missing','one','two']);
});
test('fold either offers both occurrences but books only one, and blocks apply',()=>{
 const x={range_start:'2024-11-03T05:00:00Z',range_end:'2024-11-03T07:00:00Z',rooms:['R'],transitions:{R:{R:0}},blocks:[{room_id:'R',start:'2024-11-03T05:20:00Z',end:'2024-11-03T05:40:00Z'}],meetings:[{id:'dst',zone:'America/New_York',local_start:'2024-11-03T01:30',minutes:20,value:4,eligible_rooms:['R'],people:[],requires:[],fold:'either'}]};
 assert.deepEqual(book(x),{value:4,count:1,bookings:[{meeting_id:'dst',room_id:'R',start:'2024-11-03T06:30:00.000Z',end:'2024-11-03T06:50:00.000Z'}]});
});
test('lexicographic tie uses room then UTC start',()=>{
 const x={...base,meetings:[m('z','2024-01-01T10:00',10,1,['B','A']),m('a','2024-01-01T09:00',10,1,['B','A'])]};
 assert.deepEqual(book(x).bookings.map(x=>[x.meeting_id,x.room_id]),[['a','A'],['z','A']]);
});
