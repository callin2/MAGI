// A deliberately small exhaustive optimiser.  Dates used internally are elapsed UTC
// milliseconds; local time is used only while resolving an offered occurrence.
function localParts(fmt, ms) {
  const p = fmt.formatToParts(new Date(ms));
  const o = {};
  for (const x of p) if (x.type !== 'literal') o[x.type] = x.value;
  return [Number(o.year), Number(o.month), Number(o.day), Number(o.hour), Number(o.minute)];
}
function parseCivil(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  return [ +m[1], +m[2], +m[3], +m[4], +m[5] ];
}
function civilStarts(local, zone, fold) {
  const wanted = parseCivil(local), nominal = Date.UTC(wanted[0], wanted[1]-1, wanted[2], wanted[3], wanted[4]);
  if (zone === 'UTC') return [nominal];
  // Offsets in the contracted zones are minute based. Sampling either side of
  // the civil date finds both offsets at a DST change without guessing DST rules.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  const offsets = new Set();
  for (let d = -48; d <= 48; d += 6) {
    const t = nominal + d * 3600000, q = localParts(fmt, t);
    offsets.add(Date.UTC(q[0], q[1]-1, q[2], q[3], q[4]) - t);
  }
  const found = [];
  for (const off of offsets) {
    const t = nominal - off;
    const q = localParts(fmt, t);
    if (q.every((v, i) => v === wanted[i])) found.push(t);
  }
  found.sort((a,b)=>a-b);
  if (found.length < 2) return found;
  return fold === 'earlier' ? [found[0]] : fold === 'later' ? [found[found.length-1]] : found;
}
function overlap(a,b) { return a.start < b.end && b.start < a.end; }
function ascii(a,b) { return a < b ? -1 : a > b ? 1 : 0; }
function scheduleCompare(a,b) {
  const x = a.slice().sort((u,v)=>ascii(u.meeting_id,v.meeting_id));
  const y = b.slice().sort((u,v)=>ascii(u.meeting_id,v.meeting_id));
  for (let i=0;i<Math.min(x.length,y.length);i++) {
    for (const k of ['meeting_id','room_id','startText','endText']) { const c=ascii(x[i][k],y[i][k]); if(c) return c; }
  }
  return x.length-y.length;
}

export function book({range_start, range_end, rooms, transitions, meetings, blocks}) {
  const lo=Date.parse(range_start), hi=Date.parse(range_end);
  const blocked=(room,start,end)=>blocks.some(b=>b.room_id===room && start<Date.parse(b.end) && Date.parse(b.start)<end);
  const choices = new Map();
  for (const m of meetings) {
    const arr=[];
    for (const start of civilStarts(m.local_start,m.zone,m.fold)) {
      const end=start+m.minutes*60000;
      if (start<lo || end>hi) continue;
      for (const room of m.eligible_rooms) if (rooms.includes(room) && !blocked(room,start,end))
        arr.push({m,meeting_id:m.id,room_id:room,start,end,startText:new Date(start).toISOString(),endText:new Date(end).toISOString()});
    }
    arr.sort((a,b)=>ascii(a.room_id,b.room_id)||a.start-b.start);
    choices.set(m.id,arr);
  }
  const order=meetings.slice().sort((a,b)=>b.value-a.value || ascii(a.id,b.id));
  const suffix=new Array(order.length+1).fill(0);
  for(let i=order.length-1;i>=0;i--) suffix[i]=suffix[i+1]+order[i].value;
  let best={value:0,count:0,list:[]};
  function validWith(x, list) {
    for(const y of list) {
      if (x.room_id===y.room_id && overlap(x,y)) return false;
      const common=x.m.people.some(p=>y.m.people.includes(p));
      if (common && overlap(x,y)) return false;
    }
    // Rebuild only affected people's chronological lists. Thus inserting an
    // intermediate meeting correctly replaces the formerly adjacent transition.
    for(const p of x.m.people) {
      const z=list.filter(q=>q.m.people.includes(p)).concat(x).sort((a,b)=>a.start-b.start || a.end-b.end || ascii(a.meeting_id,b.meeting_id));
      for(let i=1;i<z.length;i++) if(z[i].start < z[i-1].end + transitions[z[i-1].room_id][z[i].room_id]*60000) return false;
    }
    for(const y of list) {
      if (x.m.requires.includes(y.meeting_id) && y.end>x.start) return false;
      if (y.m.requires.includes(x.meeting_id) && x.end>y.start) return false;
    }
    return true;
  }
  function requirementsOK(list) {
    const got=new Map(list.map(x=>[x.meeting_id,x]));
    return list.every(x=>x.m.requires.every(id=>{const r=got.get(id); return r && r.end<=x.start;}));
  }
  function visit(i,list,value) {
    const maxCount=list.length + order.length-i;
    if (value+suffix[i] < best.value || (value+suffix[i]===best.value && maxCount<best.count)) return;
    if(i===order.length) {
      if(!requirementsOK(list)) return;
      const candidate={value,count:list.length,list:list.slice()};
      if(candidate.value>best.value || (candidate.value===best.value && (candidate.count>best.count || (candidate.count===best.count && scheduleCompare(candidate.list,best.list)<0)))) best=candidate;
      return;
    }
    const m=order[i];
    for(const x of choices.get(m.id)) if(validWith(x,list)) { list.push(x); visit(i+1,list,value+m.value); list.pop(); }
    visit(i+1,list,value);
  }
  visit(0,[],0);
  const bookings=best.list.slice().sort((a,b)=>ascii(a.meeting_id,b.meeting_id)).map(x=>({meeting_id:x.meeting_id,room_id:x.room_id,start:x.startText,end:x.endText}));
  return {value:best.value,count:best.count,bookings};
}
