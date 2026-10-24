export function sessions({gap_ms,lateness_ms,records}) {
 let watermark=null; const versions=new Map(), live=new Map(), sealedIds=new Set(), sealed=[];
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const components=(map)=>{const by=new Map();for(const e of map.values()){if(!by.has(e.key))by.set(e.key,[]);by.get(e.key).push(e)}const out=[];for(const [key,es] of by){es.sort((a,b)=>a.event_time-b.event_time||cmp(a.id,b.id));let cur=null;for(const e of es){if(!cur||e.event_time-cur.last>gap_ms){if(cur)out.push(cur);cur={key,first:e.event_time,last:e.event_time,events:[e]}}else{cur.last=e.event_time;cur.events.push(e)}}if(cur)out.push(cur)}return out};
 const snapshot=c=>({key:c.key,start:c.first,end:c.last+gap_ms,total:c.events.reduce((s,e)=>s+e.amount,0),count:c.events.length,ids:c.events.map(e=>e.id).sort(cmp),final:true});
 const finalize=()=>{if(watermark===null)return;for(const c of components(live))if(c.last+gap_ms<=watermark-lateness_ms){sealed.push(snapshot(c));for(const e of c.events){sealedIds.add(e.id);live.delete(e.id)}}};
 for(const r of records){if(r.kind==='watermark'){watermark=watermark===null?r.time:Math.max(watermark,r.time);finalize();continue}
   const oldv=versions.get(r.id);const payload=r.kind==='delete'?{kind:'delete',id:r.id,rev:r.rev}:{kind:'upsert',id:r.id,rev:r.rev,key:r.key,event_time:r.event_time,amount:r.amount};
   if(oldv){if(r.rev<oldv.rev)continue;if(r.rev===oldv.rev){if(JSON.stringify(payload)!==oldv.payload)throw Error('revision conflict');continue}}
   if(r.kind==='delete'){if(sealedIds.has(r.id))throw Error('finalized event');live.delete(r.id);versions.set(r.id,{rev:r.rev,payload:JSON.stringify(payload)});finalize();continue}
   if(sealedIds.has(r.id))throw Error('finalized event');
   for(const s of sealed)if(s.key===r.key&&r.event_time>=s.start-gap_ms&&r.event_time<=s.end+gap_ms)throw Error('touches finalized session');
   const proposal=new Map(live);proposal.delete(r.id);proposal.set(r.id,{id:r.id,key:r.key,event_time:r.event_time,amount:r.amount});
   const c=components(proposal).find(x=>x.events.some(e=>e.id===r.id));
   if(watermark!==null&&c.last+gap_ms<=watermark-lateness_ms)throw Error('late session');
   live.clear();for(const [id,e] of proposal)live.set(id,e);versions.set(r.id,{rev:r.rev,payload:JSON.stringify(payload)});finalize();
 }
 const out=[...sealed];for(const c of components(live))out.push({...snapshot(c),final:false});out.sort((a,b)=>a.start-b.start||cmp(a.key,b.key));return {watermark,sessions:out};
}
