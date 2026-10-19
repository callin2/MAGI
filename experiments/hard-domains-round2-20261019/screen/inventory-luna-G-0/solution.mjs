function ascii(a,b){return a<b?-1:a>b?1:0}
function canonOrder(o){
 const choices=o.choices.map(c=>({id:c.id,items:Object.fromEntries(Object.keys(c.items).sort(ascii).map(k=>[k,c.items[k]]))})).sort((a,b)=>ascii(a.id,b.id)||ascii(JSON.stringify(a.items),JSON.stringify(b.items)));
 return JSON.stringify({id:o.id,value:o.value,group:o.group,choices});
}
export function allocate({now,on_hand,holds,orders}){
 const remaining={...on_hand}, blocked=new Set();
 for(const h of holds){if(h.state==='reserved'&&h.expires_at>now){remaining[h.sku]-=h.quantity;blocked.add(h.order_id)}else if(h.state==='committed'||h.state==='cancelled')blocked.add(h.order_id)}
 const ids=new Map();for(const o of orders){const sig=canonOrder(o);if(ids.has(o.id)){if(ids.get(o.id)!==sig)throw new Error(`Conflicting order ID: ${o.id}`)}else ids.set(o.id,sig)}
 const candidates=[...new Map(orders.map(o=>[o.id,o])).values()].filter(o=>!blocked.has(o.id)).sort((a,b)=>ascii(a.id,b.id));
 const used=Object.fromEntries(Object.keys(on_hand).map(s=>[s,0]));let best=[],bestValue=0,bestCount=0;
 const pairs=xs=>xs.map(x=>({order_id:x.o.id,choice_id:x.c.id})).sort((a,b)=>ascii(a.order_id,b.order_id)||ascii(a.choice_id,b.choice_id));
 function better(v,xs){if(v!==bestValue)return v>bestValue;if(xs.length!==bestCount)return xs.length>bestCount;const a=pairs(xs),b=pairs(best);for(let i=0;i<a.length;i++){const z=ascii(a[i].order_id,b[i].order_id)||ascii(a[i].choice_id,b[i].choice_id);if(z)return z<0}return false}
 function visit(i,v,xs,groups){if(i===candidates.length){if(better(v,xs)){best=xs.slice();bestValue=v;bestCount=xs.length}return}visit(i+1,v,xs,groups);const o=candidates[i];if(o.group!==null&&groups.has(o.group))return;for(const c of o.choices){if(Object.entries(c.items).some(([s,q])=>remaining[s]-used[s]<q))continue;for(const [s,q]of Object.entries(c.items))used[s]+=q;if(o.group!==null)groups.add(o.group);xs.push({o,c});visit(i+1,v+o.value,xs,groups);xs.pop();if(o.group!==null)groups.delete(o.group);for(const [s,q]of Object.entries(c.items))used[s]-=q}}
 visit(0,0,[],new Set());const final={...on_hand};for(const h of holds)if(h.state==='reserved'&&h.expires_at>now)final[h.sku]-=h.quantity;for(const x of best)for(const [s,q]of Object.entries(x.c.items))final[s]-=q;
 return {value:bestValue,count:bestCount,allocations:pairs(best),remaining:final};
}
