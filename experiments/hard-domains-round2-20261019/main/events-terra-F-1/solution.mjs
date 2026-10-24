// Revisable, event-time session aggregation.  Kept entirely local to each call.
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  // `versions` includes tombstones.  `open` deliberately excludes sealed events.
  const versions = new Map();
  const open = new Map();
  const sealed = []; // immutable session snapshots
  const sealedId = new Set();

  const asciiCompare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const payloadOf = (r) => r.kind === 'upsert'
    ? { kind: 'upsert', id: r.id, rev: r.rev, key: r.key, event_time: r.event_time, amount: r.amount }
    : { kind: 'delete', id: r.id, rev: r.rev };
  const samePayload = (a, b) => {
    if (a.kind !== b.kind || a.id !== b.id || a.rev !== b.rev) return false;
    return a.kind === 'delete' ||
      (a.key === b.key && a.event_time === b.event_time && a.amount === b.amount);
  };

  // Build components for a key from an event map.  Input event objects have id/key/time/amount.
  const componentsFor = (events, key) => {
    const a = [];
    for (const e of events.values()) if (e.key === key) a.push(e);
    a.sort((x, y) => x.event_time - y.event_time || asciiCompare(x.id, y.id));
    const result = [];
    for (const e of a) {
      let c = result[result.length - 1];
      if (!c || e.event_time - c.last > gap_ms) {
        c = { key, start: e.event_time, last: e.event_time, total: 0, ids: [] };
        result.push(c);
      }
      c.last = e.event_time;
      c.total += e.amount;
      c.ids.push(e.id);
    }
    return result.map(c => ({
      key: c.key, start: c.start, end: c.last + gap_ms,
      total: c.total, count: c.ids.length, ids: c.ids.sort(asciiCompare)
    }));
  };
  const allOpenComponents = () => {
    const keys = new Set();
    for (const e of open.values()) keys.add(e.key);
    const r = [];
    for (const key of keys) r.push(...componentsFor(open, key));
    return r;
  };
  const finalizeEligible = () => {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    for (const c of allOpenComponents()) {
      if (c.end <= cutoff) {
        // Components are computed from current open events, so these memberships are stable now.
        sealed.push({ ...c, ids: [...c.ids], final: true });
        for (const id of c.ids) {
          open.delete(id);
          sealedId.add(id);
        }
      }
    }
  };
  const isNearSealed = (key, time) => sealed.some(s =>
    s.key === key && time >= s.start - gap_ms && time <= s.end + gap_ms
  );

  for (const r of records) {
    if (r.kind === 'watermark') {
      if (watermark === null || r.time > watermark) watermark = r.time;
      finalizeEligible();
      continue;
    }

    const prior = versions.get(r.id);
    if (prior) {
      if (r.rev < prior.rev) continue;
      if (r.rev === prior.rev) {
        if (!samePayload(prior.payload, payloadOf(r))) throw new Error('conflicting revision');
        continue;
      }
    }

    // All checks happen before changing the version or live contribution.
    if (r.kind === 'delete') {
      if (sealedId.has(r.id)) throw new Error('cannot retract finalized event');
      versions.set(r.id, { rev: r.rev, payload: payloadOf(r) });
      open.delete(r.id);
      finalizeEligible();
      continue;
    }

    if (sealedId.has(r.id)) throw new Error('cannot change finalized event');
    if (isNearSealed(r.key, r.event_time)) throw new Error('event is adjacent to finalized session');

    // Test the proposed component using a copy, which also makes a move/replacement atomic.
    const proposal = new Map(open);
    proposal.delete(r.id);
    const event = { id: r.id, key: r.key, event_time: r.event_time, amount: r.amount };
    proposal.set(r.id, event);
    if (watermark !== null) {
      const component = componentsFor(proposal, r.key)
        .find(c => c.ids.includes(r.id));
      if (component.end <= watermark - lateness_ms) {
        throw new Error('event would create finalized session');
      }
    }
    versions.set(r.id, { rev: r.rev, payload: payloadOf(r) });
    open.clear();
    for (const [id, value] of proposal) open.set(id, value);
    finalizeEligible();
  }

  const result = sealed.map(s => ({ ...s, ids: [...s.ids] }));
  for (const c of allOpenComponents()) result.push({ ...c, final: false });
  result.sort((a, b) => a.start - b.start || asciiCompare(a.key, b.key));
  return { watermark, sessions: result };
}
