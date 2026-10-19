import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from './solution.mjs';
const opts = (records, extra={}) => ({window_ms:10,lateness_ms:0,records,...extra});
test('replays idempotent, revisions replace full contribution and preserve zero totals', () => {
  const out=aggregate(opts([
    {kind:'upsert',id:'a',rev:1,key:'x',event_time:-1,amount:5},
    {kind:'upsert',id:'a',rev:1,key:'x',event_time:-1,amount:5},
    {kind:'upsert',id:'b',rev:1,key:'x',event_time:-5,amount:-5},
    {kind:'upsert',id:'a',rev:2,key:'y',event_time:10,amount:0}
  ]));
  assert.deepEqual(out,{watermark:null,windows:[
    {key:'x',start:-10,end:0,total:-5,count:1,final:false},
    {key:'y',start:10,end:20,total:0,count:1,final:false}
  ]});
});
test('finalized windows reject mutations atomically, but duplicates and old revisions remain harmless', () => {
  const records=[
    {kind:'upsert',id:'a',rev:1,key:'x',event_time:1,amount:4},
    {kind:'watermark',time:10},
    {kind:'upsert',id:'a',rev:2,key:'y',event_time:11,amount:8},
    {kind:'upsert',id:'b',rev:1,key:'x',event_time:2,amount:3},
    {kind:'delete',id:'a',rev:3},
    {kind:'upsert',id:'a',rev:1,key:'x',event_time:1,amount:4}
  ];
  assert.deepEqual(aggregate(opts(records)),{watermark:10,windows:[{key:'x',start:0,end:10,total:4,count:1,final:true}]});
});
test('same revision conflicting payload throws; watermark only advances', () => {
  assert.throws(()=>aggregate(opts([
    {kind:'upsert',id:'a',rev:1,key:'x',event_time:0,amount:1},
    {kind:'upsert',id:'a',rev:1,key:'x',event_time:0,amount:2}
  ])),Error);
  const o=aggregate(opts([{kind:'watermark',time:20},{kind:'watermark',time:-2}],{lateness_ms:5}));
  assert.deepEqual(o,{watermark:20,windows:[]});
});
