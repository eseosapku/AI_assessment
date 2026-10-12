"""The sample sheet for one subject's wave of drawn families, drawn straight from the code (P3a).

Run from the repo root:
    python scripts/figgen/wave_sheet.py --subject mathematics --per-family 3 --out <file.html>

Nothing is written to the staging store: it is opened read-only, to count the topics each family
reaches by concept and level (link.py) and the sources topics already have.
"""
from __future__ import annotations

import argparse
import base64
import json
import random
import sqlite3
import sys
from html import escape
from pathlib import Path

if __package__ in (None, ""):  # run as a script: make "figgen" importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from figgen.core import render  # noqa: E402
from figgen.families import FAMILIES  # noqa: E402
from figgen.link import band_of, reach, topic_index  # noqa: E402
from figgen.sample_sheet import CSS, LEVELS, title_of  # noqa: E402
from figgen.store import library_dir  # noqa: E402

BUCKETS = [("No family", 0, 0), ("1-2", 1, 2), ("3-5", 3, 5), ("6 or more", 6, 10**6)]
EXTRA_CSS = """
.flag{color:var(--fail);background:var(--fail-bg);padding:2px 8px;border-radius:4px;font-weight:600}
.reach{margin:0;color:var(--muted);font-size:14px}
.reach b{color:var(--ink);font-weight:600}
.toc{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;margin:0;padding:0;list-style:none}
.toc a{color:var(--ink)}
"""


def _seeds(m, per_family: int) -> list[int]:
    """Seeds giving each of the family's levels in turn."""
    out, s, want = [], 0, list(m.BANDS)
    while len(out) < per_family and s < 2000:
        s += 1
        band = band_of(m, m.sample(random.Random(s)))
        if band == want[len(out) % len(want)]:
            out.append(s)
    return out


def _card(m, seed: int) -> str:
    rng = random.Random(seed)
    p = m.sample(rng)
    qs = m.questions(p, rng)
    png = render(m.draw(p)).png
    image = f'<img src="data:image/png;base64,{base64.b64encode(png).decode()}" alt="{escape(m.ID)} figure {seed}" loading="lazy">'
    items = []
    for q in qs:
        if q.kind == "mcq":
            key = int(q.answer)
            opts = "".join(f'<li class="key">{escape(o)}</li>' if i == key else f"<li>{escape(o)}</li>" for i, o in enumerate(q.options))
            items.append(f'<li><p>{escape(q.stem)}</p><ol class="opts">{opts}</ol></li>')
        else:
            also = q.accepted[1:]
            extra = f' <span class="also">(also accepted: {escape("; ".join(also))})</span>' if also else ""
            items.append(f'<li><p>{escape(q.stem)}</p><p class="ans">Answer: {escape(q.answer)}{extra}</p></li>')
    level = LEVELS.get(band_of(m, p), band_of(m, p))
    return (f'<figure class="fig">{image}<figcaption>{escape(m.ID)} &middot; seed {seed} &middot; {escape(level)}</figcaption>'
            f'<ol class="qs">{"".join(items)}</ol></figure>')


def _reach(m, index) -> dict[str, list[str]]:
    """The topics the family's figures reach at each of its levels (school years counted)."""
    keys = reach(index, m)
    return {b: [t["name"] for t in index if t["band"] == b and t["key"] in keys] for b in m.BANDS}


def coverage_rows(families: dict, index, before: dict, others: dict | None = None) -> list[tuple[str, int, int]]:
    """The subject's topics by how many sources reach them: now (`before`), and with the wave's
    families added to the sources outside the wave (`others`, by default all of `before`)."""
    others = before if others is None else others
    subject = {m.SUBJECT for m in families.values()}
    topics = [t for t in index if t["subject"] in subject]
    reached = [reach(index, m) for m in families.values()]
    wave = {t["key"]: sum(1 for keys in reached if t["key"] in keys) for t in topics}
    rows = []
    for label, lo, hi in BUCKETS:
        rows.append((label, sum(1 for t in topics if lo <= before.get(t["key"], 0) <= hi),
                     sum(1 for t in topics if lo <= others.get(t["key"], 0) + wave[t["key"]] <= hi)))
    return rows


