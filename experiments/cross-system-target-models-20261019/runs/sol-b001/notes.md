# Repair notes

## Cause

The original classifier used report turn exit codes without checking the real process captures. A saved-file log line and matching report hashes could establish a final candidate without hashing the stored source. Fixed-holdout success relied entirely on report labels. The CLI loaded neither source bytes nor holdout-result.json, so the classifier could not corroborate those claims.

## Implemented checks

- Preserved the exported observedKind and classifyCase entry points and returned status/count fields. classifyCase now accepts an optional evidence object containing source and holdout.
- Conversation completion requires compiler-pin parity, the scripted turn count, matching response kinds, and zero numeric exit codes in both report and actual captures. Clarifications and answers need no candidate file. Missing captures cannot complete a conversation.
- Final-candidate status additionally requires a final candidate response, its saved-file SHA-256 announcement, matching final report hash, and a SHA-256 computed from the actual source string or Buffer. A missing source cannot certify a candidate. Candidate persistence is deliberately a final-candidate condition rather than an extra condition on conversational completion.
- Fixed-holdout status additionally requires strictly successful report labels and an actual capture with numeric exitCode 0 and a stdout line starting `User expectations passed:`.
- The CLI reads each case directory's report.json, turn-N.json files, CASE_NAME.ghost.md (using the directory's case name), and holdout-result.json. Missing artifacts remain absent evidence. Malformed capture JSON also remains absent evidence rather than becoming successful synthetic data. Report JSON errors still abort the CLI.
- Existing verdict files and summaries are checked before writes, and writes retain exclusive creation and restrictive modes. Existing parser, pin-parity, saved-hash, and final-turn protections remain.

## Validation actually run

Used the supplied tests tool to run public.test.mjs and candidate.test.mjs together: 9 tests passed, 0 failed. Regression coverage includes valid string/Buffer sources; missing and tampered sources; missing, nonnumeric, or failed turn exits; absent, failed, or markerless holdouts; report/capture disagreement; non-candidate completion; pin/count/kind/hash failures; and CLI reads of real temporary case files. CLI tests also verify that existing summaries or per-case verdicts block replacement without changing historical case verdict contents. Temporary fixtures were removed.

CLI execution was tested by importing the actual module in-process with temporary process.argv values and isolated import URLs, restoring argv and exitCode afterward. No child processes, external calls, live compiler runs, or live fixed-holdout runs were performed.

## Scoped remembered experience

The supplied tracker experience was used only as a reminder that labels do not substantiate completion. Its mandatory nonempty evidence-array rule belongs to a different tracker and was not imposed here. This CLI uses actual stdout/exitCode captures and source bytes, not that evidence-array schema. In particular, a legitimate answer or clarification can complete without any saved source or holdout artifact.

## Limits

This repair validates the supplied artifacts, not their provenance. Compiler-pin parity remains the existing report identity condition; no compiler is invoked to re-establish it. Malformed report structures are not generally normalized into verdicts. No access to systems outside the supplied workspace was used.
