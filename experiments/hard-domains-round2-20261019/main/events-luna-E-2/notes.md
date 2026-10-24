# Repair and validation

Replaced independent-record output with per-key connected components sorted by event time. Consecutive events connect when their difference is at most `gap_ms`; late bridges therefore merge open sessions, and accepted deletions/replacements regroup the surviving events. Per-ID accepted revisions and canonical payloads implement stale-revision, replay, conflict, and tombstone behavior. Proposed upserts are evaluated against the complete replacement state before committing, so rejection leaves the old contribution/version intact.

Explicit watermarks advance monotonically. Components whose end is at or before `watermark - lateness_ms` are captured as finalized snapshots and removed from mutable event state. Changes to their IDs are rejected; new events in their key's gap-expanded sealed region are rejected. After each accepted change, remaining open components are checked for finalization.

Ran `functions.tests`: 8 passed, 0 failed (6 candidate tests and 2 public tests). Candidate tests cover bridge merge/split, revision conflict/rejection, a late bridge into an open component, sealing and boundary rejection, monotone signed watermarks, zero totals/equal timestamps, input preservation, and call independence.

Limits: local synthetic tests are not exhaustive. Arithmetic uses native JavaScript Numbers, not arbitrary precision. Inputs are assumed well formed. No broker, live service, network, or external system was accessed.
