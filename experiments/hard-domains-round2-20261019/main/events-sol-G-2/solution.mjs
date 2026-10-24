// Revision state and event membership are local to each invocation.
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  const versions = new Map();
  const events = new Map();
  const sealed = new Set();
  const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;

  function components(source) {
    const byKey = new Map();
    for (const event of source.values()) {
      if (!byKey.has(event.key)) byKey.set(event.key, []);
      byKey.get(event.key).push(event);
    }
    const result = [];
    for (const [key, rows] of byKey) {
      rows.sort((a, b) => a.event_time - b.event_time || ascii(a.id, b.id));
      let current;
      for (const row of rows) {
        if (!current || row.event_time > current.end) {
          current = { key, start: row.event_time, end: row.event_time + gap_ms,
            total: 0, count: 0, ids: [], final: false };
          result.push(current);
        }
        current.end = row.event_time + gap_ms;
        current.total += row.amount;
        current.count++;
        current.ids.push(row.id);
      }
    }
    for (const component of result) {
      component.ids.sort(ascii);
      component.final = component.ids.some(id => sealed.has(id));
    }
    return result;
  }

  function finalize() {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    for (const component of components(events)) {
      if (component.end <= cutoff) {
        for (const id of component.ids) sealed.add(id);
      }
    }
  }

  for (const record of records) {
    if (record.kind === 'watermark') {
      watermark = watermark === null ? record.time : Math.max(watermark, record.time);
      finalize();
      continue;
    }
    // Canonical payloads do not depend on object property order.
    const payload = JSON.stringify(record.kind === 'delete'
      ? ['delete']
      : ['upsert', record.key, record.event_time, record.amount]);
    const previous = versions.get(record.id);
    if (previous) {
      if (record.rev < previous.rev) continue;
      if (record.rev === previous.rev) {
        if (payload !== previous.payload) throw new Error('Conflicting accepted revision');
        continue;
      }
    }
    if (sealed.has(record.id)) continue;

    if (record.kind === 'upsert') {
      // A finalized session is immutable, including its expanded join boundary.
      const touchesSealed = components(events).some(component =>
        component.final && component.key === record.key &&
        record.event_time >= component.start - gap_ms &&
        record.event_time <= component.end);
      if (touchesSealed) continue;

      const proposal = new Map(events);
      proposal.set(record.id, {
        id: record.id, key: record.key,
        event_time: record.event_time, amount: record.amount
      });
      const containing = components(proposal).find(component => component.ids.includes(record.id));
      if (watermark !== null && containing.end <= watermark - lateness_ms) continue;
      events.set(record.id, proposal.get(record.id));
    } else {
      events.delete(record.id);
    }
    versions.set(record.id, { rev: record.rev, payload });
    finalize();
  }
  return {
    watermark,
    sessions: components(events).sort((a, b) => a.start - b.start || ascii(a.key, b.key))
  };
}
