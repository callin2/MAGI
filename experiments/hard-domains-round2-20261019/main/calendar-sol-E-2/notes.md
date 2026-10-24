# Repair

`solution.mjs` exports the synchronous, pure `book` function. It resolves each local start using Intl-derived offsets on both sides of nearby transitions and verifies each candidate against the original civil label. Fold policy is applied before range and block filtering. `either` supplies alternative assignments of one meeting, never two independent bookings. Durations use elapsed milliseconds.

The solver enumerates skip/instant/room decisions in ASCII meeting-ID order. It enforces half-open room/person occupancy, room-only busy blocks, and prerequisite presence and completion. Directed setup is checked between consecutive selected meetings for each person. A setup violation in a partial selection is not grounds for rejection if an unassigned meeting could still fit between its endpoints: this is essential for nonmetric transition tables. At a complete selection every consecutive edge must pass. Bounds on remaining value/count and an optimistic lexicographic completion prune branches without changing the exact objective. Booking strings are UTC ISO strings with milliseconds; comparisons use code units rather than locale collation. Input collections are copied or read without modification.

## Actual validation

Ran `functions.tests` after writing the implementation and candidate suite. Result: 10 tests passed, 0 failed (2 public, 8 candidate), reported duration approximately 77 ms. The candidate oracle test independently enumerated all skip/room choices for 60 deterministic six-meeting UTC cases and checked room/person conflicts, directed consecutive setup, prerequisites, and all three objective levels.

Other candidate tests cover greedy counterexamples; value/count ties; ASCII ordering; room reassignment; deeply frozen input; a zero-value intermediate meeting repairing a nonmetric setup edge; setup equality; prerequisite timing and transitive chains; absolute-offset blocks and half-open range boundaries; New York, Berlin, and Lord Howe folds and gaps across 2024–2026; earlier/later/either behavior and fold-before-range filtering; Kathmandu's quarter-hour offset; and elapsed duration through a fold.

## Limits

Inputs are assumed well formed, including room references, transition entries, zones, DAG prerequisites, and all stated size/date bounds. The timezone offset sampling is specific to the supported modern zones and period; it is not a general historical timezone resolver. Results depend on Node's installed Intl timezone data. Exact enumeration remains exponential in worst-case inputs; no exhaustive performance benchmark of every ten-meeting configuration was run. The randomized oracle covers UTC assignments, while timezone handling has targeted tests rather than an exhaustive transition matrix. No live calendar, network, child process, third-party package, or external suite was used.
