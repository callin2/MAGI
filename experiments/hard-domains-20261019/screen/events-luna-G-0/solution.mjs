export function aggregate({ window_ms, lateness_ms, records }) {
  if (!Number.isInteger(window_ms) || window_ms <= 0) throw new Error('window_ms must be a positive integer');
  if (!Number.isInteger(lateness_ms) || lateness_ms < 0) throw new Error('lateness_ms must be a nonnegative integer');
  let watermark = null;
  const ids = new Map(); // id -> {rev, kind, key?, event_time?, amount?}
  const isFinal = (start) => watermark !== null && start + window_ms <= watermark - lateness_ms;
  const startFor = (time) => Math.floor(time / window_ms) * window_ms;

  for (const r of records) {
    if (r.kind === 'watermark') {
      if (watermark === null || r.time > watermark) watermark = r.time;
      continue;
    }
    const old = ids.get(r.id);
    if (old && r.rev < old.rev) continue;
    const payload = r.kind === 'upsert'
      ? { kind: 'upsert', key: r.key, event_time: r.event_time, amount: r.amount }
      : { kind: 'delete' };
    if (old && r.rev === old.rev) {
      if (old.kind !== payload.kind || (payload.kind === 'upsert' &&
          (old.key !== payload.key || old.event_time !== payload.event_time || old.amount !== payload.amount))) {
        throw new Error(`conflicting payload for id ${r.id} revision ${r.rev}`);
      }
      continue;
    }

    const oldStart = old?.kind === 'upsert' ? startFor(old.event_time) : null;
    const newStart = payload.kind === 'upsert' ? startFor(r.event_time) : null;
    if ((oldStart !== null && isFinal(oldStart)) || (newStart !== null && isFinal(newStart))) continue;
    ids.set(r.id, payload.kind === 'upsert'
      ? { rev: r.rev, ...payload }
      : { rev: r.rev, kind: 'delete' });
  }

  const grouped = new Map();
  for (const item of ids.values()) {
    if (item.kind !== 'upsert') continue;
    const start = startFor(item.event_time);
    // Nested maps avoid collisions between arbitrary ASCII keys and numeric starts.
    let byStart = grouped.get(item.key);
    if (!byStart) grouped.set(item.key, byStart = new Map());
    let w = byStart.get(start);
    if (!w) byStart.set(start, w = { key: item.key, start, end: start + window_ms, total: 0, count: 0, final: false });
    w.total += item.amount;
    w.count++;
  }
  const windows = [];
  for (const byStart of grouped.values()) for (const w of byStart.values()) {
    if (w.count > 0) { w.final = isFinal(w.start); windows.push(w); }
  }
  windows.sort((a, b) => a.start - b.start || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { watermark, windows };
}
