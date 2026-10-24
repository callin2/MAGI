# Verdict repair notes

## Cause

The old classifier treated report fields as evidence. In particular, it used `turn.exitCode` from the report, accepted the report's final SHA claim without hashing the stored source, and accepted the report holdout labels without examining `holdout-result.json`. The CLI also never loaded the source or actual holdout capture. This allowed a report to manufacture successful statuses.

## Actual checks implemented

- `complete` now checks each scripted turn's actual capture: numeric zero exit code and the expected observed response kind. Candidate persistence is intentionally not required for `complete`, so a legitimate clarification or answer completes without a candidate file.
- `finalCandidate` requires completion, a final candidate response, a single matching `Saved ... SHA-256 ...` record in the final actual capture, agreement with the final source claim, and SHA-256 agreement with supplied source bytes (string or Buffer).
- `fixedHoldoutPass` additionally requires the report's holdout success claim and an actual holdout capture with numeric zero exit status and a line beginning `User expectations passed:`.
- The CLI loads `turn-N.json`, `CASE_NAME.ghost.md` (using `report.identity.case`), and `holdout-result.json`. Missing or malformed optional evidence becomes absent evidence and therefore cannot establish final-candidate or holdout success. Existing verdict overwrite protections remain unchanged.

## Validation actually run

`functions.tests` ran `public.test.mjs` and `candidate.test.mjs`: 6 tests passed. The added regression tests cover missing source bytes, actual turn failure despite a report success label, missing/markerless holdout evidence, valid holdout evidence, and clarification completion without a candidate.

## Experience used

The remembered evidence-gate experience was used only as a general caution that reported completion needs corroborating evidence. Its old tracker `evidence`-array rule does not apply here: this implementation uses the task-specific source, process-capture, and holdout-capture requirements and does not impose an evidence-array schema.
