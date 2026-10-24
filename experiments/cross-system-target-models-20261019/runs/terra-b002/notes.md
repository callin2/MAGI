# Verdict repair notes

## Cause

The prior classifier treated values embedded in `report.json` as proof: it used each report turn's `exitCode`, accepted a saved-SHA line without hashing the stored candidate source, and treated report holdout labels as a successful fixed-holdout run. The CLI also passed no stored source or holdout capture to the classifier. Consequently, report claims could fabricate `finalCandidate` and `fixedHoldoutPass`.

## Actual checks

`classifyCase(report, captures, evidence = {})` now:

- derives response kinds and successful exits from the actual turn captures (`exitCode === 0`), while retaining compiler-pin parity, scripted-turn count, and expected-kind checks for `complete`;
- allows a successful clarification or answer to be complete without any candidate artifact;
- requires the final turn to be an observed, saved candidate, its claimed SHA to agree with `finalSourceSha256`, and SHA-256 of `evidence.source` (string or Buffer) to equal that final claim before setting `finalCandidate`;
- requires both the report's fixed-holdout assertion and an actual `evidence.holdout` with numeric zero exit code plus a line beginning `User expectations passed:` before setting `fixedHoldoutPass`.

The CLI now reads `turn-N.json`, `CASE_NAME.ghost.md` (using `report.identity.case`), and `holdout-result.json`; absent evidence is supplied as absent and therefore fails the relevant verdict rather than becoming a report-only pass. Existing verdict outputs are still rejected before writes, preserving historical-verdict overwrite protection.

## Validation

Ran `functions.tests`, which ran public and candidate tests: 7 tests passed. The new tests cover absent evidence, source mismatches, holdout failures/output omissions, actual turn exit failures, a valid fully corroborated candidate, and a clarification that completes without a candidate.

## Experience used

No remembered experience was supplied or used. No external systems or files were accessed.
