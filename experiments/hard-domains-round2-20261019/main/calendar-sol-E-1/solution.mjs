// Pure recommendation engine: all times below are elapsed UTC milliseconds.
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const overlap = (a, b) => a.start < b.end && b.start < a.end;

function occurrences(meeting) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: meeting.zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const civil = time => {
    const p = Object.fromEntries(fmt.formatToParts(time).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  };
  const naive = Date.parse(meeting.local_start + ':00Z');
  // Both offsets around any supported 2024-2026 transition occur in this window.
  const offsets = new Set();
  for (let h = -48; h <= 48; h += 6) {
    const t = naive + h * 3600000;
    offsets.add(Date.parse(civil(t) + 'Z') - t);
  }
  const times = [...offsets].map(o => naive - o)
    .filter(t => civil(t) === meeting.local_start + ':00').sort((a,b) => a-b);
  if (times.length < 2 || meeting.fold === 'either') return times;
  return [meeting.fold === 'earlier' ? times[0] : times[times.length - 1]];
}

export function book({range_start, range_end, rooms, transitions, meetings, blocks}) {
  const lo = Date.parse(range_start), hi = Date.parse(range_end);
  const ms = [...meetings].sort((a,b) => cmp(a.id,b.id));
  const n = ms.length;
  const index = new Map(ms.map((m,i) => [m.id,i]));
  const req = ms.map(m => m.requires.map(id => index.get(id)));
  const busy = blocks.map(b => ({room: b.room_id, start: Date.parse(b.start), end: Date.parse(b.end)}));
  const opts = ms.map(m => {
    const result = [];
    for (const start of occurrences(m)) {
      const end = start + m.minutes * 60000;
      if (start < lo || end > hi) continue;
      for (const room of [...m.eligible_rooms].sort(cmp)) {
        const o = {room, start, end};
        if (!busy.some(b => b.room === room && overlap(o,b))) result.push(o);
      }
    }
    return result.sort((a,b) => cmp(a.room,b.room) || a.start-b.start || a.end-b.end);
  });
  const shared = ms.map(a => ms.map(b => a.people.some(p => b.people.includes(p))));
  const suffixValue = Array(n+1).fill(0), suffixCount = Array(n+1).fill(0);
  for (let i=n-1;i>=0;i--) {
    suffixValue[i] = suffixValue[i+1] + (opts[i].length ? ms[i].value : 0);
    suffixCount[i] = suffixCount[i+1] + (opts[i].length ? 1 : 0);
  }
  const selected = Array(n).fill(null);
  let bestValue = 0, bestCount = 0, best = [];
  const sequence = (through=n, optimistic=false) => {
    const seq = [];
    for (let j=0;j<n;j++) {
      const o = j < through ? selected[j] : optimistic ? opts[j][0] : null;
      if (o) seq.push({meeting_id: ms[j].id, room_id: o.room,
        start: new Date(o.start).toISOString(), end: new Date(o.end).toISOString()});
    }
    return seq;
  };
  const lex = (a,b) => {
    for (let j=0;j<Math.min(a.length,b.length);j++) {
      for (const k of ['meeting_id','room_id','start','end']) {
        const c = cmp(a[j][k],b[j][k]);
        if (c) return c;
      }
    }
    return a.length-b.length;
  };
  function transitionsOK() {
    const byPerson = new Map();
    for (let j=0;j<n;j++) if (selected[j]) {
      for (const p of ms[j].people) {
        if (!byPerson.has(p)) byPerson.set(p,[]);
        byPerson.get(p).push(selected[j]);
      }
    }
    for (const list of byPerson.values()) {
      list.sort((a,b) => a.start-b.start);
      for (let j=1;j<list.length;j++) {
        const a=list[j-1], b=list[j];
        if (b.start < a.end + transitions[a.room][b.room]*60000) return false;
      }
    }
    return true;
  }
  function search(i,value,count) {
    const maxValue=value+suffixValue[i], maxCount=count+suffixCount[i];
    if (maxValue < bestValue || (maxValue === bestValue && maxCount < bestCount)) return;
    // If reaching both bounds requires all available meetings, their smallest
    // options give a safe lexical lower bound, even if that bound is infeasible.
    if (maxValue === bestValue && maxCount === bestCount &&
        lex(sequence(i,true),best) >= 0) return;
    if (i === n) {
      // Setup is deliberately checked only on the completed schedule. Inserting
      // a meeting can repair an otherwise invalid directed, nonmetric transition.
      if (!transitionsOK()) return;
      const seq = sequence();
      if (value > bestValue || (value === bestValue && (count > bestCount ||
          (count === bestCount && lex(seq,best)<0)))) {
        bestValue=value; bestCount=count; best=seq;
      }
      return;
    }
    for (const o of opts[i]) {
      let valid=true;
      for (let j=0;j<i && valid;j++) {
        const p=selected[j];
        if (req[i].includes(j) && (!p || p.end > o.start)) valid=false;
        if (p && req[j].includes(i) && o.end > p.start) valid=false;
        if (p && (p.room===o.room || shared[i][j]) && overlap(p,o)) valid=false;
      }
      if (valid) {
        selected[i]=o;
        search(i+1,value+ms[i].value,count+1);
      }
    }
    selected[i]=null;
    // A selected dependent cannot survive omitting this requirement.
    if (!ms.some((m,j) => j<i && selected[j] && req[j].includes(i))) search(i+1,value,count);
  }
  search(0,0,0);
  return {value: bestValue, count: bestCount, bookings: best};
}
