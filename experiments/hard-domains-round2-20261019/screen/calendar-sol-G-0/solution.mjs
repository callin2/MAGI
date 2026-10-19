// Recommendations only: no calendar access or input mutation.
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const MINUTE = 60000;
function instants(local, zone, fold) {
  const nominal = Date.parse(local + ':00Z');
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, calendar: 'iso8601', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const civil = t => {
    const p = Object.fromEntries(fmt.formatToParts(t).map(p => [p.type, p.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  };
  // All supported zones have constant offsets on either side of a nearby
  // transition. Sampling both sides also handles Lord Howe's half-hour shift.
  const offsets = new Set();
  for (let h = -48; h <= 48; h += 6) {
    const t = nominal + h * 3600000;
    offsets.add(Date.parse(civil(t) + 'Z') - t);
  }
  const times = [...offsets].map(o => nominal - o)
    .filter(t => civil(t) === local + ':00').sort((a, b) => a - b);
  if (times.length < 2 || fold === 'either') return times;
  return [fold === 'later' ? times[times.length - 1] : times[0]];
}

export function book({range_start, range_end, rooms, transitions, meetings, blocks}) {
  const lo = Date.parse(range_start), hi = Date.parse(range_end);
  const ms = [...meetings].sort((a, b) => cmp(a.id, b.id));
  const n = ms.length, index = new Map(ms.map((m, i) => [m.id, i]));
  const busy = blocks.map(b => ({room: b.room_id, start: Date.parse(b.start), end: Date.parse(b.end)}));
  const overlap = (a, b) => a.start < b.end && b.start < a.end;
  const options = ms.map(m => {
    const out = [];
    for (const start of instants(m.local_start, m.zone, m.fold)) {
      const end = start + m.minutes * MINUTE;
      if (start < lo || end > hi) continue;
      for (const room of m.eligible_rooms) {
        const o = {room, start, end};
        if (!busy.some(b => b.room === room && overlap(o, b))) out.push(o);
      }
    }
    return out.sort((a, b) => cmp(a.room, b.room) || a.start - b.start || a.end - b.end);
  });
  const req = ms.map(m => m.requires.map(id => index.get(id)));
  const shares = ms.map(m => ms.map(other => m.people.some(p => other.people.includes(p))));
  const people = [...new Set(ms.flatMap(m => m.people))];
  const participants = people.map(p => ms.flatMap((m, i) => m.people.includes(p) ? [i] : []));
  const upperValue = Array(n + 1).fill(0), upperCount = Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; --i) {
    upperValue[i] = upperValue[i + 1] + (options[i].length ? ms[i].value : 0);
    upperCount[i] = upperCount[i + 1] + (options[i].length ? 1 : 0);
  }
  const chosen = Array(n).fill(null);
  let best = {value: 0, count: 0, bookings: []};

  function valid(depth) {
    for (let i = 0; i < depth; ++i) if (chosen[i]) {
      for (const j of req[i]) {
        if (j < depth) {
          if (!chosen[j] || chosen[j].end > chosen[i].start) return false;
        } else if (!options[j].some(o => o.end <= chosen[i].start)) return false;
      }
      for (let j = 0; j < i; ++j) if (chosen[j] &&
        (chosen[i].room === chosen[j].room || shares[i][j]) && overlap(chosen[i], chosen[j])) return false;
    }
    for (const ids of participants) {
      const selected = ids.filter(i => i < depth && chosen[i]).sort((a, b) => chosen[a].start - chosen[b].start);
      for (let k = 1; k < selected.length; ++k) {
        const a = chosen[selected[k - 1]], b = chosen[selected[k]];
        if (b.start >= a.end + transitions[a.room][b.room] * MINUTE) continue;
        // A failing transition is not hereditary: an as-yet unassigned
        // intermediate meeting may replace it with two different transitions.
        const canInsert = ids.some(i => i >= depth && options[i].some(o => o.start >= a.end && o.end <= b.start));
        if (!canInsert) return false;
      }
    }
    return true;
  }
  function search(depth, value, count) {
    const uv = value + upperValue[depth], uc = count + upperCount[depth];
    // DFS visits equal-count schedules in tuple-lexicographic order: IDs and
    // options ascend, and selecting an ID precedes skipping it. Thus the first
    // schedule attaining an objective pair is its lexicographic minimum.
    if (uv < best.value || (uv === best.value && uc <= best.count)) return;
    if (depth === n) {
      best = {value, count, bookings: chosen.flatMap((o, i) => o ? [{
        meeting_id: ms[i].id, room_id: o.room,
        start: new Date(o.start).toISOString(), end: new Date(o.end).toISOString()
      }] : [])};
      return;
    }
    for (const o of options[depth]) {
      chosen[depth] = o;
      if (valid(depth + 1)) search(depth + 1, value + ms[depth].value, count + 1);
    }
    chosen[depth] = null;
    if (valid(depth + 1)) search(depth + 1, value, count);
  }
  search(0, 0, 0);
  return best;
}
