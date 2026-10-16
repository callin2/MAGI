import tempfile
import unittest
from pathlib import Path

from render_report import _safe_href, render


class ReportTests(unittest.TestCase):
    def test_only_relative_local_paths_are_links(self):
        self.assertEqual(_safe_href("report.md"), "report.md")
        for unsafe in ("javascript:alert(1)", "report\x00.md", "%2e%2e/secret", "C:/secret", "report\n.md"):
            self.assertIsNone(_safe_href(unsafe), unsafe)

    def test_html_is_escaped_and_self_contained(self):
        data = {"title": "<검토>", "goal": "a&b", "decomposition": {"selected": "A"}, "runs": [{"id": "r1", "passed": True, "artifact_links": ["report.md", "../secret", "https://bad"]}], "lessons": [{"observation": "관찰", "change": "개선", "evidence": "test"}]}
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "report.html"
            render(data, out)
            text = out.read_text(encoding="utf-8")
        self.assertIn("&lt;검토&gt;", text)
        self.assertIn('href="report.md"', text)
        self.assertNotIn("../secret", text)
        self.assertNotIn("https://bad", text)
        self.assertNotIn("<script", text.lower())

    def test_unknown_values_are_visible(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "report.html"
            render({"title": "x", "goal": "y"}, out)
            text = out.read_text(encoding="utf-8")
        self.assertIn("미측정", text)
        self.assertIn("실행 기록 없음", text)


if __name__ == "__main__":
    unittest.main()
