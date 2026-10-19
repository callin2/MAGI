# Repair and validation

Inspected solution.mjs and public.test.mjs. Replaced delivery-based accumulation with per-ID accepted revision state. Duplicate/conflict and stale revision checks precede lateness checks. Rejected corrections retain both the old contribution and old revision. Tombstones persist even without contributions. Final windows remain represented and cannot be modified. Window starts use floor division for negative timestamps; output uses numeric start and ASCII lexical key order.

Output is materialized from accepted current upserts, so moves and deletes cannot leave previous contributions behind. Separate maps for start and key avoid delimiter collisions. All state is invocation-local and input objects are copied rather than modified.

Ran functions.tests after writing the implementation and candidate tests: 13 tests passed, 0 failed (11 candidate tests plus 2 public tests). Covered retransmission, distinct IDs with identical payloads, full replacement, stale revisions, tombstones, canonical conflicts, negative boundaries, sorting, explicit monotone watermarks, lateness equality, finalized source/target rejection, rejected revision reuse, zero totals, empty windows, frozen inputs, and call independence.

Limits: tests are local synthetic checks, not an exhaustive proof. No broker, external service, production stream, or network was used. Arithmetic uses native JavaScript Numbers and does not provide arbitrary-precision integer handling. Inputs are assumed well formed as specified; no extra validation is imposed. Accepted state and tombstones are retained for the whole invocation, with memory proportional to distinct accepted IDs plus output groups.
