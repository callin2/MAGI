/**
 * Build revisable, gap-based sessions.  The maps below are deliberately local:
 * calls do not share either revision or watermark state.
 */
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  const versions = new Map();       // id -> last accepted revision and payload
  const live = new Map();           // includes events which have since been sealed
  const sealedIds = new Set();
  const sealed = [];

  const asciiCompare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const payloadOf = r => r.kind === 'delete'
    ? JSON.stringify(['delete', r.id, r.rev])
    : JSON.stringify(['upsert', r.id, r.rev, r.key, r.event_time, r.amount]);

  // Components only of still-mutable events.  Sealed components are kept as
  // snapshots rather than recomputed, which makes their values immutable.
  function openComponents(events = [...live.values()].filter(e => !sealedIds.has(e.id))) {
    const byKey = new Map();
    for (const e of events) {
      let a = byKey.get(e.key);
      if (!a) byKey.set(e.key, a = []);
      a.push(e);
    }
    const answer = [];
    for (const [key, a] of byKey) {
      a.sort((x, y) => x.event_time - y.event_time || asciiCompare(x.id, y.id));
      let part = [];
      for (const e of a) {
        if (part.length && e.event_time - part[part.length - 1].event_time > gap_ms) {
          answer.push(makeComponent(key, part));
          part = [];
        }
        part.push(e);
      }
      if (part.length) answer.push(makeComponent(key, part));
    }
    return answer;
  }
  function makeComponent(key, part) {
    return {
      key,
      start: part[0].event_time,
      end: part[part.length - 1].event_time + gap_ms,
      total: part.reduce((n, e) => n + e.amount, 0),
      count: part.length,
      ids: part.map(e => e.id).sort(asciiCompare),
      members: part
    };
  }
  function finalizeEligible() {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    for (const c of openComponents()) {
      if (c.end <= cutoff) {
        for (const e of c.members) sealedIds.add(e.id);
        sealed.push({ key: c.key, start: c.start, end: c.end, total: c.total,
          count: c.count, ids: c.ids, final: true });
      }
    }
  }
  function touchesSealed(key, time) {
    // A point can connect to a sealed component precisely on this interval:
    // [first-gap, last+gap], where last+gap is the displayed session end.
    return sealed.some(s => s.key === key && time >= s.start - gap_ms && time <= s.end);
  }
  function rejectIfBadRevision(r, payload) {
    const old = versions.get(r.id);
    if (!old || r.rev > old.rev) return false;
    if (r.rev === old.rev && old.payload !== payload)
      throw new Error('conflicting payload for accepted revision');
    return true; // lower revisions and exact replays are no-ops
  }

  for (const r of records) {
    if (r.kind === 'watermark') {
      if (watermark === null || r.time > watermark) {
        watermark = r.time;
        finalizeEligible();
      }
      continue;
    }

    const payload = payloadOf(r);
    if (rejectIfBadRevision(r, payload)) continue;

    // From here on every possible rejection occurs before any map is changed.
    if (sealedIds.has(r.id))
      throw new Error('cannot change an event in a finalized session');

    if (r.kind === 'delete') {
      live.delete(r.id); // deleting an unknown id is an accepted tombstone
      versions.set(r.id, { rev: r.rev, payload });
      finalizeEligible();
      continue;
    }

    if (touchesSealed(r.key, r.event_time))
      throw new Error('event would join or extend a finalized session');

    // Test the proposed session after removing this id's previous contribution.
    const proposed = [];
    for (const e of live.values()) if (!sealedIds.has(e.id) && e.id !== r.id) proposed.push(e);
    const candidate = { id: r.id, key: r.key, event_time: r.event_time, amount: r.amount };
    proposed.push(candidate);
    if (watermark !== null) {
      const component = openComponents(proposed).find(c => c.members.some(e => e.id === r.id));
      if (component.end <= watermark - lateness_ms)
        throw new Error('proposed session is already final');
    }

    live.set(r.id, candidate);
    versions.set(r.id, { rev: r.rev, payload });
    finalizeEligible();
  }

  const result = sealed.map(s => ({ ...s }));
  for (const c of openComponents()) {
    result.push({ key: c.key, start: c.start, end: c.end, total: c.total,
      count: c.count, ids: c.ids, final: false });
  }
  result.sort((a, b) => a.start - b.start || asciiCompare(a.key, b.key));
  return { watermark, sessions: result };
}
