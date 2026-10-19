// Enumerate real minutes rather than guessing the offset of a wall-clock label.
// This naturally retains both sides of a fold and never invents a gap time.
export function plan({ zone, range_start, range_end, rules, exclusions = [], busy = [] }) {
  if (rules.length === 0) return [];
  const minute = 60000;
  const day = 86400000;
  const lower = Date.parse(range_start);
  const upper = Date.parse(range_end);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const byClock = new Map();
  const occurrences = rules.map(() => new Map());
  rules.forEach((rule, index) => {
    if (!byClock.has(rule.start)) byClock.set(rule.start, []);
    byClock.get(rule.start).push(index);
  });
  const removed = new Map();
  for (const { rule_id, date } of exclusions) {
    if (!removed.has(rule_id)) removed.set(rule_id, new Set());
    removed.get(rule_id).add(date);
  }
  const occupied = busy.map(b => [Date.parse(b.start), Date.parse(b.end)]);

  // Pad before applying range containment: the requested fold might be outside
  // the query even though its other copy is inside. All folds in the supported
  // zones in 2024–2026 are at most one hour, so a day covers both copies.
  for (let instant = Math.floor(lower / minute) * minute - day;
       instant <= Math.ceil(upper / minute) * minute + day;
       instant += minute) {
    const parts = {};
    for (const p of formatter.formatToParts(instant)) {
      if (p.type !== 'literal') parts[p.type] = p.value;
    }
    const indices = byClock.get(`${parts.hour}:${parts.minute}`);
    if (!indices) continue;
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (const index of indices) {
      const rule = rules[index];
      if (weekday !== rule.weekday || date < rule.from || date > rule.through ||
          removed.get(rule.id)?.has(date)) continue;
      const dates = occurrences[index];
      if (!dates.has(date)) dates.set(date, []);
      dates.get(date).push(instant);
    }
  }

  const result = [];
  rules.forEach((rule, index) => {
    for (const [local_date, instants] of occurrences[index]) {
      const selected = rule.fold === 'both' ? instants :
        [rule.fold === 'later' ? instants[instants.length - 1] : instants[0]];
      for (const start of selected) {
        const end = start + rule.minutes * minute;
        if (start < lower || end > upper) continue;
        if (occupied.some(([a, b]) => start < b && a < end)) continue;
        result.push({ rule_id: rule.id, local_date,
          start: new Date(start).toISOString(), end: new Date(end).toISOString() });
      }
    }
  });
  return result.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 :
    a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0);
}
