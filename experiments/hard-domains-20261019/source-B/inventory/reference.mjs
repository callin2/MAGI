export function replay({stock,operations}){
 const on_hand={...stock},rs=new Map(),receipts=new Map(),outcomes=[];let now=0;
 const held=sku=>[...rs.values()].filter(r=>r.state==='reserved'&&r.sku===sku).reduce((n,r)=>n+r.quantity,0);
 for(const o of operations){now=Math.max(now,o.at);for(const r of rs.values())if(r.state==='reserved'&&r.expires_at<=now)r.state='expired';
  const core=o.type==='reserve'?[o.type,o.reservation_id,o.sku,o.quantity,o.ttl_ms]:o.type==='adjust'?[o.type,o.sku,o.delta]:[o.type,o.reservation_id];const signature=JSON.stringify(core);let status;
  if(receipts.has(o.request_id)){const old=receipts.get(o.request_id);if(old.signature!==signature)throw Error('CONFLICT');status=old.status;}
  else{
   const r=rs.get(o.reservation_id);
   if(o.type==='reserve'){
    if(r){if(r.sku!==null&&(r.sku!==o.sku||r.quantity!==o.quantity||r.ttl_ms!==o.ttl_ms))throw Error('CONFLICT');status=r.state;}
    else if(on_hand[o.sku]-held(o.sku)<o.quantity)status='insufficient';
    else{rs.set(o.reservation_id,{id:o.reservation_id,sku:o.sku,quantity:o.quantity,expires_at:now+o.ttl_ms,ttl_ms:o.ttl_ms,state:'reserved'});status='reserved';}
   }else if(o.type==='adjust'){if(on_hand[o.sku]+o.delta<held(o.sku)||on_hand[o.sku]+o.delta<0)status='rejected';else{on_hand[o.sku]+=o.delta;status='adjusted';}}
   else if(!r){if(o.type==='cancel'){rs.set(o.reservation_id,{id:o.reservation_id,sku:null,quantity:0,expires_at:null,state:'cancelled'});status='cancelled';}else status='missing';}
   else if(r.state!=='reserved')status=r.state;
   else{r.state=o.type==='commit'?'committed':'cancelled';if(o.type==='commit')on_hand[r.sku]-=r.quantity;status=r.state;}
   receipts.set(o.request_id,{signature,status});
  }
  outcomes.push({request_id:o.request_id,status});
 }
 const available=Object.fromEntries(Object.keys(on_hand).map(s=>[s,on_hand[s]-held(s)]));
 return {now,on_hand,available,reservations:[...rs.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(({id,sku,quantity,expires_at,state})=>({id,sku,quantity,expires_at,state})),outcomes};
}
