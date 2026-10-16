import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from evaluator import evaluate


class EvaluatorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.artifact = self.root / "result.txt"
        self.artifact.write_text("완료 산출물", encoding="utf-8")
        digest = hashlib.sha256(self.artifact.read_bytes()).hexdigest()
        (self.root / "state.json").write_text(json.dumps({
            "schema_version": 1, "revision": 2, "issues": [{
                "id": "T1", "title": "goal", "goal": "Make result",
                "parent_id": None, "acceptance": ["artifact"], "status": "done",
                "evidence": [{"path": "result.txt", "sha256": digest}]
            }], "audit": []}), encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_passes_goal_status_artifact_and_evidence(self):
        case = {"id": "c1", "schema_version": 1, "checks": [
            {"kind": "goal_exists", "goal": " make   result "},
            {"kind": "status", "goal": "make result", "status": "done"},
            {"kind": "artifact_contains", "path": "result.txt", "text": "산출물"},
            {"kind": "no_done_without_evidence"}]}
        self.assertTrue(evaluate(case, self.root)["passed"])

    def test_rejects_forged_hash(self):
        state = json.loads((self.root / "state.json").read_text())
        state["issues"][0]["evidence"][0]["sha256"] = "0" * 64
        (self.root / "state.json").write_text(json.dumps(state))
        result = evaluate({"id": "c2", "checks": [{"kind": "no_done_without_evidence"}]}, self.root)
        self.assertFalse(result["passed"])

    def test_rejects_traversal_artifact(self):
        result = evaluate({"id": "c3", "checks": [{"kind": "artifact_contains", "path": "../result.txt", "text": "완료"}]}, self.root)
        self.assertFalse(result["passed"])

    def test_unknown_check_fails(self):
        result = evaluate({"id": "c4", "checks": [{"kind": "made_up"}]}, self.root)
        self.assertFalse(result["passed"])

    def test_duplicate_ids_rejected(self):
        state = json.loads((self.root / "state.json").read_text())
        state["issues"].append(dict(state["issues"][0]))
        (self.root / "state.json").write_text(json.dumps(state))
        self.assertFalse(evaluate({"id": "c5", "checks": []}, self.root)["passed"])

    def test_empty_checks_fail(self):
        self.assertFalse(evaluate({"id": "c6", "checks": []}, self.root)["passed"])

    def test_malformed_issue_state_fails_without_traceback(self):
        state = json.loads((self.root / "state.json").read_text())
        state["issues"] = [{"id": "", "goal": "", "status": "wat", "parent_id": "missing"}]
        (self.root / "state.json").write_text(json.dumps(state))
        result = evaluate({"id": "c7", "checks": [{"kind": "status", "goal": "x", "status": "done"}]}, self.root)
        self.assertFalse(result["passed"])

    def test_parent_cycle_fails(self):
        state = json.loads((self.root / "state.json").read_text())
        state["issues"] = [
            {"id": "A", "goal": "a", "status": "open", "parent_id": "B"},
            {"id": "B", "goal": "b", "status": "open", "parent_id": "A"},
        ]
        (self.root / "state.json").write_text(json.dumps(state))
        self.assertFalse(evaluate({"id": "c8", "checks": [{"kind": "no_done_without_evidence"}]}, self.root)["passed"])

    def test_descendant_goal_allows_intermediate_parent(self):
        state = json.loads((self.root / "state.json").read_text())
        state["issues"] = [
            {"id": "T1", "goal": "root", "status": "open", "parent_id": None, "acceptance": ["x"]},
            {"id": "T2", "goal": "middle", "status": "open", "parent_id": "T1", "acceptance": ["x"]},
            {"id": "T3", "goal": "leaf", "status": "open", "parent_id": "T2", "acceptance": ["x"]},
        ]
        (self.root / "state.json").write_text(json.dumps(state))
        result = evaluate({"id": "c9", "checks": [{"kind": "descendant_goal", "goal": "leaf", "ancestor_goal": "root"}]}, self.root)
        self.assertTrue(result["passed"])

    def test_artifact_nonempty_requires_contained_utf8_file(self):
        result = evaluate({"id": "c10", "checks": [{"kind": "artifact_nonempty", "path": "result.txt"}]}, self.root)
        self.assertTrue(result["passed"])
        (self.root / "empty.txt").write_text("", encoding="utf-8")
        result = evaluate({"id": "c11", "checks": [{"kind": "artifact_nonempty", "path": "empty.txt"}]}, self.root)
        self.assertFalse(result["passed"])

    def test_done_parent_with_open_descendant_fails(self):
        state = json.loads((self.root / "state.json").read_text())
        state["issues"] = [
            {"id": "T1", "goal": "parent", "status": "done", "parent_id": None, "acceptance": ["x"], "evidence": []},
            {"id": "T2", "goal": "child", "status": "open", "parent_id": "T1", "acceptance": ["x"], "evidence": []},
        ]
        (self.root / "state.json").write_text(json.dumps(state))
        result = evaluate({"id": "c12", "checks": [{"kind": "no_done_without_evidence"}]}, self.root)
        self.assertFalse(result["passed"])


if __name__ == "__main__":
    unittest.main()
