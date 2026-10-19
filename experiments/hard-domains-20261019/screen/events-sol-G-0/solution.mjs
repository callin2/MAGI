// State is local to one invocation. Rejected records never enter acceptedById.
export function aggregate({ window_ms, lateness_ms, records }) {
  let watermark = null;
  const acceptedById = new Map();
  const windowStart = time => Math.floor(time / window_ms) * window_ms;
  const finalized = time => watermark !== null &&
    windowStart(time) + window_ms <= watermark - lateness_ms;
  const samePayload = (a, b) => a.kind === b.kind &&
    (a.kind === 'delete' || (a.key === b.key &&
      a.event_time === b.event_time && a.amount === b.amount));

  for (const record of records) {
    if (record.kind === 'watermark') {
      watermark = watermark === null ? record.time : Math.max(watermark, record.time);
      continue;
    }
    const previous = acceptedById.get(record.id);
    if (previous) {
      if (record.rev < previous.rev) continue;
      if (record.rev === previous.rev) {
        if (!samePayload(previous, record)) {
          throw new Error(`Conflicting payload for accepted revision ${record.rev} of ${record.id}`);
        }
        continue;
      }
    }

    // A replacement is atomic: neither its revision nor either contribution
    // changes if its old or new window has already closed.
    if (previous?.kind === 'upsert' && finalized(previous.event_time)) continue;
    if (record.kind === 'upsert' && finalized(record.event_time)) continue;
    acceptedById.set(record.id, { ...record });
  }

  // Materialize only the current accepted contributions, retaining zero totals.
  // Nested maps avoid any ambiguity from separators inside business keys.
  const byStart = new Map();
  for (const record of acceptedById.values()) {
    if (record.kind !== 'upsert') continue;
    const start = windowStart(record.event_time);
    let byKey = byStart.get(start);
    if (!byKey) byStart.set(start, byKey = new Map());
    let window = byKey.get(record.key);
    if (!window) {
      window = { key: record.key, start, end: start + window_ms,
        total: 0, count: 0, final: finalized(record.event_time) };
      byKey.set(record.key, window);
    }
    window.total += record.amount;
    window.count++;
  }
  const windows = [...byStart.values()].flatMap(byKey => [...byKey.values()]);
  windows.sort((a, b) => a.start - b.start || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { watermark, windows };
}
