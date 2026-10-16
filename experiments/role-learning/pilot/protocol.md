# #16 role-learning exploratory protocol

Fixed before learning/trial calls. Synthetic Delta API traces, not claims about a real service.

Question: does an LLM extract conditional reusable lessons from experience, can the adapter persist them and supply them to clean new role executions, and do answers differ from no-memory and raw-log?

One fixed post-task reflection procedure produces candidate JSON without a new human remember command. This is instructed workflow learning, not spontaneous weight updates. The coordinator does not handwrite the lessons. Validation checks source support and different-context counterexamples; generated validation labels alone are not performance evidence.

Three conditions none/log/lesson; 2 repetitions each; 4 cases in each fresh worker, grouped as one batch. Same inherited model/settings, fork_turns none. Workers see only their input and cannot browse. Three parallel conditions per repetition; no cross-arm opinions. No outcome-dependent stopping or case replacement.

Expected fields are held out of worker inputs; cases and scoring keys fixed together now. Training and test entities differ. Cases are small synthetic retention/transfer and context-change probes. none has less retained information, so this does NOT test equal-information reasoning superiority. log versus lesson tests representation at this tiny scale, not a generic framework claim.

Each answer: case id, action, fields, used_ids, confidence, need_clarification. A missing/incorrect required expected field is wrong. Stop/continue, wrong database id or retry dedup are separate errors. Changed context must not use Delta lessons. Count per-case correctness, errors, need_clarification (proxy only, no actual human re-explanation), unsupported high-confidence errors, changed-context violation, model calls and available usage. Character/byte counts are not tokens. Total model tokens/cost unavailable in collaboration tool -> unknown; do not claim equal total budgets or token savings. Record observed elapsed batch wall time separately from model generation/retrieval time.

Boundary tests: separate fresh processes verify binding/state/version/project/private isolation, grants/ungrant, conflict hold, revoke and replacement version, stale application receipts. These are adapter API checks, not OS sandbox proof.

After the main trials: remove one lesson as an ablation and rerun all cases in one fresh worker. Revoke that lesson, requery in a fresh process and run one further clean worker. Fixing a lesson is separately tested by replacement version. Main trial failures remain in report. Do not equate retrieval, self-reported use, answer correctness or before/after difference with causal general efficacy.

Success of plumbing: exact state/revision survives fresh processes and final answers link to receipts without leakage. Performance gain is supported only if observed correctness changes; no gain remains valid. Any leakage, revoked item in new retrieval or stale apply accepted fails the boundary test. Generalization/long-run validity and total token efficiency stay open if not measured. #11 criteria only completed to actual evidence scope.
