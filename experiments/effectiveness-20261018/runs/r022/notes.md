# Tracker import repair

Cause: `init` only applied structural state checks. It accepted unknown statuses and done issues with empty evidence, without checking imported evidence against files; thus imported state bypassed `complete`'s safeguards.

Change: Added status/evidence shape validation, acceptance and nonempty-evidence requirements for done issues, import-time in-root regular-file/hash checks, and rejection of completed parents with open descendants. Validation runs before the atomic state write. Runtime list/reopen still do not revalidate artifact hashes, so changed completed artifacts remain inspectable and reopen clears evidence for recertification. Public operations and schema are unchanged.

Validation: `functions.tests` passed all 15 tests, including the original regression suite and new candidate cases for invalid/valid imports, atomic rejection, artifact changes, and reopen.

Limits: File validation establishes current file/hash/containment integrity only; it does not establish the meaning or adequacy of evidence.
