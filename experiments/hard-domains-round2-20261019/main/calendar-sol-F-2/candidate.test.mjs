import test from 'node:test';
import assert from 'node:assert/strict';
import { book } from './solution.mjs';
const m = (id, time, minutes = 30, value = 1, extra = {}) => ({id, zone:'UTC', local_start:`2024-01-07T${time}`, minutes, value, eligible_rooms:['a'], people:[], requires:[], fold:'either', ...extra});
const input = (meetings, extra = {}) => ({range_start:'2024-01-07T00:00Z', range_end:'2024-01-08T00:00Z', rooms:['a','b','c'], transitions:{a:{a:0,b:0,c:0},b:{a:0,b:0,c:0},c:{a:0,b:0,c:0}}, meetings, blocks:[], ...extra});
test('global value, count and ASCII ties; no mutation', () => {
  const a = input([m('long','09:00',60,9),m('short1','09:00',30,5),m('short2','09:30',30,5)]);
  const copy = structuredClone(a);
  assert.deepEqual(book(a).bookings.map(b=>b.meeting_id), ['short1','short2']);
  assert.deepEqual(a,copy);
  assert.equal(book(input([m('Z','09:00'),m('a','09:00')])).bookings[0].meeting_id,'Z');
  assert.equal(book(input([m('x','09:00',30,0,{eligible_rooms:['b','a']})])).bookings[0].room_id,'a');
  assert.equal(book(input([m('long','09:00',60,2),m('one','09:00'),m('two','09:30')])).count,2);
});
test('dependencies in either ID order and end boundary', () => {
  const a = input([m('a','10:00',30,10,{requires:['z']}),m('z','09:30',30,0)]);
  assert.equal(book(a).count,2);
  a.meetings[1].minutes=31;
  assert.equal(book(a).value,0);
  assert.equal(book(input([m('a','10:00',30,0),m('z','09:00',30,10,{requires:['a']})])).value,0);
});
test('room blocks are occupancy only and range uses elapsed intervals', () => {
  const a = input([m('x','09:00',30,3,{eligible_rooms:['a','b']}),m('y','09:30')],{
    blocks:[{room_id:'a',start:'2024-01-07T09:00Z',end:'2024-01-07T09:30Z'}]});
  assert.deepEqual(book(a).bookings.map(b=>b.room_id),['b','a']);
  a.range_end='2024-01-07T09:45Z';
  assert.equal(book(a).count,1);
});
test('directed setup only on final consecutive meetings, intermediate can repair', () => {
  const meetings=[m('A','09:00',10,5,{people:['p'],eligible_rooms:['a']}),
    m('C','09:40',10,5,{people:['p'],eligible_rooms:['c']}),
    m('Z','09:20',10,0,{people:['p'],eligible_rooms:['b']})];
  const a=input(meetings);
  a.transitions.a.c=60;
  assert.equal(book(a).count,3);
  a.meetings=a.meetings.slice(0,2);
  assert.equal(book(a).count,1);
  a.transitions.a.c=30;
  assert.equal(book(a).count,2);
  a.transitions.a.c=31;
  assert.equal(book(a).count,1);
});
test('people conflict across rooms, unrelated people need no setup', () => {
  const a=input([m('a','09:00',30,2,{people:['p']}),m('b','09:10',30,1,{people:['p'],eligible_rooms:['b']})]);
  assert.equal(book(a).count,1);
  a.meetings[1].people=['q']; a.transitions.a.b=1000;
  assert.equal(book(a).count,2);
});
function zoned(zone, local_start, fold='either', extra={}) {
  return input([m('x','00:00',30,1,{zone,local_start,fold,...extra})],{range_start:'2024-01-01T00:00Z',range_end:'2026-12-31T23:59Z'});
}
test('NY gap and folds; either is one meeting, room block may choose later', () => {
  assert.equal(book(zoned('America/New_York','2024-03-10T02:30')).count,0);
  for(const [fold,hour] of [['earlier','05'],['later','06'],['either','05']]) {
    const r=book(zoned('America/New_York','2024-11-03T01:30',fold));
    assert.equal(r.count,1); assert.equal(r.bookings[0].start,`2024-11-03T${hour}:30:00.000Z`);
  }
  const a=zoned('America/New_York','2024-11-03T01:30');
  a.blocks=[{room_id:'a',start:'2024-11-03T05:30Z',end:'2024-11-03T06:00Z'}];
  assert.equal(book(a).bookings[0].start,'2024-11-03T06:30:00.000Z');
});
test('Berlin, Kathmandu, Lord Howe half-hour fold and gap; elapsed duration', () => {
  assert.equal(book(zoned('Europe/Berlin','2025-03-30T02:30')).count,0);
  assert.equal(book(zoned('Europe/Berlin','2025-10-26T02:30','later')).bookings[0].start,'2025-10-26T01:30:00.000Z');
  assert.equal(book(zoned('Asia/Kathmandu','2026-01-02T00:15')).bookings[0].start,'2026-01-01T18:30:00.000Z');
  assert.equal(book(zoned('Australia/Lord_Howe','2024-10-06T02:15')).count,0);
  assert.equal(book(zoned('Australia/Lord_Howe','2024-04-07T01:45','earlier')).bookings[0].start,'2024-04-06T14:45:00.000Z');
  const r=book(zoned('Australia/Lord_Howe','2024-04-07T01:45','later',{minutes:120}));
  assert.equal(r.bookings[0].start,'2024-04-06T15:15:00.000Z');
  assert.equal(r.bookings[0].end,'2024-04-06T17:15:00.000Z');
});
// Independent small exhaustive oracle: validate complete schedules, including
// prerequisites and adjacency, without any partial-search pruning.
function oracle(a) {
  let best={value:0,count:0,bookings:[]};
  const selected=[];
  const key = r => r.bookings.map(b=>[b.meeting_id,b.room_id,b.start,b.end].join('|')).join('\n');
  function visit(i) {
    if(i<a.meetings.length) {
      visit(i+1);
      const m=a.meetings[i], start=Date.parse(m.local_start+'Z'), end=start+m.minutes*60000;
      for(const room of m.eligible_rooms) {selected.push({m,room,start,end});visit(i+1);selected.pop();}
      return;
    }
    for(const x of selected) {
      if(x.m.requires.some(id=>!selected.some(y=>y.m.id===id && y.end<=x.start)))return;
      if(a.blocks.some(b=>b.room_id===x.room&&Date.parse(b.start)<x.end&&x.start<Date.parse(b.end)))return;
      for(const y of selected) if(x!==y && x.start<y.end && y.start<x.end && (x.room===y.room||x.m.people.some(p=>y.m.people.includes(p))))return;
    }
    for(const p of new Set(selected.flatMap(x=>x.m.people))) {
      const line=selected.filter(x=>x.m.people.includes(p)).sort((x,y)=>x.start-y.start);
      for(let j=1;j<line.length;j++) if(line[j].start<line[j-1].end+a.transitions[line[j-1].room][line[j].room]*60000)return;
    }
    const r={value:selected.reduce((s,x)=>s+x.m.value,0),count:selected.length,bookings:selected.map(x=>({meeting_id:x.m.id,room_id:x.room,start:new Date(x.start).toISOString(),end:new Date(x.end).toISOString()})).sort((x,y)=>x.meeting_id<y.meeting_id?-1:1)};
    if(r.value>best.value || r.value===best.value&&(r.count>best.count||r.count===best.count&&key(r)<key(best)))best=r;
  }
  visit(0);return best;
}
test('80 seeded exhaustive differential schedules', () => {
  let seed=1701;
  const rnd=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let trial=0;trial<80;trial++) {
    const ms=Array.from({length:6},(_,i)=>m(String.fromCharCode(70-i),`09:${String(rnd(6)*10).padStart(2,'0')}`,10+rnd(3)*10,rnd(7),{
      eligible_rooms:rnd(2)?['a','b']:['a'],people:rnd(2)?['p']:[],requires:i&&rnd(4)===0?[String.fromCharCode(71-i)]:[] }));
    const a=input(ms);a.transitions.a.b=rnd(4)*10;a.transitions.b.a=rnd(4)*10;
    assert.deepEqual(book(a),oracle(a),`trial ${trial}`);
  }
});
