function wall(t,zone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t));const x=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${x.year}-${x.month}-${x.day}T${x.hour}:${x.minute}`;}
export function alarm(local,zone){const base=Date.parse(local+'Z');for(let t=base-18*3600000;t<=base+18*3600000;t+=60000)if(wall(t,zone)===local)return t;return null;}
export function overlaps(a,b){return a.start<b.end&&b.start<a.end;}
