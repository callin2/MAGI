// Revisions are kept separately from the current open-event index: tombstones and
// sealed events still need to participate in revision checks.
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  const versions = new Map(); // id -> { rev, payload }
  const events = new Map();   // live id -> copied upsert payload (including sealed)
  const sealedIds = new Set();
  const sealed = [];

  const idCompare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const payloadOf = r => r.kind === 'upsert'
    ? { kind: 'upsert', id: r.id, rev: r.rev, key: r.key,
        event_time: r.event_time, amount: r.amount }
    : { kind: 'delete', id: r.id, rev: r.rev };
  const samePayload = (a, b) => {
    const ak = Object.keys(a), bk = Object.keys(b);
    return ak.length === bk.length && ak.every(k => a[k] === b[k]);
  };
  const fail = message => { throw new Error(message); };

  function openEventsFor(key, omitId, add) {
    const result = [];
    for (const e of events.values()) {
      if (!sealedIds.has(e.id) && e.key === key && e.id !== omitId) result.push(e);
    }
    if (add) result.push(add);
    return result;
  }

  function components(list) {
    const sorted = [...list].sort((a, b) => a.event_time - b.event_time || idCompare(a.id, b.id));
    const result = [];
    for (const e of sorted) {
      let c = result[result.length - 1];
      if (!c || e.event_time - c.last > gap_ms) {
        c = { items: [], start: e.event_time, last: e.event_time };
        result.push(c);
      }
      c.items.push(e);
      c.last = e.event_time;
    }
    return result;
  }

  // Seal every currently-open component whose computed session end is old enough.
  function finalizeEligible() {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    const byKey = new Map();
    for (const e of events.values()) {
      if (sealedIds.has(e.id)) continue;
      let a = byKey.get(e.key);
      if (!a) byKey.set(e.key, a = []);
      a.push(e);
    }
    for (const [key, list] of byKey) {
      for (const c of components(list)) {
        const end = c.last + gap_ms;
        if (end <= cutoff) {
          const items = c.items;
          for (const e of items) sealedIds.add(e.id);
          sealed.push({
            key, start: c.start, end,
            total: items.reduce((n, e) => n + e.amount, 0),
            count: items.length,
            ids: items.map(e => e.id).sort(idCompare),
            final: true
          });
        }
      }
    }
  }

  function nearSealed(key, time) {
    // A point can join a sealed component exactly when it is no earlier than
    // first-gap and no later than last+gap (the stored session end).
    return sealed.some(s => s.key === key && time >= s.start - gap_ms && time <= s.end);
  }

  for (const record of records) {
    if (record.kind === 'watermark') {
      if (watermark === null || record.time > watermark) watermark = record.time;
      finalizeEligible();
      continue;
    }

    const prior = versions.get(record.id);
    if (prior) {
      if (record.rev < prior.rev) continue;
      if (record.rev === prior.rev) {
        if (!samePayload(prior.payload, payloadOf(record))) fail('conflicting revision');
        continue;
      }
    }

    // Do all rejection checks before changing either state map.
    if (sealedIds.has(record.id)) fail('cannot revise finalized event');
    if (record.kind === 'upsert') {
      const proposed = payloadOf(record);
      if (nearSealed(proposed.key, proposed.event_time)) fail('event is too close to finalized session');
      if (watermark !== null) {
        const proposedComponents = components(openEventsFor(proposed.key, proposed.id, proposed));
        const component = proposedComponents.find(c => c.items.some(e => e.id === proposed.id));
        if (component.last + gap_ms <= watermark - lateness_ms) {
          fail('proposed session is already final');
        }
      }
    }

    const payload = payloadOf(record);
    versions.set(record.id, { rev: record.rev, payload });
    if (record.kind === 'upsert') events.set(record.id, payload);
    else events.delete(record.id);
    finalizeEligible();
  }

  const result = sealed.map(s => ({ ...s, ids: [...s.ids] }));
  const byKey = new Map();
  for (const e of events.values()) {
    if (sealedIds.has(e.id)) continue;
    let a = byKey.get(e.key);
    if (!a) byKey.set(e.key, a = []);
    a.push(e);
  }
  for (const [key, list] of byKey) {
    for (const c of components(list)) {
      const items = c.items;
      result.push({
        key, start: c.start, end: c.last + gap_ms,
        total: items.reduce((n, e) => n + e.amount, 0),
        count: items.length, ids: items.map(e => e.id).sort(idCompare), final: false
      });
    }
  }
  result.sort((a, b) => a.start - b.start || idCompare(a.key, b.key));
  return { watermark, sessions: result };
}
