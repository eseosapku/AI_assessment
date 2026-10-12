"""The sample sheet for the user (spec 5.5): each drawn family's figures with their questions and answers.

Run from the repo root:
    python scripts/figgen/sample_sheet.py [--per-family 3] [--out PATH]

Writes one self-contained HTML page (figures inlined as PNG), by default to
<FIGURE_LIBRARY_DIR>/reports/p1a-samples.html. It follows the artifact page
contract, so it can be published as it is.
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from html import escape
from pathlib import Path

if __package__ in (None, ""):  # run as a script: make "figgen" importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from figgen.families import FAMILIES  # noqa: E402
from figgen.store import library_dir, open_store  # noqa: E402

REVIEW_SIZE, PASS_MARK = 30, 27  # spec 3.3, as in scripts/figure-library/review.ts
LEVELS = {"P": "Primary", "LS": "Lower Secondary", "UP": "Upper Secondary", "AL": "A Level"}

CSS = """
:root{--paper:#f5f4ef;--card:#ffffff;--ink:#1d1f22;--muted:#5c626a;--rule:#dcd8cd;--key:#1c6a44;--key-bg:#e1f0e6;
--fail:#a3311d;--fail-bg:#f6e3dd;--sheet:#ffffff}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#15171a;--card:#1e2125;--ink:#e7e5e0;
--muted:#a2a7ad;--rule:#32363b;--key:#83d3a6;--key-bg:#1b3125;--fail:#ef937f;--fail-bg:#3a1f1a;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#15171a;--card:#1e2125;--ink:#e7e5e0;--muted:#a2a7ad;--rule:#32363b;--key:#83d3a6;
--key-bg:#1b3125;--fail:#ef937f;--fail-bg:#3a1f1a;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font:15px/1.55 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding-inline:16px;padding-block:32px 72px;display:flex;flex-direction:column;gap:40px}
h1,h2{font-family:"Newsreader",Georgia,"Times New Roman",serif;font-weight:600;text-wrap:balance;margin:0;line-height:1.15}
h1{font-size:clamp(28px,5vw,40px)}
h2{font-size:24px}
.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:var(--muted);margin:0 0 8px}
.lede{max-width:68ch;color:var(--muted);margin:12px 0 0}
.table-wrap{overflow-x:auto;border:1px solid var(--rule);border-radius:6px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--rule);white-space:nowrap}
th{font-weight:600;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
tr:last-child td{border-bottom:0}
.family{display:flex;flex-direction:column;gap:16px}
.meta{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--muted);font-size:14px;margin:0}
.score{font-weight:600;padding:1px 8px;border-radius:4px}
.score.pass{color:var(--key);background:var(--key-bg)}
.score.fail{color:var(--fail);background:var(--fail-bg)}
.score.wait{color:var(--muted);background:transparent;border:1px solid var(--rule)}
.figs{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr));gap:20px}
.fig{margin:0;background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:14px;display:flex;
flex-direction:column;gap:12px;min-width:0}
.fig img{display:block;width:100%;height:auto;background:var(--sheet);border-radius:3px}
.missing{padding:24px;text-align:center;color:var(--fail);background:var(--fail-bg);border-radius:3px}
.fig figcaption{font-size:12px;color:var(--muted);font-family:ui-monospace,"Cascadia Mono",Consolas,monospace}
ol.qs{margin:0;padding-left:1.4em;display:flex;flex-direction:column;gap:12px}
ol.qs p{margin:0}
ol.opts{margin:6px 0 0;padding-left:1.6em;list-style:upper-alpha;display:grid;gap:2px}
ol.opts li{padding:1px 6px;border-radius:3px}
ol.opts li.key{color:var(--key);background:var(--key-bg);font-weight:600}
.ans{color:var(--key);font-weight:600;margin-top:4px!important}
.also{color:var(--muted);font-weight:400}
.notes{margin:0;padding:12px 14px 12px 2em;background:var(--fail-bg);border-radius:6px;font-size:14px}
.notes li+li{margin-top:4px}
"""


def title_of(family: str) -> str:
    return family.replace("_", " ").capitalize()


def score_of(reviewed: int, passed: int) -> tuple[str, str]:
    if not reviewed:
        return "not reviewed", "wait"
    if reviewed < REVIEW_SIZE:
        return f"{passed}/{reviewed} so far", "wait"
    return f"{passed}/{reviewed}", "pass" if passed >= PASS_MARK else "fail"


def card(db, lib: Path, f) -> str:
    file = lib / f["preview"] if f["preview"] else None
    if file and file.exists():
        data = base64.b64encode(file.read_bytes()).decode()
        image = f'<img src="data:image/png;base64,{data}" alt="{escape(f["id"])}" loading="lazy">'
    else:
        image = f'<div class="missing">image missing: {escape(str(f["preview"]))}</div>'
    items = []
    for q in db.execute("SELECT kind, stem, options, answer, accepted FROM figure_questions WHERE figure_id = ? ORDER BY n",
                        (f["id"],)):
        if q["kind"] == "mcq":
            key = int(q["answer"])
            options = "".join(f'<li class="key">{escape(o)}</li>' if i == key else f"<li>{escape(o)}</li>"
                              for i, o in enumerate(json.loads(q["options"])))
            items.append(f'<li><p>{escape(q["stem"])}</p><ol class="opts">{options}</ol></li>')
        else:
            also = json.loads(q["accepted"])[1:]
            extra = f' <span class="also">(also accepted: {escape("; ".join(also))})</span>' if also else ""
            items.append(f'<li><p>{escape(q["stem"])}</p><p class="ans">Answer: {escape(q["answer"])}{extra}</p></li>')
    return (f'<figure class="fig">{image}<figcaption>{escape(f["id"])}</figcaption>'
            f'<ol class="qs">{"".join(items)}</ol></figure>')


def build_sheet(db, lib: Path, per_family: int = 3, job: str = "p1a-blind") -> str:
    rows, sections = [], []
    for fid, m in FAMILIES.items():
        figs = db.execute("SELECT id, preview FROM figures WHERE origin = 'drawn' AND family = ? AND status != 'rejected' "
                          "ORDER BY seed LIMIT ?", (fid, per_family)).fetchall()
        rejected = db.execute("SELECT id, reason FROM figures WHERE origin = 'drawn' AND family = ? AND status = 'rejected' "
                              "ORDER BY seed", (fid,)).fetchall()
        if not figs and not rejected:
            continue
        topics = [r[0] for r in db.execute(
            "SELECT DISTINCT t.name FROM figure_topics ft JOIN topics t ON t.key = ft.topic_key "
            "JOIN figures f ON f.id = ft.figure_id WHERE f.family = ? ORDER BY t.name", (fid,))]
        bands = [LEVELS.get(r[0], r[0]) for r in db.execute(
            "SELECT DISTINCT band FROM figures WHERE family = ? ORDER BY band", (fid,))]
        total = db.execute("SELECT COUNT(*) FROM figures WHERE family = ?", (fid,)).fetchone()[0]
        reviewed, passed = db.execute(
            "SELECT COUNT(*), COALESCE(SUM(r.pass), 0) FROM reviews r JOIN figures f ON f.id = r.figure_id "
            "WHERE r.job = ? AND f.family = ?", (job, fid)).fetchone()
        score, state = score_of(reviewed, passed)
        name = escape(title_of(fid))
        rows.append(f"<tr><td>{name}</td><td>{escape(m.KIND)}</td><td>{escape(', '.join(bands))}</td>"
                    f"<td>{escape('; '.join(topics))}</td><td>{total}</td>"
                    f'<td><span class="score {state}">{escape(score)}</span></td></tr>')
        notes = ""
        if rejected:
            notes = ('<ul class="notes">' + "".join(f"<li><b>{escape(r['id'])}</b>: {escape(r['reason'] or '')}</li>"
                                                     for r in rejected) + "</ul>")
        sections.append(
            f'<section class="family" id="{escape(fid)}"><h2>{name}</h2>'
            f'<p class="meta"><span>{escape(m.KIND)}</span><span>{escape(", ".join(bands))}</span>'
            f"<span>{escape('; '.join(topics))}</span>"
            f'<span>Blind review <span class="score {state}">{escape(score)}</span></span></p>'
            f'<div class="figs">{"".join(card(db, lib, f) for f in figs)}</div>{notes}</section>')
    figures = db.execute("SELECT COUNT(*) FROM figures WHERE origin = 'drawn'").fetchone()[0]
    return f"""<title>Drawn Figure Samples</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Newsreader:opsz,wght@6..72,600&display=swap">
<style>{CSS}</style>
<main>
<header><p class="eyebrow">StudySquare figure library &middot; pilot P1a</p><h1>Drawn figure samples</h1>
<p class="lede">{len(sections)} families and {figures} figures, drawn by code. Each answer is computed by the same code that drew
the figure. Sonnet answered the questions on 30 figures from each family without seeing the keys or being told how the
figures were made, and its answers were checked against the keys; a family passes at 27 of 30.
Correct options are marked in green. Figures the review rejected are listed under their family with the reason.</p></header>
<div class="table-wrap"><table><thead><tr><th>Family</th><th>Kind</th><th>Level</th><th>Pilot topic</th><th>Figures</th>
<th>Blind review</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>
{"".join(sections)}
</main>
"""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Write the P1a sample sheet")
    ap.add_argument("--per-family", type=int, default=3)
    ap.add_argument("--out", default="", help="where to write the page; the library's reports folder by default")
    a = ap.parse_args(argv)
    lib = library_dir()
    db = open_store()
    out = Path(a.out) if a.out else lib / "reports" / "p1a-samples.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_sheet(db, lib, a.per_family), encoding="utf-8")
    db.close()
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
