// ASCII strings are ordered by code unit, not by locale collation.
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function sessions({gap_ms, lateness_ms, records}) {
  let watermark = null;
  let accepted = new Map();
  const sealedIds = new Set();
  const sealed = [];

  function samePayload(a, b) {
    return a.kind === b.kind && (a.kind === 'delete' ||
      (a.key === b.key && a.event_time === b.event_time && a.amount === b.amount));
  }

  // Rebuild connected components rather than assigning events to epoch buckets.
  // Sealed events are represented by immutable snapshots, never regrouped.
  function components(state) {
    const keys = new Map();
    for (const [id, r] of state) {
      if (r.kind !== 'upsert' || sealedIds.has(id)) continue;
      if (!keys.has(r.key)) keys.set(r.key, []);
      keys.get(r.key).push({id, ...r});
    }
    const result = [];
    for (const [key, events] of keys) {
      events.sort((a, b) => a.event_time - b.event_time || compare(a.id, b.id));
      let group = null;
      for (const event of events) {
        // group.end is the last event time plus the inactivity gap.
        if (!group || event.event_time > group.end) {
          group = {key, start: event.event_time, end: event.event_time + gap_ms,
            total: 0, count: 0, ids: [], final: false};
          result.push(group);
        }
        group.end = event.event_time + gap_ms;
        group.total += event.amount;
        group.count++;
        group.ids.push(event.id);
      }
    }
    for (const group of result) group.ids.sort(compare);
    return result;
  }

  function finalize() {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    for (const group of components(accepted)) {
      if (group.end <= cutoff) {
        group.final = true;
        sealed.push(group);
        for (const id of group.ids) sealedIds.add(id);
      }
    }
  }

  for (const record of records) {
    if (record.kind === 'watermark') {
      watermark = watermark === null ? record.time : Math.max(watermark, record.time);
      finalize();
      continue;
    }
    const old = accepted.get(record.id);
    if (old) {
      if (record.rev < old.rev) continue;
      if (record.rev === old.rev) {
        if (!samePayload(old, record)) throw new Error('Conflicting accepted revision');
        continue;
      }
    }
    if (sealedIds.has(record.id)) continue;

    if (record.kind === 'upsert' && sealed.some(group =>
      group.key === record.key && record.event_time >= group.start - gap_ms &&
      record.event_time <= group.end)) continue;

    // The proposal removes the old contribution before testing the new session.
    const proposal = new Map(accepted);
    proposal.set(record.id, {...record});
    if (record.kind === 'upsert' && watermark !== null) {
      const target = components(proposal).find(group => group.ids.includes(record.id));
      if (target.end <= watermark - lateness_ms) continue;
    }
    accepted = proposal;
    finalize();
  }

  const output = [...sealed, ...components(accepted)];
  output.sort((a, b) => a.start - b.start || compare(a.key, b.key));
  return {watermark, sessions: output};
}
