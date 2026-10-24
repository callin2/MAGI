# Repair notes

## Cause

The original classifier checked turn exit codes in the report, not the actual process captures. It treated a saved-file hash printed in stdout as proof of persisted source without reading or hashing the file. Its fixed-holdout decision relied entirely on report fields. The CLI loaded only reports and turn captures, so it could never independently corroborate stored source or the actual holdout output.

## Implemented checks

- Preserved `observedKind` and `classifyCase`; the latter now accepts optional `{ source, holdout }` evidence. Preserved the returned statuses, candidate counts, mismatch list, and report metadata, while recomputing verdict fields instead of trusting historical values in reports.
- Completion requires compiler-pin parity, a positive integer scripted turn count matching the turn list, exactly one supported response-kind result per turn matching the expectation, and numeric zero exit codes in both the report and actual turn capture.
- Completion is conversational: successful clarification and answer turns need no candidate source. A candidate response without a save marker may complete the conversation but cannot establish a final candidate.
- Final-candidate success additionally requires that the final turn is a candidate with a saved SHA-256 claim, that claim matches the report's final hash, and the SHA-256 of the supplied source string or Buffer matches it.
- Fixed-holdout success additionally requires report exit code zero and literal `fixedExpectationsPassed: true`, plus actual holdout exit code zero and a stdout line starting `User expectations passed:`.
- The CLI reads `CASE_NAME.ghost.md` using the case directory name and `holdout-result.json`, as well as each `turn-N.json`. Missing source/captures and missing or malformed capture JSON become absent evidence and yield failed relevant statuses, not synthesized successes. Other filesystem errors and malformed report JSON still fail the CLI rather than certify anything.
- Retained preflight refusal of existing summary/case verdict files and exclusive `wx` writes. Tests check both summary-blocked reruns and an existing case verdict without a summary.

## Actual validation

Ran the provided `functions.tests` tool once after writing the implementation and regression tests. It ran both `public.test.mjs` and `candidate.test.mjs`: **10 passed, 0 failed, exit code 0**. Coverage includes source bytes and mutations, missing evidence, contradictory/non-numeric exits, holdout report/capture disagreements, completion without candidates, save-marker requirements, pin/count/kind protections, duplicate/malformed responses, final response selection, and CLI file-loading and overwrite refusal.

The CLI tests import the real entry path with temporary process arguments and temporary workspace files, restoring process state afterward. No subprocess, external compiler, network, or independently executed fixed holdout was used. The test fixtures represent captures rather than running the original farm application.

## Experience scope

No remembered experience was supplied or used. This repair follows the current farm_studio_api contracts only; it does not apply MAGI or an old tracker's evidence-array schema. Missing candidate evidence does not invalidate a legitimate conversational clarification/answer completion, but cannot certify a final candidate or holdout success.
