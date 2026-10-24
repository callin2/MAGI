// Recurring local-time availability planner.  Resolution is deliberately done by
// validating each possible offset against Intl, rather than by interpreting a
// local clock reading as UTC (which is incorrect at DST transitions).
const OFFSETS = {
  UTC: [0],
  'America/New_York': [-300, -240],
  'Europe/Berlin': [60, 120],
  'Asia/Kathmandu': [345],
  'Australia/Lord_Howe': [630, 660]
};

function datePartsFormatter(zone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
}

function matchesLocal(formatter, instant, y, mo, d, h, min) {
  const p = formatter.formatToParts(new Date(instant));
  const values = {};
  for (const part of p) if (part.type !== 'literal') values[part.type] = +part.value;
  return values.year === y && values.month === mo && values.day === d &&
    values.hour === h && values.minute === min;
}

function localDateLabel(y, m, d) {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Build slots from weekly local wall-clock rules. All comparisons after local
 * resolution are numeric instant comparisons, so endpoint adjacency is safe.
 */
export function plan({ zone, range_start, range_end, rules, exclusions, busy }) {
  const rangeStart = Date.parse(range_start);
  const rangeEnd = Date.parse(range_end);
  const formatter = datePartsFormatter(zone);
  const offsets = OFFSETS[zone];
  // The stated supported zones are intentionally enumerated above. This guard
  // also makes an accidental unsupported zone fail plainly instead of silently
  // applying an arbitrary offset.
  if (!offsets) throw new RangeError(`Unsupported zone: ${zone}`);

  const excluded = new Set(exclusions.map(x => `${x.rule_id}\u0000${x.date}`));
  const busyIntervals = busy.map(x => [Date.parse(x.start), Date.parse(x.end)]);
  const output = [];

  // A local date can be at most one calendar day away from an instant in these
  // zones. Two days either side keeps the enumeration simple and conservative.
  const first = new Date(rangeStart - 2 * 86400000);
  const last = new Date(rangeEnd + 2 * 86400000);
  let cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
  const stop = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());

  for (; cursor <= stop; cursor += 86400000) {
    const wallDay = new Date(cursor);
    const y = wallDay.getUTCFullYear(), mo = wallDay.getUTCMonth() + 1, d = wallDay.getUTCDate();
    const local_date = localDateLabel(y, mo, d);
    const weekday = wallDay.getUTCDay(); // Gregorian weekday of a local date label

    for (const rule of rules) {
      if (rule.weekday !== weekday || local_date < rule.from || local_date > rule.through ||
          excluded.has(`${rule.id}\u0000${local_date}`)) continue;
      const hour = +rule.start.slice(0, 2), minute = +rule.start.slice(3, 5);
      const nominal = Date.UTC(y, mo - 1, d, hour, minute);
      const resolved = [];
      for (const offset of offsets) {
        const instant = nominal - offset * 60000;
        if (matchesLocal(formatter, instant, y, mo, d, hour, minute)) resolved.push(instant);
      }
      resolved.sort((a, b) => a - b);
      let selected = resolved;
      if (resolved.length === 2 && rule.fold === 'earlier') selected = [resolved[0]];
      else if (resolved.length === 2 && rule.fold === 'later') selected = [resolved[1]];

      for (const start of selected) {
        const end = start + rule.minutes * 60000;
        if (start < rangeStart || end > rangeEnd) continue;
        if (busyIntervals.some(([busyStart, busyEnd]) => start < busyEnd && busyStart < end)) continue;
        output.push({ rule_id: rule.id, local_date, start: new Date(start).toISOString(), end: new Date(end).toISOString() });
      }
    }
  }
  return output.sort((a, b) => {
    const delta = Date.parse(a.start) - Date.parse(b.start);
    if (delta) return delta;
    return a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0;
  });
}
