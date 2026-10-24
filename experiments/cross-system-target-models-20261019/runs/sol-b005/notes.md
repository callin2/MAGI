# Repair notes

## Cause and checks

The old classifier trusted report turn exit codes instead of captured process exit codes, treated a printed saved-source digest as proof of stored source, and accepted report-only fixed-holdout success. The CLI loaded neither the actual source nor holdout capture.

The repair requires numeric zero exit codes from both turn claims and captures, preserves strict response-kind parsing and compiler pin parity, hashes the actual source bytes with SHA-256 for final-candidate acceptance, and requires strict report holdout success plus a numeric-zero actual holdout capture with a line beginning `User expectations passed:`. Missing source or holdout evidence cannot pass their respective gates. Missing/malformed capture JSON is treated as absent evidence. Clarification and answer turns can complete without a candidate artifact. Derived verdict fields overwrite any incoming claimed statuses.

The CLI loads each case directory's `report.json`, `turn-N.json`, `CASE_NAME.ghost.md` (CASE_NAME is the directory basename), and `holdout-result.json`. Existing summary and case verdict files are checked before writing; exclusive creation remains enabled. The shared exported `runCli` function allows testing the real loader without launching a subprocess.

## Validation actually performed

Ran the supplied tests tool against public.test.mjs and candidate.test.mjs: 8 tests passed, zero failed. Coverage includes valid string/Buffer source evidence; missing and changed source; missing and nonzero/string process exits; pin, turn count, response kind and final digest mismatches; missing, failed and invalid holdout evidence; no-artifact clarification/answer completion; duplicate and malformed response records; filesystem CLI loading with missing and changed evidence; and historical output overwrite rejection. CLI tests created and removed temporary directories inside the workspace and invoked runCli directly; no child process or external service was used.

## Scoped experience and limitations

The remembered local-work-pilot rule suggests rejecting unsupported completion claims and adding regression coverage. Its evidence-array schema does not apply to farm_studio_api. No tracker evidence array was added; this system uses source bytes and actual process/check capture objects instead. These checks corroborate supplied captures and stored bytes, not their authenticity against a malicious editor controlling all files. No compiler or holdout executable was rerun, and no external repository or system was accessed.
