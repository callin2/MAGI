export function sessions({gap_ms,lateness_ms,records}) {
  let watermark=null;
  const versions=new Map(); // accepted revision and canonical payload, including tombstones
  const live=new Map();
  const sealedIds=new Set();
  const finals=[];
  const ascii=(a,b)=>a<b?-1:a>b?1:0;
  const canonical=r=>r.kind==='delete'?JSON.stringify(['delete']):JSON.stringify(['upsert',r.key,r.event_time,r.amount]);
  function components(events){
    const byKey=new Map();
    for(const e of events){if(!byKey.has(e.key))byKey.set(e.key,[]);byKey.get(e.key).push(e);}
    const out=[];
    for(const [key,es] of byKey){es.sort((a,b)=>a.event_time-b.event_time||ascii(a.id,b.id));let c=null;
      for(const e of es){if(!c||e.event_time-c.last>gap_ms){c={key,start:e.event_time,last:e.event_time,total:0,count:0,ids:[]};out.push(c);}c.last=e.event_time;c.total+=e.amount;c.count++;c.ids.push(e.id);}
    }
    return out.map(c=>({key:c.key,start:c.start,end:c.last+gap_ms,total:c.total,count:c.count,ids:c.ids.sort(ascii),final:false}));
  }
  function sealEligible(){if(watermark===null)return;const threshold=watermark-lateness_ms;const cs=components([...live.values()]);
    for(const c of cs){if(c.end<=threshold){finals.push({...c,final:true});for(const id of c.ids){live.delete(id);sealedIds.add(id);}}}
  }
  for(const r of records){
    if(r.kind==='watermark'){if(watermark===null||r.time>watermark)watermark=r.time;sealEligible();continue;}
    const prev=versions.get(r.id), payload=canonical(r);
    if(prev&&r.rev<prev.rev)continue;
    if(prev&&r.rev===prev.rev){if(payload!==prev.payload)throw new Error('conflicting payload for accepted revision');continue;}
    if(r.kind==='delete'){
      if(sealedIds.has(r.id))continue;
      live.delete(r.id);versions.set(r.id,{rev:r.rev,payload});sealEligible();continue;
    }
    if(sealedIds.has(r.id))continue;
    const candidate=new Map(live);candidate.delete(r.id);
    const proposed={id:r.id,key:r.key,event_time:r.event_time,amount:r.amount};
    // Sealed sessions are immutable and cannot be contacted or extended.
    const blocked=finals.some(f=>f.key===r.key&&r.event_time>=f.start-gap_ms&&r.event_time<=f.end);
    if(blocked)continue;
    candidate.set(r.id,proposed);
    const containing=components([...candidate.values()]).find(c=>c.ids.includes(r.id));
    if(watermark!==null&&containing.end<=watermark-lateness_ms)continue;
    live.clear();for(const [id,e] of candidate)live.set(id,e);
    versions.set(r.id,{rev:r.rev,payload});sealEligible();
  }
  const open=components([...live.values()]);
  const result=[...finals,...open];
  result.sort((a,b)=>a.start-b.start||ascii(a.key,b.key));
  return {watermark,sessions:result};
}
