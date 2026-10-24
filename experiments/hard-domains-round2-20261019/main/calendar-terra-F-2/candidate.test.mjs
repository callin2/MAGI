import test from 'node:test';
import assert from 'node:assert/strict';
import {book} from './solution.mjs';
const base = {range_start:'2024-01-01T00:00:00Z',range_end:'2024-01-03T00:00:00Z',rooms:['A','B'],transitions:{A:{A:0,B:20},B:{A:5,B:0}},blocks:[]};
const m=(id,time,value,room='A',people=[],requires=[])=>({id,zone:'UTC',local_start:time,minutes:30,value,eligible_rooms:[room],people,requires,fold:'either'});
test('globally chooses two modest meetings over one attractive conflict',()=>{
 const big=m('big','2024-01-01T09:00',9); big.minutes=60;
 const r=book({...base,meetings:[big,m('a','2024-01-01T09:00',5),m('b','2024-01-01T09:30',5)]});
 assert.equal(r.value,10); assert.deepEqual(r.bookings.map(x=>x.meeting_id),['a','b']);
});
test('transition setup rejects endpoint-adjacent room change, while same room works',()=>{
 const x=m('x','2024-01-01T09:00',4,'A',['p']);
 const y=m('y','2024-01-01T09:30',8,'B',['p']);
 const z=m('z','2024-01-01T09:30',6,'A',['p']);
 const r=book({...base,meetings:[x,y,z]});
 assert.equal(r.value,10); assert.deepEqual(r.bookings.map(x=>x.meeting_id),['x','z']);
});
test('DST fold either offers alternatives, and a gap local label has no option',()=>{
 const common={...base,range_start:'2024-11-03T00:00:00Z',range_end:'2024-11-04T00:00:00Z',rooms:['A'],transitions:{A:{A:0}}};
 const fold={id:'fold',zone:'America/New_York',local_start:'2024-11-03T01:30',minutes:30,value:2,eligible_rooms:['A'],people:[],requires:[],fold:'either'};
 const gap={id:'gap',zone:'America/New_York',local_start:'2024-03-10T02:30',minutes:30,value:99,eligible_rooms:['A'],people:[],requires:[],fold:'earlier'};
 const r=book({...common,meetings:[fold,gap]});
 assert.equal(r.value,2); assert.equal(r.bookings[0].start,'2024-11-03T05:30:00.000Z');
});
test('requirements, blocks, and lexicographic tie break are honored',()=>{
 const pre=m('pre','2024-01-01T10:00',2), dep=m('dep','2024-01-01T09:00',99,'B',[],['pre']);
 const aa=m('aa','2024-01-01T12:00',3), zz=m('zz','2024-01-01T12:00',3);
 const r=book({...base,blocks:[{room_id:'A',start:'2024-01-01T10:00:00Z',end:'2024-01-01T10:30:00Z'}],meetings:[pre,dep,zz,aa]});
 assert.equal(r.value,3); assert.deepEqual(r.bookings.map(x=>x.meeting_id),['aa']);
});
