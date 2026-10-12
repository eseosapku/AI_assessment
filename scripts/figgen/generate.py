"""Draws the pilot's figures into the staging store and the local asset folder (spec 5.2, 5.6).

Run from the repo root:
    python scripts/figgen/generate.py [--per-family 30] [--families bar_chart,pie_chart] [--redo]

Files land at <FIGURE_LIBRARY_DIR>/assets/drawn/<family>/<seed>.svg and .png,
laid out as the S3 keys will be. Resumable: seeds already stored are kept, so a
stopped run carries on where it stopped. --redo redraws a family from scratch,
for after a fix, and drops its old reviews.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

if __package__ in (None, ""):  # run as a script: make "figgen" importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from figgen.core import render  # noqa: E402
from figgen.families import FAMILIES  # noqa: E402
from figgen.link import band_of, topic_index, topics_for, unknown_concepts  # noqa: E402
from figgen.pilot import topics_for as topics_for_pilot  # noqa: E402
from figgen.store import delete_family, has_figure, library_dir, open_store, save_drawn, topic  # noqa: E402


def figure_id(family: str, seed: int) -> str:
    return f"drawn/{family}/{seed}"


def png_size(png: bytes) -> tuple[int, int]:
    return int.from_bytes(png[16:20], "big"), int.from_bytes(png[20:24], "big")


def generate_family(db, lib: Path, m, count: int, redo: bool = False, max_seeds: int = 5000, index=None) -> dict:
    """Draws figures for one family until it has `count` different ones.

    A family that names its concepts reaches its topics by concept and level (link.py), and an
    instance that reaches none is not stored; the pilot's families keep their hand-made topics.
    """
    by_concept = hasattr(m, "CONCEPTS")
    if by_concept:
        unknown = unknown_concepts(db, m)
        if unknown:
            raise ValueError(f"{m.ID} names concepts the store does not have: {', '.join(unknown)}")
        index = index if index is not None else topic_index(db)
    if redo:
        for key in delete_family(db, m.ID):
            (lib / key).unlink(missing_ok=True)
    seen: set[str] = set()
    have = drawn = seed = 0
    while have < count:
        seed += 1
        if seed > max_seeds:
            raise RuntimeError(f"{m.ID}: only {have} different figures in {max_seeds} seeds")
        rng = random.Random(seed)
        params = m.sample(rng)
        key = json.dumps(params, sort_keys=True)
        if key in seen:  # the same figure as an earlier seed: never store it twice
            continue
        seen.add(key)
        fid = figure_id(m.ID, seed)
        if has_figure(db, fid):
            have += 1
            continue
        if by_concept:
            keys, band, subject = topics_for(index, m, params), band_of(m, params), m.SUBJECT
            if not keys:  # serves no topic at its level: not worth storing
                continue
        else:
            keys = topics_for_pilot(m.ID, params)
            first = topic(db, keys[0])
            if first["band"] not in m.BANDS:
                raise ValueError(f"{m.ID} draws for {', '.join(m.BANDS)}, but {keys[0]} is {first['band']}")
            band, subject = first["band"], first["subject"]
        questions = m.questions(params, rng)
        out = render(m.draw(params))
        asset, preview = f"assets/{fid}.svg", f"assets/{fid}.png"
        (lib / asset).parent.mkdir(parents=True, exist_ok=True)
        (lib / asset).write_text(out.svg, encoding="utf-8")
        (lib / preview).write_bytes(out.png)
        width, height = png_size(out.png)
        save_drawn(db, figure_id=fid, family=m.ID, kind=m.KIND, subject=subject, band=band,
                   topics=keys, seed=seed, spec=params, questions=questions, asset=asset, preview=preview,
                   width=width, height=height)
        have += 1
        drawn += 1
    return {"family": m.ID, "have": have, "drawn": drawn}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Draw the P1a pilot's figures into the staging store")
    ap.add_argument("--per-family", type=int, default=30)
    ap.add_argument("--families", default="", help="comma-separated family ids; all when left out")
    ap.add_argument("--redo", action="store_true", help="redraw these families from scratch, dropping their reviews")
    a = ap.parse_args(argv)
    ids = [f.strip() for f in a.families.split(",") if f.strip()] or list(FAMILIES)
    unknown = [f for f in ids if f not in FAMILIES]
    if unknown:
        ap.error(f"unknown families: {', '.join(unknown)}")
    lib = library_dir()
    db = open_store()
    index = topic_index(db)
    for fid in ids:
        r = generate_family(db, lib, FAMILIES[fid], a.per_family, redo=a.redo, index=index)
        print(f"{fid:20s} {r['have']} figures ({r['drawn']} new)")
    total = db.execute("SELECT COUNT(*) FROM figures WHERE origin = 'drawn'").fetchone()[0]
    print(f"{total} drawn figures in the store at {lib}")
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
