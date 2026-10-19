import test from 'node:test';import assert from 'node:assert/strict';import {book} from './solution.mjs';
const base={range_start:'2025-01-01T00:00:00Z',range_end:'2025-12-31T23:59:59Z',rooms:['A','B'],transitions:{A:{A:0,B:20},B:{A:0,B:0}},blocks:[]};
const m=(id,start,value,room='A',people=['p'],requires=[])=>({id,zone:'UTC',local_start:`2025-01-01T${start}`,fold:'either',minutes:30,value,eligible_rooms:[room],people,requires});
test('global search selects compatible high total',()=>{const x={...base,meetings:[m('big','09:00',10),m('one','09:00',6),m('two','09:30',6)]};assert.equal(book(x).value,16);});
test('directed setup applies to consecutive meetings',()=>{const x={...base,meetings:[m('a','09:00',4,'A'),m('b','09:40',4,'B'),m('c','10:10',4,'A')]};assert.equal(book(x).count,2);});
test('fold alternatives and nonexistent local time',()=>{const x={...base,meetings:[{...m('fold','01:30',3),zone:'America/New_York',local_start:'2025-11-02T01:30',fold:'either'},{...m('gap','02:30',9),zone:'America/New_York',local_start:'2025-03-09T02:30'}]};const r=book(x);assert.equal(r.count,1);assert.equal(r.bookings[0].start,'2025-11-02T05:30:00.000Z');});
test('requirements, room block, half open endpoint',()=>{const x={...base,blocks:[{room_id:'A',start:'2025-01-01T09:00:00Z',end:'2025-01-01T09:30:00Z'}],meetings:[m('req','09:30',2,'A',[]),m('dep','10:00',3,'B',[],['req'])]};assert.equal(book(x).count,2);});
test('setup enforces positive gap',()=>{const x={...base,meetings:[m('a','09:00',5,'A'),m('b','09:30',8,'B')]};assert.equal(book(x).count,1);});
test('tie breaks ASCII meeting ID',()=>{const x={...base,meetings:[m('z','09:00',1),m('A','09:00',1)]};assert.deepEqual(book(x).bookings.map(b=>b.meeting_id),['A']);});
