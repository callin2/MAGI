// Calculate a recommendation only; this function deliberately does not mutate its inputs.
export function allocate({ now, on_hand, holds, orders }) {
  const skuKeys = Object.keys(on_hand);
  const capacity = skuKeys.map((sku) => on_hand[sku]);
  const skuIndex = new Map(skuKeys.map((sku, i) => [sku, i]));

  // A reservation is the only kind of old hold which consumes this snapshot.
  // (on_hand has already had historical commits accounted for.)
  const blockedOrders = new Set();
  for (const hold of holds) {
    const activeReservation = hold.state === 'reserved' && hold.expires_at > now;
    if (activeReservation) {
      capacity[skuIndex.get(hold.sku)] -= hold.quantity;
      blockedOrders.add(hold.order_id);
    } else if (hold.state === 'committed' || hold.state === 'cancelled') {
      blockedOrders.add(hold.order_id);
    }
  }

  // Normalize enough of an order to make duplicate detection independent of
  // object-key and choice ordering.
  const canonicalOrder = (order) => JSON.stringify([order.value, order.group,
    order.choices.map((choice) => [choice.id,
      Object.entries(choice.items).sort(([a], [b]) => asciiCompare(a, b))])
      .sort((a, b) => asciiCompare(JSON.stringify(a), JSON.stringify(b))),
  ]);

  const byId = new Map();
  for (const order of orders) {
    const signature = canonicalOrder(order);
    const previous = byId.get(order.id);
    if (previous) {
      if (previous.signature !== signature) throw new Error(`conflicting definitions for order ${order.id}`);
    } else byId.set(order.id, { order, signature });
  }

  const candidates = [];
  for (const { order } of byId.values()) {
    if (blockedOrders.has(order.id)) continue;
    candidates.push({
      id: order.id, value: order.value, group: order.group,
      choices: order.choices.map((choice) => ({
        id: choice.id, quantities: skuKeys.map((sku) => choice.items[sku] ?? 0),
      })),
    });
  }
  // Keeping each non-null group consecutive means a DP state needs only one
  // boolean for its current group, instead of a mask of all prior groups.
  candidates.sort((a, b) => {
    if (a.group === null) return b.group === null ? asciiCompare(a.id, b.id) : -1;
    if (b.group === null) return 1;
    const groups = asciiCompare(a.group, b.group);
    return groups || asciiCompare(a.id, b.id);
  });

  const pairCompare = (a, b) => asciiCompare(a.order_id, b.order_id) || asciiCompare(a.choice_id, b.choice_id);
  const better = (a, b) => {
    if (a.value !== b.value) return a.value > b.value;
    if (a.count !== b.count) return a.count > b.count;
    for (let i = 0; i < a.pairs.length; i++) {
      const comparison = pairCompare(a.pairs[i], b.pairs[i]);
      if (comparison) return comparison < 0;
    }
    return false;
  };
  const insertPair = (pairs, pair) => {
    const result = pairs.slice();
    let at = 0;
    while (at < result.length && pairCompare(result[at], pair) < 0) at++;
    result.splice(at, 0, pair);
    return result;
  };

  const memo = new Map();
  // groupTaken applies only to candidates[index].group. It is reset when the
  // following candidate belongs to a different group.
  const solve = (index, left, groupTaken) => {
    if (index === candidates.length) return { value: 0, count: 0, pairs: [] };
    const key = `${index}|${groupTaken ? 1 : 0}|${left.join(',')}`;
    const known = memo.get(key);
    if (known) return known;
    const order = candidates[index];
    const carriesGroup = (taken) => index + 1 < candidates.length &&
      order.group !== null && candidates[index + 1].group === order.group ? taken : false;

    let best = solve(index + 1, left, carriesGroup(groupTaken));
    if (order.group === null || !groupTaken) {
      for (const choice of order.choices) {
        let fits = true;
        for (let s = 0; s < left.length; s++) if (choice.quantities[s] > left[s]) { fits = false; break; }
        if (!fits) continue;
        const nextLeft = left.map((amount, s) => amount - choice.quantities[s]);
        const tail = solve(index + 1, nextLeft, carriesGroup(order.group !== null));
        const proposal = {
          value: order.value + tail.value,
          count: 1 + tail.count,
          pairs: insertPair(tail.pairs, { order_id: order.id, choice_id: choice.id }),
        };
        if (better(proposal, best)) best = proposal;
      }
    }
    memo.set(key, best);
    return best;
  };

  const winner = solve(0, capacity, false);
  const remaining = {};
  for (let i = 0; i < skuKeys.length; i++) remaining[skuKeys[i]] = capacity[i];
  for (const pair of winner.pairs) {
    const order = candidates.find((candidate) => candidate.id === pair.order_id);
    const choice = order.choices.find((candidate) => candidate.id === pair.choice_id);
    for (let i = 0; i < skuKeys.length; i++) remaining[skuKeys[i]] -= choice.quantities[i];
  }
  return { value: winner.value, count: winner.count, allocations: winner.pairs, remaining };
}

function asciiCompare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
