// Sessions are connected components, not epoch-aligned windows.
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  const versions = new Map();
  const live = new Map();
  const sealedIds = new Set();
  const sealed = [];
  const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;

  function components(events) {
    const byKey = new Map();
    for (const [id, event] of events) {
      if (sealedIds.has(id)) continue;
      if (!byKey.has(event.key)) byKey.set(event.key, []);
      byKey.get(event.key).push({ id, ...event });
    }
    const result = [];
    for (const [key, group] of byKey) {
      group.sort((a, b) => a.event_time - b.event_time || ascii(a.id, b.id));
      let session;
      for (const event of group) {
        if (!session || event.event_time > session.end) {
          session = { key, start: event.event_time, end: event.event_time + gap_ms,
            total: 0, count: 0, ids: [], final: false };
          result.push(session);
        }
        session.end = event.event_time + gap_ms;
        session.total += event.amount;
        session.count++;
        session.ids.push(event.id);
      }
    }
    for (const session of result) session.ids.sort(ascii);
    return result;
  }

  function finalize() {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    for (const session of components(live)) {
      if (session.end <= cutoff) {
        session.final = true;
        sealed.push(session);
        for (const id of session.ids) sealedIds.add(id);
      }
    }
  }

  function samePayload(a, b) {
    return a.kind === b.kind && (a.kind === 'delete' ||
      (a.key === b.key && a.event_time === b.event_time && a.amount === b.amount));
  }

  for (const record of records) {
    if (record.kind === 'watermark') {
      watermark = watermark === null ? record.time : Math.max(watermark, record.time);
      finalize();
      continue;
    }
    const previous = versions.get(record.id);
    if (previous) {
      if (record.rev < previous.rev) continue;
      if (record.rev === previous.rev) {
        if (!samePayload(previous, record)) throw new Error('Conflicting accepted revision');
        continue;
      }
    }
    // Version checks precede sealing checks: replay/conflict semantics never expire.
    if (sealedIds.has(record.id)) continue;
    if (record.kind === 'upsert') {
      if (sealed.some(s => s.key === record.key &&
          record.event_time >= s.start - gap_ms && record.event_time <= s.end)) continue;
      const proposal = new Map(live);
      proposal.set(record.id, {
        key: record.key, event_time: record.event_time, amount: record.amount
      });
      const containing = components(proposal).find(s => s.ids.includes(record.id));
      if (watermark !== null && containing.end <= watermark - lateness_ms) continue;
      live.set(record.id, proposal.get(record.id));
    } else {
      live.delete(record.id);
    }
    // Rejected proposals never reach this commit point.
    versions.set(record.id, { ...record });
    finalize();
  }
  return { watermark, sessions: [...sealed, ...components(live)]
    .sort((a, b) => a.start - b.start || ascii(a.key, b.key)) };
}
