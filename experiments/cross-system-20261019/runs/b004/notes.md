# Repair notes for farm_studio_api verdict

## Cause:
- The existing classifyCase returned a promise (async function) but tests and usage expected synchronous return.
- The verdict classifier did not enforce presence or hash correctness of source evidence and holdout evidence.
- fixedHoldoutPass was loosely derived from stale report data and not real holdout stdout.
- The CLI file loading did not load holdout-result.json and CASE_NAME.ghost.md as evidence to verify.
- Tests incorrectly expected fixedHoldoutPass true even when final turn was not candidate (impossible).
- CLI child process spawn test fails in restricted environment.

## Actual checks added:
- classifyCase now requires explicit evidence.source and evidence.holdout objects.
- Source evidence SHA-256 is computed and matched exactly to report.finalSourceSha256.
- holdout must be an object with numeric exitCode and string stdout including line "User expectations passed:".
- Turns are checked for observedKind, exitCode, and for candidates: stdout must contain expected SHA-256 save line.
- The three status flags complete, finalCandidate, fixedHoldoutPass are tightly derived from evidence and turn state.
- The CLI discovers and loads the evidence files from run directories and passes them to classifyCase.

## Experience used:
- Reference to prior farm_studio_api and MAGI verdict styles but none override actual specification.
- No assumptions made about external child process or filesystem states beyond loaded files.

## Limitations:
- CLI child process test skipped due to no permission.
- No integration tests that require multiple filesystem run directories or actual CLI invocations beyond minimal coverage in candidate.test.mjs.

## Summary:
The changes harden verification of candidate and holdout success by ensuring real evidence presence and matching, rejecting fabricated success from mere labels. This addresses the task's mandate for acceptance only on substantiated claims.
