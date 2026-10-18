Cause: init ran structural state checks only, so imported done issues bypassed complete's acceptance, evidence, file-hash, and child-order invariants.

Change: init now performs a separate import completion validation before writing state. It validates legal status and evidence list shape for every issue; done issues require acceptance, nonempty evidence with valid lowercase SHA-256, in-root existing files with matching hashes, and no open descendant. Validation precedes state creation. Existing list and reopen do not revalidate completed evidence against current file contents, allowing stale artifacts to be reopened and evidence cleared for recertification.

Actual validation: tests tool passed 14 tests: all 11 original tracker tests and 3 test_candidate.py regression tests. Coverage includes atomic rejection of invalid imports, bad status/evidence and containment, done parent with open child, valid import, and list/reopen after artifact mutation.

Remaining limits: imported artifact files are checked at import time; subsequent external modification is handled by explicit reopen rather than automatic status changes.