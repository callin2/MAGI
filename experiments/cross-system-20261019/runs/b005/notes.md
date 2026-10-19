# Repair Notes for farm_studio_api CLI Verdict

## Cause and Problem Addressed
- The original verdict.mjs allowed reports to be considered successful (fixedHoldoutPass true) even when the source evidence or the real fixed holdout process capture was missing or did not substantiate the claims.
- This could falsely certify a generated candidate and fixed holdout from the report's labels alone.
- The source SHA-256 claim was not verified against the actual source content file.
- The fixed holdout capture was trusted from the report field without verifying the actual capture output.

## Actual Checks Introduced
- `classifyCase` now accepts an `evidence` object with `source` (Buffer or string) and `holdout` (object with `exitCode` and `stdout`).
- `fixedHoldoutPass` requires:
  - `finalCandidate` must be true (turns completed with correct kind and final candidate matching source SHA).
  - The provided `source` must hash via SHA-256 to the report's `finalSourceSha256` exactly.
  - The `holdout` must have exitCode 0 and contain the line starting with "User expectations passed:" in its stdout.
- Missing or invalid evidence causes `fixedHoldoutPass` to be false.
- The CLI code that loads cases from the PRIVATE_RUN_DIR now explicitly reads and passes the source file (CASE_NAME.ghost.md) and the holdout-result.json capture alongside the reported turns and the report.json.
- It runs classifyCase with these additional evidences for hardening.
- Preserved `observedKind` and entry points, and fields like `complete`, `finalCandidate`, and `fixedHoldoutPass` in the output.

## Testing
- Added `candidate.test.mjs` with extensive coverage:
  - Valid and invalid source SHA hashes.
  - Valid and invalid holdout captures.
  - Missing evidence scenarios.
  - Mismatched kind turns causing incomplete status.
  - Capture outputs lacking saved SHA lines fail persistedCandidate.
  - Multiple turns and holdout combinations.
- All public tests and candidate tests pass with zero failures.

## Experience Used
- Followed the remembered practice of validating nonempty evidence before marking the state as done.
- Did not apply the old MAGI tracker evidence schema or expectations array as instructed.

## Remaining Limitations
- Reliant on exact CLI file naming and formats.
- Fixed holdout success relies on the presence of a single 'User expectations passed:' line in stdout.
- Tests do not cover the directory CLI execution exhaustively but cover core logic thoroughly.

This completes the repair with hardened verification according to the problem description.