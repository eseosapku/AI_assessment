"""Chooses the comparison set: the same screened images go to both writers (spec 5.5).

Run from the repo root:  python scripts/figgen/real/choose.py [--per-topic 10]
Writes the figure ids, one per line, to <FIGURE_LIBRARY_DIR>/reports/p1b-compare.txt.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from figgen.store import library_dir, open_store  # noqa: E402


def choose(db, per_topic: int = 10, seed: int = 2026, diagrams_first: bool = False) -> list[str]:
    """Up to `per_topic` kept images from each topic, drawn at random but the same every time. With
    `diagrams_first`, about two thirds are diagrams, the rest photos and other kinds."""
    rng = random.Random(seed)
    out: list[str] = []
    keys = [r[0] for r in db.execute("SELECT DISTINCT ft.topic_key FROM figure_topics ft JOIN screenings s "
                                     "ON s.figure_id = ft.figure_id WHERE s.keep = 1 ORDER BY ft.topic_key")]
    for key in keys:
        rows = db.execute("SELECT ft.figure_id, s.detail FROM figure_topics ft JOIN screenings s ON s.figure_id = ft.figure_id "
                          "WHERE s.keep = 1 AND ft.topic_key = ? ORDER BY ft.figure_id", (key,)).fetchall()
        ids = [r[0] for r in rows]
        if not diagrams_first:
            out += sorted(rng.sample(ids, min(per_topic, len(ids))))
            continue
        diagrams = [r[0] for r in rows if (json.loads(r[1] or "{}") or {}).get("image_type") == "diagram"]
        others = [i for i in ids if i not in set(diagrams)]
        picked = rng.sample(diagrams, min(len(diagrams), max(1, round(per_topic * 2 / 3))))
        picked += rng.sample(others, min(per_topic - len(picked), len(others)))
        rest = [d for d in diagrams if d not in picked]
        picked += rng.sample(rest, min(per_topic - len(picked), len(rest)))
        out += sorted(picked)
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Choose the P1b comparison set")
    ap.add_argument("--per-topic", type=int, default=10)
    ap.add_argument("--diagrams-first", action="store_true")
    ap.add_argument("--out", default="p1b-compare.txt")
    a = ap.parse_args(argv)
    db = open_store()
    ids = choose(db, a.per_topic, diagrams_first=a.diagrams_first)
    out = library_dir() / "reports" / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(ids) + "\n", encoding="utf-8")
    print(f"Wrote {len(ids)} figure ids to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
