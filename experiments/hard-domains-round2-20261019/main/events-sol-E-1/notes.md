# Repair and validation

Replaced the per-row output stub with actual maximal gap-connected sessions. Components are rebuilt from current accepted upserts, sorted by numeric event time, with equality at the gap connecting events. Revision tombstones remain in accepted state. Canonical replay/conflict and stale-revision checks precede sealed-source and lateness checks; rejected proposals do not establish a revision or remove the previous contribution.

Upsert proposal validation removes the old contribution before finding the proposed event's complete resulting session. Its end, rather than its individual event time or an epoch bucket, determines lateness. Finalized IDs are permanently protected. Proposed events cannot touch a finalized component's closed gap-neighborhood. Deletes and successful moves regroup source components, and finalization runs immediately after each accepted change as well as explicit monotone watermark records. No watermark is inferred from events. All state is invocation-local and records are copied, not mutated.

## Actual validation

Ran `functions.tests` after writing solution.mjs and candidate.test.mjs. Result: 14 passed, 0 failed (12 candidate tests and 2 public tests).

Candidate coverage includes late bridges, retraction splits, immediate sealing after splits, individually old events joining open sessions, removal of the old contribution during proposal evaluation, both sealed-neighborhood equality boundaries, atomic rejected moves and revision reuse, finalized replay/conflict handling, tombstones, stale revisions, property-order-independent payload comparison, signed and nonrewinding watermarks, exact lateness cutoff, zero totals and amounts, distinct equal-content IDs, ASCII ordering, cross-key moves, frozen inputs, and invocation independence.

## Limits

Local synthetic tests are not an exhaustive proof. No external services, brokers, network calls, or other sessions were used. Inputs are assumed well formed. Native JavaScript Number arithmetic is used; arbitrary-precision and values outside reliable Number arithmetic are not specially handled. Rebuilding components for proposals and accepted changes is intentionally simple at the specified bounds of 80 records and 18 IDs, rather than optimized for an unbounded production stream. Remembered fixed-window guidance was not used to determine membership or lateness.