def build_wave_sheet(families: dict, per_family: int, index, before: dict, others: dict | None = None) -> str:
    sections, toc = [], []
    for fid, m in families.items():
        reach = _reach(m, index)
        parts = []
        for b, names in reach.items():
            if names:
                shown = "; ".join(sorted(set(names))[:5]) + (f"; and {len(names) - 5} more" if len(names) > 5 else "")
                parts.append(f"<b>{escape(LEVELS[b])}</b>: {len(names)} topics ({escape(shown)})")
            else:
                parts.append(f'<span class="flag">reaches no {escape(LEVELS[b])} topic in the current books</span>')
        cards = "".join(_card(m, s) for s in _seeds(m, per_family))
        toc.append(f'<li><a href="#{escape(fid)}">{escape(title_of(fid))}</a></li>')
        sections.append(
            f'<section class="family" id="{escape(fid)}"><h2>{escape(title_of(fid))}</h2>'
            f'<p class="meta"><span>{escape(m.KIND)}</span><span>{escape(", ".join(LEVELS[b] for b in m.BANDS))}</span>'
            f"<span>{len(m.CONCEPTS)} concepts</span></p>"
            f'<p class="reach">{"<br>".join(parts)}</p><div class="figs">{cards}</div></section>')
    rows = "".join(f"<tr><td>{escape(label)}</td><td>{a}</td><td>{b}</td></tr>"
                   for label, a, b in coverage_rows(families, index, before, others))
    subject = escape(", ".join(sorted({m.SUBJECT for m in families.values()})).capitalize())
    return f"""<title>{subject} Wave Samples</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Newsreader:opsz,wght@6..72,600&display=swap">
<style>{CSS}{EXTRA_CSS}</style>
<main>
<header><p class="eyebrow">StudySquare figure library &middot; P3a, the {subject.lower()} wave</p><h1>{subject} figure samples</h1>
<p class="lede">{len(families)} drawn families, {per_family} figures each, drawn by code: every answer is computed by the same
code that drew the figure, and checked a second time by a test over 1,000 figures. Correct options are marked in green. Each
family reaches the topics whose P0 concepts it draws, at the levels it draws for. Nothing has been reviewed by a model yet:
that comes after your verdict on these.</p></header>
<div class="table-wrap"><table><thead><tr><th>{subject} topics reached by</th><th>Now</th><th>With this wave</th></tr></thead>
<tbody>{rows}</tbody></table></div>
<ul class="toc">{"".join(toc)}</ul>
{"".join(sections)}
</main>
"""


def _sources_now(db, exclude: set[str]) -> dict[str, int]:
    """Distinct sources (a drawn family, or a real collection) of approved figures per topic, leaving out `exclude`."""
    rows = db.execute("""SELECT ft.topic_key AS key, COUNT(DISTINCT COALESCE(f.family, f.origin)) AS n FROM figures f
                         JOIN figure_topics ft ON ft.figure_id = f.id WHERE f.status = 'approved' AND COALESCE(f.family, '') NOT IN
                         (SELECT value FROM json_each(?)) GROUP BY ft.topic_key""", (json.dumps(sorted(exclude)),))
    return {r["key"]: r["n"] for r in rows}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Write the sample sheet for one subject's wave")
    ap.add_argument("--subject", default="mathematics")
    ap.add_argument("--per-family", type=int, default=3)
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    fams = {f: m for f, m in FAMILIES.items() if m.SUBJECT == a.subject and hasattr(m, "CONCEPTS")}
    db = sqlite3.connect(f"file:{(library_dir() / 'figures.db').as_posix()}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    index = topic_index(db)
    before, others = _sources_now(db, set()), _sources_now(db, set(fams))
    db.close()
    html = build_wave_sheet(fams, a.per_family, index, before, others)
    Path(a.out).write_text(html, encoding="utf-8")
    print(f"{len(fams)} families written to {a.out} ({len(html) // 1024} KB)")
    for label, now, wave in coverage_rows(fams, index, before, others):
        print(f"  {label:10s} now {now:4d}  with the wave {wave:4d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
