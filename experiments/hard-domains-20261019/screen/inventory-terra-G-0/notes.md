# Validation notes

Implemented `replay` as a pure in-memory ledger. The receipt clock advances with `max(now, at)`, and all due reserved holds are marked expired before processing every receipt, including request replays. Physical stock is changed only by successful commits and accepted adjustments; available stock is derived from physical stock minus currently reserved holds.

Added `candidate.test.mjs` coverage for duplicate cancellation and reserve delivery, expiry at a watermark with out-of-order delivery time, cancellation tombstones, adjustment rejection while holds are active, and both request and reservation identity conflicts.

Validation actually run: `functions.tests`, which executed `public.test.mjs` and `candidate.test.mjs`; all 6 tests passed.

## Limits

This synthetic module is deliberately synchronous and memory-only. It has no persistence, locking across processes, real clock, network, or warehouse/database access. It assumes the contract's well-formed input guarantee.
