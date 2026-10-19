import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate } from './solution.mjs';
const order=(id,value,items,group=null,choice='c')=>({id,value,group,choices:[{id:choice,items}]});

test('global combination beats individually highest order; choices compete across shared stock',()=>{
 const r=allocate({now:10,on_hand:{s:2,t:1},holds:[],orders:[order('big',10,{s:2}),order('a',6,{s:1}),order('b',6,{s:1})]});
 assert.deepEqual(r,{value:12,count:2,allocations:[{order_id:'a',choice_id:'c'},{order_id:'b',choice_id:'c'}],remaining:{s:0,t:1}});
});
test('only live reserved holds consume capacity; terminal hold IDs blocked, expired remain eligible',()=>{
 const r=allocate({now:10,on_hand:{s:5},holds:[{id:'h1',order_id:'held',sku:'s',quantity:1,state:'reserved',expires_at:11},{id:'h2',order_id:'old',sku:'s',quantity:1,state:'reserved',expires_at:10},{id:'h3',order_id:'done',sku:'s',quantity:1,state:'committed',expires_at:0},{id:'h4',order_id:'cancel',sku:'s',quantity:1,state:'cancelled',expires_at:0}],orders:[order('held',100,{s:1}),order('old',2,{s:1}),order('done',90,{s:1}),order('cancel',80,{s:1}),order('fresh',3,{s:1})]});
 assert.equal(r.value,5);assert.equal(r.count,2);assert.equal(r.remaining.s,2);
});
test('ties prefer count then ASCII lexical pair; groups permit at most one',()=>{
 const r=allocate({now:0,on_hand:{s:2},holds:[],orders:[order('z',5,{s:2}),order('a',5,{s:1},'g','zchoice'),order('b',5,{s:1},'g','achoice'),order('c',0,{s:1})]});
 assert.deepEqual(r.allocations,[{order_id:'a',choice_id:'zchoice'},{order_id:'c',choice_id:'c'}]);assert.equal(r.value,5);assert.equal(r.count,2);
});
test('canonical duplicate IDs deduplicated; conflicting terms throw',()=>{
 const a={id:'x',value:2,group:null,choices:[{id:'q',items:{b:1,a:1}}]};
 const b={id:'x',value:2,group:null,choices:[{items:{a:1,b:1},id:'q'}]};
 assert.equal(allocate({now:0,on_hand:{a:1,b:1},holds:[],orders:[a,b]}).count,1);
 assert.throws(()=>allocate({now:0,on_hand:{a:1,b:1},holds:[],orders:[a,{...b,value:3}]}),Error);
});
test('inputs are not mutated and call results are independent',()=>{
 const input={now:0,on_hand:{s:2},holds:[],orders:[order('x',1,{s:1})]};const before=structuredClone(input);const a=allocate(input);a.remaining.s=99;
 assert.deepEqual(input,before);assert.equal(allocate(input).remaining.s,1);
});
