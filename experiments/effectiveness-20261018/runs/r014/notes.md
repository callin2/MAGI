Cause: init used structural state validation only, accepting status/evidence combinations that complete itself forbids. Applying evidence freshness checks on every state load would also make list/reopen unusable once a certified artifact changed.

Change: shared validation now checks legal statuses, nonempty acceptance and evidence for done issues, evidence item shape/hash format, workspace containment/existence/current digest at import, and forbids done issues with open descendants. Init validates before atomic save. Runtime loading intentionally does not revalidate file freshness, so list and reopen remain available; reopen clears evidence for recertification. Complete validates its proposed done state before saving.

Validation: tests tool ran original test_tracker.py and added test_candidate.py; all 15 tests passed. Regressions cover atomic invalid imports, status/acceptance/evidence and hierarchy invariants, and changed-file list/reopen behavior.

Limits: audit-record contents and unrelated legacy open-issue evidence fields are not comprehensively schema-validated; this task focused on imported completion invariants.