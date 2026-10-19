const fmtCache = new Map();
function formatter(zone) {
  if (!fmtCache.has(zone)) fmtCache.set(zone, new Intl.DateTimeFormat('en-GB', {timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  return fmtCache.get(zone);
}
function partsAt(ms, zone) {
  const p = Object.fromEntries(formatter(zone).formatToParts(new Date(ms)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {year:+p.year,month:+p.month,day:+p.day,hour:+p.hour,minute:+p.minute,second:+p.second};
}
function matches(p,y,m,d,h,mi) {return p.year===y&&p.month===m&&p.day===d&&p.hour===h&&p.minute===mi&&p.second===0;}
function resolveLocal(date, clock, zone) {
  const [y,m,d]=date.split('-').map(Number), [h,mi]=clock.split(':').map(Number), naive=Date.UTC(y,m-1,d,h,mi);
  const offsets=new Set();
  // Sampling both sides catches all supported-zone transitions, including Lord Howe's half-hour change.
  for(let delta=-48*60;delta<=48*60;delta+=30){const t=naive+delta*60000,p=partsAt(t,zone); offsets.add(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-t);}
  return [...offsets].map(off=>naive-off).filter(t=>matches(partsAt(t,zone),y,m,d,h,mi)).sort((a,b)=>a-b);
}
function dateShift(s,n){const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function plan({zone,range_start,range_end,rules,exclusions,busy}) {
  const lo=Date.parse(range_start), hi=Date.parse(range_end), out=[];
  if(!rules.length)return out;
  const excluded=new Set(exclusions.map(x=>`${x.rule_id}\0${x.date}`));
  const busyMs=busy.map(b=>[Date.parse(b.start),Date.parse(b.end)]);
  const first=dateShift(range_start.slice(0,10),-2), last=dateShift(range_end.slice(0,10),2);
  for(let date=first;date<=last;date=dateShift(date,1)){
    const weekday=new Date(date+'T00:00:00Z').getUTCDay();
    for(const r of rules){
      if(weekday!==r.weekday||date<r.from||date>r.through||excluded.has(`${r.id}\0${date}`))continue;
      const instants=resolveLocal(date,r.start,zone); if(!instants.length)continue;
      const selected=instants.length===1?instants:(r.fold==='earlier'?[instants[0]]:r.fold==='later'?[instants.at(-1)]:instants);
      for(const start of selected){const end=start+r.minutes*60000;if(start<lo||end>hi||end<=start)continue;if(busyMs.some(([a,b])=>start<b&&a<end))continue;
        out.push({rule_id:r.id,local_date:date,start:new Date(start).toISOString(),end:new Date(end).toISOString()});}
    }
  }
  return out.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||(a.rule_id<b.rule_id?-1:a.rule_id>b.rule_id?1:0));
}
