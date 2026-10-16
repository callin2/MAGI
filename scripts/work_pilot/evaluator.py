#!/usr/bin/env python3
"""Independent, read-only checks for a work-pilot case."""
import hashlib
import json
import sys
from pathlib import Path


def _norm(value):
    return " ".join(str(value).split()).casefold()


def _result(case_id, checks):
    return {"case_id": case_id, "passed": all(c["passed"] for c in checks),
            "checks": checks, "evidence_scope": "local-tool-action"}


def evaluate(case, workspace):
    root = Path(workspace).resolve()
    checks = []
    def check(kind, passed, detail):
        checks.append({"kind": kind, "passed": bool(passed), "detail": detail})

    try:
        state_path = root / "state.json"
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return _result(case.get("id", "unknown"), [{"kind": "state", "passed": False,
            "detail": f"cannot load state: {exc}"}])

    issues = state.get("issues")
    valid = isinstance(issues, list) and state.get("schema_version") == 1
    valid = valid and all(isinstance(i, dict) for i in issues) if isinstance(issues, list) else False
    ids = [i.get("id") for i in issues] if valid else []
    valid = valid and all(isinstance(i, str) and bool(i.strip()) for i in ids)
    valid = valid and len(ids) == len(set(ids))
    if valid:
        id_set = set(ids)
        valid = all((i.get("parent_id") is None or i.get("parent_id") in id_set) and
                    isinstance(i.get("goal"), str) and bool(i.get("goal").strip()) and
                    i.get("status") in {"open", "done"} and
                    isinstance(i.get("acceptance"), list) and
                    all(isinstance(a, str) and bool(a.strip()) for a in i.get("acceptance"))
                    for i in issues)
        parent = {i["id"]: i.get("parent_id") for i in issues}
        def acyclic(node, visiting, done):
            if node in visiting:
                return False
            if node in done:
                return True
            visiting.add(node)
            p = parent.get(node)
            if p is not None and not acyclic(p, visiting, done):
                return False
            visiting.remove(node)
            done.add(node)
            return True
        done = set()
        valid = valid and all(acyclic(i, set(), done) for i in ids)
        if valid:
            # A completed ancestor cannot contain an open descendant.
            for issue in issues:
                if issue.get("status") != "open":
                    continue
                current = issue.get("parent_id")
                seen = set()
                while current is not None and current not in seen:
                    seen.add(current)
                    parent_issue = next(i for i in issues if i.get("id") == current)
                    if parent_issue.get("status") == "done":
                        valid = False
                        break
                    current = parent_issue.get("parent_id")
                if not valid:
                    break
    check("state_valid", valid, "schema_version=1 and unique issue ids")
    if not valid:
        return _result(case.get("id", "unknown"), checks)

    by_goal = {}
    by_id = {i.get("id"): i for i in issues}
    for issue in issues:
        by_goal.setdefault(_norm(issue.get("goal", "")), []).append(issue)

    # Completion evidence is independently verified for every done issue.
    for issue in issues:
        if issue.get("status") != "done":
            continue
        evidence_ok = bool(issue.get("evidence"))
        for ev in issue.get("evidence", []):
            try:
                path = (root / ev["path"]).resolve()
                path.relative_to(root)
                evidence_ok = evidence_ok and path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == ev["sha256"]
            except (KeyError, OSError, ValueError):
                evidence_ok = False
        check("declared_evidence", evidence_ok, f"issue {issue.get('id')} evidence hashes")

    specs = case.get("checks")
    if not isinstance(specs, list) or not specs:
        check("checks_present", False, "at least one check is required")
        return _result(case.get("id", "unknown"), checks)
    for spec in specs:
        kind = spec.get("kind")
        if kind == "goal_exists":
            matches = by_goal.get(_norm(spec.get("goal")), [])
            parent_goal = spec.get("parent_goal")
            passed = bool(matches)
            if passed and parent_goal is not None:
                parent_ids = {i.get("id") for i in by_goal.get(_norm(parent_goal), [])}
                passed = any(i.get("parent_id") in parent_ids for i in matches)
            check(kind, passed, f"goal={spec.get('goal')}")
        elif kind == "unique_goal":
            matches = by_goal.get(_norm(spec.get("goal")), [])
            check(kind, len(matches) == 1, f"matches={len(matches)}")
        elif kind == "status":
            matches = by_goal.get(_norm(spec.get("goal")), [])
            check(kind, len(matches) == 1 and matches[0].get("status") == spec.get("status"),
                  f"expected={spec.get('status')}")
        elif kind == "artifact_contains":
            try:
                path = (root / spec["path"]).resolve()
                path.relative_to(root)
                text = path.read_text(encoding="utf-8")
                passed = spec.get("text", "") in text
            except (KeyError, OSError, ValueError):
                passed = False
            check(kind, passed, f"path={spec.get('path')}")
        elif kind == "artifact_nonempty":
            try:
                path = (root / spec["path"]).resolve()
                path.relative_to(root)
                passed = path.is_file() and bool(path.read_text(encoding="utf-8"))
            except (KeyError, OSError, UnicodeError, ValueError):
                passed = False
            check(kind, passed, f"path={spec.get('path')}")
        elif kind == "descendant_goal":
            descendants = by_goal.get(_norm(spec.get("goal")), [])
            ancestors = by_goal.get(_norm(spec.get("ancestor_goal")), [])
            ancestor_ids = {i.get("id") for i in ancestors}
            passed = False
            for issue in descendants:
                seen = set()
                current = issue
                while current.get("parent_id") is not None and current.get("id") not in seen:
                    seen.add(current.get("id"))
                    parent = by_id.get(current.get("parent_id"))
                    if parent is None:
                        break
                    if parent.get("id") in ancestor_ids:
                        passed = True
                        break
                    current = parent
                if passed:
                    break
            check(kind, passed, f"goal={spec.get('goal')} ancestor={spec.get('ancestor_goal')}")
        elif kind == "no_done_without_evidence":
            passed = all(i.get("status") != "done" or bool(i.get("evidence")) for i in issues)
            check(kind, passed, "all done issues have evidence")
        else:
            check(kind or "unknown", False, "unknown check kind")
    return _result(case.get("id", "unknown"), checks)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 2:
        print(json.dumps({"error": "usage: evaluator.py CASE.json WORKSPACE"}))
        return 1
    try:
        case = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
        result = evaluate(case, argv[1])
        print(json.dumps(result, ensure_ascii=False))
        return 0 if result["passed"] else 1
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
