import test from 'node:test';
import assert from 'node:assert/strict';
import {book} from './solution.mjs';
const meeting = (id, time, extra = {}) => ({id, zone:'UTC', local_start:`2024-01-07T${time}`, minutes:30, value:1, eligible_rooms:['a'], people:[], requires:[], fold:'either', ...extra});
const input = (meetings, extra = {}) => ({range_start:'2024-01-07T00:00Z', range_end:'2024-01-08T00:00Z', rooms:['a','b','c'], transitions:{a:{a:0,b:0,c:0},b:{a:0,b:0,c:0},c:{a:0,b:0,c:0}},meetings,blocks:[],...extra});
test('global objective beats greedy and zero-value meetings increase count', () => {
  const a=input([meeting('big','09:00',{minutes:120,value:9}),meeting('x','09:00',{value:5}),meeting('y','10:00',{value:5}),meeting('zero','12:00',{value:0})]);
  const copy=structuredClone(a); const r=book(a);
  assert.equal(r.value,10); assert.deepEqual(r.bookings.map(b=>b.meeting_id),['x','y','zero']); assert.deepEqual(a,copy);
});
test('dependencies, room assignment, blocks, half-open endpoints and ASCII ties', () => {
  const a=input([meeting('z','09:30',{requires:['A'],eligible_rooms:['b','a']}),meeting('A','09:00',{eligible_rooms:['b','a']})],{blocks:[{room_id:'a',start:'2024-01-07T09:00Z',end:'2024-01-07T09:30Z'}]});
  assert.deepEqual(book(a).bookings.map(b=>[b.meeting_id,b.room_id]),[['A','b'],['z','a']]);
  a.meetings[0].local_start='2024-01-07T09:15'; assert.equal(book(a).count,1);
});
test('directed setup applies only to immediately consecutive meetings', () => {
  const a=input([meeting('A','09:00',{people:['p'],eligible_rooms:['a']}),meeting('B','09:30',{people:['p'],eligible_rooms:['b']}),meeting('C','10:00',{people:['p'],eligible_rooms:['c']})]);
  a.transitions.a.c=100; assert.equal(book(a).count,3);
  a.meetings.splice(1,1); assert.equal(book(a).count,1);
  a.transitions.a.c=30; assert.equal(book(a).count,2);
  a.transitions.a.c=31; assert.equal(book(a).count,1);
});
test('New York fold gives alternatives but never duplicates; gaps give no option', () => {
  const a=input([meeting('fold','01:30',{local_start:'2024-11-03T01:30',zone:'America/New_York'})],{range_start:'2024-11-03T00:00Z',range_end:'2024-11-04T00:00Z'});
  assert.equal(book(a).bookings[0].start,'2024-11-03T05:30:00.000Z');
  a.meetings[0].fold='later'; assert.equal(book(a).bookings[0].start,'2024-11-03T06:30:00.000Z');
  a.meetings[0].fold='either'; a.blocks=[{room_id:'a',start:'2024-11-03T05:00Z',end:'2024-11-03T06:00Z'}];
  assert.equal(book(a).bookings[0].start,'2024-11-03T06:30:00.000Z'); assert.equal(book(a).count,1);
  a.meetings[0].local_start='2024-03-10T02:30'; a.range_start='2024-03-10T00:00Z'; a.range_end='2024-03-11T00:00Z'; assert.equal(book(a).count,0);
});
test('Berlin, Kathmandu and half-hour Lord Howe transitions', () => {
  for (const [zone,local,fold,expected] of [
    ['Europe/Berlin','2025-10-26T02:30','later','2025-10-26T01:30:00.000Z'],
    ['Asia/Kathmandu','2026-01-02T09:00','either','2026-01-02T03:15:00.000Z'],
    ['Australia/Lord_Howe','2024-04-07T01:45','earlier','2024-04-06T14:45:00.000Z'],
    ['Australia/Lord_Howe','2024-04-07T01:45','later','2024-04-06T15:15:00.000Z']]) {
    const start=Date.parse(expected); const a=input([meeting('m','00:00',{zone,local_start:local,fold})],{range_start:new Date(start-3600000).toISOString(),range_end:new Date(start+3600000).toISOString()});
    assert.equal(book(a).bookings[0].start,expected);
  }
  const a=input([meeting('gap','00:00',{zone:'Australia/Lord_Howe',local_start:'2024-10-06T02:15'})],{range_start:'2024-10-05T00:00Z',range_end:'2024-10-07T00:00Z'});assert.equal(book(a).count,0);
});
test('range bounds use elapsed duration', () => {
 const a=input([meeting('m','01:45',{zone:'America/New_York',local_start:'2024-11-03T01:45',minutes:60,fold:'earlier'})],{range_start:'2024-11-03T05:45Z',range_end:'2024-11-03T06:45Z'});
 assert.equal(book(a).bookings[0].end,'2024-11-03T06:45:00.000Z'); a.range_end='2024-11-03T06:44Z';assert.equal(book(a).count,0);
});
// Independent exhaustive small-instance oracle: checks transitions only after
// constructing the whole schedule, so it exercises the chronological search.
test('seeded exhaustive oracle for global assignments and consecutive setup', () => {
 let seed=12345; const rnd=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let trial=0;trial<60;trial++) {
  const ms=Array.from({length:5},(_,i)=>meeting(String.fromCharCode(65+i),`${String(9+Math.floor(i/3)).padStart(2,'0')}:${String(rnd(4)*15).padStart(2,'0')}`,{minutes:15+rnd(3)*15,value:rnd(5),eligible_rooms:['a','b'],people:rnd(2)?['p']:[],requires:i&&rnd(4)===0?['A']:[]}));
  const a=input(ms);a.transitions.a.b=rnd(4)*15;a.transitions.b.a=rnd(4)*15;
  let best={value:0,count:0,bookings:[]}; const selected=[];
  function visit(i) {
   if(i<ms.length){visit(i+1);for(const room of ms[i].eligible_rooms){const s=Date.parse(ms[i].local_start+'Z');selected.push({i,room,s,e:s+ms[i].minutes*60000});visit(i+1);selected.pop();}return;}
   for(const x of selected){for(const id of ms[x.i].requires){const req=selected.find(y=>ms[y.i].id===id);if(!req||req.e>x.s)return;}for(const y of selected)if(x!==y&&(x.room===y.room||ms[x.i].people.some(p=>ms[y.i].people.includes(p)))&&x.s<y.e&&y.s<x.e)return;}
   const ps=selected.filter(x=>ms[x.i].people.includes('p')).sort((x,y)=>x.s-y.s);for(let j=1;j<ps.length;j++)if(ps[j].s<ps[j-1].e+a.transitions[ps[j-1].room][ps[j].room]*60000)return;
   const r={value:selected.reduce((v,x)=>v+ms[x.i].value,0),count:selected.length,bookings:selected.map(x=>({meeting_id:ms[x.i].id,room_id:x.room,start:new Date(x.s).toISOString(),end:new Date(x.e).toISOString()}))};
   if(r.value>best.value||r.value===best.value&&(r.count>best.count||r.count===best.count&&JSON.stringify(r.bookings)<JSON.stringify(best.bookings)))best=r;
  }
  visit(0);assert.deepEqual(book(a),best,`trial ${trial}`);
 }
});
