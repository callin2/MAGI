Cause: the classifier previously trusted report turn exit codes and report holdout claims, while candidate persistence was inferred from a captured log line alone. The CLI loaded only report and turn captures, so neither final source bytes nor actual holdout output participated in the decision.

Changes/checks: classifyCase now accepts evidence.source (Buffer or string) and evidence.holdout, hashes stored source bytes with SHA-256, and requires that hash to agree with the final source claim and final candidate turn. Turn completion relies on actual capture exit codes and observed response kinds; completion does not require a candidate, allowing clarification/answer results. Fixed holdout success requires both the report claim and numeric successful actual capture with a stdout line beginning `User expectations passed:`. The CLI loads CASE_NAME.ghost.md and holdout-result.json and leaves evidence missing on read failure, which cannot establish the higher verdicts. Existing compiler-pin, response-kind, candidate-save, and overwrite protections remain.

Validation: ran functions.tests, which ran public.test.mjs and candidate.test.mjs: 5 passed, 0 failed. Candidate regression tests cover successful evidence, absent evidence, hash mismatch, holdout output, capture exit code, and legitimate clarification.

Experience/reference: the supplied remembered-experience list was empty, so no remembered guidance was applied. In particular, no unrelated evidence-array schema was imposed.

Limitations: no independent end-to-end CLI filesystem test was run; tests validate the classifier directly as required by the available test harness.
