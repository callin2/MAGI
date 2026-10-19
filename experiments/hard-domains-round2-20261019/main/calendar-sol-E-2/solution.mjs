// Exact bounded search. No calendar I/O; all state belongs to this invocation.
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const overlap = (a, b) => a.s < b.e && b.s < a.e;

function resolveLocal(meeting, formatters) {
  const {zone, local_start, fold} = meeting;
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }));
  const formatter = formatters.get(zone);
  function civil(t) {
    const p = Object.fromEntries(formatter.formatToParts(t).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  }
  const nominal = Date.parse(local_start + ':00Z');
  // All offsets on either side of a transition in the supported zones/years.
  const offsets = new Set();
  for (let h = -48; h <= 48; h += 6) {
    const t = nominal + h * 3600000;
    offsets.add(Date.parse(civil(t) + 'Z') - t);
  }
  const starts = [...offsets].map(o => nominal - o)
    .filter(t => civil(t) === local_start + ':00').sort((a, b) => a - b);
  if (starts.length < 2 || fold === 'either') return starts;
  return [fold === 'earlier' ? starts[0] : starts[starts.length - 1]];
}

export function book({range_start, range_end, rooms, transitions, meetings, blocks}) {
  const lo = Date.parse(range_start), hi = Date.parse(range_end);
  const busy = blocks.map(b => ({room: b.room_id, s: Date.parse(b.start), e: Date.parse(b.end)}));
  const formatters = new Map();
  const ms = [...meetings].sort((a, b) => cmp(a.id, b.id));
  const index = new Map(ms.map((m, i) => [m.id, i]));
  const options = ms.map(m => {
    const out = [];
    for (const s of resolveLocal(m, formatters)) {
      const e = s + m.minutes * 60000;
      if (s < lo || e > hi) continue;
      for (const room of m.eligible_rooms) {
        const o = {s, e, room, booking: {meeting_id: m.id, room_id: room,
          start: new Date(s).toISOString(), end: new Date(e).toISOString()}};
        if (!busy.some(b => b.room === room && overlap(o, b))) out.push(o);
      }
    }
    return out.sort((a, b) => cmp(a.room, b.room) || a.s - b.s || a.e - b.e);
  });
  const n = ms.length;
  const req = ms.map(m => m.requires.map(id => index.get(id)));
  const shared = ms.map(a => ms.map(b => a.people.some(p => b.people.includes(p))));
  const persons = [...new Set(ms.flatMap(m => m.people))];
  const personMeetings = persons.map(p => ms.flatMap((m, i) => m.people.includes(p) ? [i] : []));
  const suffixValue = Array(n + 1).fill(0), suffixCount = Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    suffixValue[i] = suffixValue[i + 1] + (options[i].length ? ms[i].value : 0);
    suffixCount[i] = suffixCount[i + 1] + (options[i].length ? 1 : 0);
  }
  const chosen = Array(n).fill(null);
  let best = {value: 0, count: 0, bookings: []};
  function lex(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      for (const k of ['meeting_id', 'room_id', 'start', 'end']) {
        const c = cmp(a[i][k], b[i][k]);
        if (c) return c;
      }
    }
    return a.length - b.length;
  }
  function feasible(next) {
    for (let i = 0; i < next; i++) if (chosen[i]) {
      for (const r of req[i]) {
        if (r < next) {
          if (!chosen[r] || chosen[r].e > chosen[i].s) return false;
        } else if (!options[r].some(o => o.e <= chosen[i].s)) return false;
      }
    }
    for (const indices of personMeetings) {
      const selected = indices.filter(i => chosen[i]).sort((i, j) => chosen[i].s - chosen[j].s);
      for (let k = 1; k < selected.length; k++) {
        const a = chosen[selected[k - 1]], b = chosen[selected[k]];
        if (b.s >= a.e + transitions[a.room][b.room] * 60000) continue;
        // A later search decision may insert a meeting, replacing this directed
        // edge. Never reject such a partial schedule solely for this edge.
        if (!indices.some(i => i >= next && options[i].some(o => o.s >= a.e && o.e <= b.s))) return false;
      }
    }
    return true;
  }
  function search(i, value, count) {
    const upper = value + suffixValue[i], upperCount = count + suffixCount[i];
    if (upper < best.value || (upper === best.value && upperCount < best.count)) return;
    if (upper === best.value && upperCount === best.count) {
      const optimistic = chosen.slice(0, i).filter(Boolean).map(o => o.booking);
      for (let j = i; j < n; j++) if (options[j].length) optimistic.push(options[j][0].booking);
      if (lex(optimistic, best.bookings) >= 0) return;
    }
    if (i === n) {
      best = {value, count, bookings: chosen.filter(Boolean).map(o => ({...o.booking}))};
      return;
    }
    for (const o of options[i]) {
      let conflict = false;
      for (let j = 0; j < i; j++) if (chosen[j] &&
        (chosen[j].room === o.room || shared[i][j]) && overlap(chosen[j], o)) {
        conflict = true; break;
      }
      if (conflict) continue;
      chosen[i] = o;
      if (feasible(i + 1)) search(i + 1, value + ms[i].value, count + 1);
    }
    chosen[i] = null;
    if (feasible(i + 1)) search(i + 1, value, count);
  }
  search(0, 0, 0);
  return best;
}
