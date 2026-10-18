# Tracker import boundary repair

Cause: `init` called only structural `state_ok`, allowing statuses and evidence that the `complete` operation would reject. Separately, validating evidence hashes on every state load would make an artifact changed after completion block `list` and `reopen`.

Change: added import-only validation for legal open/done status, nonempty acceptance and evidence on done issues, well-formed evidence entries, evidence file existence/containment, matching hashes for completed issues, and no completed issue with an open direct descendant (and thus no open deeper descendant under valid lineage). Validation runs before atomic state creation. Regular state reads remain structural so stale completions can be listed and reopened; reopen clears active evidence for recertification.

Validation: `functions.tests` passed all 14 tests: original tracker suite and `test_candidate.py`. Regression cases cover malformed completion imports, invalid paths/hashes/statuses, done-parent/open-child, atomic rejection, valid import, and artifact mutation followed by list/reopen.

Limits: evidence import validation confirms regular-file existence and content hash within workspace; broader semantic acceptance evidence is outside the tracker schema.