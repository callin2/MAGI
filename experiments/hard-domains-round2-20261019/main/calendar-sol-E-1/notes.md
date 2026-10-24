# Repair

Replaced greedy slot selection with exact branch-and-bound assignment over one occurrence/room or omission per meeting. Objective order is value, count, then code-unit lexical booking sequence. Dependencies and room/person overlap are checked during assignment. Directed setup is checked only between chronological neighbors in each person's completed schedule: partial setup failures are not used to prune, since a later-assigned intermediate meeting may repair them. Safe value/count upper bounds and, when both bounds must be attained, an optimistic lexical lower bound reduce search.

Civil starts are resolved using Intl timezone offsets sampled around the civil date and round-trip verification. Gaps have no occurrence; folds are selected before range/block filtering. Duration is elapsed time. Blocks and occupancy use half-open intervals; blocks do not create people or transitions. All arrays sorted by the implementation are newly allocated.

# Actual validation

Ran the provided tests tool after writing solution.mjs and candidate.test.mjs: 9 tests passed, 0 failed (2 public and 7 candidate). Candidate tests cover global optimization over a greedy trap, count and ASCII tie breaking, directed setup and exact gap equality, nonmetric intermediate repair with adversarial ID order, prerequisites in both ID directions and absent prerequisites, block/room/range boundaries, fold exclusivity and filtering order, elapsed duration across a fold, New York/Berlin/Lord Howe gaps, Berlin and Lord Howe folds, Kathmandu offsets, recursively frozen input, and zero-value count maximization.

# Limits

Assumes well-formed inputs and the stated bounds. Timezone behavior depends on Node's installed Intl database. Offset sampling targets only the five supported zones in 2024–2026, not arbitrary historical timezone transitions. Search is exponential in the worst case; no polynomial runtime guarantee or exhaustive performance benchmark is claimed. No external service, network, live calendar, or package was accessed. No test suite beyond the reported public/candidate tests was run.
