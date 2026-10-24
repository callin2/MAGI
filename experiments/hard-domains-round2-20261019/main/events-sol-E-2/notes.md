# Repair and validation

Inspected solution.mjs and public.test.mjs. Replaced per-event output with per-key event-time connected components: consecutive event times at most gap_ms apart connect, including equality. Components are rebuilt from current accepted upserts, so late bridges merge and bridge retractions split without fixed epoch-window assumptions.

Accepted revisions and tombstones are retained by ID. Stale revisions and canonical replay/conflict checks precede finalization rejection. Upserts are evaluated as complete proposals with the old contribution removed; rejected changes establish neither payload nor revision. The containing proposed session, rather than the individual timestamp, determines lateness. Deletes may expose old components, which finalize immediately after acceptance.

Watermarks are explicit and monotone. Finalized component snapshots and their IDs remain immutable; updates to sealed IDs and upserts within the inclusive connection range of a sealed same-key component are rejected. Output uses ASCII ordering for IDs and key tie breaks. Invocation-local state and copies of input records preserve inputs and call independence.

## Actual validation

Ran functions.tests after writing solution.mjs and candidate.test.mjs. Result: 15 passed, 0 failed, including 2 public tests and 13 candidate tests. Candidate coverage includes late bridges, equality connections, retraction splits and immediate finalization, old events joining open sessions, complete-proposal removal, rejected revision reuse, source/target sealing, inclusive sealed boundaries, canonical replay/conflicts after finalization, tombstones, signed monotone watermarks, lateness equality, replacement/deletion/key moves, zero totals, ASCII sorting, delimiter-like keys, frozen inputs, and independent calls.

## Limits

Local synthetic tests are not an exhaustive proof. No broker, external service, live stream, network, or other session was accessed. Inputs are assumed well formed. Arithmetic uses native JavaScript Numbers, not arbitrary precision, so exactness outside the safe-integer range is not guaranteed. Rebuilding and sorting at most 18 IDs per proposal is suitable for the stated limit of 80 records; this implementation is not intended as a large-stream incremental index.
