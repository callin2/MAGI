// A state records used stock and used groups. For equal states, only the
// best objective prefix can matter to any later order.
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const instant = t => typeof t === 'string' ? Date.parse(t) : Number(t);

export function allocate({now, on_hand, holds, orders}) {
  const remaining = {...on_hand};
  const blocked = new Set();
  const time = instant(now);
  for (const h of holds) {
    const active = h.state === 'reserved' && instant(h.expires_at) > time;
    if (active) remaining[h.sku] -= h.quantity;
    if (active || h.state === 'committed' || h.state === 'cancelled') {
      blocked.add(h.order_id);
    }
  }

  // Validate duplicate IDs even if an existing hold makes them ineligible.
  const unique = new Map();
  for (const o of orders) {
    const choices = o.choices.map(c => ({
      id: c.id,
      entries: Object.entries(c.items).sort((a,b) => cmp(a[0], b[0]))
    })).sort((a,b) => cmp(a.id,b.id) || cmp(JSON.stringify(a.entries), JSON.stringify(b.entries)));
    const terms = JSON.stringify([o.value, o.group, choices]);
    if (unique.has(o.id)) {
      if (unique.get(o.id).terms !== terms) throw new Error('Conflicting order ID: ' + o.id);
    } else unique.set(o.id, {id:o.id, value:o.value, group:o.group, choices, terms});
  }
  const candidates = [...unique.values()].filter(o => !blocked.has(o.id))
    .sort((a,b) => cmp(a.id,b.id));
  const skus = Object.keys(on_hand);
  const caps = skus.map(s => remaining[s]);
  const strides = [];
  let stockRange = 1;
  for (const cap of caps) { strides.push(stockRange); stockRange *= cap + 1; }
  const groups = new Map();
  for (const o of candidates) {
    if (o.group !== null && !groups.has(o.group)) groups.set(o.group, 1 << groups.size);
  }
  for (const o of candidates) {
    o.mask = o.group === null ? 0 : groups.get(o.group);
    o.choices = o.choices.map((c, i) => {
      const quantities = skus.map(s => c.entries.find(e => e[0] === s)?.[1] ?? 0);
      return {...c, digit:3-i, quantities,
        delta:quantities.reduce((sum,q,j) => sum + q*strides[j],0)};
    });
  }

  // Base-4 digits encode choices in sorted order-ID order. On equal counts,
  // a larger code means a lexically smaller sequence of (order, choice).
  // At most 18 digits: all arithmetic remains exact in a JS Number.
  let states = new Map([[0, {value:0, count:0, code:0}]]);
  const better = (a,b) => !b || a.value > b.value ||
    (a.value === b.value && (a.count > b.count ||
      (a.count === b.count && a.code > b.code)));
  for (let i=0; i<candidates.length; i++) {
    const o = candidates[i];
    const weight = 4 ** (candidates.length-1-i);
    const next = new Map(states);
    for (const [key, prior] of states) {
      const mask = Math.floor(key / stockRange);
      if (mask & o.mask) continue;
      const usedCode = key % stockRange;
      const used = caps.map((cap,j) => Math.floor(usedCode / strides[j]) % (cap+1));
      for (const c of o.choices) {
        if (c.quantities.some((q,j) => used[j]+q > caps[j])) continue;
        const target = key + c.delta + o.mask*stockRange;
        const result = {value:prior.value+o.value, count:prior.count+1,
          code:prior.code+c.digit*weight};
        if (better(result,next.get(target))) next.set(target,result);
      }
    }
    states = next;
  }
  let best = {value:0,count:0,code:0};
  for (const result of states.values()) if (better(result,best)) best=result;
  const allocations = [];
  for (let i=0; i<candidates.length; i++) {
    const digit = Math.floor(best.code / 4**(candidates.length-1-i)) % 4;
    if (!digit) continue;
    const o = candidates[i], c = o.choices.find(c => c.digit === digit);
    allocations.push({order_id:o.id,choice_id:c.id});
    for (const [s,q] of c.entries) remaining[s] -= q;
  }
  return {value:best.value,count:best.count,allocations,remaining};
}
