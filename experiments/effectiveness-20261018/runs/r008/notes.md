# MAGI handover — evidence-bounded

## What can be used now

The supplied README describes a small SQLite/JSON role-memory adapter and a local work-pilot task tool, not a general-purpose MAGI runtime. Its documented scripts are:

```sh
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
```

Run these from the MAGI repository root. The README reports the role-memory save/retrieve/scope/revocation paths as tested and 25 work-tool tests as passing. The pilot records an actual task cycle and says the task tool can mutate local tracker state through its CLI, while explicitly disclaiming a general planning runtime or OS sandbox. These source extracts do not include the scripts themselves, so this handover has not independently run them. The checkers validate stored artifacts/state; they do not call a model or establish semantic correctness.

The work-pilot tool's documented invocation is `python3 scripts/work_pilot/tracker.py /absolute/workspace/state.json /absolute/request.json`; begin with a request containing `{"op":"describe"}` to inspect supported operations. Treat this as bounded task-state tooling, not free-form natural-language planning.

## What the evidence does not establish

The draft claim that a general natural-language planning and expert-routing runtime is deployed is unsupported and contradicted by the README: a general engine/model-connection runtime is not implemented. The expertise proposal is explicitly under review; discovering experts, routing questions, and obtaining reliable answers are questions for later investigation, not current capability.

Passing tests mean the tested paths and invariants passed in the reported run. The 25 tests do not prove memory improves outcomes, causes adoption, or saves human time. The pilot explicitly says causal use of extracted lessons is unknown, human review time and model cost are unmeasured, and its observed task completion is not a time-saving measurement. The expertise proposal also requires comparative evaluation and does not report a completed effect.

## Decision boundary and next bounded verification

Continue technical validation, technical adoption/revocation, and correction of technical lessons within the existing technical goals; they do not require a new value decision merely because they change a technical conclusion. Verify a bounded authorized-scope save → retrieve → revoke path against the existing role-memory contract and report exact observations. Do not generalize that check into proof of memory benefit.

Sharing private role memory outside its authorized scope is different: it changes permission. It is not already authorized, must not be implemented or published as part of this handover, and requires a human decision before any such sharing. No external publication was performed.

Sources used: `current-readme.md`, `current-pilot.md`, and `expertise-proposal.md`.