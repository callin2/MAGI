/**
 * Apply an ordered set of event-time mutations to keyed tumbling windows.
 * State is deliberately local to this invocation.
 */
export function aggregate({ window_ms, lateness_ms, records }) {
  let watermark = null;
  // id -> { rev, payload, contribution? }.  A missing contribution is a tombstone.
  const identities = new Map();
  // JSON encoding avoids collisions between arbitrary ASCII keys and starts.
  const windows = new Map();

  const windowFor = (eventTime) => {
    // Math.floor, rather than truncation, is required for pre-epoch times.
    const start = Math.floor(eventTime / window_ms) * window_ms;
    return { start, end: start + window_ms };
  };
  const isFinal = (win) => watermark !== null && win.end <= watermark - lateness_ms;
  const payloadFor = (record) => record.kind === 'delete'
    ? { kind: 'delete' }
    : { kind: 'upsert', key: record.key, event_time: record.event_time, amount: record.amount };
  const payloadEqual = (a, b) => {
    if (a.kind !== b.kind) return false;
    return a.kind === 'delete' ||
      (a.key === b.key && a.event_time === b.event_time && a.amount === b.amount);
  };
  const windowKey = (key, start) => JSON.stringify([start, key]);

  const add = (contribution) => {
    const id = windowKey(contribution.key, contribution.start);
    let win = windows.get(id);
    if (!win) {
      win = {
        key: contribution.key,
        start: contribution.start,
        end: contribution.end,
        total: 0,
        count: 0,
      };
      windows.set(id, win);
    }
    win.total += contribution.amount;
    win.count += 1;
  };
  const remove = (contribution) => {
    const id = windowKey(contribution.key, contribution.start);
    const win = windows.get(id);
    // Every live contribution was previously added, so this is intentionally exact.
    win.total -= contribution.amount;
    win.count -= 1;
    if (win.count === 0) windows.delete(id);
  };

  for (const record of records) {
    if (record.kind === 'watermark') {
      if (watermark === null || record.time > watermark) watermark = record.time;
      continue;
    }

    const old = identities.get(record.id);
    const payload = payloadFor(record);
    if (old) {
      if (record.rev < old.rev) continue;
      if (record.rev === old.rev) {
        if (!payloadEqual(old.payload, payload)) {
          throw new Error('conflicting payload for an accepted revision');
        }
        continue;
      }
    }

    // The record has a greater revision (or is the first for this id).  First
    // determine all windows it would change; rejection must be atomic.
    const oldContribution = old?.contribution;
    let newContribution = null;
    if (record.kind === 'upsert') {
      const bounds = windowFor(record.event_time);
      newContribution = {
        key: record.key,
        start: bounds.start,
        end: bounds.end,
        amount: record.amount,
      };
    }
    if ((oldContribution && isFinal(oldContribution)) ||
        (newContribution && isFinal(newContribution))) {
      continue;
    }

    if (oldContribution) remove(oldContribution);
    if (newContribution) add(newContribution);
    identities.set(record.id, {
      rev: record.rev,
      payload,
      contribution: newContribution,
    });
  }

  const asciiCompare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const result = [...windows.values()]
    .filter((win) => win.count > 0)
    .sort((a, b) => a.start - b.start || asciiCompare(a.key, b.key))
    .map((win) => ({
      key: win.key,
      start: win.start,
      end: win.end,
      total: win.total,
      count: win.count,
      final: isFinal(win),
    }));
  return { watermark, windows: result };
}
