# Validation notes

Implemented a depth-first exhaustive search over each distinct eligible order's skip/choice decisions. It tracks per-SKU use and non-null group occupancy, and ranks complete feasible selections by value, count, then sorted ASCII `(order_id, choice_id)` sequence. Active reserved holds consume snapshot capacity and make their order ineligible; committed/cancelled holds block eligibility without subtracting stock. Expired reserved holds have neither effect.

Duplicate IDs are compared using canonical order terms with sorted choice and item representations; exact duplicates are deduplicated and conflicting terms throw. Inputs are only read, and returned records are newly constructed.

Validation: `node --test public.test.mjs candidate.test.mjs` passed all 7 tests. Coverage includes global combination optimization, live/expired/committed/cancelled holds, group constraints and deterministic ties, duplicate/conflict handling, and input/call isolation. Search is exponential in order count and is scoped to the supplied maximum of 18 orders and 3 choices per order.