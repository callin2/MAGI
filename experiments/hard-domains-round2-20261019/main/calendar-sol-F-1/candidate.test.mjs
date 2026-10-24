import test from 'node:test';
import assert from 'node:assert/strict';
import { book } from './solution.mjs';
const m = (id, local_start, extra = {}) => ({id, local_start: '2024-01-07T' + local_start, zone:'UTC', fold:'either', minutes:30, value:1, eligible_rooms:['a'], people:[], requires:[], ...extra});
function input(meetings, extra={}) {
  return {range_start:'2024-01-07T00:00Z',range_end:'2024-01-08T00:00Z',rooms:['a','b','c'],transitions:{a:{a:0,b:0,c:0},b:{a:0,b:0,c:0},c:{a:0,b:0,c:0}},meetings,blocks:[],...extra};
}
test('global value beats early attractive slot; count breaks value tie',()=>{
  const a=input([m('long','09:00',{minutes:120,value:9}),m('short1','09:00',{value:5}),m('short2','10:00',{value:5})]);
  assert.deepEqual(book(a).bookings.map(b=>b.meeting_id),['short1','short2']);
  a.meetings[0].value=10;
  assert.equal(book(a).count,2);
});
test('directed nonmetric transitions apply only to consecutive selected meetings',()=>{
  const a=input([m('A','09:00',{people:['p']}),m('B','09:30',{people:['p'],eligible_rooms:['b'],value:0}),m('C','10:00',{people:['p'],eligible_rooms:['c']})]);
  a.transitions.a.c=100;
  assert.equal(book(a).count,3);
  a.meetings.splice(1,1);
  assert.equal(book(a).count,1);
  a.transitions.a.c=30;
  assert.equal(book(a).count,2);
  a.transitions.a.c=31;
  assert.equal(book(a).count,1);
});
test('dependencies, people overlap, block endpoints and input preservation',()=>{
  const a=input([m('z','09:00',{eligible_rooms:['b'],people:['p'],value:0}),m('a','09:30',{requires:['z'],people:['p'],value:10}),m('x','09:15',{people:['p'],eligible_rooms:['c'],value:8})],{blocks:[{room_id:'a',start:'2024-01-07T09:00Z',end:'2024-01-07T09:30Z'}]});
  const before=JSON.stringify(a);
  assert.deepEqual(book(a).bookings.map(b=>b.meeting_id),['a','z']);
  assert.equal(JSON.stringify(a),before);
  a.blocks[0].end='2024-01-07T09:31Z';
  assert.deepEqual(book(a).bookings.map(b=>b.meeting_id),['x']);
});
test('ASCII tie order, room assignment is global, range and half-open occupancy',()=>{
  const a=input([m('Z','09:00',{eligible_rooms:['b','a']}),m('a','09:00')]);
  assert.deepEqual(book(a).bookings.map(b=>[b.meeting_id,b.room_id]),[['Z','b'],['a','a']]);
  a.meetings[1].local_start='2024-01-07T09:30';
  assert.deepEqual(book(a).bookings.map(b=>b.room_id),['a','a']);
  a.range_end='2024-01-07T09:59Z';
  assert.deepEqual(book(a).bookings.map(b=>b.meeting_id),['Z']);
});
function zoned(zone,local_start,fold='either') {
  return input([m('one','09:00',{zone,local_start,fold})], {range_start:'2024-01-01T00:00Z',range_end:'2024-12-31T00:00Z'});
}
test('civil fold resolution in New York, Berlin and Lord Howe',()=>{
  for(const [zone,label,early,late] of [
    ['America/New_York','2024-11-03T01:30','2024-11-03T05:30:00.000Z','2024-11-03T06:30:00.000Z'],
    ['Europe/Berlin','2024-10-27T02:30','2024-10-27T00:30:00.000Z','2024-10-27T01:30:00.000Z'],
    ['Australia/Lord_Howe','2024-04-07T01:45','2024-04-06T14:45:00.000Z','2024-04-06T15:15:00.000Z']]) {
    const a=zoned(zone,label); a.range_start=early; a.range_end=new Date(Date.parse(late)+3600000).toISOString();
    assert.equal(book(a).count,1);
    assert.equal(book(a).bookings[0].start,early);
    a.meetings[0].fold='later'; assert.equal(book(a).bookings[0].start,late);
    a.meetings[0].fold='earlier'; assert.equal(book(a).bookings[0].start,early);
    a.meetings[0].fold='either'; a.blocks=[{room_id:'a',start:early,end:new Date(Date.parse(early)+1800000).toISOString()}];
    assert.equal(book(a).bookings[0].start,late);
  }
});
test('nonexistent local labels and quarter-hour offset',()=>{
  for(const [zone,label] of [['America/New_York','2024-03-10T02:30'],['Europe/Berlin','2024-03-31T02:30'],['Australia/Lord_Howe','2024-10-06T02:15']]) {
    const a=zoned(zone,label); a.range_start=label.slice(0,10)+'T00:00Z'; a.range_end=new Date(Date.parse(a.range_start)+86400000).toISOString();
    assert.equal(book(a).count,0);
  }
  const a=zoned('Asia/Kathmandu','2024-06-01T09:00'); a.range_start='2024-06-01T00:00Z'; a.range_end='2024-06-02T00:00Z';
  assert.equal(book(a).bookings[0].start,'2024-06-01T03:15:00.000Z');
});
test('fold alternative allows required meeting to finish first',()=>{
  const a=zoned('America/New_York','2024-11-03T01:30');
  a.range_start='2024-11-03T00:00Z'; a.range_end='2024-11-04T00:00Z';
  a.meetings[0].requires=['pre'];
  a.meetings.push(m('pre','09:00',{local_start:'2024-11-03T05:30',minutes:60,value:0}));
  assert.equal(book(a).count,2);
  assert.equal(book(a).bookings[0].start,'2024-11-03T06:30:00.000Z');
});
// Independent whole-assignment oracle: only evaluates transitions after all
// meetings have been selected, so it does not share the search's pruning rule.
test('deterministic small exhaustive oracle comparisons',()=>{
  let seed=891;
  const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  const cmp=(a,b)=>a<b?-1:a>b?1:0;
  for(let trial=0;trial<50;trial++) {
    const ms=Array.from({length:5},(_,i)=>m(String(i),'09:00',{
      local_start:`2024-01-07T${String(9+rand(3)).padStart(2,'0')}:${rand(2)?'30':'00'}`,
      minutes:30+30*rand(2),value:rand(5),eligible_rooms:['a','b'],people:rand(2)?['p']:[],requires:i && rand(3)===0?[String(rand(i))]:[]
    }));
    const a=input(ms); a.transitions.a.b=rand(4)*15; a.transitions.b.a=rand(4)*15;
    let best={value:0,count:0,bookings:[]};
    function enumerate(i,bs) {
      if(i<ms.length) {
        enumerate(i+1,bs);
        for(const r of ms[i].eligible_rooms) {
          const s=Date.parse(ms[i].local_start+':00Z');
          enumerate(i+1,[...bs,{i,r,s,e:s+ms[i].minutes*60000}]);
        }
        return;
      }
      for(const b of bs) {
        if(ms[b.i].requires.some(id=>!bs.some(x=>ms[x.i].id===id && x.e<=b.s)))return;
        for(const c of bs) if(b.i<c.i && (b.r===c.r || (ms[b.i].people.length && ms[c.i].people.length)) && b.s<c.e && c.s<b.e)return;
      }
      const ps=bs.filter(b=>ms[b.i].people.length).sort((a,b)=>a.s-b.s);
      for(let j=1;j<ps.length;j++) if(ps[j].s<ps[j-1].e+a.transitions[ps[j-1].r][ps[j].r]*60000)return;
      const candidate={value:bs.reduce((v,b)=>v+ms[b.i].value,0),count:bs.length,bookings:bs.map(b=>({meeting_id:ms[b.i].id,room_id:b.r,start:new Date(b.s).toISOString(),end:new Date(b.e).toISOString()}))};
      const key=x=>x.bookings.flatMap(b=>[b.meeting_id,b.room_id,b.start,b.end]).join('\0');
      if(candidate.value>best.value || candidate.value===best.value && (candidate.count>best.count || candidate.count===best.count && cmp(key(candidate),key(best))<0))best=candidate;
    }
    enumerate(0,[]);
    assert.deepEqual(book(a),best,`trial ${trial}`);
  }
});
