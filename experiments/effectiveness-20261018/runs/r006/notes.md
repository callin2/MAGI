# MAGI handover — evidence-bounded

## What can be used now

This is a research project with small, real-work pilots—not a deployed general natural-language planning runtime, model-connection runtime, or automatic change-detection system. The README explicitly says these are not implemented. The work-pilot scripts provide a bounded task-tracking/tool workflow, independent checking, and a local review report. They are not an OS sandbox or a general planner.

A small SQLite/JSON role-memory adapter has exercised saving, lookup, scope, and revocation paths. That supports trying the existing adapter; it does not establish durable general learning, memory quality, or benefit. The expertise proposal is explicitly under review: expert discovery and inter-agent expert routing are questions for investigation, not implemented capabilities.

## Try with existing scripts

From the repository root, the supplied README/pilot give these local commands:

```sh
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
```

The pilot also documents the task tool invocation:

```sh
python3 scripts/work_pilot/tracker.py /absolute/workspace/state.json /absolute/request.json
```

Start by sending `{"op":"describe"}` in a request to inspect its contract. The role-learning checker and work-pilot run checker validate stored local artifacts; they do not call models or prove new answers. Follow each script's reported result and do not treat a passing structural check as semantic correctness.

## What the tests establish—and do not

The README reports 25 passing work-pilot tool tests and five final structural checks. The pilot describes 25 failure-oriented tool tests and final state/file checks (16/16 for one task and 17/17 per transfer condition). These are evidence about tested tool behavior and saved work structure, not 25 demonstrations of memory benefit. The transfer pilot preserves initial failures and recovery; the tool contract changed, so condition differences cannot be attributed causally to memory. Memory was retrieved into a worker input, but whether the lesson caused a changed/better result remains unknown. No general learning effect, total-cost advantage, or human-time saving was measured. The pilot explicitly says human review time and model token/billing cost were not measured.

## Next bounded verification and authority boundary

Next, run the existing role-memory tests/checker and work-pilot tests/checker, record exact outputs and any failures, and review the relevant saved artifacts. Then, within already authorized scope, validate one technical lesson's source, scope, retrieval, and correction/revocation behavior; keep this distinct from evidence that it improves outcomes. A later benefit test should use a small predeclared comparison and measure outcome quality and human time separately, without claiming causation from retrieval alone.

Technical validation and correction or revocation of a technical lesson within its authorized scope are technical work and need not be blocked by a blanket new approval rule. In contrast, publishing private role memory beyond its authorized scope changes permission. It is not already authorized: do not implement that proposal or publish anything unless a human explicitly authorizes the scope. The expertise proposal itself remains under review, not a deployment decision.
