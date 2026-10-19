# Repair and validation

Implemented a pure recommendation function; no calendar, network, filesystem, or external service access occurs in the optimizer. Inputs are not modified.

The search enumerates meeting occurrence/room assignments globally, including omission. Safe partial pruning enforces room/person overlaps and prerequisite selection/timing, with value/count upper bounds. Directed setup is evaluated only against consecutive meetings on each person's final timeline. In particular, a nonmetric transition that is invalid in a partial schedule is not prematurely rejected: an intermediate selected meeting may repair it. Output tie-breaking uses code-unit comparisons, not locale collation.

Civil labels are resolved by collecting nearby Intl time-zone offsets and round-tripping candidate instants. Gaps yield no candidates; folds honor earlier/later/either while retaining one selected occurrence per meeting. Durations are elapsed minutes, and room blocks use half-open occupancy only.

Validation: ran the supplied public tests and candidate tests using the tests tool. All 10 tests passed, including 80 seeded cases compared with an independent complete-schedule exhaustive oracle. Coverage includes global value/count/ASCII ties, input preservation, prerequisites in both ID orders, endpoint adjacency, blocks and range containment, cross-room people conflicts, directed setup and repair by an intermediate meeting, New York/Berlin DST, Kathmandu offset, and Lord Howe half-hour gap/fold plus elapsed duration.

Limits: exact search is exponential, intended for the contractual maximum of 10 meetings and 3 rooms. Time-zone resolution relies on Node's Intl time-zone database and the stated five zones in 2024–2026; it is not a general historical time-zone resolver. Inputs are assumed well formed as specified. Some zone-focused tests intentionally use a broad range to isolate civil-time resolution; range containment itself is tested separately. No live calendar access was attempted.
