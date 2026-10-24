# Repair notes

## Cause

The prior classifier trusted report fields for turn exit status and holdout success.  It treated a `Saved` line matching a report-provided digest as sufficient persistence, without hashing the actual saved source.  The CLI also did not load either the case source file or `holdout-result.json`, so a self-asserted report could certify a final candidate and fixed holdout.

## Actual checks

`classifyCase(report, captures, evidence = {})` now uses process captures for observed response kinds and numeric successful exits.  `complete` requires compiler-pin parity, the scripted-turn count, matching observed kinds, and successful actual captures.  It remains possible for an answer or clarification to complete without a source file.

`finalCandidate` additionally requires a final candidate response, matching final/source claims, a matching `Saved ... SHA-256 ...` process line, and SHA-256 equality between `evidence.source` (string or Buffer) and the final claim.  `fixedHoldoutPass` additionally requires both the report holdout assertion and `evidence.holdout` with numeric zero exit status plus a line beginning `User expectations passed:`.

The CLI now loads `turn-N.json`, `CASE_NAME.ghost.md` as raw bytes, and `holdout-result.json`. Missing or malformed optional evidence is passed as unavailable, which yields failed dependent statuses rather than a fabricated success. Existing verdict-output overwrite checks, compiler pin checking, and response-kind validation remain in place.

## Validation

Ran `functions.tests`, which ran public and added candidate tests: 5 tests passed. Regression coverage includes missing source evidence, source digest mismatch, absent real holdout success output, actual process failure, and successful clarification without a candidate.

## Experience used

No remembered experience was supplied or used. No external systems were accessed.
