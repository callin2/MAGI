# Repair notes

The classifier previously trusted report turn exit codes and report holdout claims, and considered a matching `Saved ... SHA-256` line sufficient candidate evidence. It never checked the saved source bytes. The CLI also supplied only turn captures, so source and real holdout evidence could not participate in classification.

The classifier now takes `evidence.source` (Buffer or string) and `evidence.holdout`. Completion checks current pin parity, expected turn count/kinds, and each actual capture's numeric zero exit code. Completion does not require a candidate file, allowing legitimate clarification/answer turns. Final-candidate status additionally requires a candidate final turn, a matching persisted hash line, and source bytes whose SHA-256 equals both that turn's claim and `finalSourceSha256`. Fixed-holdout status additionally requires report holdout claims and an actual zero-exit capture whose stdout has a line beginning `User expectations passed:`.

The CLI now reads CASE_NAME.ghost.md and holdout-result.json alongside report.json and turn-N.json. Missing/malformed turn or holdout evidence cannot create success. Existing verdict-file overwrite checks remain. The public and new candidate regression tests were run with the provided test tool: all 6 passed. The CLI loading path was not tested end-to-end.

No remembered experience was used; the supplied reference list was empty. In particular, no unrelated evidence-array schema was imposed.
