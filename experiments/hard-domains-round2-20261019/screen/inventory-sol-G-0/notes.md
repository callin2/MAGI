# Repair and validation

`allocate` now deducts only unexpired reserved holds from the physical snapshot. Active reserved, committed, and cancelled order IDs are blocked. Expired reservations (including exactly-at-now expiry) and expired-state records do not block fresh recommendations. Committed quantities are never deducted again.

All duplicate order IDs are validated before eligibility filtering. Canonical terms sort choice IDs and item keys with code-unit comparison. Different IDs are independent candidates, subject to shared capacity and groups.

The exact dynamic program processes distinct eligible orders in ASCII order. Its state consists of used quantities and a group bitmask. Keeping only the best value/count/lexical prefix for a state is sound because all future feasible continuations depend solely on that state. Skipping each order remains possible. Base-4 choice digits encode the lexical objective exactly: when counts tie, selecting the earlier order is preferred, followed by its earlier choice ID. At most 18 digits fit exactly in JavaScript's integer precision. Reconstruction subtracts the winning choices from a fresh capacity object. Inputs are not mutated and no state persists across calls.

## Actual validation

Ran `functions.tests` after writing both implementation and candidate tests: **8 passed, 0 failed**, reported duration about 84 ms. This includes both existing public tests and six candidate test cases covering:

- Global combinations beating greedy picks; count and ASCII tie-breaking; alternate choices.
- Active, committed, cancelled, expired, stale, and exactly-due holds; physical snapshot accounting.
- Canonical duplicate acceptance and conflicting duplicate rejection, including blocked IDs.
- Groups (including empty-string group), zero-value orders, zero capacity, lexical preference over leftover stock.
- Input preservation, repeated-call independence, and all original SKU keys.
- 250 deterministic small random instances checked against independent exhaustive enumeration.
- A representative instance at 18 orders, three choices, four SKUs, and five nonnull groups.

## Limits

The implementation relies on the stated well-formedness and bounds, including known SKU names and positive integral choice quantities. Sparse DP space is bounded by reachable capacity/group combinations (at most `13^4 * 2^5` state keys), with old and new maps during an order transition. Runtime scales with orders, reachable states, and choices. The maximum-bound test is not an exhaustive worst-case stress benchmark. This module only computes recommendations; it does not reserve stock or implement an execution replay terminal-ID policy.
