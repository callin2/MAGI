# MAGI handover — evidence-bounded

## What is usable now

This is a research project with a small, real-work pilot, not a deployed general natural-language planning runtime. The documented local work-pilot scripts implement a bounded tracker/task workflow and review UI; they are not a general planner, model connector, or sandbox. A small SQLite/JSON role-memory adapter supports storage, retrieval, scope and revocation paths. Its existence and exercised paths do not establish useful learning or adoption benefit.

Try the documented checks from the repository root (Python standard library):

```sh
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
python3 scripts/check_pilot.py --check
```

The work-pilot tracker can be queried using `{"op":"describe"}` and a request JSON file; documented invocation is `python3 scripts/work_pilot/tracker.py /absolute/workspace/state.json /absolute/request.json`. `check_runs.py` and the pilot check scripts validate saved artifacts; they do not call a model or create new responses. Follow the README's scope and local workspace assumptions.

## What the tests do—and do not—mean

The README reports 25 passing failure-oriented tool tests and final structure checks for five tasks. Those tests exercise tool behavior and recorded task structure; they do not prove broad runtime deployment, semantic correctness of every judgment, general learning, better memory outcomes, cost superiority, or human time saved. The recursive pilot report documents initial failures, a faulty initial judge, and repair; it explicitly warns that tool-contract changes confound comparisons, conditions were small and single-run, and total model/token/billing and human review time were not measured. A memory retrieval receipt proves inclusion in an input, not causal use or improved results. Keep those distinctions in customer-facing claims.

## Decision boundary and next bounded verification

Agents may carry out already-authorized technical validation, and technical lesson lifecycle work (including revocation) within its existing scope. Record provenance and results; do not silently expand data access or convert technical checks into value or permission decisions. Publishing private role memory beyond its authorized scope is a new permission choice and requires a human decision. It is not authorized by this handover; do not implement or publish that proposal.

Next, run one bounded, pre-specified and permission-scoped memory transfer verification against an appropriate no-memory/control condition, independently inspect outputs, retain failures, and report the small-sample limits. Separate retrieval from evidence of changed behavior; measure human/model time and total cost if making efficiency claims. Do not expand to expert routing or external/private-memory sharing without the appropriate authorization and separate evidence. The expertise item is a proposal under review, not an implemented routing capability.

Source basis: `current-readme.md`, `current-pilot.md`, and `expertise-proposal.md`.