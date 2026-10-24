// Revision state is separate from live membership: tombstones retain versions.
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  const versions = new Map();
  const live = new Map();
  const sealed = new Set();
  const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;

  function components(rows) {
    const byKey = new Map();
    for (const row of rows.values()) {
      if (!byKey.has(row.key)) byKey.set(row.key, []);
      byKey.get(row.key).push(row);
    }
    const result = [];
    for (const [key, events] of byKey) {
      events.sort((a, b) => a.event_time - b.event_time || ascii(a.id, b.id));
      let group;
      for (const event of events) {
        // The previous last time is group.end - gap_ms.
        if (!group || event.event_time > group.end) {
          group = { key, start: event.event_time, end: event.event_time + gap_ms,
            total: 0, count: 0, ids: [], final: false };
          result.push(group);
        }
        group.end = event.event_time + gap_ms;
        group.total += event.amount;
        group.count++;
        group.ids.push(event.id);
      }
    }
    for (const group of result) {
      group.ids.sort(ascii);
      group.final = sealed.has(group.ids[0]);
    }
    return result.sort((a, b) => a.start - b.start || ascii(a.key, b.key));
  }

  let current = [];
  function regroupAndFinalize() {
    current = components(live);
    if (watermark !== null) {
      const cutoff = watermark - lateness_ms;
      for (const group of current) {
        if (group.end <= cutoff) {
          group.final = true;
          for (const id of group.ids) sealed.add(id);
        }
      }
    }
  }

  for (const record of records) {
    if (record.kind === 'watermark') {
      watermark = watermark === null ? record.time : Math.max(watermark, record.time);
      regroupAndFinalize();
      continue;
    }
    const { id, rev } = record;
    // Canonical payload ignores object property ordering.
    const payload = JSON.stringify(record.kind === 'delete'
      ? ['delete'] : ['upsert', record.key, record.event_time, record.amount]);
    const previous = versions.get(id);
    if (previous && rev < previous.rev) continue;
    if (previous && rev === previous.rev) {
      if (payload !== previous.payload) throw new Error('Conflicting accepted revision');
      continue;
    }
    if (sealed.has(id)) continue;

    if (record.kind === 'upsert') {
      // A sealed component cannot be joined or extended, even by a bridge.
      if (current.some(group => group.final && group.key === record.key &&
          record.event_time >= group.start - gap_ms && record.event_time <= group.end)) continue;
      const proposed = new Map(live);
      proposed.set(id, { id, key: record.key, event_time: record.event_time, amount: record.amount });
      const containing = components(proposed).find(group => group.ids.includes(id));
      if (watermark !== null && containing.end <= watermark - lateness_ms) continue;
      live.set(id, proposed.get(id));
    } else {
      live.delete(id);
    }
    versions.set(id, { rev, payload });
    // A split or shortened component may now be behind the cutoff.
    regroupAndFinalize();
  }
  return { watermark, sessions: current };
}
