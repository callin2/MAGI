// ASCII lexical order (not locale-dependent collation).
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function sessions({gap_ms, lateness_ms, records}) {
  let watermark = null;
  const versions = new Map();
  let live = new Map();
  const sealedIds = new Set();
  const sealed = [];

  const canonical = r => JSON.stringify(r.kind === 'delete'
    ? ['delete', r.id, r.rev]
    : ['upsert', r.id, r.rev, r.key, r.event_time, r.amount]);

  // Recompute maximal connected components; sealed events never participate.
  function components(events) {
    const byKey = new Map();
    for (const e of events.values()) {
      if (sealedIds.has(e.id)) continue;
      if (!byKey.has(e.key)) byKey.set(e.key, []);
      byKey.get(e.key).push(e);
    }
    const result = [];
    for (const [key, rows] of byKey) {
      rows.sort((a, b) => a.event_time - b.event_time || compare(a.id, b.id));
      let current;
      for (const e of rows) {
        if (!current || e.event_time > current.end) {
          current = {key, start: e.event_time, end: e.event_time + gap_ms,
            total: 0, count: 0, ids: [], final: false};
          result.push(current);
        }
        current.end = e.event_time + gap_ms;
        current.total += e.amount;
        current.count++;
        current.ids.push(e.id);
      }
    }
    for (const s of result) s.ids.sort(compare);
    return result;
  }

  function finalize() {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    for (const s of components(live)) {
      if (s.end <= cutoff) {
        s.final = true;
        sealed.push(s);
        for (const id of s.ids) sealedIds.add(id);
      }
    }
  }

  for (const r of records) {
    if (r.kind === 'watermark') {
      watermark = watermark === null ? r.time : Math.max(watermark, r.time);
      finalize();
      continue;
    }
    const previous = versions.get(r.id);
    if (previous && r.rev < previous.rev) continue;
    const payload = canonical(r);
    if (previous && r.rev === previous.rev) {
      if (payload !== previous.payload) throw new Error('Conflicting accepted revision');
      continue;
    }
    if (sealedIds.has(r.id)) continue;

    const proposal = new Map(live);
    proposal.delete(r.id);
    if (r.kind === 'upsert') {
      // A sealed component contains events from start through end-gap.
      // The closed interval [start-gap, end] is precisely its join range.
      if (sealed.some(s => s.key === r.key &&
        r.event_time >= s.start - gap_ms && r.event_time <= s.end)) continue;
      proposal.set(r.id, {id: r.id, key: r.key,
        event_time: r.event_time, amount: r.amount});
      if (watermark !== null) {
        const target = components(proposal).find(s => s.ids.includes(r.id));
        if (target.end <= watermark - lateness_ms) continue;
      }
    }
    live = proposal;
    versions.set(r.id, {rev: r.rev, payload});
    finalize();
  }

  return {watermark, sessions: [...sealed, ...components(live)]
    .sort((a, b) => a.start - b.start || compare(a.key, b.key))};
}
