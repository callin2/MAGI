export function sessions({gap_ms,lateness_ms,records}) {
  let watermark=null;
  const versions=new Map(); // id -> {rev,payload}
  const live=new Map();
  const sealed=[];
  const cmp=(a,b)=>a<b?-1:a>b?1:0;
  const payloadOf=r=>r.kind==='upsert'?{kind:r.kind,id:r.id,rev:r.rev,key:r.key,event_time:r.event_time,amount:r.amount}:{kind:r.kind,id:r.id,rev:r.rev};
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function components(items){
    const by=new Map(); for(const x of items){if(!by.has(x.key))by.set(x.key,[]);by.get(x.key).push(x);}
    const out=[];
    for(const [key,es] of by){es.sort((a,b)=>a.event_time-b.event_time||cmp(a.id,b.id));let cur=null;
      for(const e of es){if(!cur||e.event_time-cur.last>gap_ms){cur={key,start:e.event_time,last:e.event_time,total:0,count:0,ids:[]};out.push(cur);}cur.last=e.event_time;cur.total+=e.amount;cur.count++;cur.ids.push(e.id);}
    }
    return out.map(c=>({key:c.key,start:c.start,end:c.last+gap_ms,total:c.total,count:c.count,ids:c.ids.sort(cmp),final:false}));
  }
  function finalize(){if(watermark===null)return;const threshold=watermark-lateness_ms;const all=components([...live.values()]);
    const done=all.filter(s=>s.end<=threshold);const keep=all.filter(s=>s.end>threshold);
    for(const s of done){const members=[...live.values()].filter(e=>e.key===s.key&&e.event_time>=s.start&&e.event_time<=s.end-gap_ms); // component's event range
      sealed.push({...s,ids:[...s.ids], final:true});for(const e of members)live.delete(e.id);
    }
  }
  function nearSealed(e){return sealed.some(s=>s.key===e.key && e.event_time>=s.start-gap_ms && e.event_time<=s.end+gap_ms);}
  for(const r of records){
    if(r.kind==='watermark'){if(watermark===null||r.time>watermark)watermark=r.time;finalize();continue;}
    const oldv=versions.get(r.id);
    if(oldv&&r.rev<oldv.rev)continue;
    const p=payloadOf(r);
    if(oldv&&r.rev===oldv.rev){if(same(oldv.payload,p))continue;throw new Error('conflicting accepted revision');}
    const old=live.get(r.id);
    // Any ID represented by a sealed membership is immutable.
    if(sealed.some(s=>s.ids.includes(r.id)))throw new Error('event is finalized');
    if(r.kind==='upsert'){
      const candidate={id:r.id,key:r.key,event_time:r.event_time,amount:r.amount};
      if(nearSealed(candidate))throw new Error('event is adjacent to finalized session');
      const proposal=[...live.values()].filter(e=>e.id!==r.id).concat(candidate);
      const cs=components(proposal);const c=cs.find(s=>s.ids.includes(r.id));
      if(watermark!==null&&c.end<=watermark-lateness_ms)throw new Error('proposed session is already final');
      live.set(r.id,candidate);
    } else {live.delete(r.id);}
    versions.set(r.id,{rev:r.rev,payload:p});finalize();
  }
  const open=components([...live.values()]);
  const result=[...sealed,...open].sort((a,b)=>a.start-b.start||cmp(a.key,b.key));
  return {watermark,sessions:result};
}
