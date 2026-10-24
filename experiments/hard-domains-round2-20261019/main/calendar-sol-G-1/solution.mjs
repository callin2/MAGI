// Resolve civil time by collecting nearby zone offsets, then round-tripping.
// The supported zones in 2024--2026 have at most two offsets near a start.
function instants(local, zone, fold, formatters) {
  const [y, mo, d, h, mi] = local.match(/\d+/g).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (zone === 'UTC') return [wall];
  let fmt = formatters.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    formatters.set(zone, fmt);
  }
  const civil = t => {
    const p = Object.fromEntries(fmt.formatToParts(t).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  };
  const offsets = new Set();
  for (let hours = -36; hours <= 36; hours += 6) {
    const t = wall + hours * 3600000;
    offsets.add(civil(t) - t);
  }
  const times = [...offsets].map(o => wall - o).filter(t => civil(t) === wall).sort((a,b) => a-b);
  if (times.length <= 1 || fold === 'either') return times;
  return [fold === 'earlier' ? times[0] : times[times.length - 1]];
}
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const overlaps = (a,b) => a.start < b.end && b.start < a.end;

export function book({range_start, range_end, rooms, transitions, meetings, blocks}) {
  const lo = Date.parse(range_start), hi = Date.parse(range_end);
  const ms = [...meetings].sort((a,b) => cmp(a.id,b.id));
  const n = ms.length, index = new Map(ms.map((m,i) => [m.id,i]));
  const needs = ms.map(m => m.requires.map(id => index.get(id)));
  const busy = blocks.map(b => ({room: b.room_id, start: Date.parse(b.start), end: Date.parse(b.end)}));
  const fmt = new Map();
  const options = ms.map(m => {
    const times = instants(m.local_start, m.zone, m.fold, fmt);
    const result = [];
    for (const room of [...m.eligible_rooms].sort(cmp)) {
      for (const start of times) {
        const o = {room, start, end: start + m.minutes * 60000};
        if (o.start >= lo && o.end <= hi && !busy.some(b => b.room === room && overlaps(o,b))) result.push(o);
      }
    }
    return result;
  });
  const shares = ms.map(a => ms.map(b => a.people.some(p => b.people.includes(p))));
  const persons = [...new Set(ms.flatMap(m => m.people))];
  const members = persons.map(p => ms.flatMap((m,i) => m.people.includes(p) ? [i] : []));
  const suffixValue = Array(n+1).fill(0), suffixCount = Array(n+1).fill(0);
  for (let i=n-1;i>=0;i--) {
    suffixValue[i] = suffixValue[i+1] + (options[i].length ? ms[i].value : 0);
    suffixCount[i] = suffixCount[i+1] + (options[i].length ? 1 : 0);
  }
  // undefined = undecided, null = omitted, object = selected option.
  const chosen = Array(n);
  let best = {value: 0, count: 0, bookings: []};
  function feasible(next) {
    for (let i=0;i<next;i++) if (chosen[i]) {
      for (const r of needs[i]) {
        if (r < next && (!chosen[r] || chosen[r].end > chosen[i].start)) return false;
        if (r >= next && !options[r].some(o => o.end <= chosen[i].start)) return false;
      }
    }
    for (const ids of members) {
      const ordered = ids.filter(i => chosen[i]).sort((a,b) => chosen[a].start - chosen[b].start);
      for (let k=1;k<ordered.length;k++) {
        const a = chosen[ordered[k-1]], b = chosen[ordered[k]];
        if (b.start >= a.end + transitions[a.room][b.room] * 60000) continue;
        // Nonmetric transitions: an undecided intermediate meeting may repair
        // this gap. Never reject the pair until such insertion is impossible.
        if (!ids.some(i => i >= next && options[i].some(o => o.start >= a.end && o.end <= b.start))) return false;
      }
    }
    return true;
  }
  function visit(i, value, count) {
    const upper = value + suffixValue[i];
    if (upper < best.value || (upper === best.value && count + suffixCount[i] <= best.count)) return;
    if (i === n) {
      // DFS visits equal-count schedules in tuple-lexicographic order, so an
      // objective tie cannot improve the incumbent.
      best = {value, count, bookings: ms.flatMap((m,j) => chosen[j] ? [{
        meeting_id: m.id, room_id: chosen[j].room,
        start: new Date(chosen[j].start).toISOString(), end: new Date(chosen[j].end).toISOString()
      }] : [])};
      return;
    }
    for (const o of options[i]) {
      let ok = true;
      for (let j=0;j<i;j++) if (chosen[j] && (o.room === chosen[j].room || shares[i][j]) && overlaps(o,chosen[j])) { ok=false; break; }
      if (!ok) continue;
      chosen[i] = o;
      if (feasible(i+1)) visit(i+1, value + ms[i].value, count+1);
    }
    chosen[i] = null;
    if (feasible(i+1)) visit(i+1, value, count);
    chosen[i] = undefined;
  }
  visit(0,0,0);
  return best;
}
