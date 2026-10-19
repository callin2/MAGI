// Resolve civil times by discovering the offsets on both sides of any nearby
// transition, then round-tripping each candidate. No host-local timezone is used.
function instants(local, zone, fold) {
  const [y, mo, d, h, mi] = local.match(/\d+/g).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const civil = t => {
    const p = Object.fromEntries(fmt.formatToParts(t).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  };
  const offsets = new Set();
  // Supported zones in 2024-2026 have constant offsets on each side of
  // isolated transitions; this window includes both sides even for gaps.
  for (let dh = -48; dh <= 48; dh += 6) {
    const t = wall + dh * 3600000;
    offsets.add(civil(t) - t);
  }
  const times = [...offsets].map(o => wall - o)
    .filter(t => civil(t) === wall).sort((a, b) => a - b);
  if (times.length < 2 || fold === 'either') return times;
  return [fold === 'earlier' ? times[0] : times[times.length - 1]];
}
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function compareBookings(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    for (const k of ['meeting_id', 'room_id', 'start', 'end']) {
      const c = cmp(a[i][k], b[i][k]);
      if (c) return c;
    }
  }
  return a.length - b.length;
}

export function book({range_start, range_end, rooms, transitions, meetings, blocks}) {
  const lo = Date.parse(range_start), hi = Date.parse(range_end);
  const ms = [...meetings].sort((a, b) => cmp(a.id, b.id));
  const ids = new Map(ms.map((m, i) => [m.id, i]));
  const busy = new Map(rooms.map(r => [r, []]));
  for (const b of blocks) busy.get(b.room_id).push([Date.parse(b.start), Date.parse(b.end)]);
  const events = [];
  ms.forEach((m, i) => {
    for (const start of instants(m.local_start, m.zone, m.fold)) {
      const end = start + m.minutes * 60000;
      if (start < lo || end > hi) continue;
      const options = [...m.eligible_rooms].sort(cmp)
        .filter(r => !busy.get(r).some(([s, e]) => start < e && s < end))
        .map(room_id => ({meeting_id: m.id, room_id,
          start: new Date(start).toISOString(), end: new Date(end).toISOString()}));
      if (options.length) events.push({i, start, end, options});
    }
  });
  events.sort((a, b) => a.start - b.start || a.i - b.i);
  const chosen = Array(ms.length).fill(null);
  const roomLast = new Map(), personLast = new Map();
  let best = {value: 0, count: 0, bookings: []};

  function search(pos, value, count) {
    const bookings = chosen.filter(Boolean).map(x => x.booking);
    if (value > best.value || (value === best.value &&
        (count > best.count || (count === best.count && compareBookings(bookings, best.bookings) < 0)))) {
      best = {value, count, bookings};
    }
    // Each remaining meeting contributes at most once. Also construct a
    // lexicographic lower bound, ignoring conflicts, for tied objective bounds.
    const optimistic = chosen.map(x => x && x.booking);
    for (let p = pos; p < events.length; p++) {
      const e = events[p];
      if (chosen[e.i]) continue;
      const b = e.options[0];
      if (!optimistic[e.i] || compareBookings([b], [optimistic[e.i]]) < 0) optimistic[e.i] = b;
    }
    let upperValue = value, upperCount = count;
    for (let i = 0; i < ms.length; i++) if (!chosen[i] && optimistic[i]) {
      upperValue += ms[i].value; upperCount++;
    }
    if (upperValue < best.value || (upperValue === best.value && upperCount < best.count)) return;
    if (upperValue === best.value && upperCount === best.count &&
        compareBookings(optimistic.filter(Boolean), best.bookings) >= 0) return;
    if (pos === events.length) return;
    const e = events[pos], m = ms[e.i];
    if (!chosen[e.i] && m.requires.every(id => chosen[ids.get(id)] && chosen[ids.get(id)].end <= e.start)) {
      for (const booking of e.options) {
        const room = booking.room_id;
        if ((roomLast.get(room) ?? -Infinity) > e.start) continue;
        if (m.people.some(p => {
          const last = personLast.get(p);
          return last && e.start < last.end + transitions[last.room][room] * 60000;
        })) continue;
        const oldRoom = roomLast.get(room);
        const oldPeople = m.people.map(p => personLast.get(p));
        roomLast.set(room, e.end);
        m.people.forEach(p => personLast.set(p, {end: e.end, room}));
        chosen[e.i] = {booking, end: e.end};
        search(pos + 1, value + m.value, count + 1);
        chosen[e.i] = null;
        if (oldRoom === undefined) roomLast.delete(room); else roomLast.set(room, oldRoom);
        m.people.forEach((p, j) => {
          if (oldPeople[j] === undefined) personLast.delete(p); else personLast.set(p, oldPeople[j]);
        });
      }
    }
    search(pos + 1, value, count);
  }
  search(0, 0, 0);
  return best;
}
