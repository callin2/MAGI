# Repair Notes for farm_studio_api Verdict

## Cause
- The standalone verdict previously could certify finalCandidate and fixedHoldoutPass statuses based solely on report fields and turn capture stdout lines without validating stored source evidence or real holdout captures adequately.
- Missing or mismatched source evidence did not fail the complete verdict as required, allowing fabricated success where source or holdout capture did not substantiate claims.
- The CLI file loading path did not enforce reading actual source from the .ghost.md and holdout-result.json, which are now mandatory for positive certification.

## Actual Checks Implemented
- The classifyCase function extended to accept an evidence object with:
  - `source`: Buffer or string, checked against report.finalSourceSha256 using SHA-256 hash to ensure source consistency.
  - `holdout`: actual holdout capture object with numeric exitCode and stdout, parsed for success line "User expectations passed:".
- classifyCase returns early a failure verdict with complete=false if source evidence is missing or mismatched.
- classifyCase returns failure if holdout evidence is missing or incomplete.
- Completed status requires scripted turns matching expected kinds, zero mismatches, all exits zero, and candidate turn persistence.
- finalCandidate requires complete plus last turn candidate with source hash matching finalSourceSha256.
- fixedHoldoutPass requires finalCandidate true plus holdout exitCode 0 and success line in holdout stdout.
- CLI loading enforces reading from known files:
  - report.json
  - turn-N.json per turn
  - CASE_NAME.ghost.md for source evidence
  - holdout-result.json for holdout evidence
- Files failing to exist or parse cause negative verdict without fabricated success.

## Experience Used
- Confirmed during implementation that missing evidence should result in failed verdict, consistent with previous remembered experience about rejection of state without evidence.
- Maintained compatibility with the exported observedKind and classifyCase API signatures.

## Noted Limitations
- Source correctness is checked only by SHA-256 match; contents are not semantically validated.
- Capture reading expects valid JSON files, no corruptions or partial reads handled.
- No attempt to support old evidence array schema; only the new `{source, holdout}` object evidence interface.
- CLI currently aborts on existing verdict files to prevent overwriting historical data.

This repair ensures the system tightly couples declared success statuses to concrete evidence in files and captures, preventing false positives and fabricated completions.
