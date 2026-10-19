// Exhaustive (but bounded) optimizer.  Meeting times are fixed civil times; only
// their DST occurrence and room are choices.
const OFFSETS = {
  UTC:[0], 'America/New_York':[-300,-240], 'Europe/Berlin':[60,120],
  'Asia/Kathmandu':[345], 'Australia/Lord_Howe':[630,660]
};
const fmts = new Map();
function formatter(zone) {
  if (!fmts.has(zone)) fmts.set(zone, new Intl.DateTimeFormat('en-US', {
    timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',
    hourCycle:'h23'
  }));
  return fmts.get(zone);
}
function occurrences(m) {
  const q=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(m.local_start);
  const want=[+q[1],+q[2],+q[3],+q[4],+q[5]];
  const nominal=Date.UTC(want[0],want[1]-1,want[2],want[3],want[4]);
  const ans=[];
  for (const offset of OFFSETS[m.zone]) {
    const t=nominal-offset*60000;
    const p={};
    for (const x of formatter(m.zone).formatToParts(new Date(t))) if (x.type!=='literal') p[x.type]=+x.value;
    if (p.year===want[0]&&p.month===want[1]&&p.day===want[2]&&p.hour===want[3]&&p.minute===want[4]) ans.push(t);
  }
  ans.sort((a,b)=>a-b);
  if (ans.length<2) return ans;
  if (m.fold==='earlier') return [ans[0]];
  if (m.fold==='later') return [ans[ans.length-1]];
  return ans;
}
const cmp=(a,b)=>a<b?-1:a>b?1:0;
function overlap(a,b,c,d) { return a<d && c<b; }

export function book(input) {
  const rangeStart=Date.parse(input.range_start), rangeEnd=Date.parse(input.range_end);
  const byId=new Map(input.meetings.map(m=>[m.id,m]));
  const options=new Map();
  for (const m of input.meetings) {
    const os=[];
    for (const start of occurrences(m)) {
      const end=start+m.minutes*60000;
      if (start<rangeStart || end>rangeEnd) continue;
      for (const room_id of m.eligible_rooms) os.push({m,room_id,start,end});
    }
    os.sort((a,b)=>cmp(a.room_id,b.room_id)||a.start-b.start);
    options.set(m.id,os);
  }
  const indeg=new Map(), children=new Map();
  for (const m of input.meetings) { indeg.set(m.id,m.requires.length); children.set(m.id,[]); }
  for (const m of input.meetings) for (const r of m.requires) children.get(r).push(m.id);
  const todo=[...input.meetings].filter(m=>indeg.get(m.id)===0), order=[];
  while(todo.length) {
    todo.sort((a,b)=>options.get(a.id).length-options.get(b.id).length||cmp(a.id,b.id));
    const m=todo.shift(); order.push(m);
    for(const x of children.get(m.id)) { indeg.set(x,indeg.get(x)-1); if(!indeg.get(x)) todo.push(byId.get(x)); }
  }
  const blocks=input.blocks.map(b=>({room_id:b.room_id,start:Date.parse(b.start),end:Date.parse(b.end)}));
  let best={value:0,count:0,bookings:[]};
  const selected=[], chosen=new Set();
  const suffix=new Array(order.length+1).fill(0);
  for(let i=order.length-1;i>=0;i--) suffix[i]=suffix[i+1]+order[i].value;
  function output(value) {
    const bookings=selected.map(x=>({meeting_id:x.m.id,room_id:x.room_id,start:new Date(x.start).toISOString(),end:new Date(x.end).toISOString()}))
      .sort((a,b)=>cmp(a.meeting_id,b.meeting_id));
    return {value,count:bookings.length,bookings};
  }
  function better(x,y) {
    if(x.value!==y.value)return x.value>y.value;
    if(x.count!==y.count)return x.count>y.count;
    for(let i=0;i<x.bookings.length;i++) for(const k of ['meeting_id','room_id','start','end']) {
      const z=cmp(x.bookings[i][k],y.bookings[i][k]); if(z)return z<0;
    }
    return false;
  }
  function feasible(x) {
    // Requirements were chosen earlier topologically, but their time still has
    // to precede this dependent booking.
    for(const id of x.m.requires) if(selected.find(y=>y.m.id===id).end>x.start) return false;
    for(const b of blocks) if(b.room_id===x.room_id&&overlap(x.start,x.end,b.start,b.end)) return false;
    for(const y of selected) if(y.room_id===x.room_id&&overlap(x.start,x.end,y.start,y.end)) return false;
    for(const p of x.m.people) {
      const chain=selected.filter(y=>y.m.people.includes(p)).concat(x).sort((a,b)=>a.start-b.start);
      for(let i=1;i<chain.length;i++) {
        const a=chain[i-1], b=chain[i];
        if (b.start<a.end) return false;
        if (b.start<a.end+input.transitions[a.room_id][b.room_id]*60000) return false;
      }
    }
    return true;
  }
  function dfs(i,value) {
    if(value+suffix[i]<best.value) return;
    if(i===order.length) { const got=output(value); if(better(got,best))best=got; return; }
    const m=order[i];
    if(m.requires.every(r=>chosen.has(r))) for(const x of options.get(m.id)) if(feasible(x)) {
      selected.push(x); chosen.add(m.id); dfs(i+1,value+m.value); chosen.delete(m.id); selected.pop();
    }
    dfs(i+1,value);
  }
  dfs(0,0);
  return best;
}
