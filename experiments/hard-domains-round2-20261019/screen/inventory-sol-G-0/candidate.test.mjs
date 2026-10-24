import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate} from './solution.mjs';
const order=(id,value,items,group=null)=>({id,value,group,choices:[{id:'c',items}]});
const input=(orders,on_hand={s:4},holds=[])=>({now:10,on_hand,holds,orders});

test('global combination, count tie, choice feasibility and ASCII ties',()=>{
  assert.deepEqual(allocate(input([order('a',9,{s:4}),order('b',5,{s:2}),order('c',5,{s:2})])).allocations,
    [{order_id:'b',choice_id:'c'},{order_id:'c',choice_id:'c'}]);
  assert.equal(allocate(input([order('a',10,{s:4}),order('b',5,{s:2}),order('c',5,{s:2})])).count,2);
  const a=order('A',5,{s:4}); a.choices=[{id:'z',items:{s:4}},{id:'Z',items:{s:2}}];
  assert.deepEqual(allocate(input([order('a',5,{s:4}),a])).allocations,[{order_id:'A',choice_id:'Z'}]);
  const flexible=order('a',6,{s:2}); flexible.choices.push({id:'d',items:{t:2}});
  assert.equal(allocate(input([flexible,order('b',5,{s:2})],{s:2,t:2})).value,11);
});

test('hold lifecycle uses current physical snapshot and fresh expired orders',()=>{
  const holds=[
    {id:'h1',order_id:'active',sku:'s',quantity:2,state:'reserved',expires_at:11},
    {id:'h2',order_id:'committed',sku:'s',quantity:9,state:'committed',expires_at:0},
    {id:'h3',order_id:'cancelled',sku:'s',quantity:9,state:'cancelled',expires_at:99},
    {id:'h4',order_id:'due',sku:'s',quantity:9,state:'reserved',expires_at:10},
    {id:'h5',order_id:'old',sku:'s',quantity:9,state:'expired',expires_at:0},
    {id:'h6',order_id:'stale',sku:'s',quantity:9,state:'reserved',expires_at:9}
  ];
  const data=input(['active','committed','cancelled','due','old','stale'].map(id=>order(id,1,{s:1})),{s:5,t:3},holds);
  const before=structuredClone(data);
  assert.deepEqual(allocate(data),{value:3,count:3,allocations:['due','old','stale'].map(order_id=>({order_id,choice_id:'c'})),remaining:{s:0,t:3}});
  assert.deepEqual(data,before);
  assert.deepEqual(allocate(data),allocate(data));
  assert.equal(allocate({...data,orders:[]}).remaining.s,3);
});

test('canonical duplicate terms and conflicts including blocked IDs',()=>{
  const a={id:'x',value:3,group:'G',choices:[{id:'b',items:{s:1,t:2}},{id:'a',items:{s:2}}]};
  const b={choices:[{items:{s:2},id:'a'},{items:{t:2,s:1},id:'b'}],group:'G',value:3,id:'x'};
  assert.equal(allocate(input([a,b],{s:4,t:4})).count,1);
  for(const changed of [{...b,value:4},{...b,group:null},{...b,choices:[{id:'a',items:{s:1}}]}]) {
    assert.throws(()=>allocate(input([a,changed],{s:4,t:4},[{id:'h',order_id:'x',sku:'s',quantity:1,state:'committed',expires_at:0}])),Error);
  }
  assert.equal(allocate(input([order('a',2,{s:1}),order('b',2,{s:1})])).count,2);
});

test('groups, zero values, empty stock, choice lexical priority before stock usage',()=>{
  assert.deepEqual(allocate(input([order('a',0,{s:1},''),order('b',0,{s:1},''),order('c',0,{s:1})])).allocations,
    [{order_id:'a',choice_id:'c'},{order_id:'c',choice_id:'c'}]);
  assert.equal(allocate(input([order('a',0,{s:1})],{s:0})).count,0);
  const a=order('a',1,{s:1});a.choices=[{id:'a',items:{s:4}},{id:'b',items:{s:1}}];
  assert.equal(allocate(input([a])).remaining.s,0);
});

// Exhaustive enumeration is deliberately independent of the production DP.
function brute(data) {
  const os=[...data.orders].sort((a,b)=>a.id<b.id?-1:1);
  let best={value:0,count:0,allocations:[],remaining:{...data.on_hand}};
  const lexical=(a,b)=>{
    for(let i=0;i<a.length;i++) for(const k of ['order_id','choice_id']) {
      if(a[i][k]!==b[i][k]) return a[i][k]<b[i][k];
    }
    return false;
  };
  function visit(i,stock,groups,alloc,value) {
    if(i===os.length) {
      if(value>best.value || value===best.value && (alloc.length>best.count || alloc.length===best.count && lexical(alloc,best.allocations)))
        best={value,count:alloc.length,allocations:[...alloc],remaining:{...stock}};
      return;
    }
    visit(i+1,stock,groups,alloc,value);
    const o=os[i]; if(o.group!==null && groups.has(o.group))return;
    for(const c of o.choices) {
      if(Object.entries(c.items).some(([s,q])=>q>stock[s]))continue;
      const next={...stock};for(const [s,q] of Object.entries(c.items))next[s]-=q;
      const gs=new Set(groups);if(o.group!==null)gs.add(o.group);
      visit(i+1,next,gs,[...alloc,{order_id:o.id,choice_id:c.id}],value+o.value);
    }
  }
  visit(0,data.on_hand,new Set(),[],0);return best;
}

test('250 seeded exhaustive differential cases',()=>{
  let seed=1247;
  const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let trial=0;trial<250;trial++) {
    const orders=[];
    for(let i=0,n=1+rand(7);i<n;i++) {
      const o=order(String.fromCharCode(65+i),rand(9),{s:1},[null,'g','h'][rand(3)]);
      o.choices=Array.from({length:1+rand(3)},(_,j)=>{
        const items={};for(const s of ['s','t','u'])if(rand(2))items[s]=1+rand(3);
        if(!Object.keys(items).length)items.s=1;
        return {id:String.fromCharCode(97+j),items};
      }).reverse();orders.unshift(o);
    }
    const data=input(orders,{s:rand(6),t:rand(6),u:rand(6)});
    assert.deepEqual(allocate(data),brute(data),`trial ${trial}`);
  }
});

test('18 orders, three choices, four SKUs, five groups',()=>{
  const orders=Array.from({length:18},(_,i)=>({id:String(i).padStart(2,'0'),value:i%7,group:i<5?'g'+i:null,
    choices:[{id:'a',items:{a:1,b:1}},{id:'b',items:{c:1,d:1}},{id:'c',items:{a:1,d:1}}]}));
  const result=allocate(input(orders,{a:12,b:12,c:12,d:12}));
  assert.equal(result.count,18);
  assert.equal(result.value,orders.reduce((v,o)=>v+o.value,0));
  assert.ok(Object.values(result.remaining).every(q=>q>=0));
});
