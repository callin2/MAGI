// Meeting recommendation optimizer.  All comparisons below use elapsed UTC milliseconds.
const formatterCache = new Map();
function formatter(zone) {
  let f = formatterCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    formatterCache.set(zone, f);
  }
  return f;
}
function localParts(ms, zone) {
  const p = formatter(zone).formatToParts(new Date(ms));
  const x = {};
  for (const q of p) if (q.type !== 'literal') x[q.type] = q.value;
  return `${x.year}-${x.month}-${x.day}T${x.hour}:${x.minute}`;
}
// Find actual instants having this civil minute.  Searching is deliberate: it also
// makes gaps have zero candidates and folds have two, without embedding DST rules.
function resolveLocal(label, zone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(label);
  const nominal = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const found = [];
  // Supported zones have offsets between -12 and +14 in the contracted years.
  for (let t = nominal - 16 * 3600000; t <= nominal + 16 * 3600000; t += 60000) {
    if (localParts(t, zone) === label) found.push(t);
  }
  return found;
}
function overlap(a0, a1, b0, b1) { return a0 < b1 && b0 < a1; }
function ascii(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function bookingCompare(a, b) {
  let c = ascii(a.meeting_id, b.meeting_id); if (c) return c;
  c = ascii(a.room_id, b.room_id); if (c) return c;
  c = ascii(a.start, b.start); if (c) return c;
  return ascii(a.end, b.end);
}
function scheduleCompare(a, b) { // negative when a is lexically smaller
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { const c = bookingCompare(a[i], b[i]); if (c) return c; }
  return a.length - b.length;
}

export function book(input) {
  const rangeStart = Date.parse(input.range_start), rangeEnd = Date.parse(input.range_end);
  const blocks = input.blocks.map(b => ({ room_id: b.room_id, start: Date.parse(b.start), end: Date.parse(b.end) }));
  const meetingById = new Map(input.meetings.map(m => [m.id, m]));

  // An option is one occurrence and one room.  An occurrence is not duplicated for
  // `either`: the recursion makes exactly one choice (or none) per meeting.
  const options = new Map();
  for (const m of input.meetings) {
    let instants = resolveLocal(m.local_start, m.zone);
    if (m.fold === 'earlier') instants = instants.length ? [instants[0]] : [];
    else if (m.fold === 'later') instants = instants.length ? [instants[instants.length - 1]] : [];
    const list = [];
    for (const start of instants) {
      const end = start + m.minutes * 60000;
      if (start < rangeStart || end > rangeEnd) continue;
      for (const room_id of m.eligible_rooms) {
        if (blocks.some(b => b.room_id === room_id && overlap(start, end, b.start, b.end))) continue;
        list.push({ meeting_id: m.id, room_id, start, end, value: m.value, people: m.people, requires: m.requires });
      }
    }
    list.sort(bookingCompare);
    options.set(m.id, list);
  }

  // ID order makes output/tie handling deterministic.  The search is global: a
  // choice is checked against every previously selected booking, not just a slot.
  const meetings = [...input.meetings].sort((a, b) => ascii(a.id, b.id));
  const suffixValue = Array(meetings.length + 1).fill(0);
  const suffixCount = Array(meetings.length + 1).fill(0);
  for (let i = meetings.length - 1; i >= 0; --i) {
    suffixValue[i] = suffixValue[i + 1] + meetings[i].value;
    suffixCount[i] = suffixCount[i + 1] + 1;
  }
  let best = { value: 0, count: 0, bookings: [] };
  const chosen = [];

  function validFinal() {
    const selected = new Set(chosen.map(x => x.meeting_id));
    for (const x of chosen) {
      for (const r of x.requires) {
        if (!selected.has(r)) return false;
        const prerequisite = chosen.find(y => y.meeting_id === r);
        if (prerequisite.end > x.start) return false;
      }
    }
    // Only adjacent entries in this person's chronological selected sequence matter.
    const byPerson = new Map();
    for (const x of chosen) for (const p of x.people) {
      if (!byPerson.has(p)) byPerson.set(p, []);
      byPerson.get(p).push(x);
    }
    for (const list of byPerson.values()) {
      list.sort((a, b) => a.start - b.start || a.end - b.end || ascii(a.meeting_id, b.meeting_id));
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1], next = list[i];
        if (next.start < prev.end + input.transitions[prev.room_id][next.room_id] * 60000) return false;
      }
    }
    return true;
  }
  function consider(value) {
    if (!validFinal()) return;
    const out = chosen.map(x => ({ meeting_id: x.meeting_id, room_id: x.room_id,
      start: new Date(x.start).toISOString(), end: new Date(x.end).toISOString() })).sort(bookingCompare);
    const candidate = { value, count: out.length, bookings: out };
    if (candidate.value > best.value ||
        (candidate.value === best.value && (candidate.count > best.count ||
         (candidate.count === best.count && scheduleCompare(candidate.bookings, best.bookings) < 0)))) best = candidate;
  }
  function dfs(i, value) {
    // Strictly inferior upper bounds can never improve score or tie-break count.
    if (value + suffixValue[i] < best.value) return;
    if (value + suffixValue[i] === best.value && chosen.length + suffixCount[i] < best.count) return;
    if (i === meetings.length) { consider(value); return; }
    const m = meetings[i];
    for (const x of options.get(m.id)) {
      let ok = true;
      for (const y of chosen) {
        if ((x.room_id === y.room_id || x.people.some(p => y.people.includes(p))) && overlap(x.start, x.end, y.start, y.end)) { ok = false; break; }
        // A known prerequisite ordering violation cannot be repaired later.
        if (x.requires.includes(y.meeting_id) && y.end > x.start) { ok = false; break; }
        if (y.requires.includes(x.meeting_id) && x.end > y.start) { ok = false; break; }
      }
      if (ok) { chosen.push(x); dfs(i + 1, value + x.value); chosen.pop(); }
    }
    dfs(i + 1, value);
  }
  dfs(0, 0);
  return best;
}
