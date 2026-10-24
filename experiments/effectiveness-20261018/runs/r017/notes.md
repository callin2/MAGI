# Tracker import boundary repair

Cause: `init` ran structural `state_ok` checks only, allowing imported `done` items to bypass completion's acceptance and evidence rules. Recovery/list also needs to tolerate evidence files changed after certification so that users can inspect and reopen items for recertification.

Change: imported state now validates status, nonempty acceptance/evidence for done items, evidence shape/hash format, contained relative paths, and existing regular-file content hashes. It rejects done parents with open children. Initialization validates before atomic save. Existing state loading validates evidence structure without requiring current file content, keeping list/reopen available after artifacts change; reopen clears active evidence. No schema change.

Validation: `functions.tests` ran original `test_tracker.py` plus added `test_candidate.py`: 14 tests passed. Candidate coverage includes invalid imports atomicity, invalid completion/evidence, descendant status, and changed artifact list/reopen behavior.

Limits: this implementation follows the existing single-workspace filesystem model; it does not add concurrent-writer protection or alter the public operation contract.