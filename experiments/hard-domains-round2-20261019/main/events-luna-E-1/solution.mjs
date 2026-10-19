export function sessions({gap_ms,lateness_ms,records}) {
  let watermark=null;
  const versions=new Map(); // id -> {rev,payload,live}
  const events=new Map(); // live unsealed id -> event
  const sealedIds=new Set();
  const finalized=[];
  const cmp=(a,b)=>a<b?-1:a>b?1:0;
  function components(list) {
    const byKey=new Map();
    for(const e of list){if(!byKey.has(e.key))byKey.set(e.key,[]);byKey.get(e.key).push(e);}
    const out=[];
    for(const [key,es] of byKey){es.sort((a,b)=>a.event_time-b.event_time||cmp(a.id,b.id));let cur=null;
      for(const e of es){if(!cur||e.event_time-cur.last>gap_ms){cur={key,start:e.event_time,last:e.event_time,total:0,count:0,ids:[]};out.push(cur);}cur.last=e.event_time;cur.total+=e.amount;cur.count++;cur.ids.push(e.id);}
    }
    return out.map(c=>({key:c.key,start:c.start,end:c.last+gap_ms,total:c.total,count:c.count,ids:c.ids.sort(cmp),final:false}));
  }
  function sealEligible(){if(watermark===null)return;const threshold=watermark-lateness_ms;const cs=components([...events.values()]);
    for(const c of cs)if(c.end<=threshold){c.final=true;finalized.push(c);for(const id of c.ids){sealedIds.add(id);events.delete(id);}}
  }
  function sealedNear(key,t){return finalized.some(s=>s.key===key&&t>=s.start-gap_ms&&t<=s.end);}
  for(const r of records){
    if(r.kind==='watermark'){if(watermark===null||r.time>watermark)watermark=r.time;sealEligible();continue;}
    const prior=versions.get(r.id);
    const payload=r.kind==='delete'?{kind:'delete'}:{kind:'upsert',key:r.key,event_time:r.event_time,amount:r.amount};
    if(prior){if(r.rev<prior.rev)continue;if(r.rev===prior.rev){if(JSON.stringify(payload)!==JSON.stringify(prior.payload))throw new Error('conflicting revision');continue;}}
    // A correction to an event in an immutable component is never accepted.
    if(sealedIds.has(r.id))continue;
    const old=events.get(r.id);
    if(r.kind==='upsert'){
      if(sealedNear(r.key,r.event_time))continue;
      const proposal=[...events.values()].filter(e=>e.id!==r.id);
      proposal.push({id:r.id,key:r.key,event_time:r.event_time,amount:r.amount});
      const c=components(proposal).find(x=>x.ids.includes(r.id));
      if(watermark!==null&&c.end<=watermark-lateness_ms)continue;
      events.delete(r.id);events.set(r.id,{id:r.id,key:r.key,event_time:r.event_time,amount:r.amount});
    } else events.delete(r.id);
    versions.set(r.id,{rev:r.rev,payload,live:r.kind==='upsert'});
    sealEligible();
  }
  const open=components([...events.values()]);
  const all=[...finalized,...open];
  all.sort((a,b)=>a.start-b.start||cmp(a.key,b.key));
  return {watermark,sessions:all};
}
