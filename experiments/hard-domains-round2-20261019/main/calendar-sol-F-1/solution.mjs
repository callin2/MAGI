// Civil starts are resolved before optimization; every event is an actual instant.
const minute = 60000;
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function resolveStart(meeting, formatters) {
  const { zone, local_start, fold } = meeting;
  let fmt = formatters.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    formatters.set(zone, fmt);
  }
  const civilNumber = t => {
    const p = Object.fromEntries(fmt.formatToParts(t).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  };
  const nominal = Date.parse(local_start + ':00.000Z');
  const offsets = new Set();
  // All supported zones have constant offsets on either side of a change
  // for far longer than six hours. Sample both sides, including half-hour DST.
  for (let h = -48; h <= 48; h += 6) {
    const t = nominal + h * 60 * minute;
    offsets.add(civilNumber(t) - t);
  }
  const matches = [...offsets].map(offset => nominal - offset)
    .filter(t => civilNumber(t) === nominal).sort((a, b) => a - b);
  if (matches.length < 2 || fold === 'either') return matches;
  return [fold === 'earlier' ? matches[0] : matches[matches.length - 1]];
}

export function book({ range_start, range_end, rooms, transitions, meetings, blocks }) {
  const lo = Date.parse(range_start), hi = Date.parse(range_end);
  const sorted = [...meetings].sort((a, b) => cmp(a.id, b.id));
  const index = new Map(sorted.map((m, i) => [m.id, i]));
  const people = new Map();
  for (const m of sorted) for (const p of m.people) {
    if (!people.has(p)) people.set(p, people.size);
  }
  const personLists = sorted.map(m => m.people.map(p => people.get(p)));
  const requirements = sorted.map(m => m.requires.map(id => index.get(id)));
  const roomIndex = new Map(rooms.map((r, i) => [r, i]));
  const busy = rooms.map(r => blocks.filter(b => b.room_id === r)
    .map(b => [Date.parse(b.start), Date.parse(b.end)]));
  const events = [], formatters = new Map();
  sorted.forEach((m, i) => {
    for (const start of resolveStart(m, formatters)) {
      const end = start + m.minutes * minute;
      if (start < lo || end > hi) continue;
      const choices = [...m.eligible_rooms].sort(cmp).map(r => roomIndex.get(r))
        .filter(r => !busy[r].some(([s, e]) => start < e && s < end));
      if (choices.length) events.push({ i, start, end, choices });
    }
  });
  events.sort((a, b) => a.start - b.start || a.i - b.i);
  const suffix = Array(events.length + 1).fill(0);
  for (let k = events.length - 1; k >= 0; k--) suffix[k] = suffix[k + 1] | (1 << events[k].i);
  const selected = Array(sorted.length).fill(null);
  const roomEnds = rooms.map(() => -Infinity);
  const last = Array(people.size).fill(null);
  let best = { value: 0, count: 0, bookings: [] };
  function lexLess(a, b) {
    for (let j = 0; j < a.length; j++) {
      for (const key of ['meeting_id', 'room_id', 'start', 'end']) {
        const c = cmp(a[j][key], b[j][key]);
        if (c) return c < 0;
      }
    }
    return false;
  }
  function visit(k, mask, value, count) {
    let upperValue = value, upperCount = count;
    const remaining = suffix[k] & ~mask;
    for (let i = 0; i < sorted.length; i++) if (remaining & (1 << i)) {
      upperValue += sorted[i].value;
      upperCount++;
    }
    if (upperValue < best.value || (upperValue === best.value && upperCount < best.count)) return;
    if (k === events.length) {
      if (value < best.value || (value === best.value && count < best.count)) return;
      const bookings = selected.filter(Boolean).map(b => ({
        meeting_id: sorted[b.i].id, room_id: rooms[b.r],
        start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString()
      }));
      if (value > best.value || count > best.count || lexLess(bookings, best.bookings)) {
        best = { value, count, bookings };
      }
      return;
    }
    const ev = events[k], { i, start, end } = ev;
    if (!(mask & (1 << i)) && requirements[i].every(j => selected[j] && selected[j].end <= start)) {
      for (const r of ev.choices) {
        if (roomEnds[r] > start) continue;
        const ps = personLists[i];
        if (ps.some(p => last[p] && start < last[p].end + transitions[rooms[last[p].r]][rooms[r]] * minute)) continue;
        const oldEnd = roomEnds[r], oldPeople = ps.map(p => last[p]);
        const booking = { i, r, start, end };
        selected[i] = booking;
        roomEnds[r] = end;
        for (const p of ps) last[p] = booking;
        // Chronological search makes these the final consecutive-person edges:
        // no later decision can insert a meeting between them.
        visit(k + 1, mask | (1 << i), value + sorted[i].value, count + 1);
        selected[i] = null;
        roomEnds[r] = oldEnd;
        ps.forEach((p, j) => { last[p] = oldPeople[j]; });
      }
    }
    visit(k + 1, mask, value, count);
  }
  visit(0, 0, 0, 0);
  return best;
}
