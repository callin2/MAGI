Validation performed
- Ran the supplied test runner after implementation: 7 tests passed (2 public and 5 candidate tests).
- Candidate coverage includes gap-connected bridge construction/retraction, post-retraction partial finalization, immutable finalized contributions, exact/lower revision behavior, zero totals, unknown-delete tombstones, sealed proximity rejection, and an old event accepted by a still-open proposed connected component.

Implementation notes
- State is allocated inside `sessions`, so calls do not share state and input records are not mutated.
- Finalized components are removed from the mutable open-event map and retained as immutable snapshots. Revision metadata remains available for replay/conflict/lower-revision decisions.
- JavaScript Number arithmetic is used, so the practical numeric limit is safely representable integer values.
