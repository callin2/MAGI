# Verdict repair notes

## Cause

The prior classifier trusted report fields for turn exit status and fixed-holdout success. It also treated a `Saved` line and claimed digest as sufficient without hashing the actual stored candidate. The CLI loaded only report and turn files, so it never supplied the source or actual holdout process capture needed to substantiate those claims.

## Actual checks added

- `complete` now requires every scripted turn's actual capture to have numeric `exitCode === 0` and the expected observed response kind. It retains compiler-pin parity and scripted-turn count checks.
- `finalCandidate` requires completion, a final candidate response, a matching saved-digest line in that final actual capture, matching final/turn digest claims, and SHA-256 equality between that claim and `evidence.source` (string or Buffer).
- `fixedHoldoutPass` additionally requires both the existing report holdout claim and `evidence.holdout` with numeric successful exit status and a line beginning `User expectations passed:`.
- The CLI now loads `CASE_NAME.ghost.md` and `holdout-result.json`, passes them as evidence, and represents missing/malformed evidence as absent so it produces a failed verdict rather than a fabricated success.
- Existing write-once verdict checks, pin parity, response parsing, and returned status/count fields remain in place.

## Validation actually run

`functions.tests` ran `public.test.mjs` and `candidate.test.mjs`; all 7 tests passed. The added regressions cover missing source evidence, forged holdout text, actual failed turn capture despite a report claim, digest mismatch, and a valid clarification completing without a candidate file.

## Remembered experience

The supplied remembered rule about nonempty evidence was used only as a general prompt to ensure success depends on real evidence. Its `local-work-pilot` workspace condition does not apply to this farm_studio_api task, and its old evidence-array schema was not adopted.
