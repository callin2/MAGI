# MAGI handover — evidence-bounded

The draft overstates the current system. Available now is a small SQLite/JSON role-memory adapter with tested save, retrieval, scope, and revocation paths, plus local work-pilot scripts for task tracking, validation, and report rendering. This is a real pilot/toolset, not a general natural-language planning runtime or model-connected autonomous engine. The README explicitly says the general engine, model runtime, and automatic change detection are not implemented. Expert discovery and routing are an under-review proposal; the proposal records questions and intended comparisons, not a deployed router.

## Try the existing checks

From the repository root, use the documented commands:

```sh
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
```

The first pair exercises/checks role-memory implementation and saved learning material. The second pair runs work-pilot tool regression tests and checks preserved runs. These are local scripts; the pilot report says the checker re-evaluates stored state/files and does not call a model. The tracker is a state-changing tool, not a general agent: inspect its contract with `{"op":"describe"}` before requests. The report also documents `tracker.py STATE.json REQUEST.json`, and a renderer command for the preserved review data. Do not treat a check of artifacts as semantic correctness or a fresh model run.

## What the results establish—and do not

The README reports 25 passing work-tool tests and five final structural checks; the pilot explains that these validate bounded tool/state/artifact conditions, not universal task success. The memory pilot observed retrieval into new-worker input and tested adapter paths. It did not establish that retrieved lessons caused better results, that refined lessons outperform source experiences, long-term/general learning, total-token efficiency, total cost superiority, or human time savings. Calls/logs are incomplete or non-comparable for total cost, and human review time was not measured. A count of passing tests is not evidence of saved human time.

## Decision boundary and next bounded verification

Continue technical review, validation, adoption, and revocation of technical lessons within the existing role-learning goals and authorized scope; the evidence does not justify a universal new human-approval gate for technical learning. Keep failures and scope limits visible. By contrast, sharing private role memory beyond its authorized scope changes permission: it is not already authorized and requires a human decision. The expertise proposal itself is under review and does not authorize implementation or publication.

Next, run the existing memory tests/checker and inspect the concrete adapter scope and lesson lifecycle. Then define one bounded comparison with controlled inputs, preserving initial failures and comparing retrieval conditions without claiming causation beyond the design. Record outcomes and measure model/tool and human review costs separately. Do not implement the expertise proposal or publish private memory as part of this handover; routing accuracy and broader memory benefit remain open verification questions.
