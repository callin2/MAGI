# Repair and validation

Implemented `sessions` as an invocation-local revisable state machine. It keeps accepted per-ID revisions (including unknown-ID delete tombstones), ignores lower revisions, makes exact accepted revision replays idempotent, and throws on same-revision payload conflicts. Failed late/finalization checks occur before committing version or live-event state.

Live events are regrouped by key into maximal event-time gap-connected components after every accepted mutation. A watermark only advances to the maximum explicit value. Components whose session end is at or before `watermark - lateness_ms` are snapshotted as immutable finalized sessions; bridge deletion can therefore split a session and finalize only an older resulting component. Upserts are tested in a replacement proposal (old contribution removed), and finalized event IDs and finalized-session exclusion ranges reject prohibited corrections.

`candidate.test.mjs` covers bridge merging/splitting, gap equality, ASCII IDs, zero and negative totals/times, watermark sealing, sealed update/delete and nearby insert rejection, retraction-triggered finalization, rejected-revision reuse, tombstones/conflicts/stale revisions, monotonic watermarks, frozen inputs, and independent calls.

Ran `functions.tests`: 9 tests passed and 0 failed (7 candidate tests plus 2 public tests).

# Limits

This is local synthetic validation, not an exhaustive proof. The implementation uses native JavaScript `Number` arithmetic (safe-integer precision limitations apply), assumes the documented well-formed inputs, and retains accepted revision/tombstone state for the invocation. No broker, network, live service, or external calls were used.
