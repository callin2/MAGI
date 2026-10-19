// Revisable, event-time session aggregation.  All state below is local to one call.
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  // An entry is the last accepted version of an id.  payload is null for a tombstone.
  const versions = new Map();
  const sealed = []; // immutable session snapshots

  const samePayload = (old, r) => {
    if (old.payload === null) return r.kind === 'delete';
    return r.kind === 'upsert' && old.payload.key === r.key &&
      old.payload.event_time === r.event_time && old.payload.amount === r.amount;
  };

  const liveByKey = () => {
    const byKey = new Map();
    for (const [id, entry] of versions) {
      if (entry.payload !== null && !entry.sealed) {
        const p = entry.payload;
        let a = byKey.get(p.key);
        if (!a) byKey.set(p.key, a = []);
        a.push({ id, ...p });
      }
    }
    return byKey;
  };

  const components = (events) => {
    if (!events || events.length === 0) return [];
    const a = [...events].sort((x, y) => x.event_time - y.event_time || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    const result = [];
    let group = [a[0]];
    for (let i = 1; i < a.length; i++) {
      if (a[i].event_time - a[i - 1].event_time <= gap_ms) group.push(a[i]);
      else { result.push(group); group = [a[i]]; }
    }
    result.push(group);
    return result;
  };

  const makeSession = (key, group, final) => ({
    key,
    start: group[0].event_time,
    end: group[group.length - 1].event_time + gap_ms,
    total: group.reduce((sum, e) => sum + e.amount, 0),
    count: group.length,
    ids: group.map(e => e.id).sort(),
    final
  });

  // Seal complete *connected components*, not timestamp buckets.
  const finalizeEligible = () => {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    for (const [key, events] of liveByKey()) {
      for (const group of components(events)) {
        const snapshot = makeSession(key, group, true);
        if (snapshot.end <= cutoff) {
          for (const e of group) versions.get(e.id).sealed = true;
          sealed.push(snapshot);
        }
      }
    }
  };

  const touchesSealed = (key, time) => sealed.some(s =>
    s.key === key && time >= s.start - gap_ms && time <= s.end
  );

  for (const r of records) {
    if (r.kind === 'watermark') {
      if (watermark === null || r.time > watermark) watermark = r.time;
      finalizeEligible();
      continue;
    }

    const prior = versions.get(r.id);
    if (prior && r.rev < prior.rev) continue;
    if (prior && r.rev === prior.rev) {
      if (!samePayload(prior, r)) throw new Error('conflicting accepted revision');
      continue;
    }

    // Greater revisions which would alter a sealed contribution are rejected,
    // without recording the proposed revision.
    if (r.kind === 'delete') {
      if (prior && prior.payload !== null && prior.sealed) continue;
      versions.set(r.id, { rev: r.rev, payload: null, sealed: false });
      finalizeEligible();
      continue;
    }

    // A sealed component has a closed gap-sized exclusion zone.
    if (touchesSealed(r.key, r.event_time)) continue;
    if (prior && prior.payload !== null && prior.sealed) continue;

    // Test the replacement atomically: temporarily describe the complete
    // proposed live set (the old version is omitted by using a replacement map).
    const proposed = { key: r.key, event_time: r.event_time, amount: r.amount };
    const byKey = liveByKey();
    if (prior && prior.payload !== null) {
      const oldList = byKey.get(prior.payload.key);
      if (oldList) {
        const ix = oldList.findIndex(e => e.id === r.id);
        if (ix >= 0) oldList.splice(ix, 1);
      }
    }
    let target = byKey.get(r.key);
    if (!target) byKey.set(r.key, target = []);
    target.push({ id: r.id, ...proposed });
    let targetSession;
    for (const group of components(target)) {
      if (group.some(e => e.id === r.id)) { targetSession = makeSession(r.key, group, false); break; }
    }
    if (watermark !== null && targetSession.end <= watermark - lateness_ms) continue;

    versions.set(r.id, { rev: r.rev, payload: proposed, sealed: false });
    finalizeEligible();
  }

  const output = sealed.map(s => ({ ...s, ids: [...s.ids] }));
  for (const [key, events] of liveByKey()) {
    for (const group of components(events)) output.push(makeSession(key, group, false));
  }
  output.sort((a, b) => a.start - b.start || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { watermark, sessions: output };
}
