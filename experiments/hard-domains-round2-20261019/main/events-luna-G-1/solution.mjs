export function sessions({gap_ms,lateness_ms,records}) {
  let watermark=null;
  const versions=new Map(); // id -> {rev,payload}
  const live=new Map();
  const sealed=[];
  const threshold=()=>watermark===null?null:watermark-lateness_ms;
  const payloadOf=r=>r.kind==='delete'?{kind:'delete',id:r.id,rev:r.rev}:{kind:'upsert',id:r.id,rev:r.rev,key:r.key,event_time:r.event_time,amount:r.amount};
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const cmp=(a,b)=>a<b?-1:a>b?1:0;
  function components(map) {
    const groups=new Map();
    for(const e of map.values()){if(!groups.has(e.key))groups.set(e.key,[]);groups.get(e.key).push(e);}
    const result=[];
    for(const [key,arr] of groups){arr.sort((a,b)=>a.event_time-b.event_time||cmp(a.id,b.id));let cur=[];
      const flush=()=>{if(!cur.length)return;result.push({key,start:cur[0].event_time,end:cur[cur.length-1].event_time+gap_ms,total:cur.reduce((s,e)=>s+e.amount,0),count:cur.length,ids:cur.map(e=>e.id).sort(cmp),final:false,_events:cur});cur=[];};
      for(const e of arr){if(cur.length&&e.event_time-cur[cur.length-1].event_time>gap_ms)flush();cur.push(e);}flush();
    }
    return result;
  }
  function finalize(){const t=threshold();if(t===null)return;const cs=components(live);for(const c of cs)if(c.end<=t){sealed.push({...c,final:true});for(const e of c._events)live.delete(e.id);}}
  for(const r of records){
    if(r.kind==='watermark'){if(watermark===null||r.time>watermark)watermark=r.time;finalize();continue;}
    const p=payloadOf(r), oldver=versions.get(r.id);
    if(oldver&&r.rev<oldver.rev)continue;
    if(oldver&&r.rev===oldver.rev){if(!same(p,oldver.payload))throw new Error('Conflicting payload at accepted revision');continue;}
    const old=live.get(r.id);
    // A current contribution already sealed cannot be revised or withdrawn.
    if(sealed.some(s=>s._events.some(e=>e.id===r.id)))continue;
    const proposal=new Map(live);proposal.delete(r.id);
    if(r.kind==='upsert'){
      const e={id:r.id,key:r.key,event_time:r.event_time,amount:r.amount};
      // Do not permit a new event to touch a sealed component (expanded by gap).
      if(sealed.some(s=>s.key===e.key&&e.event_time>=s.start-gap_ms&&e.event_time<=s.end+gap_ms))continue;
      proposal.set(e.id,e);
      const containing=components(proposal).find(c=>c._events.some(x=>x.id===e.id));
      const t=threshold();if(t!==null&&containing.end<=t)continue;
    }
    // Accepted revisions, including unknown-ID tombstones, establish version.
    versions.set(r.id,{rev:r.rev,payload:p});live.clear();for(const [id,e] of proposal)live.set(id,e);
    finalize();
  }
  const visible=[...sealed,...components(live)];
  visible.sort((a,b)=>a.start-b.start||cmp(a.key,b.key));
  return {watermark,sessions:visible.map(({key,start,end,total,count,ids,final})=>({key,start,end,total,count,ids,final}))};
}
