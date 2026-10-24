import test from 'node:test';
import assert from 'node:assert/strict';
import {book} from './solution.mjs';
const meeting = (id, time, extra={}) => ({id,zone:'UTC',local_start:`2024-01-07T${time}`,minutes:30,value:1,eligible_rooms:['a'],people:[],requires:[],fold:'earlier',...extra});
const input = (meetings, extra={}) => ({range_start:'2024-01-07T00:00Z',range_end:'2024-01-08T00:00Z',rooms:['a','b','c'],transitions:{a:{a:0,b:0,c:0},b:{a:0,b:0,c:0},c:{a:0,b:0,c:0}},meetings,blocks:[],...extra});
test('global optimum beats a locally valuable long meeting; inputs preserved',()=>{
 const a=input([meeting('A','09:00',{minutes:90,value:9}),meeting('B','09:00',{value:6}),meeting('C','09:30',{value:6})]);
 const before=structuredClone(a); const r=book(a);
 assert.equal(r.value,12); assert.deepEqual(r.bookings.map(b=>b.meeting_id),['B','C']); assert.deepEqual(a,before);
});
test('room assignment, count and code-unit tie breaking',()=>{
 const a=input([meeting('a','09:00',{eligible_rooms:['b','a'],value:0}),meeting('Z','09:00',{eligible_rooms:['b','a'],value:0})]);
 assert.deepEqual(book(a).bookings.map(b=>[b.meeting_id,b.room_id]),[['Z','a'],['a','b']]);
});
test('directed setup and a nonmetric intermediate meeting (ID order differs from time)',()=>{
 const transitions={a:{a:0,b:90,c:0},b:{a:0,b:0,c:0},c:{a:0,b:0,c:0}};
 const first=meeting('A','09:00',{people:['p']}), last=meeting('B','10:00',{eligible_rooms:['b'],people:['p']});
 assert.equal(book(input([first,last],{transitions})).count,1);
 const middle=meeting('Z','09:30',{eligible_rooms:['c'],people:['p'],value:0});
 assert.equal(book(input([first,last,middle],{transitions})).count,3);
 // Direction b -> a has no setup.
 assert.equal(book(input([ {...first,eligible_rooms:['b']}, {...last,eligible_rooms:['a']} ],{transitions})).count,2);
});
test('dependencies, elapsed end constraint, room-only blocks and range',()=>{
 const a=input([meeting('a','09:00',{value:0}),meeting('b','09:30',{requires:['a'],value:10,people:['p']})],{blocks:[{room_id:'a',start:'2024-01-07T08:00Z',end:'2024-01-07T09:00Z'}]});
 assert.equal(book(a).count,2);
 a.blocks[0].end='2024-01-07T09:01Z'; assert.equal(book(a).count,0);
 a.blocks=[]; a.meetings[0].minutes=31; assert.equal(book(a).value,0);
 a.meetings[0].minutes=30; a.range_end='2024-01-07T09:59Z'; assert.equal(book(a).count,1);
});
test('DST folds, gaps, non-hour offsets, elapsed duration and one occurrence',()=>{
 function run(zone,local_start,fold='either',minutes=30) {
  return book(input([meeting('x','09:00',{zone,local_start,fold,minutes})],{range_start:'2024-01-01T00:00Z',range_end:'2027-01-01T00:00Z'}));
 }
 assert.equal(run('America/New_York','2024-03-10T02:30').count,0);
 assert.equal(run('Europe/Berlin','2025-03-30T02:30').count,0);
 assert.equal(run('Australia/Lord_Howe','2024-10-06T02:15').count,0);
 assert.equal(run('America/New_York','2024-11-03T01:30').bookings[0].start,'2024-11-03T05:30:00.000Z');
 assert.equal(run('America/New_York','2024-11-03T01:30','later',120).bookings[0].end,'2024-11-03T08:30:00.000Z');
 assert.equal(run('Europe/Berlin','2026-10-25T02:30','later').bookings[0].start,'2026-10-25T01:30:00.000Z');
 assert.equal(run('Australia/Lord_Howe','2024-04-07T01:45','later').bookings[0].start,'2024-04-06T15:15:00.000Z');
 assert.equal(run('Asia/Kathmandu','2025-01-01T09:00').bookings[0].start,'2025-01-01T03:15:00.000Z');
 const a=input([meeting('x','09:00',{zone:'America/New_York',local_start:'2024-11-03T01:30',fold:'either'})],{range_start:'2024-11-03T00:00Z',range_end:'2024-11-04T00:00Z',blocks:[{room_id:'a',start:'2024-11-03T05:30Z',end:'2024-11-03T06:00Z'}]});
 assert.equal(book(a).bookings[0].start,'2024-11-03T06:30:00.000Z'); assert.equal(book(a).count,1);
});
// Independent exhaustive leaf validator: intentionally never prunes transition
// pairs, since adding an intermediate meeting can make an invalid pair legal.
function oracle(a) {
 const choices=a.meetings.map(m=>[null,...m.eligible_rooms.map(room_id=>({meeting_id:m.id,room_id,start:new Date(m.local_start+'Z').toISOString(),end:new Date(Date.parse(m.local_start+'Z')+m.minutes*60000).toISOString()}))]);
 let best={value:0,count:0,bookings:[]}; const selected=[];
 const cmp=(x,y)=>x<y?-1:x>y?1:0;
 const lex=bs=>JSON.stringify(bs.map(b=>[b.meeting_id,b.room_id,b.start,b.end]));
 function check(i) {
  if(i<choices.length) {for(const c of choices[i]) {selected[i]=c;check(i+1);}return;}
  const bs=selected.filter(Boolean); const meta=b=>a.meetings.find(m=>m.id===b.meeting_id);
  const overlap=(x,y)=>x.start<y.end&&y.start<x.end;
  for(const b of bs) {
   if(Date.parse(b.start)<Date.parse(a.range_start)||Date.parse(b.end)>Date.parse(a.range_end))return;
   if(a.blocks.some(x=>x.room_id===b.room_id&&Date.parse(x.start)<Date.parse(b.end)&&Date.parse(b.start)<Date.parse(x.end)))return;
   for(const r of meta(b).requires)if(!bs.some(x=>x.meeting_id===r&&x.end<=b.start))return;
  }
  for(let j=0;j<bs.length;j++)for(let k=0;k<j;k++)if(overlap(bs[j],bs[k])&&(bs[j].room_id===bs[k].room_id||meta(bs[j]).people.some(p=>meta(bs[k]).people.includes(p))))return;
  for(const p of new Set(a.meetings.flatMap(m=>m.people))) {
   const list=bs.filter(b=>meta(b).people.includes(p)).sort((x,y)=>cmp(x.start,y.start));
   for(let j=1;j<list.length;j++)if(Date.parse(list[j].start)<Date.parse(list[j-1].end)+a.transitions[list[j-1].room_id][list[j].room_id]*60000)return;
  }
  const value=bs.reduce((s,b)=>s+meta(b).value,0),count=bs.length;
  bs.sort((x,y)=>cmp(x.meeting_id,y.meeting_id));
  if(value>best.value||(value===best.value&&(count>best.count||(count===best.count&&lex(bs)<lex(best.bookings)))))best={value,count,bookings:bs};
 }
 check(0); return best;
}
test('deterministic random global assignments match exhaustive oracle',()=>{
 let seed=743; const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let trial=0;trial<100;trial++) {
  const ms=Array.from({length:6},(_,i)=>meeting(String.fromCharCode(65+i),`09:${String(rand(4)*15).padStart(2,'0')}`,{minutes:15+15*rand(3),value:rand(6),eligible_rooms:rand(2)?['b','a']:['a'],people:rand(2)?['p']:[],requires:i&&rand(4)===0?[String.fromCharCode(65+rand(i))]:[]}));
  const a=input(ms);a.transitions.a.b=rand(4)*15;a.transitions.b.a=rand(4)*15;
  if(rand(2))a.blocks=[{room_id:'a',start:'2024-01-07T09:15Z',end:'2024-01-07T09:30Z'}];
  assert.deepEqual(book(a),oracle(a),`trial ${trial}`);
 }
});
