"""Testing materials (P): a class's results table for four to six materials (cotton cloth, a clear plastic bag,
paper, aluminium foil, a wooden block, glass, an iron nail ...), each tested for three or four properties:
waterproof?, floats?, magnetic?, see-through?, bends? A tick or a cross in every cell, and a key.

Which material is best for a job (an umbrella must be waterproof and bend; a window must be see-through and not
bend), how many of the materials float, and which material does two things at once.

Every tick and cross comes from TABLE, what a class test of that material shows. A cell a test would not
settle (cloth and paper float, then soak and sink; a nail cannot be dripped on to see if it is waterproof) is
None there, and no figure ever shows it. Each job and each "which material" question has exactly one material
on the table that fits, so the table, not what a pupil already knows, decides the key.
"""
from __future__ import annotations

import itertools
import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, count, mcq, new_figure

ID = "materials_test_p"
KIND = "table.data"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.material-properties", "science.floating-and-sinking", "science.school-materials")
# A topic whose sections the book lists is reached only if its name or a section names materials and their
# properties: not "Making toys" or "Sound travels through different materials".
NEEDS = (r"properties of materials|testing materials|sorting materials|(uses|using|classification) (of )?materials"
         r"|materials used|(school|home) materials|materials in my world|investigating materials|materials:")

PROPS = ["waterproof", "floats", "magnetic", "see-through", "bends"]
T, F, X = True, False, None
# What a test shows for each material, as a Primary teacher would mark it; X: a test would not settle it.
TABLE = {
    "cotton cloth": {"waterproof": F, "floats": X, "magnetic": F, "see-through": F, "bends": T},
    "clear plastic bag": {"waterproof": T, "floats": T, "magnetic": F, "see-through": T, "bends": T},
    "paper": {"waterproof": F, "floats": X, "magnetic": F, "see-through": X, "bends": T},
    "cardboard": {"waterproof": F, "floats": X, "magnetic": F, "see-through": F, "bends": T},
    "aluminium foil": {"waterproof": T, "floats": X, "magnetic": F, "see-through": F, "bends": T},
    "wooden block": {"waterproof": X, "floats": T, "magnetic": F, "see-through": F, "bends": F},
    "glass": {"waterproof": T, "floats": F, "magnetic": F, "see-through": T, "bends": F},
    "iron nail": {"waterproof": X, "floats": F, "magnetic": T, "see-through": F, "bends": F},
    "steel paper clip": {"waterproof": X, "floats": F, "magnetic": T, "see-through": F, "bends": T},
    "stone": {"waterproof": X, "floats": F, "magnetic": F, "see-through": F, "bends": F},
    "copper wire": {"waterproof": X, "floats": F, "magnetic": F, "see-through": F, "bends": T},
    "rubber band": {"waterproof": X, "floats": X, "magnetic": F, "see-through": F, "bends": T},
}
# Each job: what its material must do, and the material a teacher would choose for it.
JOBS = {
    "an umbrella": ([["waterproof", True], ["bends", True]], "clear plastic bag"),
    "a raincoat": ([["waterproof", True], ["bends", True]], "clear plastic bag"),
    "a window": ([["see-through", True], ["bends", False]], "glass"),
    "a see-through book cover": ([["see-through", True], ["bends", True]], "clear plastic bag"),
    "a toy raft": ([["floats", True], ["bends", False]], "wooden block"),
}
HEADERS = {"waterproof": "Waterproof?", "floats": "Floats?", "magnetic": "Magnetic?", "see-through": "See-through?",
           "bends": "Bends?"}
MUST = {("waterproof", True): "be waterproof", ("bends", True): "bend", ("bends", False): "not bend",
        ("see-through", True): "be see-through", ("floats", True): "float", ("magnetic", True): "be magnetic"}
HOW_MANY = {"floats": "float?", "waterproof": "are waterproof?", "magnetic": "are magnetic?", "see-through": "are see-through?",
            "bends": "bend?"}
DOES = {"floats": "floats", "waterproof": "is waterproof", "magnetic": "is magnetic", "see-through": "is see-through",
        "bends": "bends"}


def _fits(mat: str, need) -> bool:
    return all(TABLE[mat][pr] == want for pr, want in need)


