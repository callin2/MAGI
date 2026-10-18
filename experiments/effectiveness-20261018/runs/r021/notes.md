# MAGI handover — evidence-bounded

## What can be used now

This is a research project with working, bounded tools—not a deployed general natural-language planning runtime. The recursive-work pilot used a local Python tracker for explicit task decomposition, state changes, evidence hashes and completion; it also used a separate evaluator/review workflow. The pilot produced actual task artifacts, repaired integration failures and tested the tools. These tools do not sandbox arbitrary worker access or autonomously plan arbitrary goals. A small SQLite/JSON role-memory adapter supports saving, retrieving, scoping and revocation paths in the tested setup. Neither adapter existence nor retrieval proves that a remembered lesson improves a result.

Expertise-aware discovery and routing are a proposal under review, not a demonstrated deployed capability. Role labels and memory do not establish that an agent is genuinely expert or that a routed answer is correct.

## Try existing scripts

From the repository root, use the documented commands:

```sh
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
```

The pilot reports 25 passing tool tests and 5 final structure checks; the current README also points to the role-memory checks. These commands test code or re-evaluate preserved run artifacts. They do not call a model, create a new work run, or establish general runtime capability. Consult the current README and pilot report for additional stored-pilot checks. For tracker use, first query `{"op":"describe"}`; the documented CLI accepts a state path and request JSON path. Treat hashes as file-integrity evidence, not proof of the artifact's semantic correctness.

## What the tests mean—and do not mean

The 25 tests are failure-oriented tests of the work-tool implementation. The five final structure checks concern recorded pilot work. The report describes initial failures, evaluator corrections and successful reruns; preserving those failures is important evidence, not a reason to claim universal reliability. In the transfer pilot, each condition had one run, the task was small and self-related, tools changed during the work, and the improved tool contract helped all conditions. Therefore the results do not isolate a causal benefit from stored or extracted memory. Memory's independent benefit, long-term improvement, generalization and total cost remain unproven. Human review time was not measured; CLI tool duration is not human time or model time. No test proves that MAGI saves people time.

## Decision boundary and next bounded verification

Agents may conduct technical validation, adopt or revoke technical lessons within existing goals and authorized scope, recording sources and uncertainty. Do not impose a blanket new human-approval gate on that technical work. Conversely, a new preference/value choice or permission change is not implied by technical validation. In particular, publishing private role memory outside its authorized scope requires a human permission decision; do not implement or publish the proposal here.

Next, run the existing role-memory checks and inspect their bounded results, then undertake the proposal's bounded #23 comparison: ordinary search, role-specific memory/search, and expertise-based agent queries. Include wrong expert recommendations, stale knowledge, conflicts and revocation; assess answer grounding and changed task behavior, and record full model/token and human review costs separately. Preserve negative results and avoid claims of benefit until an appropriate comparison supports them. The proposal remains under review; no implementation or external publication is authorized by this handover.