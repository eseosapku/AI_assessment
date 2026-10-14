"""Importing the exam-diagram dataset into the staging store (P3q). Each row with a writer and a topic is copied into
`assets/dataset/<family>/` and stored as a drawn figure of family `ds.<family>`, with its computed questions and
linked topics. The review, regrade and approval then work as for our own families. A second run keeps what is there.

Run from the repo root:
    python -m figgen.dataset.importer --families math.trig_triangle,bio.cell --per-family 30
    python -m figgen.dataset.importer --all
(with `scripts` on the path, as for generate.py). Staging store only; nothing reaches production.
"""
from __future__ import annotations

import argparse
import collections
import random
import shutil
from pathlib import Path

from .. import link
from ..store import has_figure, library_dir, open_store, save_drawn
from . import concepts, manifest, writers


def figure_id(row: dict) -> str:
    return f"dataset/{row['family']}/{row['id'].rsplit('__', 1)[-1]}"


def _seed(row: dict) -> int:
    tail = row["id"].rsplit("__", 1)[-1]
    try:
        return int(tail, 16) % (2 ** 31)
    except ValueError:
        return 0


def import_rows(db, lib: Path, families: set[str] | None = None, per_family: int | None = None, index=None,
                spread: bool = False) -> dict:
    """Stores up to `per_family` new figures a family (all when None); returns what happened to the rows read. A spread
    sample takes the middle row of each stride across the family: the manifest is grouped by subtopic and kind, so its
    first rows are all one kind."""
    index = index if index is not None else link.topic_index(db)
    out = {"stored": 0, "kept": 0, "no_writer": 0, "no_topic": 0}
    taken: dict[str, int] = {}
    seen: collections.Counter = collections.Counter()
    step = {}
    if spread and per_family:
        sizes = collections.Counter(r["family"] for r in manifest.rows(families))
        step = {f: max(1, n // per_family) for f, n in sizes.items()}
    src = manifest.root()
    for k, row in enumerate(manifest.rows(families)):
        fam = row["family"]
        seen[fam] += 1
        if step and (seen[fam] - 1) % step[fam] != step[fam] // 2:
            continue
        if per_family is not None and taken.get(fam, 0) >= per_family:
            continue
        fid = figure_id(row)
        if has_figure(db, fid):
            out["kept"] += 1
            taken[fam] = taken.get(fam, 0) + 1
            continue
        if fam not in concepts.LINKS or fam not in writers.WRITERS:
            out["no_writer"] += 1
            continue
        qs = writers.questions(row, random.Random(_seed(row)))
        if not qs:
            out["no_writer"] += 1
            continue
        band = manifest.band_of(row)
        m = concepts.family_of(row, band)
        topics = link.topics_for(index, m, {"band": band})
        for extra in concepts.extra_bands(row, band):
            topics = sorted(set(topics) | set(link.topics_for(index, concepts.family_of(row, extra), {"band": extra})))
        if not topics:
            out["no_topic"] += 1
            continue
        tail = row["id"].rsplit("__", 1)[-1]
        dest = lib / "assets" / "dataset" / fam
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src / row["svg"], dest / f"{tail}.svg")
        shutil.copyfile(src / row["png"], dest / f"{tail}.png")
        save_drawn(db, figure_id=fid, family=m.ID, kind=m.KIND, subject=m.SUBJECT, band=band, topics=topics, seed=_seed(row),
                   spec={"dataset_id": row["id"], "params": row["params"], "labels": row["labels"], "subtopic": row["subtopic_id"]},
                   questions=qs, asset=f"assets/dataset/{fam}/{tail}.svg", preview=f"assets/dataset/{fam}/{tail}.png",
                   width=int(row.get("width_px") or 0), height=int(row.get("height_px") or 0))
        out["stored"] += 1
        taken[fam] = taken.get(fam, 0) + 1
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--families", default="", help="comma-separated dataset families; all with a writer when left out")
    ap.add_argument("--per-family", type=int, default=None)
    ap.add_argument("--all", action="store_true", help="every row of the families, not a sample")
    ap.add_argument("--spread", action="store_true", help="a sample across each family, not its first rows")
    args = ap.parse_args(argv)
    if not manifest.available():
        print(f"The dataset is not at {manifest.root()}")
        return 1
    fams = set(filter(None, args.families.split(","))) or set(writers.WRITERS)
    db = open_store()
    r = import_rows(db, library_dir(), fams, None if args.all else (args.per_family or 30), spread=args.spread)
    print(f"{r['stored']} stored, {r['kept']} already there, {r['no_writer']} with no question, {r['no_topic']} with no topic")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
