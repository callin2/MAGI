import test from 'node:test';
import assert from 'node:assert/strict';
import {book} from './solution.mjs';
const m=(id,time,extra={})=>({id,zone:'UTC',local_start:`2024-01-07T${time}`,minutes:30,value:1,eligible_rooms:['a'],people:[],requires:[],fold:'either',...extra});
const input=(meetings,extra={})=>({range_start:'2024-01-07T00:00Z',range_end:'2024-01-08T00:00Z',rooms:['a','b','c'],transitions:{a:{a:0,b:0,c:0},b:{a:0,b:0,c:0},c:{a:0,b:0,c:0}},blocks:[],meetings,...extra});
const ids=r=>r.bookings.map(x=>x.meeting_id);
test('global objective beats greedy; count and ASCII tie breaks',()=>{
 assert.deepEqual(ids(book(input([m('big','09:00',{minutes:60,value:5}),m('left','09:00',{value:3}),m('right','09:30',{value:3})]))),['left','right']);
 assert.equal(book(input([m('big','09:00',{minutes:60,value:2}),m('left','09:00'),m('right','09:30')])).count,2);
 const r=book(input([m('z','09:00'),m('Z','09:00',{eligible_rooms:['b','a']})]));
 assert.equal(r.count,2); assert.equal(r.bookings[0].meeting_id,'Z'); assert.equal(r.bookings[0].room_id,'b');
 assert.deepEqual(ids(book(input([m('z','09:00'),m('Z','09:00')]))),['Z']);
});
test('directed setup, equality, and nonmetric intermediate repair',()=>{
 const transitions={a:{a:0,b:5,c:100},b:{a:50,b:0,c:5},c:{a:50,b:50,c:0}};
 const a=m('A','09:00',{people:['p']});
 const c=m('B','10:10',{people:['p'],eligible_rooms:['c']});
 const b=m('Z','09:35',{people:['p'],eligible_rooms:['b']});
 assert.equal(book(input([a,c],{transitions})).count,1);
 assert.equal(book(input([a,c,b],{transitions})).count,3);
 assert.equal(book(input([a,{...b,local_start:'2024-01-07T09:34'}],{transitions})).count,1);
});
test('dependencies in either ID order, omitted prerequisites and timing',()=>{
 assert.equal(book(input([m('A','10:00',{requires:['Z']}),m('Z','09:30')])).count,2);
 assert.equal(book(input([m('A','09:00',{requires:['Z'],value:10}),m('Z','09:30')])).value,1);
 assert.equal(book(input([m('Z','10:00',{requires:['A'],value:10}),m('A','09:00',{eligible_rooms:[]})])).count,0);
});
test('blocks only affect their room; half-open range and busy boundaries',()=>{
 const blocks=[{room_id:'a',start:'2024-01-07T08:00Z',end:'2024-01-07T09:00Z'},{room_id:'a',start:'2024-01-07T09:30Z',end:'2024-01-07T10:00Z'}];
 assert.equal(book(input([m('x','09:00')],{blocks,range_end:'2024-01-07T09:30Z'})).count,1);
 assert.equal(book(input([m('x','09:01')],{blocks})).count,0);
 assert.equal(book(input([m('x','09:01',{eligible_rooms:['b']})],{blocks})).count,1);
});
function zoned(zone,local_start,fold='either',extra={}) {
 return input([m('x','00:00',{zone,local_start,fold,...extra})],{range_start:local_start.slice(0,10)+'T00:00Z',range_end:new Date(Date.parse(local_start.slice(0,10)+'T00:00Z')+86400000).toISOString()});
}
test('fold alternatives are exclusive and fold choice precedes filtering',()=>{
 let a=zoned('America/New_York','2024-11-03T01:30');
 assert.equal(book(a).count,1); assert.equal(book(a).bookings[0].start,'2024-11-03T05:30:00.000Z');
 a.meetings[0].fold='later'; assert.equal(book(a).bookings[0].start,'2024-11-03T06:30:00.000Z');
 a.meetings[0].fold='earlier'; a.range_start='2024-11-03T06:00Z'; assert.equal(book(a).count,0);
 a.meetings[0].fold='either'; assert.equal(book(a).count,1);
 a=zoned('America/New_York','2024-11-03T01:30','earlier',{minutes:120});
 assert.equal(book(a).bookings[0].end,'2024-11-03T07:30:00.000Z');
});
test('gaps, Berlin fold, Lord Howe half-hour fold, Kathmandu fractional offset',()=>{
 for(const [z,t] of [['America/New_York','2024-03-10T02:30'],['Europe/Berlin','2025-03-30T02:30'],['Australia/Lord_Howe','2024-10-06T02:15']]) assert.equal(book(zoned(z,t)).count,0);
 let a=zoned('Europe/Berlin','2024-10-27T02:30','later');
 assert.equal(book(a).bookings[0].start,'2024-10-27T01:30:00.000Z');
 a=zoned('Australia/Lord_Howe','2024-04-07T01:45'); a.range_start='2024-04-06T00:00Z';
 assert.equal(book(a).bookings[0].start,'2024-04-06T14:45:00.000Z');
 a.meetings[0].fold='later'; assert.equal(book(a).bookings[0].start,'2024-04-06T15:15:00.000Z');
 a=zoned('Asia/Kathmandu','2026-01-07T10:00'); assert.equal(book(a).bookings[0].start,'2026-01-07T04:15:00.000Z');
});
test('preserves recursively frozen input; zero-value meetings improve count',()=>{
 const a=input([m('x','09:00',{value:0,eligible_rooms:['b','a']})]);
 const before=JSON.stringify(a);
 function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}} freeze(a);
 assert.equal(book(a).count,1); assert.equal(book(a).bookings[0].room_id,'a'); assert.equal(JSON.stringify(a),before);
});
