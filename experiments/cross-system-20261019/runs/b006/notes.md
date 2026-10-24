# Repair and Hardening of farm_studio_api CLI acceptance verdict

## Cause of Problem
The original `verdict.mjs` classified final candidate acceptance and holdout hold success status largely based on labels and superficial matching, without requiring the actual source file content or the real capture of the fixed holdout run to substantiate claims. This allowed fabricated success verdicts when evidence was missing or did not align.

## Actual Checks Added
- Extended `classifyCase` to accept an `evidence` object containing `source` (Buffer or string, the real candidate source file) and `holdout` (the actual holdout capture object with `exitCode` and `stdout`).
- Require that the SHA-256 of the `source` matches the final source claim in the report.
- Require the holdout evidence to have numeric `exitCode` of 0 and a `stdout` line starting with `User expectations passed:` to be considered a successful fixed holdout.
- Modified the CLI loading path to read the required source file `${caseName}.ghost.md` and `holdout-result.json` file, passing these as evidence to classification.
- Missing evidence or mismatches induce a failure to confirm `finalCandidate` and `fixedHoldoutPass`, preventing false positives.
- Preserved the existing exported functions, the CLI interface, and the statuses returned.

## Tests and Coverage
- Carried forward all previous tests from `public.test.mjs`.
- Added `candidate.test.mjs` covering acceptance and rejection scenarios for:
  - Valid candidate and holdout evidence acceptance.
  - Missing source or mismatched source leading to rejection.
  - Missing or failing holdout evidence leading to rejection.
  - Detection of kind mismatches between expected and observed.
  - Enforcement of current pin parity for completeness.
  - Non-candidate last turn leading to no finalCandidate.
  - Detection of duplicate responses causing observedKind to return null.
- All tests pass, validating hardening against fabrication of success.

## Experience Used and Scope
- The repair is purpose-fitted to the current farm_studio_api CLI isolated system; previous remembered experience about integration failures and evidence gates influenced the approach.
- Did not impose evidence arrays schema as instructed.
- No external calls or network access used.

## Limitations
- Does not parse or validate deeper correctness of clarification or answer kinds beyond the kind detection.
- Assumes input files are in expected JSON format.
- No historic verdict back-patching.

This repair addresses the problem of false success verdicts by anchoring final acceptance states to real source and holdout evidence and hardening the CLI file loading and classification code accordingly.