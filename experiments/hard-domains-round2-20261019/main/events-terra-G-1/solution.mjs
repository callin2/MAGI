/**
 * Build revisable, gap-connected activity sessions.
 * State is deliberately local to an invocation: records are a receipt log, not
 * an append-only list of events.
 */
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  // id -> { rev, payload, alive, event, sealed }
  const versions = new Map();
  const finalized = [];

  const cmpText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const payloadOf = r => r.kind === 'delete'
    ? `d\u0000${r.id}\u0000${r.rev}`
    : `u\u0000${r.id}\u0000${r.rev}\u0000${r.key}\u0000${r.event_time}\u0000${r.amount}`;

  function openComponents(extra) {
    // extra is the proposed, already old-contribution-free event list when
    // testing an update.  Normally the list is read from current state.
    const events = extra || [];
    if (!extra) {
      for (const [id, state] of versions) {
        if (state.alive && !state.sealed) events.push({ id, ...state.event });
      }
    }
    const byKey = new Map();
    for (const event of events) {
      let a = byKey.get(event.key);
      if (!a) byKey.set(event.key, a = []);
      a.push(event);
    }
    const result = [];
    for (const [key, a] of byKey) {
      a.sort((x, y) => x.event_time - y.event_time || cmpText(x.id, y.id));
      let group = [];
      for (const event of a) {
        if (group.length && event.event_time - group[group.length - 1].event_time > gap_ms) {
          result.push(component(key, group));
          group = [];
        }
        group.push(event);
      }
      if (group.length) result.push(component(key, group));
    }
    return result;
  }

  function component(key, group) {
    let total = 0;
    for (const e of group) total += e.amount;
    const ids = group.map(e => e.id).sort(cmpText);
    return {
      key,
      start: group[0].event_time,
      end: group[group.length - 1].event_time + gap_ms,
      total,
      count: group.length,
      ids,
      final: false,
      // Kept internally only; stripped in the returned value.
      _members: group.map(e => e.id)
    };
  }

  function finalizeEligible() {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    for (const c of openComponents()) {
      if (c.end <= cutoff) {
        for (const id of c._members) versions.get(id).sealed = true;
        delete c._members;
        c.final = true;
        finalized.push(c);
      }
    }
  }

  function isNearFinal(event) {
    // A final session occupies [start, end] for extension purposes: end is
    // already last-event-time + gap.  Thus equality at either reach boundary
    // is forbidden.
    return finalized.some(f => f.key === event.key &&
      event.event_time >= f.start - gap_ms && event.event_time <= f.end);
  }

  for (const r of records) {
    if (r.kind === 'watermark') {
      if (watermark === null || r.time > watermark) {
        watermark = r.time;
        finalizeEligible();
      }
      continue;
    }

    const prior = versions.get(r.id);
    const payload = payloadOf(r);
    if (prior && r.rev < prior.rev) continue;
    if (prior && r.rev === prior.rev) {
      if (prior.payload !== payload) throw new Error('conflicting revision');
      continue;
    }

    // A greater mutation of a sealed logical event is never accepted.
    if (prior && prior.sealed) throw new Error('finalized event cannot change');

    if (r.kind === 'delete') {
      versions.set(r.id, { rev: r.rev, payload, alive: false, event: null, sealed: false });
      finalizeEligible();
      continue;
    }

    const event = { key: r.key, event_time: r.event_time, amount: r.amount };
    // This test is before altering state, making rejection completely atomic.
    if (isNearFinal(event)) throw new Error('event is adjacent to finalized session');

    // Test the component in the full proposal, with this id's old open event
    // removed.  This is why old isolated events may still be revised into a
    // newer, open component.
    const proposal = [];
    for (const [id, state] of versions) {
      if (id !== r.id && state.alive && !state.sealed) proposal.push({ id, ...state.event });
    }
    proposal.push({ id: r.id, ...event });
    if (watermark !== null) {
      const proposedComponent = openComponents(proposal).find(c => c._members.includes(r.id));
      if (proposedComponent.end <= watermark - lateness_ms) {
        throw new Error('event would create a final session');
      }
    }

    versions.set(r.id, { rev: r.rev, payload, alive: true, event, sealed: false });
    finalizeEligible();
  }

  const result = finalized.concat(openComponents().map(c => {
    delete c._members;
    return c;
  }));
  result.sort((a, b) => a.start - b.start || cmpText(a.key, b.key));
  return { watermark, sessions: result };
}
