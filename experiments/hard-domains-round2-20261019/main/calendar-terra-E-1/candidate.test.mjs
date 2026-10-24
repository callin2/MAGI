import assert from 'node:assert/strict';
import {book} from './solution.mjs';
const base={range_start:'2024-01-01T00:00:00.000Z',range_end:'2024-01-02T00:00:00.000Z',rooms:['A','B'],transitions:{A:{A:0,B:10},B:{A:10,B:0}},blocks:[]};
const run=(meetings, extra={})=>book({...base,...extra,meetings});
// Global choice: the attractive long option loses to two compatible meetings.
let r=run([
 {id:'a',zone:'UTC',local_start:'2024-01-01T09:00',fold:'either',minutes:120,value:11,eligible_rooms:['A'],people:['p'],requires:[]},
 {id:'b',zone:'UTC',local_start:'2024-01-01T09:00',fold:'either',minutes:60,value:6,eligible_rooms:['A'],people:['q'],requires:[]},
 {id:'c',zone:'UTC',local_start:'2024-01-01T10:00',fold:'either',minutes:60,value:6,eligible_rooms:['A'],people:['q'],requires:[]}
]); assert.equal(r.value,12); assert.deepEqual(r.bookings.map(x=>x.meeting_id),['b','c']);
// Adjacent meetings in different rooms need setup for their shared person.
r=run([
 {id:'a',zone:'UTC',local_start:'2024-01-01T09:00',fold:'either',minutes:60,value:5,eligible_rooms:['A'],people:['p'],requires:[]},
 {id:'b',zone:'UTC',local_start:'2024-01-01T10:00',fold:'either',minutes:30,value:5,eligible_rooms:['B'],people:['p'],requires:[]}
]); assert.equal(r.count,1);
// A selected intermediate room changes the relevant transition: A->B and B->C work,
// despite direct A->C needing a larger gap.
const tr={A:{A:0,B:5,C:30},B:{A:5,B:0,C:5},C:{A:30,B:5,C:0}};
r=run([
 {id:'a',zone:'UTC',local_start:'2024-01-01T09:00',fold:'either',minutes:30,value:1,eligible_rooms:['A'],people:['p'],requires:[]},
 {id:'b',zone:'UTC',local_start:'2024-01-01T09:35',fold:'either',minutes:10,value:1,eligible_rooms:['B'],people:['p'],requires:[]},
 {id:'c',zone:'UTC',local_start:'2024-01-01T09:50',fold:'either',minutes:10,value:1,eligible_rooms:['C'],people:['p'],requires:[]}
],{rooms:['A','B','C'],transitions:tr}); assert.equal(r.count,3);
// New York fall-back either has two occurrences, and later is the one in range.
r=book({range_start:'2024-11-03T06:00:00.000Z',range_end:'2024-11-03T08:00:00.000Z',rooms:['A'],transitions:{A:{A:0}},blocks:[],meetings:[{id:'x',zone:'America/New_York',local_start:'2024-11-03T01:30',fold:'either',minutes:30,value:1,eligible_rooms:['A'],people:[],requires:[]}]}); assert.equal(r.bookings[0].start,'2024-11-03T06:30:00.000Z');
// Spring gap is not an offered instant; requirements are temporal and mandatory.
r=run([{id:'gap',zone:'America/New_York',local_start:'2024-03-10T02:30',fold:'either',minutes:30,value:9,eligible_rooms:['A'],people:[],requires:[]}]); assert.equal(r.count,0);
r=run([{id:'a',zone:'UTC',local_start:'2024-01-01T10:00',fold:'either',minutes:10,value:9,eligible_rooms:['A'],people:[],requires:['b']},{id:'b',zone:'UTC',local_start:'2024-01-01T11:00',fold:'either',minutes:10,value:1,eligible_rooms:['B'],people:[],requires:[]}]); assert.equal(r.count,1); assert.equal(r.bookings[0].meeting_id,'b');
