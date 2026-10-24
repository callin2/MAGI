import test from 'node:test';
import assert from 'node:assert/strict';
import {book} from './solution.mjs';
const meeting = (id, time, value = 1, extra = {}) => ({id,zone:'UTC',local_start:`2024-01-07T${time}`,minutes:30,value,eligible_rooms:['a'],people:[],requires:[],fold:'earlier',...extra});
const input = (meetings, extra = {}) => ({range_start:'2024-01-07T00:00Z',range_end:'2024-01-08T00:00Z',rooms:['a','b','c'],transitions:{a:{a:0,b:0,c:0},b:{a:0,b:0,c:0},c:{a:0,b:0,c:0}},meetings,blocks:[],...extra});
test('global value, count tie, ASCII room tie and preservation', () => {
 const a=input([meeting('long','09:00',9,{minutes:90}),meeting('short1','09:00',5),meeting('short2','10:00',5),meeting('zero','12:00',0,{eligible_rooms:['a','Z']})]);
 const before=JSON.stringify(a); const r=book(a);
 assert.equal(r.value,10); assert.equal(r.count,3); assert.deepEqual(r.bookings.map(b=>b.meeting_id),['short1','short2','zero']);
 assert.equal(r.bookings[2].room_id,'Z'); assert.equal(JSON.stringify(a),before);
});
test('directed setup and nonmetric intermediate rescue despite assignment order', () => {
 const a=input([meeting('a','09:00',5,{people:['p']}),meeting('b','10:00',5,{people:['p'],eligible_rooms:['c']}),meeting('z','09:30',0,{people:['p'],eligible_rooms:['b']})]);
 a.transitions.a.c=60;
 assert.equal(book(a).count,3);
 a.meetings.pop(); assert.equal(book(a).count,1);
 a.meetings[0].people=[]; assert.equal(book(a).count,2);
});
test('prerequisites require selection and elapsed precedence; blocks are room only',()=>{
 const a=input([meeting('a','10:00',0),meeting('b','09:00',20,{requires:['a']}),meeting('c','10:30',3,{requires:['a']})]);
 assert.deepEqual(book(a).bookings.map(b=>b.meeting_id),['a','c']);
 a.blocks=[{room_id:'a',start:'2024-01-07T10:00Z',end:'2024-01-07T10:30Z'}];
 assert.equal(book(a).count,0);
});
test('folds, gaps, non-hour offsets and elapsed durations',()=>{
 const run=(zone,local_start,fold='either')=>book(input([meeting('x','00:00',1,{zone,local_start,fold,minutes:60})],{range_start:'2024-01-01T00:00Z',range_end:'2027-01-01T00:00Z'}));
 assert.equal(run('America/New_York','2024-03-10T02:30').count,0);
 assert.equal(run('Europe/Berlin','2025-03-30T02:30').count,0);
 assert.equal(run('Australia/Lord_Howe','2024-10-06T02:15').count,0);
 assert.equal(run('America/New_York','2024-11-03T01:30').bookings[0].start,'2024-11-03T05:30:00.000Z');
 assert.equal(run('America/New_York','2024-11-03T01:30','later').bookings[0].end,'2024-11-03T07:30:00.000Z');
 assert.equal(run('Europe/Berlin','2026-10-25T02:30','later').bookings[0].start,'2026-10-25T01:30:00.000Z');
 assert.equal(run('Australia/Lord_Howe','2024-04-07T01:45','later').bookings[0].start,'2024-04-06T15:15:00.000Z');
 assert.equal(run('Asia/Kathmandu','2025-01-07T09:00').bookings[0].start,'2025-01-07T03:15:00.000Z');
});
test('either fold can choose later to avoid a block, but only one occurrence',()=>{
 const a=input([meeting('x','00:00',3,{zone:'America/New_York',local_start:'2024-11-03T01:30',fold:'either'})],{range_start:'2024-11-03T04:00Z',range_end:'2024-11-03T08:00Z',blocks:[{room_id:'a',start:'2024-11-03T05:30Z',end:'2024-11-03T06:00Z'}]});
 assert.equal(book(a).count,1); assert.equal(book(a).bookings[0].start,'2024-11-03T06:30:00.000Z');
});
// Independent exhaustive leaf-only oracle exercises pruning with nonmetric setup.
test('seeded exhaustive oracle (100 small global assignments)',()=>{
 let seed=194; const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let trial=0;trial<100;trial++){
  const a=input(Array.from({length:5},(_,i)=>meeting(String.fromCharCode(65+i),`${String(9+rand(3)).padStart(2,'0')}:${rand(2)?'30':'00'}`,rand(5),{eligible_rooms:rand(2)?['a','b']:['b'],people:rand(2)?['p']:[],requires:i&&rand(3)===0?[String.fromCharCode(64+i)]:[]})));
  a.transitions.a.b=rand(4)*30; a.transitions.b.a=rand(4)*30;
  let best={value:0,count:0,bookings:[]}; const picked=[];
  const key=r=>JSON.stringify(r.bookings.map(b=>[b.meeting_id,b.room_id,b.start,b.end]));
  function walk(i){
   if(i<5){walk(i+1); const m=a.meetings[i];for(const room of m.eligible_rooms){const start=Date.parse(m.local_start+':00Z');picked.push({i,room,start,end:start+m.minutes*60000});walk(i+1);picked.pop();}return;}
   for(const x of picked){for(const id of a.meetings[x.i].requires){const y=picked.find(y=>a.meetings[y.i].id===id);if(!y||y.end>x.start)return;}}
   for(const x of picked)for(const y of picked)if(x.i<y.i&&(x.room===y.room||(a.meetings[x.i].people.length&&a.meetings[y.i].people.length))&&x.start<y.end&&y.start<x.end)return;
   const p=picked.filter(x=>a.meetings[x.i].people.length).sort((x,y)=>x.start-y.start);
   for(let j=1;j<p.length;j++)if(p[j].start<p[j-1].end+a.transitions[p[j-1].room][p[j].room]*60000)return;
   const r={value:picked.reduce((s,x)=>s+a.meetings[x.i].value,0),count:picked.length,bookings:picked.map(x=>({meeting_id:a.meetings[x.i].id,room_id:x.room,start:new Date(x.start).toISOString(),end:new Date(x.end).toISOString()}))};
   if(r.value>best.value||(r.value===best.value&&(r.count>best.count||(r.count===best.count&&key(r)<key(best)))))best=r;
  }
  walk(0);assert.deepEqual(book(a),best,`trial ${trial}`);
 }
});
