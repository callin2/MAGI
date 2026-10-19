// Exhaustive (with safe branch-and-bound) optimizer for the deliberately small input bounds.
export function book(input) {
  const ms = 60000;
  const rangeStart = Date.parse(input.range_start), rangeEnd = Date.parse(input.range_end);
  const fmtCache = new Map();
  function formatter(zone) {
    if (!fmtCache.has(zone)) fmtCache.set(zone, new Intl.DateTimeFormat('en-US', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }));
    return fmtCache.get(zone);
  }
  // Return every UTC minute which has this wall-clock representation.  The
  // supported input precision is minutes, so searching this small window is
  // also a simple, reliable way to handle both unusual DST folds and gaps.
  function wallInstants(local, zone) {
    const [date, time] = local.split('T');
    const wanted = date + 'T' + time;
    const base = Date.parse(wanted + 'Z');
    const f = formatter(zone), result = [];
    for (let t = base - 16 * 60 * ms; t <= base + 16 * 60 * ms; t += ms) {
      const p = Object.create(null);
      for (const x of f.formatToParts(new Date(t))) if (x.type !== 'literal') p[x.type] = x.value;
      if (`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === wanted) result.push(t);
    }
    return result;
  }
  function asciiCompare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function bookingCompare(a, b) {
    for (const k of ['meeting_id', 'room_id', 'start', 'end']) {
      const c = asciiCompare(a[k], b[k]); if (c) return c;
    }
    return 0;
  }
  function scheduleCompare(a, b) {
    for (let i = 0; i < a.length; i++) { const c = bookingCompare(a[i], b[i]); if (c) return c; }
    return 0;
  }

  const byId = new Map(input.meetings.map(m => [m.id, m]));
  const opts = new Map();
  for (const m of input.meetings) {
    let times = wallInstants(m.local_start, m.zone);
    if (times.length > 1) {
      if (m.fold === 'earlier') times = [times[0]];
      else if (m.fold === 'later') times = [times[times.length - 1]];
      // "either" deliberately retains both, but they are alternatives below.
    }
    const choices = [];
    for (const startMs of times) for (const room_id of m.eligible_rooms) {
      const endMs = startMs + m.minutes * ms;
      if (startMs >= rangeStart && endMs <= rangeEnd) choices.push({
        m, room_id, startMs, endMs,
        booking: {meeting_id:m.id, room_id, start:new Date(startMs).toISOString(), end:new Date(endMs).toISOString()}
      });
    }
    opts.set(m.id, choices);
  }
  const blocks = input.blocks.map(x => ({room_id:x.room_id, startMs:Date.parse(x.start), endMs:Date.parse(x.end)}));
  const overlaps = (a, b) => a.startMs < b.endMs && b.startMs < a.endMs;

  // A topological order means a dependent can only be selected after every
  // required meeting has already been selected.
  const done = new Set(), order = [];
  while (order.length < input.meetings.length) {
    const available = input.meetings.filter(m => !done.has(m.id) && m.requires.every(x => done.has(x)));
    // Choice first tends to find a strong incumbent early; it does not affect correctness.
    available.sort((a,b) => b.value-a.value || opts.get(a.id).length-opts.get(b.id).length || asciiCompare(a.id,b.id));
    const m = available[0]; done.add(m.id); order.push(m);
  }
  const suffixValue = Array(order.length + 1).fill(0), suffixCount = Array(order.length + 1).fill(0);
  for (let i=order.length-1;i>=0;i--) { suffixValue[i]=suffixValue[i+1]+order[i].value; suffixCount[i]=suffixCount[i+1]+1; }
  let best = {value:0, count:0, bookings:[]};
  const selected = [], selectedById = new Map();
  function finalTransitionsOK() {
    const people = new Map();
    for (const x of selected) for (const p of x.m.people) (people.get(p) || (people.set(p, []), people.get(p))).push(x);
    for (const list of people.values()) {
      list.sort((a,b) => a.startMs-b.startMs || a.endMs-b.endMs || asciiCompare(a.m.id,b.m.id));
      for (let i=1;i<list.length;i++) {
        const a=list[i-1], b=list[i];
        if (b.startMs < a.endMs + input.transitions[a.room_id][b.room_id] * ms) return false;
      }
    }
    return true;
  }
  function consider(value) {
    if (!finalTransitionsOK()) return;
    const bookings = selected.map(x=>x.booking).sort(bookingCompare);
    const candidate = {value, count:bookings.length, bookings};
    if (candidate.value > best.value || (candidate.value === best.value && (candidate.count > best.count || (candidate.count === best.count && scheduleCompare(candidate.bookings,best.bookings)<0)))) best=candidate;
  }
  function dfs(i, value) {
    if (value + suffixValue[i] < best.value || (value + suffixValue[i] === best.value && selected.length + suffixCount[i] < best.count)) return;
    if (i === order.length) { consider(value); return; }
    const m = order[i];
    // A skipped prerequisite makes this meeting impossible, but its remaining
    // descendants may still be explored as skipped by the normal recursion.
    const requirementsPresent = m.requires.every(id => selectedById.has(id));
    if (requirementsPresent) for (const x of opts.get(m.id)) {
      let bad = blocks.some(b => b.room_id === x.room_id && overlaps(x,b));
      if (!bad) for (const y of selected) {
        if (y.room_id === x.room_id && overlaps(x,y)) { bad=true; break; }
        if (!bad && x.m.people.some(p => y.m.people.includes(p)) && overlaps(x,y)) { bad=true; break; }
      }
      if (!bad) for (const id of m.requires) if (selectedById.get(id).endMs > x.startMs) { bad=true; break; }
      if (!bad) { selected.push(x); selectedById.set(m.id,x); dfs(i+1,value+m.value); selectedById.delete(m.id); selected.pop(); }
    }
    dfs(i+1,value);
  }
  dfs(0,0);
  return best;
}
