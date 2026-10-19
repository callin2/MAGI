import test from 'node:test';
import assert from 'node:assert/strict';
import {plan} from './solution.mjs';
const rule=(id,weekday,start,fold='earlier',minutes=30)=>({id,weekday,start,minutes,from:'2024-01-01',through:'2026-12-31',fold});
test('New York spring gap is omitted; autumn fold selects both distinct instants',()=>{
 const gap=plan({zone:'America/New_York',range_start:'2024-03-10T00:00:00-05:00',range_end:'2024-03-11T00:00:00-04:00',rules:[rule('gap',0,'02:30')],exclusions:[],busy:[]}); assert.deepEqual(gap,[]);
 const args={zone:'America/New_York',range_start:'2024-11-03T00:00:00-04:00',range_end:'2024-11-04T00:00:00-05:00',rules:[rule('fold',0,'01:30','both')],exclusions:[],busy:[]};
 assert.deepEqual(plan(args).map(x=>x.start),['2024-11-03T05:30:00.000Z','2024-11-03T06:30:00.000Z']);
});
test('elapsed duration, adjacency, exclusion, and overlapping intervals',()=>{
 const args={zone:'UTC',range_start:'2024-01-07T08:00:00Z',range_end:'2024-01-07T11:00:00Z',rules:[rule('a',0,'09:00','earlier',60),rule('b',0,'10:00','later',30),rule('c',0,'10:30','earlier',30)],exclusions:[{rule_id:'c',date:'2024-01-07'}],busy:[{start:'2024-01-07T08:00:00Z',end:'2024-01-07T09:00:00Z'}]};
 assert.deepEqual(plan(args).map(x=>x.rule_id),['a','b']);
 args.busy=[{start:'2024-01-07T09:30:00Z',end:'2024-01-07T09:31:00Z'}]; assert.deepEqual(plan(args).map(x=>x.rule_id),['b']);
});
test('non-hour transition and Kathmandu offset',()=>{
 const lord=plan({zone:'Australia/Lord_Howe',range_start:'2024-10-06T00:00:00+10:30',range_end:'2024-10-07T00:00:00+11:00',rules:[rule('x',0,'02:15')],exclusions:[],busy:[]}); assert.deepEqual(lord,[]);
 const kath=plan({zone:'Asia/Kathmandu',range_start:'2024-01-07T00:00:00+05:45',range_end:'2024-01-08T00:00:00+05:45',rules:[rule('k',0,'09:00')],exclusions:[],busy:[]}); assert.equal(kath[0].start,'2024-01-07T03:15:00.000Z');
});
