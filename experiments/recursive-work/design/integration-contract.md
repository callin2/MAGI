# Recursive MAGI work pilot integration contract v1

Parent #19. Concrete delegated intellectual work: build a useful runnable local validation package for real goal-to-action work, then run fresh LLM workers against it. This is research tooling and a demonstrated workflow, not a hosted general agent engine.

Python standard library only. Files under scripts/work_pilot/. CLI: python3 scripts/work_pilot/tracker.py STATE.json request.json; prints one JSON result, errors return 1 with {error}. Every operation must preserve prior state on error; writes atomic. State has schema_version=1, revision, issues list, audit list. Requests:
- init: {op:"init",issues:[{id,title,goal,parent_id:null|string,acceptance:[str],status:"open"|"done",evidence:[str]}]}; refuse overwrite.
- list: {op:"list"}; returns full issues and revision. read does not bump.
- create: {op:"create",title,goal,parent_id,acceptance:[str]}; nonempty strings required, parent must exist if set. Reject exact normalized goal duplicate regardless title. Return issue with deterministic id Tn. Parent refs cannot cycle.
- complete: {op:"complete",id,evidence:[{path,sha256}]}; require existing regular files inside workspace root (state file parent), current hash match, nonempty acceptance, no open children. Store done/evidence. Evidence records are actual hash checks, not proof of all semantics. No arbitrary commands executed.
- branch: {op:"branch",target}; copy exact state to a new nonexistent same-directory file, record branch origin revision. Reject traversal/absolute target and overwrite. Do not change source revision.
- show: {op:"show",id}.
- register_followups: {op:"register_followups",parent_id,actions:[{title,goal,acceptance}]}; atomically create missing normalized goals, reuse matching existing ones; return created_ids,reused_ids. No partial writes on any invalid action. If reused existing goal has a different parent, return conflict, not silent reassignment.

Task worker interacts only with CLI and assigned workspace artifact files, reports exact created/reused/completed ids, no exposure to evaluation answers. Actual requested actions and file artifacts are scored from state and hashes.

Cases file JSON: {schema_version:1,cases:[{id,goal,seed_issues:[issue],input_files:{relative_path:text},checks:[{kind:"goal_exists",goal,parent_goal}|{kind:"unique_goal",goal}|{kind:"status",goal,status}|{kind:"artifact_contains",path,text}|{kind:"no_done_without_evidence"}],expected_claim_scope:"local-tool-action"}]}.

Checker module evaluator.py callable evaluate(case, workspace)-> {case_id,passed,checks:[{kind,passed,detail}],evidence_scope}. Loads workspace/state.json, rejects invalid state/duplicate ids, verifies declared hashes for completed issues; checks are conjunctive, unknown check fails. Check final files path contained in workspace. Goal lookup normalized whitespace/casefold. Independent of worker self-report. Does not mutate state. CLI evaluator.py CASE.json WORKSPACE prints result.

Report module render_report.py callable render(data,output_html). Data: {title,goal,decomposition:{selected,alternatives,children},runs:[{id,condition,passed,checks,elapsed_seconds,model_tokens,artifact_links}],limitations:[str],lessons:[{observation,change,evidence}]}. Render self-contained escaped HTML with readable Korean overview, conditions/results table, task decomposition, failure/recovery, limitations, linked local artifacts only when relative safe. No external assets/scripts/network. Unknown values visibly 미측정. CLI render_report.py RESULTS.json OUTPUT.html.

Tests should target rollback, dedup semantic key, wrong parent, forged/missing evidence, branch isolation, path traversal, evaluator rejects false completion, HTML escaping. No new dependencies or framework. Leaf worker may split internal code/test responsibility if needed, but keep file ownership. Main owns integration and final claim.
