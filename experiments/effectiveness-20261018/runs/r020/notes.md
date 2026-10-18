# Tracker import repair

Cause: `init` only ran structural `state_ok`; imported issues could mark themselves done with empty or malformed evidence, and no current file/hash/containment or done-parent invariant was checked. `complete` had stricter checks, producing inconsistent completion rules.

Change: initialization now validates legal open/done status, nonempty acceptance and evidence for done issues, evidence records and lowercase SHA-256 values, evidence file containment/existence/hash, parent cycles, and done-parent descendants before atomically saving. Normal loads intentionally check evidence shape and completion structure but do not revalidate current files; this preserves list and reopen after an artifact changes. Reopen clears evidence for recertification. Added candidate regressions covering invalid atomic imports and valid import followed by artifact mutation, list, and reopen.

Validation: `functions.tests` ran `test_tracker.py` and `test_candidate.py`: all 13 tests passed. Includes existing completion, reopen, follow-up, and import regressions.

Limits: evidence binds bytes at validation time; subsequent file changes require reopen and recertification. No semantic judgment of evidence is performed.