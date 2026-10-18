# MAGI handover — evidence-bounded

## What can be used now

The source describes two concrete, local capabilities, not a general deployed planning product. The role-memory SQLite/JSON adapter supports storage, retrieval, scope checks, and revocation paths. Existing scripts are `python3 scripts/test_role_memory.py -v` and `python3 scripts/check_role_learning.py` (from the repository root). The recursion/work pilot also provides runnable tracker, independent-check, and report tools; its documented usage is `python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v`, `python3 scripts/work_pilot/check_runs.py`, and `python3 scripts/work_pilot/tracker.py /absolute/workspace/state.json /absolute/request.json`. Start the tracker by submitting `{"op":"describe"}` to learn its contract. The checker re-evaluates preserved local records; it does not call a model or create fresh answers. These paths are described by the supplied extracts; execution was not performed for this handover.

The 25 passing tests are failure-oriented tool tests for that work pilot, not evidence that memory saves time, improves general work, or powers a natural-language planner. The pilot records actual work, repairs, and final structural checks, but explicitly says initial conditions, tool changes, small self-related tasks, and missing comparable cost data block causal attribution. CLI elapsed time is not model or total work time; model/token cost and human review time were not measured. Memory retrieval into a worker input was observed, while causal use and benefit remained unknown.

## Claims and boundaries

Memory adapter and work tools are implemented in the limited documented sense above. General natural-language planning/runtime is expressly not implemented. Expert routing is an under-review proposal with questions and planned investigation, not a functioning routing capability. Memory benefit is experimental; human time saving is unproven.

Proceed with authorized technical validation, including checking technical lessons and revoking one within its existing scope. Do not convert that authority into permission to publish private role memory elsewhere: sharing outside its authorized scope requires a human decision. No proposal implementation or publication is authorized by this handover.

## Next bounded verification

Run the two existing role-memory commands from the repository root. Preserve outputs; inspect whether the tests/checker actually cover access scope and revocation, and record any gap or failure. Do not broaden visibility or publish memory. Separately, a later controlled comparison should predefine cases, conditions, outcome scoring, and total-cost measurements before execution; report human review time separately. This is a verification plan, not a claim that those checks or experiments have already run.
