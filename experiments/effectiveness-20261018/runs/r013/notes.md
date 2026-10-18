# MAGI handover — current evidence, not the draft

The draft overstates what exists. The current material documents small working scripts and pilots, not a deployed general-purpose natural-language planning runtime. The README explicitly says a general engine/model-connected runtime and automatic change detection are not implemented. Nor do 25 passing tool tests prove memory benefit or human time saved.

## What can be used now

The documented role-memory SQLite/JSON adapter supports tested storage, retrieval, scope, and revocation paths. The work-pilot scripts perform tracker/workflow operations, independent checks, and report rendering. These are bounded local tools; they are not a sandbox for unrestricted worker file access, a general planner, or proof of semantic correctness. The pilot report records actual recursive task execution, integration repair, artifacts, and transfer trials, while also retaining initial failures and limitations. Memory retrieval into a worker input was observed; causal contribution of the retrieved lesson remains unknown.

## Try the existing checks

From the repository root, using the existing scripts described in the supplied extracts:

```sh
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
python3 scripts/check_pilot.py --check
```

For the work tracker CLI, first ask its contract with a request containing `{"op":"describe"}`, then use a request JSON file and workspace state file:

```sh
python3 scripts/work_pilot/tracker.py /absolute/workspace/state.json /absolute/request.json
```

The saved pilot checks validate preserved artifacts/state; they do not call a model or produce a fresh run. The 25 passing tests are failure-oriented tests of work-tool behavior and invariants, not 25 demonstrations that memory improves outcomes. The documented saved-run checks (16/16 and 17/17 for specified runs) verify structural/state/file conditions, not the truth of every technical judgment. Initial failures and their repaired outcomes are preserved. Tests therefore support that particular tested paths work; they do not establish general reliability, expert routing, memory benefit, causal learning, or human-time savings.

## Claims and boundary

The role-memory adapter and work tools are implemented in the bounded senses above. A general runtime is explicitly absent. Expert discovery/querying is a proposal under review, not a deployed routing feature. Memory quality and benefit remain unproven, and human time/cost were not measured sufficiently to claim savings or overall efficiency.

Technical validation, correction, adoption review, and revocation of technical lessons may proceed within existing technical goals and contracts; there is no blanket requirement to seek new human approval for every technical memory action. That does not grant new permissions: publishing private role memory outside its authorized scope is a distinct permission change and requires a human decision. Do not implement or publish that proposal here.

## Next bounded verification

Run the existing role-memory and work-pilot checks in the intended local environment; inspect the recorded scope/retrieval/revocation behavior and independently review what a retrieved lesson actually says. Record failures as well as passes. Then run one pre-bounded comparison of new tasks with and without an authorized lesson, preserving inputs, outputs, and cost/time measures, and assess semantic correctness separately from tool-state checks. This would test a limited causal hypothesis, not prove general benefit. Keep any private memory within its current authorized scope; obtain a human permission decision before any broader publication. Expert-routing research remains a separate proposal task, not a prerequisite or feature to claim now.
