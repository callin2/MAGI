// Replay is entirely receipt-driven: transport retries still advance expiry.
export function replay({ stock, operations }) {
  const on_hand = { ...stock };
  const available = { ...stock };
  const reservations = new Map();
  const requests = new Map();
  const terms = new Map();
  const outcomes = [];
  let now = 0;

  function commandKey(o) {
    switch (o.type) {
      case 'reserve':
        return JSON.stringify([o.type, o.reservation_id, o.sku, o.quantity, o.ttl_ms]);
      case 'adjust':
        return JSON.stringify([o.type, o.sku, o.delta]);
      default:
        return JSON.stringify([o.type, o.reservation_id]);
    }
  }

  for (const o of operations) {
    now = Math.max(now, o.at);
    for (const r of reservations.values()) {
      if (r.state === 'reserved' && r.expires_at <= now) {
        r.state = 'expired';
        available[r.sku] += r.quantity;
      }
    }

    const key = commandKey(o);
    const previous = requests.get(o.request_id);
    if (previous) {
      if (previous.key !== key) throw new Error('Conflicting request_id');
      outcomes.push({ request_id: o.request_id, status: previous.status });
      continue;
    }

    let status;
    if (o.type === 'reserve') {
      const r = reservations.get(o.reservation_id);
      const requestedTerms = JSON.stringify([o.sku, o.quantity, o.ttl_ms]);
      if (r) {
        // Unknown-cancel tombstones deliberately never acquire reservation terms.
        if (terms.has(r.id) && terms.get(r.id) !== requestedTerms) {
          throw new Error('Conflicting reservation terms');
        }
        status = r.state;
      } else if (available[o.sku] < o.quantity) {
        status = 'insufficient';
      } else {
        reservations.set(o.reservation_id, {
          id: o.reservation_id, sku: o.sku, quantity: o.quantity,
          expires_at: now + o.ttl_ms, state: 'reserved'
        });
        terms.set(o.reservation_id, requestedTerms);
        available[o.sku] -= o.quantity;
        status = 'reserved';
      }
    } else if (o.type === 'adjust') {
      const next = on_hand[o.sku] + o.delta;
      if (next < 0 || available[o.sku] + o.delta < 0) {
        status = 'rejected';
      } else {
        on_hand[o.sku] = next;
        available[o.sku] += o.delta;
        status = 'adjusted';
      }
    } else {
      const r = reservations.get(o.reservation_id);
      if (!r) {
        if (o.type === 'cancel') {
          reservations.set(o.reservation_id, {
            id: o.reservation_id, sku: null, quantity: 0,
            expires_at: null, state: 'cancelled'
          });
          status = 'cancelled';
        } else {
          status = 'missing';
        }
      } else if (r.state !== 'reserved') {
        status = r.state;
      } else {
        if (o.type === 'commit') {
          on_hand[r.sku] -= r.quantity;
          r.state = 'committed';
        } else {
          available[r.sku] += r.quantity;
          r.state = 'cancelled';
        }
        status = r.state;
      }
    }
    requests.set(o.request_id, { key, status });
    outcomes.push({ request_id: o.request_id, status });
  }
  return {
    now, on_hand, available,
    reservations: [...reservations.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    outcomes
  };
}
