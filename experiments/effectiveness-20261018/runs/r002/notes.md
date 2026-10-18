Cause: init applied generic state/lineage checks but skipped the completion-time gate; imported done issues could therefore lack acceptance/evidence or reference invalid artifacts.

Change: init now validates legal statuses, requires acceptance and nonempty evidence for done issues, checks each completed issue's evidence path stays inside the workspace and names a file with the declared SHA-256, and rejects a done parent with an open direct descendant (which also prevents open descendants at any depth). Validation runs before atomic save. Ordinary state loading deliberately does not rehash historical done evidence, so list remains available after artifact edits and reopen clears evidence for recertification.

Validation: `functions.tests` ran the original tracker tests and the new candidate regressions; all 14 passed. Candidate coverage includes atomic rejection for missing completion evidence/acceptance, malformed hash, missing file, open descendant, plus valid import followed by artifact edit, list and reopen.

Remaining limits: evidence verification is a point-in-time check; artifacts may change after successful import/completion. Reopen is the supported recertification path.