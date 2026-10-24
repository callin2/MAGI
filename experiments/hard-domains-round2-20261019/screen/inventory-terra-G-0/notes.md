# Validation notes

Implemented `allocate({ now, on_hand, holds, orders })` as a pure recommendation calculation.

- Only `reserved` holds with `expires_at > now` reduce recommendation capacity.
- Active reserved, committed, and cancelled order IDs are excluded as required; expired/due-now reservations are not terminal.
- Duplicate identical order snapshots are collapsed after canonicalizing choice and item ordering; conflicting snapshots throw.
- The optimizer uses memoized dynamic programming across remaining SKU capacity and the currently contiguous non-null group. It maximizes value, then served count, then the ASCII/code-unit lexical pair sequence.
- Output remaining stock is reconstructed from active capacity and the selected recommendations, preserving the original SKU keys.

## Actual validation

Ran `functions.tests`, which executes `public.test.mjs` and `candidate.test.mjs`.

Result: 6 tests passed, 0 failed. Coverage includes public empty/single cases, global-vs-greedy selection, active/expired/committed/cancelled holds, group and lexical ties, duplicate normalization, and conflicting duplicate rejection.

## Limits

The implementation is designed for the supplied bounds (at most 18 distinct orders, 3 choices/order, 4 SKUs, 5 non-null groups, and stock quantities at most 12). Inputs outside the stated well-formed contract are not separately validated.
