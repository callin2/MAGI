export function sessions({gap_ms,lateness_ms,records}) {
  let watermark=null;
  const versions=new Map(), live=new Map(), sealedIds=new Set(), sealed=[];
  const canonical=r=>JSON.stringify(r.kind==='upsert'?[r.kind,r.id,r.rev,r.key,r.event_time,r.amount]:r.kind==='delete'?[r.kind,r.id,r.rev]:[r.kind,r.time]);
  const components=(map)=>{
    const byKey=new Map();
    for(const r of map.values()){if(!byKey.has(r.key))byKey.set(r.key,[]);byKey.get(r.key).push(r);}
    const out=[];
    for(const [key,arr] of byKey){arr.sort((a,b)=>a.event_time-b.event_time||ascii(a.id,b.id));let cur=null;
      for(const r of arr){if(!cur||r.event_time-cur.last>gap_ms){if(cur)out.push(finish(key,cur));cur={first:r.event_time,last:r.event_time,total:r.amount,count:1,ids:[r.id]};}
        else {cur.last=r.event_time;cur.total+=r.amount;cur.count++;cur.ids.push(r.id);}}
      if(cur)out.push(finish(key,cur));
    } return out;
  };
  const finish=(key,c)=>({key,start:c.first,end:c.last+gap_ms,total:c.total,count:c.count,ids:c.ids.sort(ascii),final:false});
  const finalizedProximity=(r)=>sealed.some(s=>s.key===r.key && r.event_time>=s.start-gap_ms && r.event_time<=s.end+gap_ms);
  const finalize=()=>{if(watermark===null)return;const threshold=watermark-lateness_ms;const all=components(live);for(const s of all){if(s.end<=threshold){s.final=true;sealed.push(s);for(const id of s.ids){sealedIds.add(id);live.delete(id);}}}};
  for(const r of records){
    if(r.kind==='watermark'){if(watermark===null||r.time>watermark)watermark=r.time;finalize();continue;}
    const prior=versions.get(r.id);
    if(prior){if(r.rev<prior.rev)continue;if(r.rev===prior.rev){if(canonical(r)!==prior.payload)throw new Error('conflicting accepted revision');continue;}}
    if(sealedIds.has(r.id))continue;
    if(r.kind==='upsert'&&finalizedProximity(r))continue;
    const proposal=new Map(live);
    proposal.delete(r.id);
    if(r.kind==='upsert')proposal.set(r.id,{id:r.id,key:r.key,event_time:r.event_time,amount:r.amount});
    if(r.kind==='upsert'&&watermark!==null){const c=components(proposal).find(s=>s.ids.includes(r.id));if(c&&c.end<=watermark-lateness_ms)continue;}
    live.clear();for(const [id,v] of proposal)live.set(id,v);
    versions.set(r.id,{rev:r.rev,payload:canonical(r)});
    finalize();
  }
  const result=[...sealed,...components(live)];result.sort((a,b)=>a.start-b.start||ascii(a.key,b.key));
  return {watermark,sessions:result};
}
function ascii(a,b){return a<b?-1:a>b?1:0;}
