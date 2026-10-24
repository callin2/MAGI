const formatters=new Map();function wall(t,zone){let f=formatters.get(zone);if(!f){f=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});formatters.set(zone,f);}const p=Object.fromEntries(f.formatToParts(new Date(t)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
function instants(date,time,zone){const target=date+'T'+time,base=Date.parse(target+'Z'),out=[];for(let m=-1080;m<=1080;m+=15){const t=base+m*60000;if(wall(t,zone)===target)out.push(t);}return out;}
export function plan({zone,range_start,range_end,rules,exclusions,busy}){const low=Date.parse(range_start),high=Date.parse(range_end),out=[];
 for(let day=Math.floor(low/86400000)*86400000-2*86400000;day<=high+2*86400000;day+=86400000){const date=new Date(day).toISOString().slice(0,10),weekday=new Date(day).getUTCDay();
  for(const r of rules){if(r.weekday!==weekday||date<r.from||date>r.through||exclusions.some(x=>x.rule_id===r.id&&x.date===date))continue;let starts=instants(date,r.start,zone);if(r.fold==='earlier')starts=starts.slice(0,1);if(r.fold==='later')starts=starts.slice(-1);
   for(const start of starts){const end=start+r.minutes*60000;if(start<low||end>high||busy.some(b=>start<Date.parse(b.end)&&Date.parse(b.start)<end))continue;out.push({rule_id:r.id,local_date:date,start:new Date(start).toISOString(),end:new Date(end).toISOString()});}
  }
 }
 return out.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||(a.rule_id<b.rule_id?-1:a.rule_id>b.rule_id?1:0));}
