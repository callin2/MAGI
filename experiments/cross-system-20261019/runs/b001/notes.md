# Notes on Repairs to farm_studio_api CLI verdict.mjs

## Cause of Issue
The original verdict.mjs allowed certification of successful completion and fixed holdout pass based on report labels alone without requiring real evidence capturing the exact source content or the actual holdout run output. It used turn.exitCode from the report which are expected values, not the real exitCode from captures.

This let false success pass if the source file or holdout-result.json was missing, or source content did not match the finalSourceSha256 claim in the report.

## Repairs Made
- Extended `classifyCase(report, captures, evidence={})` to require real evidence:
  - `evidence.source` (Buffer or string) must be present and hash to report.finalSourceSha256.
  - `evidence.holdout` (object with exitCode and stdout string) must be present and stdout must contain the success line "User expectations passed:" with exitCode zero.
- Verified `complete` flag checks actual exitCode from captures, not static report turn.exitCode.
- Updated CLI code to:
  - Read `holdout-result.json` for holdout evidence.
  - Read source file named `${caseName}.ghost.md` for source evidence.
- Preserve original exported functions and returned status fields.
- Added detailed candidate.test.mjs covering regression cases for evidence presence, source hash checks, holdout success line detection, mismatch cases, and persistedCandidate marker correctness.
- Passed all public and candidate tests.

## Experience Used
- Applied the scoped principle that "A completion gate that requires nonempty evidence prevents false done states caused by structurally complete but unsubstantiated reports" from the remembered experience references.
- Did NOT import any schema validation requiring an evidence array since the current task explicitly disallowed imposing old tracker evidence-array schema.

## Limitations
- The classifier does not check candidate file contents beyond confirming the SHA-256 hash logged in turn stdout.
- Does not handle multiple sources or varying evidence structures beyond source and holdout objects.
- The CLI will raise an error if verdict.json files already exist, it does not recover or overwrite those files.

All changes are contained to verdict.mjs, addition of candidate.test.mjs, and deliverable.json plus the notes here. No external network or dependencies used.
