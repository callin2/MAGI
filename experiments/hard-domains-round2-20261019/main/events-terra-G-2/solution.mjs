/**
 * Build revisable, gap-connected activity sessions.  State is deliberately
 * local to this call: a finalized component is copied into `sealed` and is
 * never rebuilt from later live-event proposals.
 */
export function sessions({ gap_ms, lateness_ms, records }) {
  let watermark = null;
  const versions = new Map(); // id -> canonical accepted operation
  const live = new Map();     // id -> current, unsealed upsert
  const sealed = [];          // immutable session snapshots

  const cmpText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const canonical = r => r.kind === 'delete'
    ? `delete\u0000${r.id}\u0000${r.rev}`
    : `upsert\u0000${r.id}\u0000${r.rev}\u0000${r.key}\u0000${r.event_time}\u0000${r.amount}`;

  function components(events) {
    const byKey = new Map();
    for (const e of events) {
      let a = byKey.get(e.key);
      if (!a) byKey.set(e.key, a = []);
      a.push(e);
    }
    const result = [];
    for (const [key, a] of byKey) {
      // id makes the ordering deterministic when timestamps tie.
      a.sort((x, y) => x.event_time - y.event_time || cmpText(x.id, y.id));
      let group = [];
      let previous = null;
      const finish = () => {
        if (!group.length) return;
        const ids = group.map(e => e.id).sort(cmpText);
        result.push({
          key,
          start: group[0].event_time,
          end: group[group.length - 1].event_time + gap_ms,
          total: group.reduce((n, e) => n + e.amount, 0),
          count: group.length,
          ids,
          final: false
        });
      };
      for (const e of a) {
        if (previous !== null && e.event_time - previous > gap_ms) {
          finish();
          group = [];
        }
        group.push(e);
        previous = e.event_time;
      }
      finish();
    }
    return result;
  }

  function freezeEligible() {
    if (watermark === null) return;
    const cutoff = watermark - lateness_ms;
    for (const c of components([...live.values()])) {
      if (c.end <= cutoff) {
        c.final = true;
        sealed.push(c);
        for (const id of c.ids) live.delete(id);
      }
    }
  }

  // The wording "within gap_ms of a finalized session" uses the published
  // session interval [start,end], including both boundaries.
  function tooNearSealed(key, time) {
    return sealed.some(s => s.key === key && time >= s.start - gap_ms && time <= s.end + gap_ms);
  }

  function isSealedId(id) {
    // An id in sealed is no longer live.  Searching snapshots keeps this
    // independent of whether a later tombstone/version is ever attempted.
    return sealed.some(s => s.ids.includes(id));
  }

  for (const r of records) {
    if (r.kind === 'watermark') {
      if (watermark === null || r.time > watermark) watermark = r.time;
      freezeEligible();
      continue;
    }

    const prior = versions.get(r.id);
    const text = canonical(r);
    if (prior) {
      if (r.rev < prior.rev) continue;
      if (r.rev === prior.rev) {
        if (text !== prior.text) throw new Error('conflicting accepted revision');
        continue;
      }
    }

    // Any greater revision touching sealed membership is rejected before
    // changing revision bookkeeping or live state.
    if (isSealedId(r.id)) throw new Error('cannot revise finalized event');

    if (r.kind === 'delete') {
      live.delete(r.id); // deleting an unknown id is a valid tombstone
      versions.set(r.id, { rev: r.rev, text });
      freezeEligible();
      continue;
    }

    if (tooNearSealed(r.key, r.event_time)) {
      throw new Error('event is too close to finalized session');
    }

    // Form the complete proposed unsealed population, removing a prior
    // contribution from this id before assessing its new connected component.
    const proposal = new Map(live);
    proposal.set(r.id, { id: r.id, key: r.key, event_time: r.event_time, amount: r.amount });
    if (watermark !== null) {
      const own = components([...proposal.values()]).find(c => c.ids.includes(r.id));
      if (own.end <= watermark - lateness_ms) {
        throw new Error('proposed session is already final');
      }
    }

    live.set(r.id, { id: r.id, key: r.key, event_time: r.event_time, amount: r.amount });
    versions.set(r.id, { rev: r.rev, text });
    freezeEligible();
  }

  const output = sealed.concat(components([...live.values()]));
  output.sort((a, b) => a.start - b.start || cmpText(a.key, b.key));
  return { watermark, sessions: output };
}
