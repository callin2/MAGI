# Repair and validation

Implemented replay in solution.mjs using separate transport request history and reservation business identities. Receipt time only increases; due holds expire before every receipt, including transport retries. Cached outcomes do not renew holds or repeat effects. Accepted reservations retain their original terms and deadline across terminal transitions. Unknown cancellations retain null-field tombstones, while unknown commits do not establish an identity. Adjustments cannot reduce stock below active holds or zero. Output records are sorted by ASCII ID and inputs are not mutated.

## Checks actually run

Ran the provided tests tool once after writing solution.mjs and candidate.test.mjs. It ran public.test.mjs and candidate.test.mjs successfully: 11 tests passed, 0 failed, exit code 0.

The nine added tests cover repeated cancellation and commitment, terminal reserve retries, exact-boundary expiry on retried messages, out-of-order receipt times, cancellation before creation, missing commits, replayed insufficient/rejected outcomes, distinct transport IDs, request conflicts, business term conflicts after terminal transitions, safe adjustments, multiple SKUs, ASCII ordering, input preservation, and repeatability. The two public tests cover empty input and a basic reserve.

## Limits

Only local synthetic tests were run; no warehouse, database, network, or external clock is used. Inputs are assumed well formed per contract. Arithmetic uses JavaScript Number with no extra overflow policy. Expiry scanning is linear in stored reservations per receipt and has not been performance-benchmarked. No hidden-test coverage is claimed.
