export function sessions({gap_ms,lateness_ms,records}) {
  let watermark=null;
  const versions=new Map(), live=new Map(), sealed=[];
  const ascii=(a,b)=>a<b?-1:a>b?1:0;
  const payload=r=>r.kind==='delete'?['delete',r.id,r.rev]:['upsert',r.id,r.rev,r.key,r.event_time,r.amount];
  function components(events) {
    const groups=new Map();
    for(const e of events.values()){if(!groups.has(e.key))groups.set(e.key,[]);groups.get(e.key).push(e);}
    const out=[];
    for(const [key,es] of groups){es.sort((a,b)=>a.event_time-b.event_time||ascii(a.id,b.id));let cur=[];
      for(const e of es){if(cur.length&&e.event_time-cur[cur.length-1].event_time>gap_ms){out.push(make(key,cur));cur=[];}cur.push(e);}if(cur.length)out.push(make(key,cur));
    }return out;
  }
  function make(key,es){return {key,start:es[0].event_time,end:es.at(-1).event_time+gap_ms,total:es.reduce((s,e)=>s+e.amount,0),count:es.length,ids:es.map(e=>e.id).sort(ascii),final:false};}
  const threshold=()=>watermark===null?null:watermark-lateness_ms;
  function finalize(){const t=threshold();if(t===null)return;for(const c of components(live)){if(c.end<=t){c.final=true;sealed.push(c);for(const id of c.ids)live.delete(id);}}}
  for(const r of records){
    if(r.kind==='watermark'){if(watermark===null||r.time>watermark)watermark=r.time;finalize();continue;}
    const oldv=versions.get(r.id);
    if(oldv){if(r.rev<oldv.rev)continue;if(r.rev===oldv.rev){if(JSON.stringify(payload(r))!==oldv.payload)throw new Error('conflicting accepted revision');continue;}}
    if([...sealed].some(c=>c.ids.includes(r.id)))throw new Error('cannot revise finalized event');
    if(r.kind==='delete') {live.delete(r.id);versions.set(r.id,{rev:r.rev,payload:JSON.stringify(payload(r))});finalize();continue;}
    const proposed={id:r.id,key:r.key,event_time:r.event_time,amount:r.amount};
    for(const c of sealed)if(c.key===r.key&&r.event_time>=c.start-gap_ms&&r.event_time<=c.end+gap_ms)throw new Error('event touches finalized session');
    const trial=new Map(live);trial.set(r.id,proposed);
    const containing=components(trial).find(c=>c.ids.includes(r.id));
    const t=threshold();if(t!==null&&containing.end<=t)throw new Error('proposed session is finalized');
    live.set(r.id,proposed);versions.set(r.id,{rev:r.rev,payload:JSON.stringify(payload(r))});finalize();
  }
  return {watermark,sessions:[...sealed,...components(live)].sort((a,b)=>a.start-b.start||ascii(a.key,b.key))};
}
