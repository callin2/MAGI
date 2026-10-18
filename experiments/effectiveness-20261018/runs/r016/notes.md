# Tracker import-boundary repair

Cause: `init` called structural `state_ok`, which did not constrain issue status or require done evidence. It could therefore import a false completion that normal `complete` would reject. Imported done evidence also was not checked against current workspace files, and parent/child completion consistency was unchecked.

Change: `state_ok` validates legal statuses, evidence structure (including lowercase SHA-256 format), nonempty acceptance/evidence for done issues, lineage, and done-parent/open-child consistency. `validate_import` checks all supplied evidence paths for relative containment and regular-file existence, and compares actual hashes before `init` saves anything. These checks run before atomic state creation. Runtime listing does not revalidate evidence files, allowing recovery of a completed item whose artifact later changed; `reopen` continues to clear active evidence for recertification.

Validation: ran the supplied tests tool after the final tracker edit. It reports 14 passing tests: 11 existing tracker regressions and 3 added candidate tests covering invalid/atomic imports, done-parent/open-child rejection, valid import, and list/reopen after artifact mutation.

Limits: validation is limited to this workspace and the available regression suite; no external checks were performed.