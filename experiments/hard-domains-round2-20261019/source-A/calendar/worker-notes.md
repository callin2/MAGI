# Repair and validation

The module enumerates absolute minutes and obtains local labels through Intl.DateTimeFormat with the requested zone and a 00–23 hour cycle. Missing local times therefore never appear, while repeated times remain distinct absolute instants. Occurrences are grouped independently by rule and local date, then fold selection happens before containment or busy filtering. A day of padding ensures that the other side of a fold is considered even when outside the query.

Durations are elapsed milliseconds. Busy conflicts use strict half-open overlap inequalities. Exclusions are keyed by rule ID and local date. Results retain distinct rules and resolved instants and sort by UTC start followed by ASCII ID comparison. Input arrays and objects are not modified.

## Actual validation

Ran functions.tests after writing solution.mjs and candidate.test.mjs. Both public tests and nine candidate tests passed: 11 total, 0 failures. Tests cover New York fold modes and gap, fold selection before range/busy filtering, Berlin gap and fold, Lord Howe half-hour changes, Kathmandu's fractional offset and local date, explicit offset query and busy endpoints, elapsed duration across a fold, midnight crossing, inclusive rule dates, range equality, adjacent busy intervals versus true overlap, per-rule exclusions, ASCII ordering, frozen inputs, and a fourteen-day query crossing a year boundary.

## Limits

Inputs are assumed well formed as contracted; there is no added validation for invalid IDs, dates, zones, or ranges. Minute enumeration and one-day padding target the specified five zones in 2024–2026 and at most fourteen elapsed days. Those zones have minute-aligned offsets and folds no larger than one hour in this period. This is not a general resolver for historical sub-minute offsets or multi-day date-line changes. Timezone rules come from the installed Node Intl database. No live calendar, network, or third-party package was accessed. No additional test suites or exhaustive transition matrix were run.
