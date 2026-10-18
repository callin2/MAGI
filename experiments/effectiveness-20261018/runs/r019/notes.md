# MAGI handover — evidence-bounded

## What is usable now

The supplied README describes a small real-work pilot and local tools, not a deployed general natural-language planning system, model-connected runtime, or automatic change detector. The research goal is broader than the implementation. Existing usable artifacts include the role-learning SQLite/JSON adapter with tested save, lookup, scope, and withdrawal paths, plus the work-pilot tracker, independent checker, report renderer, and saved pilot materials. These are bounded scripts and stored evidence, not a general autonomous planner or expert-finding service.

Try the available local checks from the repository root:

```sh
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
python3 scripts/check_pilot.py --check
```

The first command runs the work-pilot tool tests; check_runs checks saved run state/files. The role-memory test and checker exercise the adapter/pilot evidence. check_pilot validates stored materials and does not call a model or produce fresh answers. The work tool can be queried with `describe` and invoked on request JSON; it changes local tracker state and checks hashes, not semantic correctness or OS sandboxing. Use only authorized memory scope; do not treat a technical lookup capability as permission to disclose private role memory elsewhere.

## What the tests establish—and do not

The README reports 25 passing work-tool tests and final structural checks for five tasks. The pilot report explains the checks and preserves initial failures and recovery; checks concern tool behavior, task structure, completion and file hashes. They do not prove that all technical judgments are true, that memory caused better outcomes, that the system generally learns, or that the work saved human time. The pilot explicitly says token/billing costs and human review time were not measured, and the comparisons have small-sample and confounding limitations. Adapter path tests establish that save/retrieval/scope/withdrawal paths were exercised, not independent memory benefit. No supplied source demonstrates expert discovery/routing efficacy. The draft's causal and deployment claims therefore overstate the evidence.

## Decisions and next bounded verification

Technical validation, adoption, correction, or revocation of a technical lesson within existing goals is not categorically blocked pending new human approval. Do the bounded technical work: inspect the lesson's source and scope, run its relevant existing check, record what the check actually establishes, and correct/revoke a technically unsupported lesson within that scope. This does not authorize changing user values or permissions.

A request to publish private role memory outside its authorized scope is a new permission decision. Do not implement or publish that proposal; obtain an explicit human authorization before any such disclosure. The expertise document is an under-review proposal, not evidence of a working expert router.

Next verification: run the listed role-memory test/check and work-pilot checks locally; inspect one narrowly scoped existing memory entry through its authorized retrieval and withdrawal path, recording the exact observed result without exposing private content. Report failures as well as passes. This verifies a bounded technical path only; it does not establish memory benefit, human-time savings, general runtime deployment, or expert routing. A benefit claim requires a separately designed comparison and measured outcomes; a time-saving claim requires actual human-time measurement.
