# Repair and validation

Implemented maximal per-key connected components using event-time gaps, not epoch windows. Every proposed upsert removes its old contribution before determining the proposed component's end. Rejections leave both accepted revision state and live contribution untouched. Deletes (including unknown-ID tombstones) update accepted revisions and trigger regrouping. Accepted revision payloads are compared canonically, independent of property order.

Finalized components are stored separately and their IDs are permanently locked. A sealed component's event-time range is start through end-gap; therefore proposed times in the closed interval [start-gap, end] would connect to it and are rejected. Finalization is checked after accepted changes and explicit monotonic watermark updates. No event-derived watermark is used.

## Actual validation

Ran `functions.tests` after writing the implementation and candidate tests. Both public tests and all ten candidate tests passed: 12 total, 0 failed. Coverage includes late bridging, bridge retraction with immediate partial finalization, individually late joining, atomic failed moves, sealed-event immutability, sealed boundary rejection, accepted-revision replay/conflict, lower revisions, unknown tombstones, monotonic watermarks, key moves, zero totals, distinct equal-content IDs, ASCII ordering, input preservation, and independent calls.

## Limits

Only local synthetic tests were run; no external services or broker were accessed. Component regrouping intentionally favors simplicity over indexing at the specified maximum of 80 records and 18 IDs. Integer arithmetic uses standard JavaScript Numbers; values outside exact Number integer range are not given arbitrary-precision handling. Inputs are assumed well formed as specified.
