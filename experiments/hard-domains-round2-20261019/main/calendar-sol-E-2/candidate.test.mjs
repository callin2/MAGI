import test from 'node:test';
import assert from 'node:assert/strict';
import {book} from './solution.mjs';
const m = (id, time, value = 1, extra = {}) => ({id, zone:'UTC', local_start:`2024-01-07T${time}`, minutes:30, value, eligible_rooms:['a'], people:[], requires:[], fold:'earlier', ...extra});
const query = (meetings, extra = {}) => ({range_start:'2024-01-07T00:00Z', range_end:'2024-01-08T00:00Z', rooms:['a','b','c'], transitions:{a:{a:0,b:0,c:0},b:{a:0,b:0,c:0},c:{a:0,b:0,c:0}}, meetings, blocks:[], ...extra});
const ids = x => x.bookings.map(b => b.meeting_id);
test('global value beats greedy, and count breaks value ties', () => {
  assert.deepEqual(ids(book(query([m('A','09:00',9,{minutes:60}),m('B','09:00',5),m('C','09:30',5)]))), ['B','C']);
  assert.deepEqual(ids(book(query([m('A','09:00',10,{minutes:60}),m('B','09:00',5),m('C','09:30',5)]))), ['B','C']);
});
test('ASCII ordering and global room reassignment; frozen inputs', () => {
  const q = query([m('a','09:00',1,{eligible_rooms:['b','a']}),m('Z','09:00')]);
  function freeze(o) { if (o && typeof o === 'object') {Object.values(o).forEach(freeze);Object.freeze(o);} }
  freeze(q);
  assert.deepEqual(book(q).bookings.map(b => [b.meeting_id,b.room_id]), [['Z','a'],['a','b']]);
});
test('directed setup only on consecutive person meetings; intermediate can repair edge', () => {
  const meetings = [m('A','09:00',5,{people:['p']}),m('B','11:00',5,{eligible_rooms:['b'],people:['p']}),m('Z','10:00',0,{eligible_rooms:['c'],people:['p']})];
  const q = query(meetings); q.transitions.a.b = 120;
  assert.deepEqual(ids(book(q)), ['A','B','Z']);
  assert.equal(book({...q,meetings:meetings.slice(0,2)}).count,1);
  q.transitions.a.b = 90;
  assert.equal(book({...q,meetings:meetings.slice(0,2)}).count,2);
});
test('dependencies require presence and chronological completion, including transitive chains', () => {
  assert.deepEqual(ids(book(query([m('A','10:00',20,{requires:['Z']}),m('Z','09:30',0)]))), ['A','Z']);
  assert.equal(book(query([m('A','09:00',20,{requires:['Z']}),m('Z','09:30',0)])).value,0);
  assert.equal(book(query([m('A','10:00',20,{requires:['B']}),m('B','09:30',0,{requires:['C']}),m('C','09:00',0)])).count,3);
});
test('blocks use absolute offsets, half-open intervals, whole range containment', () => {
  const q = query([m('A','09:00'),m('B','09:30'),m('C','10:00')],{range_start:'2024-01-07T09:00Z',range_end:'2024-01-07T10:00Z', blocks:[{room_id:'a',start:'2024-01-07T10:30+01:00',end:'2024-01-07T11:00+01:00'}]});
  assert.deepEqual(ids(book(q)),['A']);
});
function zoned(zone, local, fold='either', extra={}) {
  return query([m('M','09:00',1,{zone,local_start:local,fold,...extra})],{range_start:local.slice(0,10)+'T00:00Z',range_end:new Date(Date.parse(local.slice(0,10)+'T00:00Z')+86400000).toISOString()});
}
test('folds resolve before range/block filtering; either is one occurrence', () => {
  for (const [zone,local,early,late] of [
    ['America/New_York','2024-11-03T01:30','2024-11-03T05:30:00.000Z','2024-11-03T06:30:00.000Z'],
    ['Europe/Berlin','2025-10-26T02:30','2025-10-26T00:30:00.000Z','2025-10-26T01:30:00.000Z'],
    ['Australia/Lord_Howe','2026-04-05T01:45','2026-04-04T14:45:00.000Z','2026-04-04T15:15:00.000Z']]) {
    const q = zoned(zone,local); q.range_start = new Date(Date.parse(early)-3600000).toISOString(); q.range_end = new Date(Date.parse(late)+7200000).toISOString();
    assert.equal(book(q).count,1); assert.equal(book(q).bookings[0].start,early);
    q.meetings[0].fold='later'; assert.equal(book(q).bookings[0].start,late);
    q.meetings[0].fold='earlier'; q.range_start=late; assert.equal(book(q).count,0);
    q.meetings[0].fold='either'; assert.equal(book(q).bookings[0].start,late);
  }
});
test('nonexistent starts and Kathmandu fractional offset; elapsed fold duration', () => {
  for (const [zone,local] of [['America/New_York','2024-03-10T02:30'],['Europe/Berlin','2025-03-30T02:30'],['Australia/Lord_Howe','2026-10-04T02:15']]) assert.equal(book(zoned(zone,local)).count,0);
  assert.equal(book(zoned('Asia/Kathmandu','2024-01-07T09:00')).bookings[0].start,'2024-01-07T03:15:00.000Z');
  const b = book(zoned('America/New_York','2024-11-03T01:30','earlier',{minutes:120})).bookings[0];
  assert.equal(b.end,'2024-11-03T07:30:00.000Z');
});
test('deterministic exhaustive UTC oracle: room assignment, people, prerequisites, setup', () => {
  let seed=812;
  const rand = n => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let trial=0;trial<60;trial++) {
    const meetings=Array.from({length:6},(_,i)=>m(String(i),`${String(9+rand(3)).padStart(2,'0')}:${rand(2)?'30':'00'}`,rand(6),{minutes:rand(2)?30:60,eligible_rooms:rand(2)?['a','b']:['a'],people:rand(2)?['p']:[],requires:i && rand(3)===0?[String(rand(i))]:[]}));
    const q=query(meetings);q.transitions.a.b=rand(5)*30;q.transitions.b.a=rand(5)*30;
    let best={value:0,count:0,bookings:[]}; const sel=[];
    const key=bs=>JSON.stringify(bs.map(b=>[b.meeting_id,b.room_id,b.start,b.end]));
    function enumerate(i) {
      if(i<meetings.length) {
        enumerate(i+1);
        const x=meetings[i],s=Date.parse(x.local_start+'Z'),e=s+x.minutes*60000;
        for(const r of x.eligible_rooms){sel.push({i,s,e,r});enumerate(i+1);sel.pop();} return;
      }
      for(const a of sel) {
        if(meetings[a.i].requires.some(id=>!sel.some(b=>String(b.i)===id && b.e<=a.s)))return;
        for(const b of sel) if(a.i<b.i && (a.r===b.r || (meetings[a.i].people.length && meetings[b.i].people.length)) && a.s<b.e && b.s<a.e)return;
      }
      const ps=sel.filter(x=>meetings[x.i].people.length).sort((a,b)=>a.s-b.s);
      for(let j=1;j<ps.length;j++)if(ps[j].s<ps[j-1].e+q.transitions[ps[j-1].r][ps[j].r]*60000)return;
      const value=sel.reduce((v,x)=>v+meetings[x.i].value,0),count=sel.length;
      const bookings=sel.map(x=>({meeting_id:String(x.i),room_id:x.r,start:new Date(x.s).toISOString(),end:new Date(x.e).toISOString()}));
      if(value>best.value || value===best.value && (count>best.count || count===best.count && key(bookings)<key(best.bookings)))best={value,count,bookings};
    }
    enumerate(0);assert.deepEqual(book(q),best,`trial ${trial}`);
  }
});
