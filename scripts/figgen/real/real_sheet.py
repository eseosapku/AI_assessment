"""The real-image sample sheet (P1b): what passed, with credits and questions, what was turned away, and the writers compared.

Run from the repo root:  python scripts/figgen/real/real_sheet.py [--per-topic 12] [--out PATH]
Writes one self-contained page (images inlined as 512 px JPEGs), by default to
<FIGURE_LIBRARY_DIR>/reports/p1b-samples.html. It follows the artifact page contract.
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from html import escape
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from figgen.store import library_dir, open_store  # noqa: E402

# The writers' model ids, as scripts/figure-library/claude.ts names them.
HAIKU = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
SONNET = "eu.anthropic.claude-sonnet-5-5"
JOBS = {HAIKU: "p1b-blind-haiku", SONNET: "p1b-blind-sonnet"}
NAMES = {HAIKU: "Haiku", SONNET: "Sonnet"}
LEVELS = {"P": "Primary", "LS": "Lower Secondary", "UP": "Upper Secondary", "AL": "A Level"}

CSS = """
:root{--paper:#f4f3ee;--card:#ffffff;--ink:#1c1e21;--muted:#5d6369;--rule:#dad6cb;--key:#1b6843;--key-bg:#e0efe5;
--fail:#a1301c;--fail-bg:#f5e2dc;--accent:#2f5d8a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#141619;--card:#1d2024;--ink:#e6e4df;
--muted:#a0a5ab;--rule:#31353a;--key:#80d0a3;--key-bg:#1a3024;--fail:#ee917d;--fail-bg:#391e19;--accent:#8fb8e3;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#141619;--card:#1d2024;--ink:#e6e4df;--muted:#a0a5ab;--rule:#31353a;--key:#80d0a3;
--key-bg:#1a3024;--fail:#ee917d;--fail-bg:#391e19;--accent:#8fb8e3;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font:15px/1.55 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1200px;margin:0 auto;padding-inline:16px;padding-block:32px 72px;display:flex;flex-direction:column;gap:40px}
h1,h2{font-family:"Newsreader",Georgia,"Times New Roman",serif;font-weight:600;text-wrap:balance;margin:0;line-height:1.15}
h1{font-size:clamp(28px,5vw,40px)}
h2{font-size:24px}
a{color:var(--accent)}
.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:var(--muted);margin:0 0 8px}
.lede{max-width:70ch;color:var(--muted);margin:12px 0 0}
.funnel{display:flex;flex-wrap:wrap;gap:12px;margin:0;padding:0;list-style:none}
.funnel li{background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:10px 14px;min-width:0}
.funnel b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
.table-wrap{overflow-x:auto;border:1px solid var(--rule);border-radius:6px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--rule)}
th{font-weight:600;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
tr:last-child td{border-bottom:0}
.topic{display:flex;flex-direction:column;gap:16px}
.meta{color:var(--muted);font-size:14px;margin:0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:20px}
.card{margin:0;background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:14px;display:flex;
flex-direction:column;gap:10px;min-width:0}
.card img{display:block;width:100%;height:auto;border-radius:3px;background:#fff}
.credit{font-size:12px;color:var(--muted);margin:0;overflow-wrap:anywhere}
.shows{font-size:13px;font-style:italic;color:var(--muted);margin:0}
.writer{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:4px 0 0}
.verdict{font-weight:600;padding:0 6px;border-radius:3px;font-size:12px}
.verdict.pass{color:var(--key);background:var(--key-bg)}
.verdict.fail{color:var(--fail);background:var(--fail-bg)}
ol.qs{margin:0;padding-left:1.3em;display:flex;flex-direction:column;gap:10px}
ol.qs p{margin:0}
ol.opts{margin:4px 0 0;padding-left:1.6em;list-style:upper-alpha;display:grid;gap:2px}
ol.opts li{padding:1px 6px;border-radius:3px}
ol.opts li.key{color:var(--key);background:var(--key-bg);font-weight:600}
.ans{color:var(--key);font-weight:600}
.out{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,150px),1fr));gap:12px}
.out figure{margin:0;font-size:12px;color:var(--muted);min-width:0}
.out img{width:100%;height:auto;border-radius:3px;opacity:.85}
.out figcaption{color:var(--fail);margin-top:4px}
"""


def image(lib: Path, key: str | None) -> str:
    file = lib / key if key else None
    if not file or not file.exists():
        return '<p class="credit">image missing</p>'
    return f'<img src="data:image/jpeg;base64,{base64.b64encode(file.read_bytes()).decode()}" alt="" loading="lazy">'


def questions_html(db, figure_id: str, model: str) -> str:
    items = []
    for q in db.execute("SELECT kind, stem, options, answer, accepted FROM figure_questions WHERE figure_id = ? AND model = ? ORDER BY n",
                        (figure_id, model)):
        if q["kind"] == "mcq":
            key = int(q["answer"])
            opts = "".join(f'<li class="key">{escape(o)}</li>' if i == key else f"<li>{escape(o)}</li>"
                           for i, o in enumerate(json.loads(q["options"])))
            items.append(f'<li><p>{escape(q["stem"])}</p><ol class="opts">{opts}</ol></li>')
        else:
            also = json.loads(q["accepted"])[1:]
            extra = f' <span class="credit">(also: {escape("; ".join(also))})</span>' if also else ""
            items.append(f'<li><p>{escape(q["stem"])}</p><p class="ans">Answer: {escape(q["answer"])}{extra}</p></li>')
    return f'<ol class="qs">{"".join(items)}</ol>' if items else '<p class="credit">No question kept.</p>'


def verdict_html(db, figure_id: str, model: str) -> str:
    row = db.execute("SELECT pass FROM reviews WHERE job = ? AND figure_id = ?", (JOBS[model], figure_id)).fetchone()
    if row is None:
        return ""
    return f' <span class="verdict {"pass" if row["pass"] else "fail"}">blind review {"passed" if row["pass"] else "failed"}</span>'


def clean(db, job: str) -> tuple[int, int, int]:
    figures = questions = good = 0
    for (detail,) in db.execute("SELECT detail FROM reviews WHERE job = ?", (job,)):
        v = json.loads(detail)
        figures += 1
        for q in v.get("questions", []):
            questions += 1
            good += int(bool(v.get("figureClear") and v.get("educational") and q.get("keyCorrect") and q.get("answerable") and q.get("singleAnswer")))
    return figures, questions, good


def card(db, lib: Path, f) -> str:
    spec = json.loads(f["spec"] or "{}")
    title = spec.get("title", "").removeprefix("File:").rsplit(".", 1)[0]
    licence = escape(f["licence"] or "")
    lic = f'<a href="{escape(spec["licence_url"])}">{licence}</a>' if spec.get("licence_url") else licence
    credit = (f'<p class="credit">{escape(title)} by {escape(f["author"] or "an unknown author")} &middot; {lic} &middot; '
              f'<a href="{escape(f["source_url"] or "")}">Wikimedia Commons</a></p>')
    parts = [image(lib, f["preview"]), credit, f'<p class="shows">Screener: {escape(f["shows"])}</p>']
    for model in (HAIKU, SONNET):
        if db.execute("SELECT 1 FROM question_checks WHERE figure_id = ? AND writer = ?", (f["id"], model)).fetchone():
            parts.append(f'<p class="writer">{NAMES[model]}{verdict_html(db, f["id"], model)}</p>{questions_html(db, f["id"], model)}')
    return f'<figure class="card">{"".join(parts)}</figure>'


def build_real_sheet(db, lib: Path, per_topic: int = 12) -> str:
    harvested = db.execute("SELECT COUNT(*) FROM figures WHERE origin <> 'drawn'").fetchone()[0]
    screened = db.execute("SELECT COUNT(*), COALESCE(SUM(keep), 0) FROM screenings").fetchone()
    written = db.execute("SELECT COUNT(*), COALESCE(SUM(keep), 0) FROM question_checks WHERE writer = ? AND question_id NOT LIKE '%#0'",
                         (HAIKU,)).fetchone()
    with_q = db.execute("SELECT COUNT(DISTINCT figure_id) FROM figure_questions WHERE model = ?", (HAIKU,)).fetchone()[0]
    funnel = [("harvested", harvested), ("kept by the screen", screened[1]), ("questions Haiku wrote", written[0]),
              ("kept by its check", written[1]), ("images with a kept question", with_q)]
    rows = []
    for model in (HAIKU, SONNET):
        figures, questions, good = clean(db, JOBS[model])
        rate = f"{100 * good / questions:.0f}%" if questions else "&ndash;"
        rows.append(f"<tr><td>{NAMES[model]}</td><td>{figures}</td><td>{good}/{questions}</td><td>{rate}</td></tr>")
    sections = []
    for t in db.execute("SELECT DISTINCT t.key, t.name, t.subject, t.band FROM topics t JOIN figure_topics ft ON ft.topic_key = t.key "
                        "JOIN figures f ON f.id = ft.figure_id WHERE f.origin <> 'drawn' ORDER BY t.subject, t.name").fetchall():
        passed = db.execute(
            "SELECT f.*, s.shows FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id JOIN screenings s ON s.figure_id = f.id "
            "WHERE ft.topic_key = ? AND s.keep = 1 AND EXISTS (SELECT 1 FROM figure_questions q WHERE q.figure_id = f.id) "
            "ORDER BY EXISTS (SELECT 1 FROM reviews r WHERE r.figure_id = f.id AND r.job LIKE 'p1b-blind-%') DESC, f.id LIMIT ?",
            (t["key"], per_topic)).fetchall()
        out = db.execute(
            "SELECT f.preview, f.reason FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id JOIN screenings s ON s.figure_id = f.id "
            "WHERE ft.topic_key = ? AND s.keep = 0 ORDER BY f.id LIMIT 8", (t["key"],)).fetchall()
        counts = db.execute("SELECT COUNT(*), COALESCE(SUM(s.keep), 0) FROM figure_topics ft JOIN screenings s ON s.figure_id = ft.figure_id "
                            "WHERE ft.topic_key = ?", (t["key"],)).fetchone()
        strip = "".join(f'<figure>{image(lib, o["preview"])}<figcaption>{escape(o["reason"] or "")}</figcaption></figure>' for o in out)
        sections.append(
            f'<section class="topic"><h2>{escape(t["name"])}</h2>'
            f'<p class="meta">{escape(t["subject"])} &middot; {LEVELS.get(t["band"], t["band"])} &middot; '
            f'{counts[1]} of {counts[0]} images kept by the screen</p>'
            f'<div class="cards">{"".join(card(db, lib, f) for f in passed)}</div>'
            + (f'<p class="meta">Turned away by the screen:</p><div class="out">{strip}</div>' if strip else "") + "</section>")
    stats = "".join(f"<li><b>{n}</b>{escape(label)}</li>" for label, n in funnel)
    return f"""<title>Real Image Samples</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Newsreader:opsz,wght@6..72,600&display=swap">
<style>{CSS}</style>
<main>
<header><p class="eyebrow">StudySquare figure library &middot; pilot P1b</p><h1>Real image samples</h1>
<p class="lede">Openly licensed images from Wikimedia Commons for six pilot topics. Files with the wrong licence, too small,
of a person, or a near-copy were turned away before download; Nova Lite then screened every image for the topic and level.
Haiku wrote questions on each image that passed and checked them in a second call. On a comparison set, Sonnet wrote too,
and Sonnet answered both writers' questions blind, without the keys. Correct options are marked in green. Each image
carries its credit: author, licence and source.</p></header>
<ul class="funnel">{stats}</ul>
<div class="table-wrap"><table><thead><tr><th>Writer</th><th>Images reviewed</th><th>Clean questions</th><th>Clean rate</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>
{"".join(sections)}
</main>
"""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Write the P1b real-image sample sheet")
    ap.add_argument("--per-topic", type=int, default=12)
    ap.add_argument("--out", default="")
    a = ap.parse_args(argv)
    lib = library_dir()
    db = open_store()
    out = Path(a.out) if a.out else lib / "reports" / "p1b-samples.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_real_sheet(db, lib, a.per_topic), encoding="utf-8")
    db.close()
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
