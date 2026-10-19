# Validation notes

Repaired `solution.mjs` to track each ID's accepted revision and current upsert/tombstone, deduplicate exact revision replays, reject same-revision payload conflicts, and apply finalization checks before mutating state. Output is rebuilt from current contributions, keeping zero-total nonempty windows and applying floor-based epoch-zero window assignment (including negative timestamps).

Validation run: `functions.tests` executed both `public.test.mjs` and `candidate.test.mjs`; all 5 tests passed, 0 failed. Candidate tests exercise replay idempotency, full contribution replacement, negative windows, zero totals, atomic rejection for finalized windows, monotonic watermarks, and revision conflicts.

Limit: timestamps and totals use JavaScript `Number`; integer inputs beyond `Number.MAX_SAFE_INTEGER` cannot be represented exactly. The implementation does not access any broker, stream, or network.
