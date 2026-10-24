export function aggregate({window_ms,lateness_ms,records}){let watermark=null;const accepted=new Map();const bucket=t=>Math.floor(t/window_ms)*window_ms;const closed=t=>watermark!==null&&bucket(t)+window_ms<=watermark-lateness_ms;
 const payload=r=>JSON.stringify(r.kind==='delete'?['delete']:['upsert',r.key,r.event_time,r.amount]);
 for(const r of records){if(r.kind==='watermark'){watermark=watermark===null?r.time:Math.max(watermark,r.time);continue;}const old=accepted.get(r.id);
  if(old&&r.rev<old.rev)continue;if(old&&r.rev===old.rev){if(payload(r)!==payload(old))throw Error('CONFLICT');continue;}
  if((old?.kind==='upsert'&&closed(old.event_time))||(r.kind==='upsert'&&closed(r.event_time)))continue;
  accepted.set(r.id,{...r});
 }
 const buckets=new Map();for(const r of accepted.values()){if(r.kind!=='upsert')continue;const start=bucket(r.event_time),k=JSON.stringify([r.key,start]);let w=buckets.get(k);if(!w){w={key:r.key,start,end:start+window_ms,total:0,count:0,final:closed(r.event_time)};buckets.set(k,w);}w.total+=r.amount;w.count++;}
 return {watermark,windows:[...buckets.values()].sort((a,b)=>a.start-b.start||(a.key<b.key?-1:a.key>b.key?1:0))};}
