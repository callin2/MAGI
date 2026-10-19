# Repair notes

## Cause
The original classifier trusted report-provided turn exit codes and holdout claims, and inferred a saved candidate from a capture's printed hash without reading the candidate source. Consequently report assertions could certify outcomes that stored source/process evidence did not establish. The CLI loaded turn captures only; it did not load the case's source or actual fixed-holdout capture.

## Checks implemented
- `complete` requires current pin parity, the scripted turn count, matching observed response kinds, and a numeric zero exit code from each actual turn capture. It does not require a candidate, so a genuine clarification or answer can complete.
- `finalCandidate` additionally requires the final observed candidate, its saved-hash line and turn claim to agree with the SHA-256 of supplied source bytes, with the report's final-source claim agreeing too.
- `fixedHoldoutPass` additionally requires the report's success claims and a numeric-zero actual holdout capture containing a line beginning `User expectations passed:`.
- CLI loads `CASE_NAME.ghost.md` and `holdout-result.json`; unavailable captures/source are passed as absent evidence and cannot produce success. Existing verdict overwrite protections remain.
- Regression tests cover absent/mismatching evidence, actual corroboration, candidate-free clarification completion, and nonzero process exits.

## Validation and experience
Ran the supplied test tool: public and candidate tests, six passed and zero failed. The remembered experience concerned a different tracker/evaluator completion gate and nonempty evidence-array schema. That schema does not apply here; this repair instead verifies this CLI's source hashes and concrete process/holdout captures. The scoped general caution against accepting unsupported completion claims informed the threat review, not the implementation's data model.

## Limitation
No dedicated end-to-end CLI filesystem test was run; CLI loading changes were not exercised through a spawned process.
