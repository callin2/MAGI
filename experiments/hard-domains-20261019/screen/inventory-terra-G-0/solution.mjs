/**
 * Replay a receipt stream against an in-memory reservation ledger.
 * The input is never mutated.
 */
export function replay({ stock, operations }) {
  const on_hand = { ...stock };
  const reservations = new Map();
  const requests = new Map();
  const outcomes = [];
  let now = 0;

  // The supplied operation objects contain only data.  A deterministic encoding
  // makes request-id conflict detection independent of property insertion order.
  const commandKey = (operation) => stableEncode(
    Object.fromEntries(Object.entries(operation).filter(([key]) => key !== 'at')),
  );

  const expireDueReservations = () => {
    for (const reservation of reservations.values()) {
      if (reservation.state === 'reserved' && reservation.expires_at <= now) {
        reservation.state = 'expired';
      }
    }
  };

  const heldFor = (sku) => {
    let held = 0;
    for (const reservation of reservations.values()) {
      if (reservation.state === 'reserved' && reservation.sku === sku) held += reservation.quantity;
    }
    return held;
  };

  for (const operation of operations) {
    // Delivery time is a watermark, rather than an instruction to set time.
    now = Math.max(now, operation.at);
    expireDueReservations();

    const key = commandKey(operation);
    const prior = requests.get(operation.request_id);
    if (prior) {
      if (prior.key !== key) throw new Error('request_id reused with different command fields');
      outcomes.push({ request_id: operation.request_id, status: prior.status });
      continue;
    }

    let status;
    if (operation.type === 'reserve') {
      const existing = reservations.get(operation.reservation_id);
      if (existing) {
        // A cancellation tombstone deliberately has no terms: it blocks every
        // later reserve for this business id rather than being a terms conflict.
        if (existing.sku === null) {
          status = 'cancelled';
        } else {
          if (
            existing.sku !== operation.sku ||
            existing.quantity !== operation.quantity ||
            existing.ttl_ms !== operation.ttl_ms
          ) {
            throw new Error('reservation_id reused with different terms');
          }
          status = existing.state;
        }
      } else if (on_hand[operation.sku] - heldFor(operation.sku) < operation.quantity) {
        status = 'insufficient';
      } else {
        reservations.set(operation.reservation_id, {
          id: operation.reservation_id,
          sku: operation.sku,
          quantity: operation.quantity,
          expires_at: now + operation.ttl_ms,
          // Retained internally so same-term reserve receipts can be recognized.
          ttl_ms: operation.ttl_ms,
          state: 'reserved',
        });
        status = 'reserved';
      }
    } else if (operation.type === 'cancel') {
      const reservation = reservations.get(operation.reservation_id);
      if (!reservation) {
        reservations.set(operation.reservation_id, {
          id: operation.reservation_id,
          sku: null,
          quantity: 0,
          expires_at: null,
          state: 'cancelled',
        });
        status = 'cancelled';
      } else if (reservation.state === 'reserved') {
        reservation.state = 'cancelled';
        status = 'cancelled';
      } else {
        status = reservation.state;
      }
    } else if (operation.type === 'commit') {
      const reservation = reservations.get(operation.reservation_id);
      if (!reservation) {
        status = 'missing';
      } else if (reservation.state === 'reserved') {
        on_hand[reservation.sku] -= reservation.quantity;
        reservation.state = 'committed';
        status = 'committed';
      } else {
        status = reservation.state;
      }
    } else if (operation.type === 'adjust') {
      const proposed = on_hand[operation.sku] + operation.delta;
      if (proposed >= 0 && proposed >= heldFor(operation.sku)) {
        on_hand[operation.sku] = proposed;
        status = 'adjusted';
      } else {
        status = 'rejected';
      }
    }

    requests.set(operation.request_id, { key, status });
    outcomes.push({ request_id: operation.request_id, status });
  }

  const available = {};
  for (const sku of Object.keys(on_hand)) available[sku] = on_hand[sku] - heldFor(sku);
  const publicReservations = [...reservations.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id, sku, quantity, expires_at, state }) => ({ id, sku, quantity, expires_at, state }));

  return { now, on_hand, available, reservations: publicReservations, outcomes };
}

function stableEncode(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableEncode).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableEncode(value[key])}`).join(',')}}`;
}
