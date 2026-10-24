# Repair and validation

Replaced the placeholder record listing with invocation-local revision state, live-event state, and immutable finalized components. Events are regrouped by key into maximal components using consecutive event-time distance `<= gap_ms`; bridges can therefore merge open sessions, while deletions/replacements can split them. Watermarks advance monotonically only from explicit watermark records. Finalization runs after watermark records and accepted mutations.

Revision checks precede lateness checks: lower revisions are ignored, identical accepted-revision payloads are idempotent, conflicts throw, and a rejected higher revision is not stored. Tombstones are retained for unknown-ID deletes. Upserts are checked against sealed components and evaluated against the complete proposed open event set before acceptance. Events in finalized components cannot be altered. Inputs are not mutated and all state is local to each call.

Validation: ran `functions.tests`; all 6 tests passed (2 public and 4 candidate). Candidate coverage includes bridge/retraction regrouping, finalization and late rejection, atomic/reusable rejected revisions, zero totals, and ID ordering.

Limits: this is local synthetic validation, not an exhaustive proof. Values use JavaScript Number arithmetic. Inputs are assumed well formed per contract. No broker, live service, network, or external process was used.
