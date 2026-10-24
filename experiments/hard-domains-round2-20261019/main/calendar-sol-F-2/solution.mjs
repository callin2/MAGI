// Resolve civil time before doing any scheduling arithmetic. In the supported
// zones (2024-2026), every offset regime adjoining a transition lasts > 1 hour.
function civilInstants(local, zone, fold, formatters) {
  const fields = local.match(/\d+/g).map(Number);
  const wall = Date.UTC(fields[0], fields[1] - 1, fields[2], fields[3], fields[4]);
  if (zone === 'UTC') return [wall];
  let fmt = formatters.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    formatters.set(zone, fmt);
  }
  function civilAt(t) {
    const p = {};
    for (const { type, value } of fmt.formatToParts(t)) {
      if (type !== 'literal') p[type] = Number(value);
    }
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  const offsets = new Set();
  for (let h = -48; h <= 48; h++) {
    const t = wall + h * 3600000;
    offsets.add(civilAt(t) - t);
  }
  const candidates = [...offsets].map(o => wall - o)
    .filter(t => civilAt(t) === wall).sort((a, b) => a - b);
  if (candidates.length <= 1 || fold === 'either') return candidates;
  return [fold === 'earlier' ? candidates[0] : candidates[candidates.length - 1]];
}
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const overlaps = (a, b) => a.start < b.end && b.start < a.end;

export function book({ range_start, range_end, rooms, transitions, meetings, blocks }) {
  const lo = Date.parse(range_start), hi = Date.parse(range_end);
  const sorted = [...meetings].sort((a, b) => cmp(a.id, b.id));
  const index = new Map(sorted.map((m, i) => [m.id, i]));
  const busy = blocks.map(b => ({ room: b.room_id, start: Date.parse(b.start), end: Date.parse(b.end) }));
  const formatters = new Map();
  const options = sorted.map(m => {
    const result = [];
    for (const start of civilInstants(m.local_start, m.zone, m.fold, formatters)) {
      const end = start + m.minutes * 60000;
      if (start < lo || end > hi) continue;
      for (const room of m.eligible_rooms) {
        const option = { room, start, end };
        if (!busy.some(b => b.room === room && overlaps(b, option))) result.push(option);
      }
    }
    return result.sort((a, b) => cmp(a.room, b.room) || a.start - b.start || a.end - b.end);
  });
  const n = sorted.length;
  const shared = sorted.map(a => sorted.map(b => a.people.some(p => b.people.includes(p))));
  const requires = sorted.map(m => m.requires.map(id => index.get(id)));
  const remainingValue = Array(n + 1).fill(0);
  const remainingCount = Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    remainingValue[i] = remainingValue[i + 1] + (options[i].length ? sorted[i].value : 0);
    remainingCount[i] = remainingCount[i + 1] + (options[i].length ? 1 : 0);
  }
  const selected = Array(n).fill(null);
  let best = { value: 0, count: 0, bookings: [] };
  function compareBookings(a, b) {
    for (let i = 0; i < a.length; i++) {
      for (const key of ['meeting_id', 'room_id', 'start', 'end']) {
        const c = cmp(a[i][key], b[i][key]);
        if (c) return c;
      }
    }
    return 0;
  }
  function setupValid() {
    const byPerson = new Map();
    for (let i = 0; i < n; i++) if (selected[i]) {
      for (const p of sorted[i].people) {
        if (!byPerson.has(p)) byPerson.set(p, []);
        byPerson.get(p).push(selected[i]);
      }
    }
    for (const timeline of byPerson.values()) {
      timeline.sort((a, b) => a.start - b.start);
      for (let j = 1; j < timeline.length; j++) {
        const a = timeline[j - 1], b = timeline[j];
        if (b.start < a.end + transitions[a.room][b.room] * 60000) return false;
      }
    }
    return true;
  }
  function search(i, value, count) {
    const upper = value + remainingValue[i];
    if (upper < best.value || (upper === best.value && count + remainingCount[i] < best.count)) return;
    if (i === n) {
      // Setup is deliberately checked on complete schedules: adding an
      // intermediate meeting can repair a previously invalid directed edge.
      if (!setupValid()) return;
      const bookings = [];
      for (let j = 0; j < n; j++) if (selected[j]) {
        const o = selected[j];
        bookings.push({ meeting_id: sorted[j].id, room_id: o.room,
          start: new Date(o.start).toISOString(), end: new Date(o.end).toISOString() });
      }
      if (value > best.value || (value === best.value && (count > best.count ||
          (count === best.count && compareBookings(bookings, best.bookings) < 0)))) {
        best = { value, count, bookings };
      }
      return;
    }
    for (const o of options[i]) {
      let valid = true;
      for (const r of requires[i]) {
        if (r < i && (!selected[r] || selected[r].end > o.start)) valid = false;
      }
      for (let j = 0; valid && j < i; j++) if (selected[j]) {
        const prev = selected[j];
        if ((prev.room === o.room || shared[i][j]) && overlaps(prev, o)) valid = false;
        if (requires[j].includes(i) && o.end > prev.start) valid = false;
      }
      if (!valid) continue;
      selected[i] = o;
      search(i + 1, value + sorted[i].value, count + 1);
    }
    selected[i] = null;
    // A previously selected dependent makes skipping its prerequisite illegal.
    if (!requires.some((rs, j) => j < i && selected[j] && rs.includes(i))) search(i + 1, value, count);
    selected[i] = null;
  }
  search(0, 0, 0);
  return best;
}
