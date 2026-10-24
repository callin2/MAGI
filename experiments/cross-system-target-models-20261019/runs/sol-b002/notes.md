# Repair notes

## Cause

The historical classifier trusted turn exit codes and holdout success labels from report.json. A Saved line only corroborated a claimed digest with another claim in stdout; the classifier never hashed the stored candidate. The CLI loaded only the report and turn captures, so it could not detect a missing or modified source or an absent/failed actual holdout capture.

## Changes and checks

- Preserved exported observedKind and classifyCase, existing returned status/count fields, strict single response parsing, compiler-pin parity gate, and exclusive/preflight verdict overwrite protection.
- classifyCase now accepts evidence.source (string or Buffer) and evidence.holdout. Completion requires matching response kinds and zero numeric exits in both report turns and actual captures for all scripted turns. Clarifications and answers can complete without source evidence.
- Final-candidate acceptance additionally requires the final response to be a candidate, a matching Saved digest, equality of the final turn and report digest claims, and SHA-256 of the actual supplied source bytes matching that claim.
- Fixed-holdout acceptance additionally requires strict report success, numeric zero actual holdout exit, and an actual stdout line starting `User expectations passed:`.
- The CLI reads CASE_NAME.ghost.md and holdout-result.json alongside report.json and turn-N.json. Missing evidence (and malformed JSON evidence captures) cannot be replaced by report claims. Source and holdout failures do not erase legitimate conversational completion.
- No tracker evidence-array schema was added.

## Validation actually run

Ran the supplied tests tool on public.test.mjs and candidate.test.mjs: 8 tests passed, 0 failed. Tests cover valid string/Buffer sources, missing/changed sources, actual process exits, response duplication/kind mismatch, pin/count gates, clarification/answer completion, Saved/final-digest mismatches, strict holdout claims and actual check output, and existing verdict refusal. CLI regressions execute the real entry branch by importing with CLI arguments in-process, write temporary workspace fixtures, inspect emitted verdicts, and clean up. They cover missing source, wrong source, missing holdout, failed holdout, missing turn capture, summary overwrite protection, and lone per-case historical verdict protection.

No external compiler, real farm_studio_api run, external service, or child process was used. These checks establish classifier behavior against fixtures, not independent authenticity of evidence supplied by a caller.

## Experience scope

The supplied remembered-experience list was empty; no remembered repository assumptions were used. In particular, MAGI or an old tracker's evidence-array contract does not apply to this standalone historical module. Current task semantics determined the separate meanings of complete, finalCandidate, and fixedHoldoutPass.
