# MAGI handover

## What can be used now

The current public extracts describe two usable local capabilities, not a deployed general-purpose MAGI runtime. The role-memory SQLite/JSON adapter supports saving, retrieval, scope handling, and revocation paths; its cited pilot exercises these paths. The work-pilot scripts support recursive task tracking, integration, local checks, and report rendering. They are scripts and a small pilot implementation, not a sandboxed general planner or model-connected runtime.

From the repository root, try the existing checks:

```sh
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
```

The readme also lists `python3 scripts/check_pilot.py --check` for checking preserved pilot materials. These checks validate stored artifacts or implementation behavior; they do not call a model or generate new answers. Follow each script's local usage/contract before attempting state-changing operations.

## What the evidence says

The README reports 25 passing work-tool tests and five pilot tasks with final structural checks; the pilot report describes 25 failure-oriented tool tests and completion checks (16/16 and 17/17 for the cited tasks). These are bounded implementation and artifact/state checks, not proof that every semantic judgment is correct, that general planning or expert routing exists, or that the system is superior. The pilot explicitly reports that general learning benefit and total-cost superiority are unproven. Memory was retrieved into a new worker's input, but causal use and benefit remain unknown. Human review time was not measured. Thus the draft's “25 passing tests prove memory saves human time” claim is unsupported: the test count concerns tool regressions, not a human-time or memory-benefit experiment.

The general natural-language planning and expert-routing runtime is not deployed: the README explicitly says the general engine, model-connection runtime, and automatic change detection are not implemented. The expertise document is a proposal under review, not an implementation or result. Do not imply it is available now.

## Decision boundary and next bounded verification

Agents may perform technical validation, correction, adoption, or revocation of a technical lesson within existing goals and authorized scope; no universal new human-approval gate is evidenced. For a bounded next check, select one existing technical lesson, confirm its source and scope, run its specified validation against the current implementation, record the outcome, and revise or revoke it if the evidence warrants. Preserve the test outcome and lesson status; do not claim general benefit from one check.

That technical authority does not expand permission. Publishing private role memory outside its authorized scope is a new permission decision and requires a human decision. Do not implement the proposal or publish anything under this handover. Broader causal memory benefit, human-time impact, and expertise-routing efficacy remain unverified.