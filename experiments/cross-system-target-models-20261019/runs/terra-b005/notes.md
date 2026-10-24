# Verdict repair notes

## Cause

The prior classifier treated report fields as proof of execution: it used each turn's reported `exitCode` and used the report's holdout labels without reading an actual holdout capture. It also accepted a final candidate based on a reported SHA and a `Saved` line, without hashing the stored candidate source. The CLI consequently did not load either `CASE_NAME.ghost.md` or `holdout-result.json`.

## Actual checks

`classifyCase(report, captures, evidence = {})` now uses each actual capture's numeric `exitCode` and parsed response line for `complete`. It retains compiler-pin (`currentPinParity`), response-kind, and scripted-turn-count requirements. A candidate-save line is recorded per turn; `finalCandidate` additionally requires the final candidate capture's saved SHA and SHA-256 of `evidence.source` to match `report.finalSourceSha256`. `fixedHoldoutPass` additionally requires the report's existing success claims and an actual `evidence.holdout` with exit code zero and a line beginning `User expectations passed:`.

The CLI loads turn captures, `CASE_NAME.ghost.md`, and `holdout-result.json`; absent evidence becomes `undefined` and yields a failed status instead of a synthetic pass. Existing verdict-output checks and exclusive writes remain in place, preserving historical-verdict overwrite protection.

The supplied test tool was run after the changes. It reported 7 passing tests across `public.test.mjs` and the added `candidate.test.mjs`. The added coverage checks missing source/holdout, altered source, forged reported-success with failed actual turn capture, holdout marker/exit requirements, and a legitimate non-candidate clarification completion.

## Experience reference

The remembered rule about nonempty evidence was considered only as scoped reference data. Its stated `local-work-pilot` condition does not apply to this farm_studio_api task, so it was not used as a rule. This repair instead follows the task's explicit evidence requirements.
