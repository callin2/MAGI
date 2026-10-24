# Repair and validation

Implemented `sessions` as per-key maximal connected components with inclusive gap connectivity, not epoch windows. Accepted versions and canonical payloads are stored independently of open event contributions. Proposals replace the old contribution before testing the proposed component's end; rejected operations leave both the old event and accepted version unchanged.

Finalized components are stored separately and their IDs remain sealed permanently. A proposed event cannot touch or extend a sealed component. Finalization runs after accepted mutations and explicit monotone watermark processing, including after bridge retractions. Sorting uses ASCII comparisons rather than locale collation. No input objects are mutated and all state is call-local.

## Actual validation

Ran `functions.tests` against `public.test.mjs` and `candidate.test.mjs`: **14 passed, 0 failed**, exit code 0. The 12 added tests cover transitive/equality connections, bridge merging and splitting, split-triggered finalization, individually old events joining open sessions, removal-aware proposal checks, atomic rejected revisions, sealed boundaries, replay/conflict semantics after sealing, unknown-ID tombstones, rejected insertion versions, negative timestamps, lateness equality, monotone watermarks, zero totals, ASCII ordering, key moves, frozen inputs, and independent calls.

## Limits

Tests are deterministic synthetic in-process examples, not exhaustive enumeration or a live integration test. No broker, external service, or network was accessed. Inputs are assumed well formed per the contract. Arithmetic uses standard JavaScript Number semantics; no arbitrary-precision integer extension is provided. Regrouping sorts the open events on each relevant operation, appropriate for the stated limits of 80 records and 18 logical IDs.
