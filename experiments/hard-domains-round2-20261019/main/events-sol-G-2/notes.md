# Repair notes

The implementation groups live events by key and consecutive event-time distance, not epoch windows. A proposal replaces the ID's old contribution before checking the proposed component's end. Only accepted changes update revision/payload state. Accepted-revision replay/conflict checks precede sealed-membership checks.

Finalization records immutable member IDs after each accepted mutation and explicit watermark record. Sealed IDs cannot be changed, and proposals within either inclusive join boundary of a sealed component are rejected. This prevents later recomputation from changing a finalized component. Retractions and moves can split components, with older resulting components finalized immediately.

Watermarks are explicit, initially null, and monotonic. Output uses numeric start and ASCII key ordering, retains zero-total sessions, and sorts member IDs in ASCII order. State is local to a call and input objects are not mutated.

## Actual validation

Ran `functions.tests`, executing `public.test.mjs` and `candidate.test.mjs`: **12 passed, 0 failed** (exit code 0). Candidate coverage includes bridges and retraction splits, immediate split finalization, old-event admission into an open session, proposal removal semantics, atomic rejection and revision reuse, finalized member protection and inclusive boundaries, replay/conflict and stale revisions, unknown tombstones, watermark monotonicity and lateness equality, negative times, ASCII order, zero totals, cross-key moves, preserved frozen inputs, and independent calls.

## Limits

Inputs are assumed well formed as required. Arithmetic uses JavaScript Numbers without arbitrary-precision conversion. Components are recomputed for simplicity at the stated bounds (80 records / 18 logical IDs); no large-stream performance claim is made. Validation is local and deterministic; no broker, network, or live service was accessed.
