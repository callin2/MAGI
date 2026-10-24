// Sessions are connected components, not epoch-aligned windows.
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  const versions = new Map();
  const live = new Map();
  const sealedIds = new Set();
  const sealed = [];
  const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const payload = r => JSON.stringify(r.kind === 'delete'
    ? ['delete'] : ['upsert', r.key, r.event_time, r.amount]);

  function components(events) {
    const byKey = new Map();
    for (const [id, e] of events) {
      if (!byKey.has(e.key)) byKey.set(e.key, []);
      byKey.get(e.key).push({ id, ...e });
    }
    const result = [];
    for (const [key, entries] of byKey) {
      entries.sort((a, b) => a.event_time - b.event_time || ascii(a.id, b.id));
      let s;
      for (const e of entries) {
        if (!s || e.event_time > s.end) {
          s = { key, start: e.event_time, end: e.event_time + gap_ms,
            total: 0, count: 0, ids: [], final: false };
          result.push(s);
        }
        s.end = e.event_time + gap_ms;
        s.total += e.amount;
        s.count++;
        s.ids.push(e.id);
      }
    }
    for (const s of result) s.ids.sort(ascii);
    return result;
  }

  function finalize() {
    if (watermark === null) return;
    for (const s of components(live)) {
      if (s.end <= watermark - lateness_ms) {
        s.final = true;
        sealed.push(s);
        for (const id of s.ids) {
          sealedIds.add(id);
          live.delete(id);
        }
      }
    }
  }

  for (const r of records) {
    if (r.kind === 'watermark') {
      watermark = watermark === null ? r.time : Math.max(watermark, r.time);
      finalize();
      continue;
    }
    const old = versions.get(r.id);
    if (old && r.rev < old.rev) continue;
    const canonical = payload(r);
    if (old && r.rev === old.rev) {
      if (canonical !== old.payload) throw new Error('Conflicting accepted revision');
      continue;
    }
    if (sealedIds.has(r.id)) continue;
    if (r.kind === 'upsert') {
      if (sealed.some(s => s.key === r.key &&
        r.event_time >= s.start - gap_ms && r.event_time <= s.end)) continue;
      const proposal = new Map(live);
      proposal.set(r.id, { key: r.key, event_time: r.event_time, amount: r.amount });
      const target = components(proposal).find(s => s.ids.includes(r.id));
      if (watermark !== null && target.end <= watermark - lateness_ms) continue;
      live.set(r.id, proposal.get(r.id));
    } else {
      live.delete(r.id);
    }
    versions.set(r.id, { rev: r.rev, payload: canonical });
    finalize();
  }
  return { watermark, sessions: [...sealed, ...components(live)]
    .sort((a, b) => a.start - b.start || ascii(a.key, b.key)) };
}
