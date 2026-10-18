# MAGI handover: what is usable now

## Current state, not the draft's claim

The current public extracts describe a small, local work-pilot toolset and an experimental role-memory adapter—not a deployed general natural-language planning runtime. The README explicitly says a general engine, model-connection runtime, and automatic change detection are not implemented. The pilot demonstrates recursive work decomposition, execution, repair, independent checking, and experience lookup in bounded local tasks. It does not establish general autonomy or a product guarantee.

The SQLite/JSON role-memory adapter supports saving and retrieving scoped role experience, with tested scope and revocation paths; the pilot reports a retrieval receipt showing experience was supplied to a new worker. That proves a mechanism was exercised, not that a lesson caused a better result. The pilot explicitly leaves lesson quality, causal benefit, long-term improvement, broad transfer, and total token efficiency unproved. It reports 25 passing failure-oriented tool tests and structural checks of completed pilot work. Those checks validate tool/state/artifact invariants—not general planning, semantic correctness, memory benefit, or human time saved. Human review time and model/token billing were not measured.

Expertise-aware agent questioning and routing are a proposal under review, not a delivered capability. The proposal identifies questions and evaluation needs; its registration does not complete the investigation or prove expert recommendations work.

## Try the existing scripts

From a MAGI checkout, with Python 3 and standard library:

```sh
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
```

The first command runs the work-pilot tool tests; `check_runs.py` checks preserved pilot state and artifacts, not a fresh model run. The role-memory test exercises the adapter; the checker validates preserved learning-pilot material. These scripts do not by themselves demonstrate a memory-caused performance gain or invoke a general planning runtime. For the separate saved pilot evidence, the README also documents `python3 scripts/check_pilot.py --check` and `python3 scripts/check_pilot_002.py --check`; these inspect saved materials, not fresh AI responses.

The work tool CLI accepts a state JSON path and request JSON path:

```sh
python3 scripts/work_pilot/tracker.py /absolute/workspace/state.json /absolute/request.json
```

Start by requesting `{"op":"describe"}` to inspect the supported request contract. This is a local state-changing tool when given mutation requests, not a model runtime or OS sandbox. Review outputs and hashes; structural success is not semantic endorsement.

## Next bounded verification

Within the existing learning goals, run one small, pre-specified comparison of no-memory versus authorized scoped-memory conditions on a fixed task set. Preserve initial failures, inputs, retrieved lesson records, tool/output logs, evaluation rubric, and checker results; include misleading or irrelevant retrieval and examine whether behavior actually changes in a beneficial way. Keep the scope private and authorized. Separately capture complete model/token or billing and human-review effort before making efficiency or time-saving claims. For expert routing, first validate a narrowly scoped simulation or review protocol covering wrong/stale experts, conflicts, cycles, and revocation; do not report proposal status as deployed routing.

Technical judgment, validation, and adoption or revocation of a technical lesson within existing authorized goals do not require a newly invented universal human approval gate. A genuinely new preference, value choice, or permission boundary remains a human decision. In particular, a request to publish private role memory outside its authorized scope is not authorized by the adapter's existence or by this proposal; do not implement or publish it without explicit human permission.