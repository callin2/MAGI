# Repair notes

## Cause and semantics

The original classifier read response kinds and saved-digest lines from captures, but trusted report exit codes instead of actual process exit codes. It compared only digest claims, not the saved source bytes, and accepted holdout report labels without a holdout process capture. The CLI never loaded source or holdout evidence. This allowed an internally consistent report to certify unsupported work.

The repaired `classifyCase(report, captures, evidence = {})` preserves the observedKind entry point, derived status/count fields, and report metadata. Completion requires pin parity, a nonempty full scripted turn sequence, matching response kinds, and numeric zero exit codes in both turn reports and real captures. Completion alone does not require a source file: answers and clarifications are legitimate completed conversations, and candidate persistence is a separate final-candidate requirement.

Final-candidate status additionally requires the last response to be a candidate, a saved SHA-256 line matching its digest claim, equality to the final source claim, and SHA-256 of the supplied source Buffer/string matching that claim. Fixed-holdout status additionally requires the report's numeric zero exit and literal true success claim, plus a real numeric-zero capture with a stdout line starting `User expectations passed:`. Report-supplied verdict fields are overwritten by the derived values.

## File path and historical protections

The CLI loads each case directory's report.json, numeric turn-N.json files, CASE_NAME.ghost.md (CASE_NAME is the directory basename), and holdout-result.json. Missing evidence and malformed capture JSON cannot manufacture success. Unexpected I/O errors still abort. Malformed reports still abort rather than being certified. Numeric turn identifiers prevent report-controlled path traversal. Existing verdict-summary.json and per-case verdict.json are checked before any output, and writes retain exclusive creation and private file permissions. Publication remains non-transactional across multiple files.

## Checks actually run

Ran the provided tests tool once after writing the implementation and regressions: both public.test.mjs and candidate.test.mjs ran, six tests passed and zero failed. Coverage includes valid string/Buffer sources, missing/changed source, actual process failures and nonnumeric exit codes, pin and turn-count rejection, response-kind mismatch and duplicate parsing, saved/final digest mismatch, holdout report/capture failures, source-free answers and clarifications, and derived status/count behavior. Temporary directory fixtures exercised the actual runCli file loader and verdict writer, including missing files, malformed holdout JSON, failed turn captures, and refusal to overwrite both summary and individual historical verdicts. Fixtures were removed by the tests. No subprocess, compiler, external service, or independent real holdout was run.

## Scoped remembered experience

The supplied tracker experience was used only as a general warning against accepting unsubstantiated completion claims. Its nonempty evidence-array schema does not apply here and was not introduced. This system uses typed source/capture evidence and deliberately allows conversational completion without candidate files. Current task semantics, not the old tracker gate, determine the three distinct statuses.
