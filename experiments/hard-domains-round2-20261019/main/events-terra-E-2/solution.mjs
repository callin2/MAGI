// Revisable, event-time session aggregation.  All state is deliberately local to
// an invocation: accepted revisions are not a delivery log.
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  // id -> { rev, payload, event? }.  payload is the canonical accepted change.
  const versions = new Map();
  const live = new Map();
  const sealedIds = new Set();
  const sealed = [];

  const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const samePayload = (a, b) => {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'delete') return true;
    return a.key === b.key && a.event_time === b.event_time && a.amount === b.amount;
  };
  const components = (events) => {
    const byKey = new Map();
    for (const e of events) {
      let a = byKey.get(e.key);
      if (!a) byKey.set(e.key, a = []);
      a.push(e);
    }
    const answer = [];
    for (const [key, a] of byKey) {
      a.sort((x, y) => x.event_time - y.event_time || ascii(x.id, y.id));
      let group = [];
      for (const e of a) {
        if (group.length && e.event_time - group[group.length - 1].event_time > gap_ms) {
          answer.push(makeComponent(key, group));
          group = [];
        }
        group.push(e);
      }
      if (group.length) answer.push(makeComponent(key, group));
    }
    return answer;
  };
  const makeComponent = (key, group) => {
    const first = group[0].event_time;
    const last = group[group.length - 1].event_time;
    return {
      key, start: first, end: last + gap_ms,
      total: group.reduce((n, e) => n + e.amount, 0),
      count: group.length,
      ids: group.map(e => e.id).sort(ascii),
      _events: group
    };
  };
  const finalize = () => {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    for (const c of components([...live.values()])) {
      if (c.end <= cutoff) {
        for (const e of c._events) {
          live.delete(e.id);
          sealedIds.add(e.id);
        }
        delete c._events;
        c.final = true;
        sealed.push(c);
      }
    }
  };
  // “Within gap” is measured from the published finalized session interval.
  // Boundaries are inclusive, as required by the session connection rule.
  const touchesSealed = (e) => sealed.some(s =>
    s.key === e.key && e.event_time >= s.start - gap_ms && e.event_time <= s.end + gap_ms
  );

  for (const record of records) {
    if (record.kind === 'watermark') {
      if (watermark === null || record.time > watermark) watermark = record.time;
      finalize();
      continue;
    }

    const prior = versions.get(record.id);
    if (prior && record.rev < prior.rev) continue;
    const payload = record.kind === 'delete'
      ? { kind: 'delete' }
      : { kind: 'upsert', key: record.key, event_time: record.event_time, amount: record.amount };
    if (prior && record.rev === prior.rev) {
      if (!samePayload(prior.payload, payload)) throw new Error('conflicting accepted revision');
      continue;
    }

    const old = live.get(record.id);
    // Any greater-revision operation on a sealed contribution is forbidden.
    if (sealedIds.has(record.id)) throw new Error('cannot revise finalized session');

    if (record.kind === 'upsert') {
      const candidate = { id: record.id, key: record.key, event_time: record.event_time, amount: record.amount };
      if (touchesSealed(candidate)) throw new Error('cannot join finalized session');
      // Evaluate the candidate in the replacement state, rather than applying it
      // first (which also keeps a rejected correction completely atomic).
      const proposal = [...live.values()].filter(e => e.id !== record.id);
      proposal.push(candidate);
      if (watermark !== null) {
        const candidateComponent = components(proposal).find(c => c._events.some(e => e.id === record.id));
        if (candidateComponent.end <= watermark - lateness_ms) {
          throw new Error('upsert would already be finalized');
        }
      }
      versions.set(record.id, { rev: record.rev, payload });
      live.set(record.id, candidate);
    } else {
      versions.set(record.id, { rev: record.rev, payload });
      if (old) live.delete(record.id);
    }
    finalize();
  }

  const open = components([...live.values()]).map(c => {
    delete c._events;
    c.final = false;
    return c;
  });
  const all = sealed.concat(open);
  all.sort((a, b) => a.start - b.start || ascii(a.key, b.key));
  return { watermark, sessions: all };
}
