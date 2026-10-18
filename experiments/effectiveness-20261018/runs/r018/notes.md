# Tracker import completion repair

Cause: `init` applied structural state checks but did not validate issue statuses or completed-state evidence, unlike `complete`. This allowed imported `done` issues with empty evidence/acceptance or stale/invalid evidence.

Change: initialization now validates status values, acceptance and nonempty evidence for done issues, strict evidence item shape/hash, relative path containment, current regular-file existence and hash, and that a done parent has no open descendant. Validation occurs before the atomic state write. Existing loaded states are not rechecked against the filesystem during list/show/reopen, so changed artifacts remain inspectable and reopen clears active evidence for recertification.

Validation: `functions.tests` ran original `test_tracker.py` plus `test_candidate.py`: all 15 tests passed. Candidate regressions cover atomic rejection, valid evidence imports, invalid status/acceptance/evidence/path/hash, open descendants, and listing/reopening after artifact mutation.

Limits: imported completion evidence must match files available beneath the workspace at initialization; unavailable or changed evidence intentionally prevents import as done.