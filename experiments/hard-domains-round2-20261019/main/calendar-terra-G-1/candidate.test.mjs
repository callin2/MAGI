import test from 'node:test';
import assert from 'node:assert/strict';
import {book} from './solution.mjs';
const base={range_start:'2024-01-01T00:00:00Z',range_end:'2024-01-08T00:00:00Z',rooms:['A','B','C'],transitions:{A:{A:0,B:70,C:0},B:{A:0,B:0,C:0},C:{A:0,B:0,C:0}},blocks:[]};
const m=(id,local_start,minutes,value,eligible_rooms,people=[],requires=[],zone='UTC',fold='earlier')=>({id,zone,local_start,minutes,value,eligible_rooms,people,requires,fold});
test('global optimization chooses compatible total over attractive conflict',()=>{
 const r=book({...base,meetings:[m('high','2024-01-02T09:00',120,10,['A'],['p']),m('left','2024-01-02T09:00',60,6,['B'],['p']),m('right','2024-01-02T10:00',60,6,['B'],['p'])]});
 assert.equal(r.value,12); assert.deepEqual(r.bookings.map(x=>x.meeting_id),['left','right']);
});
test('an intermediate meeting changes the applicable person transition',()=>{
 const r=book({...base,meetings:[m('a','2024-01-02T09:00',30,3,['A'],['p']),m('mid','2024-01-02T09:30',30,3,['C'],['p']),m('z','2024-01-02T10:00',30,3,['B'],['p'])]});
 assert.equal(r.value,9); assert.equal(r.count,3);
});
test('requirements, room blocks, and deterministic lexical tie breaking apply',()=>{
 const r=book({...base,blocks:[{room_id:'A',start:'2024-01-02T09:00:00Z',end:'2024-01-02T10:00:00Z'}],meetings:[
  m('pre','2024-01-02T08:00',30,3,['B']),m('dep','2024-01-02T08:30',30,4,['B'],[],['pre']),
  m('x','2024-01-02T09:00',30,7,['A']),m('a','2024-01-02T11:00',30,1,['B']),m('b','2024-01-02T11:00',30,1,['B'])]});
 assert.equal(r.value,8); assert.deepEqual(r.bookings.map(x=>x.meeting_id),['a','dep','pre']);
});
test('DST either offers both occurrences and range can select the later one',()=>{
 const r=book({...base,range_start:'2024-11-03T06:00:00Z',range_end:'2024-11-03T07:00:00Z',meetings:[m('fold','2024-11-03T01:30',20,5,['A'],[],[],'America/New_York','either')]});
 assert.deepEqual(r.bookings,[{meeting_id:'fold',room_id:'A',start:'2024-11-03T06:30:00.000Z',end:'2024-11-03T06:50:00.000Z'}]);
});
