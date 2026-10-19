# Verdict repair notes

## Cause

The prior classifier treated report fields as proof: it used each turn's reported `exitCode`, accepted the final hash claim without hashing a stored source file, and accepted the report's holdout label without inspecting an actual holdout capture. The CLI also did not load either the final source or `holdout-result.json`.

## Actual checks now performed

* `complete` requires compiler-pin parity, the scripted turn count, one valid response kind matching every expectation, and numeric zero `exitCode` from every actual turn capture.
* `finalCandidate` additionally requires the final response to be a candidate, its capture to report a saved matching hash, and `evidence.source` (string or Buffer) to hash to both the final turn claim and `report.finalSourceSha256`.
* `fixedHoldoutPass` additionally requires the report's fixed-holdout success claim and an actual `evidence.holdout` with numeric zero exit code and a line beginning `User expectations passed:`.
* The CLI loads `turn-N.json`, `CASE_NAME.ghost.md`, and `holdout-result.json` from each case directory. Missing or malformed optional evidence is passed as absent and therefore cannot produce final-candidate or holdout success. It retains no-overwrite verdict writes.
* A clarification or answer may still be complete without a candidate file.

`candidate.test.mjs` covers absent evidence, substituted source bytes, actual turn exit failure despite a report claim, missing holdout success output, and a legitimate clarification. `functions.tests` was run and reported 7 passing tests.

## Remembered experience

The supplied remembered evidence-gate experience was used only as a general prompt to avoid treating unsupported completion as success. Its tracker-specific requirement for a nonempty evidence array does not apply here: this API has no such schema, and a valid clarification/answer can complete without candidate or holdout evidence.
