# Repair notes

## Cause

The historical classifier treated report exit codes as proof of process success. Its candidate persistence test only compared a claimed digest to a Saved line, without hashing the stored source. Fixed-holdout acceptance relied entirely on report labels. The CLI loaded only reports and turn captures, so it could not corroborate source or holdout success.

## Checks implemented

- `observedKind` keeps its strict single response-line parsing and accepted kind set.
- `complete` requires current compiler-pin parity, a nonempty scripted conversation with the declared turn count, matching observed kinds, and numeric zero exit codes in both report turns and actual captures. A clarification or answer needs no candidate file. A candidate-kind response can complete the conversation without qualifying as a final saved candidate.
- `finalCandidate` additionally requires a final candidate response, a Saved digest matching that turn's digest, agreement with the final report digest, and SHA-256 of the actual source Buffer/string matching that digest.
- `fixedHoldoutPass` additionally requires numeric zero and boolean true in the report holdout claims, plus numeric zero and a line beginning `User expectations passed:` in the actual holdout capture.
- CLI reads `CASE_NAME.ghost.md` as raw bytes and `holdout-result.json`, alongside each `turn-N.json`. Missing source or captures do not fabricate success. Missing or syntactically invalid capture JSON is treated as absent evidence. Malformed report JSON still raises an error.
- Existing verdict statuses/counts are recomputed rather than trusted from input. Preflight checks and exclusive writes continue to prevent historical verdict replacement.

## Validation actually run

Used the supplied tests tool to run public.test.mjs and candidate.test.mjs. Result: 10 passed, 0 failed, exit code 0. Regression coverage includes evidence absence and tampering, strict numeric exits, holdout report/capture disagreement, source strings and Buffers, valid non-candidate completion, response/parser and pin protections, multi-turn failure, and real temporary CLI file loading with overwrite refusal. CLI execution was in-process using dynamic imports and the actual entry guard; no subprocess, external compiler, or external holdout run was performed. Temporary integration files were removed by the tests.

## Remembered experience and scope

The supplied local-work-pilot reference suggests rejecting unsupported completion and regression-testing missing evidence. Only that general corroboration principle was used. This is farm_studio_api, not MAGI or the old tracker: no evidence-array schema was imposed. In particular, conversational completion is not candidate/holdout certification, and legitimate answers and clarifications do not require source files. Source and actual captures are the evidence interfaces specified for this task.

## Limits

This offline classifier verifies consistency of supplied artifacts, not their provenance or the compiler's behavior. It does not rerun compilation or fixed-holdout checks. Missing artifacts fail the relevant status; unrelated filesystem errors remain errors rather than being silently ignored.
