# Windows byte preservation audit

The experiment ran against the exact Windows bytes hashed before execution in frozen.json and runs.json. The preregistration commit 6523f77 had some inputs normalized to LF in its Git index: adding `-text` attributes did not re-add unchanged index entries. This was detected during the first execution batch, not hidden by changing the frozen hashes.

No worker input, expected result, budget or frozen checker was changed. For every frozen file, its preregistered Git blob either already matches the recorded byte hash or reconstructs it exactly by LF→CRLF conversion. `scripts/effectiveness/verify_evidence.py` checks both paths and all current Windows byte hashes. This establishes what the pre-execution commit contained without claiming that its stored bytes were all identical.

The existing unchanged input files were force re-added with `git add --renormalize` after the `-text` attributes took effect. This stores the actual frozen Windows bytes. Final repository evidence can therefore be checked byte-for-byte after a fresh checkout. The original preregistration commits remain available.

Automatic approval review initially rejected the combined commit/push because 149 files were already staged. A full index audit then established 149/149 changes were solely LF/CRLF, all confined to this experiment, and every index entry matched the unchanged input bytes. `git diff --cached --ignore-space-at-eol --exit-code` passed. The subsequent explicitly bounded commit was approved: 9e7ea72. The audit is retained in index-byte-audit.json; the rejection was not bypassed.

Separately, legacy experiments/recursive-work reports failed their Windows checkout hash checks, while all 17 referenced original Git blobs matched their recorded hashes. Their Windows recheck results and byte audit are preserved under legacy-windows-recheck. Original legacy reports were restored after that checker wrote its outputs. No legacy evidence hash was replaced or reissued.
