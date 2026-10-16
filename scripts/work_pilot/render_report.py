#!/usr/bin/env python3
"""Render a work-pilot result JSON file as a self-contained Korean HTML report."""
import html
import json
import posixpath
import sys
from pathlib import Path


def _text(value, fallback="미측정"):
    if value is None or value == "":
        return fallback
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, indent=2)
    return str(value)


def _safe_href(value):
    """Allow only relative local artifact paths, never URLs or traversal."""
    if not isinstance(value, str) or not value or value.startswith(("/", "\\")):
        return None
    if any(ord(char) < 32 or ord(char) == 127 for char in value) or "%" in value:
        return None
    norm = posixpath.normpath(value.replace("\\", "/"))
    if norm == ".." or norm.startswith("../") or ":" in norm:
        return None
    return norm


def _cell(value):
    return html.escape(_text(value)).replace("\n", "<br>")


def render(data, output_html):
    if not isinstance(data, dict):
        raise ValueError("결과 데이터는 JSON 객체여야 합니다")
    title = html.escape(_text(data.get("title"), "MAGI 작업 보고서"))
    goal = _cell(data.get("goal"))
    decomposition = data.get("decomposition") or {}
    runs = data.get("runs") or []
    limitations = data.get("limitations") or []
    lessons = data.get("lessons") or []
    deliverable_links = []
    for item in data.get("deliverables") or []:
        path = _safe_href(item.get("path"))
        if path:
            deliverable_links.append(f'<li><a href="{html.escape(path, quote=True)}">{_cell(item.get("label"))}</a></li>')
    deliverable_section = ('<section><h2>지금 열어볼 결과물</h2><ul>' + ''.join(deliverable_links) + '</ul></section>') if deliverable_links else ''
    alternatives = decomposition.get("alternatives") or []
    children = decomposition.get("children") or []

    run_rows = []
    for run in runs:
        links = []
        for link in run.get("artifact_links") or []:
            path = _safe_href(link)
            if path:
                links.append(f'<a href="{html.escape(path, quote=True)}">{html.escape(path)}</a>')
        run_rows.append(
            "<tr>" + "".join([
                f"<td>{_cell(run.get('id'))}</td>",
                f"<td>{_cell(run.get('condition'))}</td>",
                f"<td>{'통과' if run.get('passed') is True else ('실패' if run.get('passed') is False else '미측정')}</td>",
                f"<td>{_cell(run.get('checks'))}</td>",
                f"<td>{_cell(run.get('elapsed_seconds'))}</td>",
                f"<td>{_cell(run.get('model_tokens'))}</td>",
                f"<td>{'<br>'.join(links) if links else '미측정'}</td>",
            ]) + "</tr>"
        )
    if not run_rows:
        run_rows.append('<tr><td colspan="7">실행 기록 없음</td></tr>')

    def items(values, empty="미측정"):
        return "".join(f"<li>{_cell(v)}</li>" for v in values) or f"<li>{empty}</li>"

    child_items = []
    for child in children:
        if isinstance(child, dict):
            child_items.append(f"<li><strong>{_cell(child.get('id') or child.get('title'))}</strong>: {_cell(child.get('responsibility') or child.get('goal'))}</li>")
        else:
            child_items.append(f"<li>{_cell(child)}</li>")
    lesson_items = []
    for lesson in lessons:
        if isinstance(lesson, dict):
            lesson_items.append(f"<li><strong>{_cell(lesson.get('observation'))}</strong> → {_cell(lesson.get('change'))} <span class=\"evidence\">({_cell(lesson.get('evidence'))})</span></li>")
        else:
            lesson_items.append(f"<li>{_cell(lesson)}</li>")

    document = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title><style>
:root{{color-scheme:light;--ink:#1f2937;--muted:#64748b;--line:#dbe3ea;--accent:#0f766e;--bg:#f8fafc}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.55}}
main{{max-width:920px;margin:auto;padding:24px 16px 48px}}section{{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:14px 0;overflow-wrap:anywhere}}
h1{{font-size:clamp(1.45rem,5vw,2.1rem);margin:0 0 8px}}h2{{font-size:1.15rem;margin:0 0 10px;color:var(--accent)}}p{{margin:6px 0}}.label{{color:var(--muted);font-size:.88rem}}table{{width:100%;border-collapse:collapse;font-size:.9rem;display:block;overflow-x:auto}}th,td{{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top;min-width:90px}}th{{background:#f1f5f9;white-space:nowrap}}ul{{padding-left:20px;margin:6px 0}}a{{color:#0369a1}}.evidence{{color:var(--muted);font-size:.9em}}
</style></head><body><main>
<header><p class="label">MAGI 작업 파일럿 · 사용자 검토용</p><h1>{title}</h1><p><strong>목표</strong><br>{goal}</p></header>
{deliverable_section}
<section><h2>선택된 분해</h2><p>{_cell(decomposition.get('selected'))}</p><p class="label">경쟁안</p><ul>{items(alternatives)}</ul><p class="label">하위 책임</p><ul>{''.join(child_items) or '<li>미측정</li>'}</ul></section>
<section><h2>실행 조건과 결과</h2><table><thead><tr><th>실행</th><th>조건</th><th>결과</th><th>검사</th><th>경과 초</th><th>토큰</th><th>산출물</th></tr></thead><tbody>{''.join(run_rows)}</tbody></table></section>
<section><h2>실패·복구와 제한</h2><ul>{items(limitations)}</ul></section>
<section><h2>다음 작업으로 남긴 경험</h2><ul>{''.join(lesson_items) or '<li>미측정</li>'}</ul></section>
</main></body></html>"""
    output = Path(output_html)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(document, encoding="utf-8")


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 2:
        print("사용법: render_report.py RESULTS.json OUTPUT.html", file=sys.stderr)
        return 2
    try:
        data = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
        render(data, argv[1])
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
