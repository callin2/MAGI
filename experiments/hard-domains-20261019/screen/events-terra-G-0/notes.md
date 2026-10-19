# Validation notes

Implemented `aggregate` as isolated per-call state. It tracks each ID's accepted revision and canonical payload, supports tombstones, removes prior contributions on accepted replacements, uses floor-based tumbling windows for negative timestamps, and never mutates supplied records. Watermarks advance only to their maximum; finality is evaluated against the current watermark and lateness for both mutation rejection and emitted output.

Validation run: `functions.tests` completed successfully with 8 passing tests (the supplied public tests plus candidate tests). Candidate coverage includes retransmission idempotency, revision conflict errors, correction/delete rejection after finalization, rejected revisions not becoming accepted state, late upsert rejection, tombstones, negative event times, zero totals with nonzero counts, lateness, ordering, and preservation of an input record.

## Limits

The implementation relies on the stated well-formed input contract and JavaScript `Number` integer arithmetic. Therefore, timestamps, widths, and aggregate totals should remain safely representable as JavaScript numbers for exact arithmetic.