def _picks(mats: list, props: list, job_set: set) -> list:
    """The "which material" questions the table answers with exactly one material: two things at once, or the
    only material that does one thing; never the job's own pair again."""
    out = []
    for k in (2, 1):
        for both in itertools.combinations(props, k):
            if set(both) == job_set:
                continue
            if sum(1 for mat in mats if all(TABLE[mat][pr] for pr in both)) == 1:
                out.append(list(both))
    return out


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    ncols, nrows = (3, 4) if level == "lower" else (4, rng.choice([5, 6]))
    while True:
        job = rng.choice(sorted(JOBS))
        need, answer = JOBS[job]
        must = [pr for pr, _ in need]
        props = must + rng.sample([pr for pr in PROPS if pr not in must], ncols - len(must))
        shown = [mat for mat in TABLE if all(TABLE[mat][pr] is not None for pr in props)]
        rest = [mat for mat in shown if not _fits(mat, need)]
        if answer not in shown or len(rest) < nrows - 1:
            continue
        mats = [answer, *rng.sample(rest, nrows - 1)]
        # a child's slip among the options: some other material does half of what the job needs
        if not any(TABLE[mat][pr] == want for mat in mats[1:] for pr, want in need):
            continue
        counts = [pr for pr in props if 1 <= sum(1 for mat in mats if TABLE[mat][pr]) <= nrows - 1]
        job_set = {pr for pr, want in need if want}
        picks = _picks(mats, props, job_set)
        if not counts or not picks:
            continue
        pairs = [b for b in picks if len(b) == 2]
        # two things at once where the table allows, and a different material from the job's where it can
        other = [b for b in (pairs or picks) if next(m for m in mats if all(TABLE[m][pr] for pr in b)) != answer]
        pair = rng.choice(other or pairs or picks)
        rng.shuffle(mats)
        rng.shuffle(props)
        return {"band": "P", "level": level, "materials": mats, "props": props,
                "cells": [[TABLE[mat][pr] for pr in props] for mat in mats],
                "job": job, "count": rng.choice(counts), "pair": pair}


def draw(p: dict):
    mats, props, cells = p["materials"], p["props"], p["cells"]
    nr, nc = len(mats), len(props)
    w0, w, h = 2.9, 2.15, 0.62
    fig, ax = new_figure(0.82 * (w0 + nc * w) + 0.3, 0.82 * h * (nr + 2.6) + 0.5)
    top = h * nr
    ax.add_patch(Rectangle((0, top), w0 + nc * w, h, facecolor="#e9edf0", edgecolor="none"))
    ax.text(w0 / 2, top + h / 2, "Material", ha="center", va="center", fontsize=11, fontweight="bold")
    for j, pr in enumerate(props):
        ax.text(w0 + (j + 0.5) * w, top + h / 2, HEADERS[pr], ha="center", va="center", fontsize=11, fontweight="bold")
    for i, mat in enumerate(mats):
        y = h * (nr - 1 - i)
        ax.text(0.15, y + h / 2, mat, ha="left", va="center", fontsize=11)
        for j, yes in enumerate(cells[i]):
            ax.text(w0 + (j + 0.5) * w, y + h / 2, "✓" if yes else "✗", ha="center", va="center", fontsize=19,
                    gid=f"cell-{i}-{j}")
    for k in range(nr + 2):  # the rows' lines, the header's top included
        ax.plot([0, w0 + nc * w], [h * k, h * k], color=INK, linewidth=1.2 if k in (0, nr, nr + 1) else 0.7)
    for x in [0, w0] + [w0 + j * w for j in range(1, nc + 1)]:
        ax.plot([x, x], [0, top + h], color=INK, linewidth=1.2 if x in (0, w0, w0 + nc * w) else 0.7)
    ax.text(0, -0.45 * h, "Key:   ✓ = yes      ✗ = no", ha="left", va="center", fontsize=11)
    ax.set_xlim(-0.05, w0 + nc * w + 0.05)
    ax.set_ylim(-0.9 * h, top + h + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Results of testing materials", fontsize=12)
    return fig


NUMBER = {4: "four", 5: "five", 6: "six"}
VERBS = ["tests", "checks", "tries out", "investigates"]
SETTINGS = ["in a science lesson", "at the school science club", "for a class project", "in the classroom",
            "with a partner", "for homework"]
USE = ["Which material should {who} use?", "Which material should {who} choose?", "Which material is best for {who} to use?"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    mats = p["materials"]
    need, _ = JOBS[p["job"]]
    answer = next(mat for mat in mats if _fits(mat, need))
    halves = [mat for mat in mats if mat != answer and any(TABLE[mat][pr] == want for pr, want in need)]
    others = [mat for mat in mats if mat != answer and mat not in halves]
    rng.shuffle(halves)
    rng.shuffle(others)
    must = " and ".join(MUST[(pr, want)] for pr, want in need)
    job = mcq(f"{who} {rng.choice(VERBS)} {NUMBER[len(mats)]} materials {rng.choice(SETTINGS)}. The best one will be used "
              f"to make {p['job']}. It must {must}. " + rng.choice(USE).format(who=who), answer, halves + others, rng)
    pr = p["count"]
    n = sum(1 for mat in mats if TABLE[mat][pr])
    how_many = count(f"How many of the materials {HOW_MANY[pr]}", n, "materials")
    both = p["pair"]
    key = next(mat for mat in mats if all(TABLE[mat][b] for b in both))
    near = [mat for mat in mats if mat != key and any(TABLE[mat][b] for b in both)]
    far = [mat for mat in mats if mat != key and mat not in near]
    rng.shuffle(near)
    rng.shuffle(far)
    stem = (f"Which material {DOES[both[0]]} and {DOES[both[1]]}?" if len(both) == 2
            else f"Which is the only material that {DOES[both[0]]}?")
    return [job, how_many, mcq(stem, key, near + far, rng)]
