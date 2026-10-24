# Repair and validation

Implemented `book` as a synchronous, input-preserving recommendation function. It returns only value, count, and ID-sorted booking records with UTC millisecond timestamps.

## Approach

- Round-trip civil times through `Intl.DateTimeFormat`, collecting nearby offsets to identify gaps and both sides of folds, including Lord Howe's half-hour change and Kathmandu's quarter-hour offset.
- Enumerate each meeting's room/instant options, filtering by the query boundary and room blocks.
- Search all relevant assignments with optimistic remaining-value/count bounds. ID/room/time traversal is lexicographic among equal-count schedules, so the first objective tie is retained without locale-dependent comparison.
- Check shared room/person overlap and prerequisite selection/end-time constraints.
- Check setup only between currently consecutive selected meetings for each person. An invalid transition is not pruned while an undecided meeting could fit in between, because transitions need not be metric. At a complete assignment this is an exact feasibility check.

## Actual validation

Ran `functions.tests` after writing the implementation and candidate suite: **8 tests passed, 0 failed** (including the two public tests).

Candidate coverage includes global value optimization, zero-value count optimization, ASCII ID/room ordering, input preservation, room assignment, directed setup, nonmetric intermediate meetings, prerequisites and elapsed end constraints, blocks touching endpoints, range filtering, US/Berlin/Lord Howe gaps and folds, Kathmandu offset, elapsed fold duration, and alternate-fold selection after a block.

An independent exhaustive UTC oracle also checked 100 deterministic randomized six-meeting problems with room alternatives, shared people, asymmetric transitions, prerequisites, and blocks. All exact result objects matched. The timezone test helper uses a deliberately broad query to isolate conversion cases; production support remains scoped to the specified query bounds.

## Limits

Search is exponential, with pruning, and targets the contract's small meeting/room bounds. Civil-time support relies on the runtime's Intl timezone database and the stated five zones in 2024–2026. No generalized historical-zone support or malformed-input validation is claimed. Randomized oracle coverage uses UTC; non-UTC cases are covered by explicit expected instants. No network, live calendar, or external process is used.
