# Repair and validation

Implemented `sessions` as invocation-local state rather than fixed epoch windows. It maintains the latest accepted revision per logical ID, including tombstones, and only mutates that state after all sealed-session and watermark/lateness checks pass. Exact accepted revision replays are no-ops; same-revision payload conflicts throw; lower revisions are ignored.

Live events are regrouped per key into maximal event-time connected components using consecutive gaps of at most `gap_ms`. A finalization pass runs after accepted mutations and every watermark record. It snapshots eligible components and marks their member IDs sealed. Sealed snapshots are retained unchanged; updates/deletes to sealed members and arrivals within their gap-sized event attachment zone are rejected. Proposed upserts evaluate their session after removal of a prior live contribution, which supports valid old bridge events while preventing a resulting closed session.

Added candidate tests for bridge merge/split behavior, split-triggered finalization, sealed boundaries, atomic rejected revision reuse, old events joining an open component, revision conflict/tombstones, signed times/order/zero totals, monotonic watermarks, immutability, and independent empty calls.

## Validation run

`functions.tests` completed successfully: 9 tests passed and 0 failed (7 candidate tests plus 2 supplied public tests).

## Limits

No broker, external service, network, or live system was accessed. Tests are focused local checks and not exhaustive. Arithmetic uses JavaScript `Number`, so values should remain within safe-integer precision. Input shape is trusted per the stated well-formed-input contract.
