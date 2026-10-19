// All revision, watermark, and sealing state belongs to this invocation.
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  let accepted = new Map();
  const sealedIds = new Set();

  const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  function components(state) {
    const keys = new Map();
    for (const [id, row] of state) {
      if (row.kind !== 'upsert') continue;
      if (!keys.has(row.key)) keys.set(row.key, []);
      keys.get(row.key).push({ ...row, id });
    }
    const result = [];
    for (const [key, events] of keys) {
      events.sort((a, b) => a.event_time - b.event_time || ascii(a.id, b.id));
      let current;
      for (const event of events) {
        // end is the previous event's time plus the gap: equality connects.
        if (!current || event.event_time > current.end) {
          current = { key, start: event.event_time, end: event.event_time + gap_ms,
            total: 0, count: 0, ids: [], final: false };
          result.push(current);
        }
        current.end = event.event_time + gap_ms;
        current.total += event.amount;
        current.count++;
        current.ids.push(event.id);
      }
    }
    for (const component of result) {
      component.ids.sort(ascii);
      component.final = component.ids.some(id => sealedIds.has(id));
    }
    return result.sort((a, b) => a.start - b.start || ascii(a.key, b.key));
  }
  function finalize() {
    const result = components(accepted);
    if (watermark !== null) {
      const cutoff = watermark - lateness_ms;
      for (const component of result) {
        if (component.end <= cutoff) {
          component.final = true;
          for (const id of component.ids) sealedIds.add(id);
        }
      }
    }
    return result;
  }
  function canonical(record) {
    return record.kind === 'delete'
      ? { kind: 'delete', rev: record.rev }
      : { kind: 'upsert', rev: record.rev, key: record.key,
          event_time: record.event_time, amount: record.amount };
  }
  function same(a, b) {
    return a.kind === b.kind && (a.kind === 'delete' ||
      (a.key === b.key && a.event_time === b.event_time && a.amount === b.amount));
  }

  let current = [];
  for (const record of records) {
    if (record.kind === 'watermark') {
      watermark = watermark === null ? record.time : Math.max(watermark, record.time);
      current = finalize();
      continue;
    }
    const old = accepted.get(record.id);
    const next = canonical(record);
    if (old && next.rev < old.rev) continue;
    if (old && next.rev === old.rev) {
      if (!same(old, next)) throw new Error('Conflicting payload for accepted revision');
      continue;
    }
    // Revision replay/conflict is resolved before sealed-source rejection.
    if (sealedIds.has(record.id)) continue;
    if (next.kind === 'upsert') {
      // A component spans start through end-gap; its gap-neighborhood is
      // [start-gap, end]. No event in that interval may touch a sealed session.
      if (current.some(s => s.final && s.key === next.key &&
          next.event_time >= s.start - gap_ms && next.event_time <= s.end)) continue;
    }
    const proposal = new Map(accepted);
    proposal.set(record.id, next);
    if (next.kind === 'upsert' && watermark !== null) {
      const target = components(proposal).find(s => s.ids.includes(record.id));
      if (target.end <= watermark - lateness_ms) continue;
    }
    accepted = proposal;
    current = finalize();
  }
  return { watermark, sessions: current };
}
