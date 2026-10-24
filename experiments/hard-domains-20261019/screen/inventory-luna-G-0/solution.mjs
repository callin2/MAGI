export function replay({ stock, operations }) {
  const on_hand = { ...stock };
  const reservations = new Map();
  const requests = new Map();
  const outcomes = [];
  let now = 0;

  const held = (sku) => {
    let total = 0;
    for (const r of reservations.values()) if (r.sku === sku && r.state === 'reserved') total += r.quantity;
    return total;
  };
  const fieldsFor = (o) => {
    const fields = { type: o.type };
    if (o.type === 'reserve') Object.assign(fields, { reservation_id: o.reservation_id, sku: o.sku, quantity: o.quantity, ttl_ms: o.ttl_ms });
    else if (o.type === 'adjust') Object.assign(fields, { sku: o.sku, delta: o.delta });
    else Object.assign(fields, { reservation_id: o.reservation_id });
    return JSON.stringify(fields);
  };

  for (const o of operations) {
    now = Math.max(now, o.at);
    for (const r of reservations.values()) {
      if (r.state === 'reserved' && now >= r.expires_at) r.state = 'expired';
    }
    const fingerprint = fieldsFor(o);
    if (requests.has(o.request_id)) {
      const prior = requests.get(o.request_id);
      if (prior.fingerprint !== fingerprint) throw new Error(`request_id reused with different command: ${o.request_id}`);
      outcomes.push({ request_id: o.request_id, status: prior.status });
      continue;
    }

    let status;
    if (o.type === 'reserve') {
      const old = reservations.get(o.reservation_id);
      if (old) {
        if (old.sku !== null && (old.sku !== o.sku || old.quantity !== o.quantity || old.ttl_ms !== o.ttl_ms))
          throw new Error(`reservation_id reused with different terms: ${o.reservation_id}`);
        status = old.state;
      } else if (on_hand[o.sku] - held(o.sku) < o.quantity) {
        status = 'insufficient';
      } else {
        reservations.set(o.reservation_id, { id: o.reservation_id, sku: o.sku, quantity: o.quantity, ttl_ms: o.ttl_ms, expires_at: now + o.ttl_ms, state: 'reserved' });
        status = 'reserved';
      }
    } else if (o.type === 'adjust') {
      const proposed = on_hand[o.sku] + o.delta;
      if (proposed >= held(o.sku) && proposed >= 0) { on_hand[o.sku] = proposed; status = 'adjusted'; }
      else status = 'rejected';
    } else {
      let r = reservations.get(o.reservation_id);
      if (!r) {
        if (o.type === 'cancel') {
          r = { id: o.reservation_id, sku: null, quantity: 0, ttl_ms: null, expires_at: null, state: 'cancelled' };
          reservations.set(o.reservation_id, r);
          status = 'cancelled';
        } else status = 'missing';
      } else if (r.state !== 'reserved') status = r.state;
      else if (o.type === 'cancel') { r.state = 'cancelled'; status = 'cancelled'; }
      else { r.state = 'committed'; on_hand[r.sku] -= r.quantity; status = 'committed'; }
    }
    requests.set(o.request_id, { fingerprint, status });
    outcomes.push({ request_id: o.request_id, status });
  }

  const available = {};
  for (const sku of Object.keys(on_hand)) available[sku] = on_hand[sku] - held(sku);
  const resultReservations = [...reservations.values()].map(({ id, sku, quantity, expires_at, state }) => ({ id, sku, quantity, expires_at, state })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { now, on_hand, available, reservations: resultReservations, outcomes };
}
