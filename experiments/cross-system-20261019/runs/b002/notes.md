# Repair Notes for farm_studio_api CLI verdict

## Cause of the problem
- The original verdict code did not incorporate the actual `exitCode` from the turn captures into its completeness checks, leading to incorrect acceptance.
- The `finalCandidate` and `fixedHoldoutPass` checks accepted success claims even when the evidence source file or holdout captures were missing or inconsistent.
- The CLI loading path for the evidence source (`CASE_NAME.ghost.md`) and holdout capture (`holdout-result.json`) did not enforce presence and did not connect this evidence to the classification.

## Actual checks added
- Included `exitCode` from the turn capture JSON into the per-turn data for robust completeness verification.
- Modified `finalCandidate` check to require that `evidence.source` (Buffer or string) be present and that its SHA-256 matches the `finalSourceSha256` claim in the report.
- Modified `fixedHoldoutPass` check to require the presence of a real `evidence.holdout` capture with exit code 0 and output containing a line starting with "User expectations passed:".
- CLI loads the source `.ghost.md` file and verifies exactly one such file exists; failure sets source evidence null and thus finalCandidate/fixedHoldoutPass will fail.
- CLI loads holdout-result.json and passes it as evidence; missing or incomplete results cause failure.

## Experience used
- None external to this repository; all work was based solely on inspecting provided files and understanding problem description.
- No assumptions about older MAGI system or external infrastructure were made or applied.

## Tests
- Candidate.test.mjs was added to cover positive and negative scenarios with combinations of source and holdout evidence.
- All existing public tests are passing unchanged.

## Limitations
- Tests focus on single-turn candidate reports primarily; more complex multi-turn conversational cases are less covered.
- The logic assumes UTF-8 encoding and consistent newline usage when hashing source evidence.
- CLI expects exactly one `.ghost.md` file per report directory; no fallback or multiple source file handling is implemented.

This concludes the repair delivery.