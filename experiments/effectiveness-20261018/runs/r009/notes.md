# MAGI handover — current evidence

The draft overstates the public source record. MAGI is a research contract and small real-AI pilot, not a deployed general natural-language planning or model-routing runtime. The README explicitly says a general engine, model-connection runtime, and automatic change detection are not implemented. The recursive pilot demonstrates a bounded workflow with task tools, an independent checker, a review screen, integration repair, and actual artifact completion—not an unrestricted runtime, general autonomy, or guaranteed product behavior.

## What can be used now

- A small SQLite/JSON role-memory adapter has implemented storage, retrieval, scope, and revocation paths, with existing pilot/test scripts. The source reports these paths tested, but not independent memory benefit, long-term improvement, or whole-task token efficiency.
- The recursive work-pilot scripts can run and check the preserved work. From the repository root, the supplied README lists:

```sh
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
python3 scripts/work_pilot/tracker.py /absolute/workspace/state.json /absolute/request.json
```

The tracker accepts JSON requests; begin with `{"op":"describe"}` to inspect its operation contract. `check_runs.py` checks preserved task state and artifacts; it does not call a model or create new responses. The pilot report describes 25 passing failure-oriented tool tests and final structural checks (16/16 and 17/17 for the reported tasks). These are evidence about those tools and recorded runs, not semantic certification of every document or general planning ability.

For role memory, the README lists:

```sh
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
```

These are bounded checks of the existing adapter/pilot. The sources do not establish a deployed universal memory service or that a retrieved lesson caused a better result. In the recursive pilot, an input receipt showed experience was included for a new worker, while causal use remained unknown. Initial failures, checker error, and recovery were retained; tool-contract improvements let all four conditions pass, so that outcome cannot be attributed to lesson memory.

## Claims and limits

The general runtime is planned, not implemented. Expert discovery/routing is a proposal under review (#23); no implementation or routing benefit is evidenced. Memory benefit and human time saved are unproven. The report explicitly says human review time and token/billing costs were not measured; CLI tool duration is neither model time nor total task time. The remembered integration lessons supplied with this assignment are not evidence that these broader claims are true.

## Decision boundary and next bounded verification

Proceed with technical validation of already authorized adapter and work-tool behavior, including testing the existing scope/revocation paths. This does not itself change what may be shared. A request to publish private role memory outside its authorized scope is a new permission/value decision for a human; do not implement or publish it absent that decision.

Next bounded step: pre-specify one new, narrow task and a comparison that separates retrieval from outcome (for example, an otherwise matched no-retrieval condition); retain inputs, outputs, scope/access checks, and failures, and independently assess task correctness. Verify revocation remains effective within the existing authorization. Report sample size and limitations, and make no causal benefit claim from retrieval receipt alone. Separately measure human review time and total cost before any time-saving claim. Expert routing requires its own bounded comparison, including wrong/stale recommendations and conflicts; the proposal is not a result.

Sources reviewed: `current-readme.md`, `current-pilot.md`, and `expertise-proposal.md`.