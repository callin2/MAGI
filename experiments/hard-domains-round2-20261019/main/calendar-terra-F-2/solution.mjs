// Exhaustive (but pruned) optimizer.  Civil times are resolved by asking Intl which
// instants render as the supplied wall-clock label; this also handles DST folds/gaps.
const minute = 60000;

function civilInstants(label, zone) {
  const [d, t] = label.split('T');
  const [Y, M, D] = d.split('-').map(Number);
  const [h, m] = t.split(':').map(Number);
  const nominal = Date.UTC(Y, M - 1, D, h, m);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const answer = [];
  // The supported zones have offsets within this window.  Searching whole minutes
  // is deliberate: inputs are minute labels and all their 2024--26 transitions are
  // minute-aligned.
  for (let x = nominal - 16 * 60 * minute; x <= nominal + 16 * 60 * minute; x += minute) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(x))
      .filter(q => q.type !== 'literal').map(q => [q.type, q.value]));
    let ph = Number(p.hour); if (ph === 24) ph = 0;
    if (Number(p.year) === Y && Number(p.month) === M && Number(p.day) === D &&
        ph === h && Number(p.minute) === m) answer.push(x);
  }
  return answer;
}

function cmpText(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function compareSchedules(a, b) {
  if (!b) return -1;
  if (a.value !== b.value) return b.value - a.value;
  if (a.count !== b.count) return b.count - a.count;
  for (let i = 0; i < a.bookings.length; i++) {
    const x = a.bookings[i], y = b.bookings[i];
    for (const k of ['meeting_id', 'room_id', 'start', 'end']) {
      const c = cmpText(x[k], y[k]); if (c) return c;
    }
  }
  return 0;
}

export function book({range_start, range_end, rooms, transitions, meetings, blocks}) {
  const lo = Date.parse(range_start), hi = Date.parse(range_end);
  const blocked = blocks.map(b => ({room_id: b.room_id, start: Date.parse(b.start), end: Date.parse(b.end)}));
  const byId = new Map(meetings.map(m => [m.id, m]));

  // A prerequisite-first topological order lets us reject a selected dependent as
  // soon as one of its requirements was not selected.
  const ordered = [], seen = new Set();
  function visit(m) {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    for (const id of m.requires) visit(byId.get(id));
    ordered.push(m);
  }
  meetings.forEach(visit);

  const options = new Map();
  for (const m of ordered) {
    let instants = civilInstants(m.local_start, m.zone);
    if (instants.length > 1) {
      if (m.fold === 'earlier') instants = [instants[0]];
      else if (m.fold === 'later') instants = [instants[instants.length - 1]];
      // "either" retains both, as alternatives of this one meeting.
    }
    const os = [];
    for (const start of instants) for (const room_id of m.eligible_rooms) {
      const end = start + m.minutes * minute;
      if (start < lo || end > hi) continue;
      if (blocked.some(b => b.room_id === room_id && start < b.end && b.start < end)) continue;
      os.push({meeting: m, room_id, start, end});
    }
    options.set(m.id, os);
  }

  // Useful optimistic bounds, valid even with requirements/conflicts.
  const suffixValue = Array(ordered.length + 1).fill(0);
  for (let i = ordered.length - 1; i >= 0; --i) suffixValue[i] = suffixValue[i + 1] + ordered[i].value;
  let best = null;
  const picked = [];
  const selected = new Map();

  function compatible(o) {
    // Requirements are already visited, hence their selection and ordering are known.
    for (const id of o.meeting.requires) {
      const r = selected.get(id);
      if (!r || r.end > o.start) return false;
    }
    for (const q of picked) {
      if (q.room_id === o.room_id && o.start < q.end && q.start < o.end) return false;
      let shared = false;
      for (const p of o.meeting.people) if (q.meeting.people.includes(p)) { shared = true; break; }
      if (shared && o.start < q.end && q.start < o.end) return false;
    }
    // Check adjacency anew for every affected person.  This is important when an
    // inserted meeting falls between two previously selected ones.
    for (const person of o.meeting.people) {
      const line = picked.filter(q => q.meeting.people.includes(person)).concat(o)
        .sort((a, b) => a.start - b.start || a.end - b.end);
      for (let i = 1; i < line.length; i++) {
        const prev = line[i - 1], next = line[i];
        if (next.start < prev.end + transitions[prev.room_id][next.room_id] * minute) return false;
      }
    }
    return true;
  }

  function finish(value) {
    const bookings = picked.map(o => ({meeting_id: o.meeting.id, room_id: o.room_id,
      start: new Date(o.start).toISOString(), end: new Date(o.end).toISOString()}))
      .sort((a, b) => cmpText(a.meeting_id, b.meeting_id));
    const candidate = {value, count: bookings.length, bookings};
    if (compareSchedules(candidate, best) < 0) best = candidate;
  }
  function search(i, value) {
    if (best && value + suffixValue[i] < best.value) return;
    if (best && value + suffixValue[i] === best.value && picked.length + ordered.length - i < best.count) return;
    if (i === ordered.length) { finish(value); return; }
    const m = ordered[i];
    // Try bookings first to establish a strong incumbent; skip remains necessary.
    for (const o of options.get(m.id)) if (compatible(o)) {
      picked.push(o); selected.set(m.id, o); search(i + 1, value + m.value); selected.delete(m.id); picked.pop();
    }
    search(i + 1, value);
  }
  search(0, 0);
  return best || {value: 0, count: 0, bookings: []};
}
