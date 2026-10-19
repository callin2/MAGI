Validation performed
- Ran the provided test runner after implementation: 7 tests passed (public and candidate suites).
- Candidate coverage includes transitive late bridge merging, bridge retraction splitting and immediate finalization, gap equality/transitive membership, proposal evaluation with replacement, sealed-boundary rejection, revisions/tombstones, zero totals, and independent calls.

Implementation notes
- Finalized components are snapshotted and their IDs remain revision-tracked, while only unsealed events are regrouped.
- A candidate can connect to a sealed component when its timestamp is in [session.start-gap_ms, session.end]; such writes are rejected before state mutation.
- Inputs are only read; output arrays and session objects are newly constructed.

Limits
- The implementation relies on the contract's well-formed input guarantee and normal JavaScript Number safe-integer arithmetic.
