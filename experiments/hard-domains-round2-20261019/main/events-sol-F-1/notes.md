# Repair and validation

Implemented actual per-key connected sessions rather than epoch buckets or singleton events. Components are rebuilt from live logical IDs, so bridge arrivals merge and bridge retractions or moves split them. Accepted revision metadata includes tombstones and is separate from live contributions. Same-revision payload identity is canonicalized by semantic fields, not input property order.

Upserts are checked against sealed components and then evaluated under a complete tentative replacement. Rejection changes neither contribution nor revision. Finalization runs after accepted changes and explicit watermark records; the watermark only advances. Sealed IDs cannot be changed, and their component cannot be joined or extended. Sorting is numeric by start and ASCII by key/ID. Input objects are never mutated and all state is invocation-local.

## Actual validation

Ran `functions.tests` against `public.test.mjs` and `candidate.test.mjs`: **12 passed, 0 failed** (2 public, 10 candidate). Candidate cases cover bridge merges/splits, equality connectivity, zero totals, explicit monotone watermarks, old arrivals joining open sessions, cutoff/lateness equality, split-induced finalization, atomic rejected moves and revision reuse, key moves, unknown tombstones, lower revisions, replay/conflict behavior after sealing, sealed boundary exclusion, ASCII ordering, distinct equal events, frozen inputs, and independent calls.

## Limits

Validation is local and synthetic; no broker, network, or live service was accessed. Inputs are assumed well formed as promised. Arithmetic uses JavaScript Numbers (no arbitrary-precision extension). The small specified workload permits rebuilding and sorting components on each change; no production-scale streaming performance claim is made. Remembered fixed-window policy was not used for session membership or lateness.
