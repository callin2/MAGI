Validation performed
- Ran `functions.tests`, which executed public.test.mjs and candidate.test.mjs: 6 tests passed.
- Candidate coverage includes consecutive-gap (non-window) grouping, bridge merge/retraction split, finalization after a retraction, finalized mutation rejection, revision conflict behavior, and proposal-based lateness acceptance/rejection.

Implementation notes
- Session state is invocation-local and input records are not mutated.
- Finalized components are snapshotted and their member IDs are sealed. Open components are rebuilt from current unsealed live events after every accepted state change.
- JavaScript Number arithmetic is used. Inputs requiring exact arithmetic beyond Number safe-integer precision are not specially supported.
