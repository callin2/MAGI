# Repair and validation

Implemented sessions as per-key connected components of current unsealed events, recomputed after accepted revisions. Equality at the gap connects events. Upsert proposals replace the old contribution before lateness evaluation; rejection commits neither state nor revision. Accepted revision payload checks precede sealing checks, including replay/conflict handling after finalization. Unknown deletes create revision tombstones.

Finalized components are stored separately and their IDs are permanently sealed. Proposed times in [start-gap_ms, end] of a sealed component of the same key are rejected. Explicit watermarks advance monotonically, and finalization also runs after accepted changes so split-off old components seal immediately. Output uses ASCII comparison rather than locale ordering and retains nonempty zero-total sessions.

## Actual validation

Ran the supplied test tool twice. The first run passed 11 of 12 tests: one new fixture incorrectly called an event standalone even though it was exactly one gap from the open chain. Changed that fixture from time 0 to -1, preserving the intended late standalone rejection check. No implementation change was needed for that failure.

Final run: 12 tests passed, 0 failed (2 public tests and 10 candidate tests). Coverage includes late bridges, retraction splits and immediate finalization, old events joining open components, atomic rejected moves and retry at the same revision, removal of old bridge contributions during proposal evaluation, watermark monotonicity and lateness equality, sealed boundaries, key isolation, finalized revision conflicts, tombstones, ASCII sorting, zero totals, frozen inputs, and independent calls.

## Limits

Inputs are assumed well formed per contract. Computation uses JavaScript Number arithmetic; no arbitrary-precision numeric extension is provided. Component recomputation favors clarity for the stated small input limits. Tests are deterministic local cases, not exhaustive enumeration. No external services, brokers, network calls, or other sessions were used.
