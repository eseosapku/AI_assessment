"""Gametogenesis (UP): sperm or egg formation in a mammal whose diploid number is printed in the title (human 46, cow
60, dog 78 ...). Spermatogenesis: a spermatogonium grows into a primary spermatocyte, meiosis I makes two secondary
spermatocytes, meiosis II four spermatids, which change shape into four sperm. Oogenesis: an oogonium grows into a
primary oocyte, meiosis I makes a large secondary oocyte and a small first polar body, meiosis II a large ovum and a
small second polar body. Each cell shows its chromosome number, except two cells lettered P and Q; each arrow is named.

How many chromosomes cell P and cell Q hold (from where they sit: 2n before meiosis I, n after it); which division
made cell Q (read from the arrow into it).
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Ellipse

from ..core import INK, NAMES, mcq, new_figure, short

ID = "gametogenesis"
KIND = "process.flow"
SUBJECT = "biology"
BANDS = ("UP",)
CONCEPTS = tuple(f"biology.{c}" for c in ("cell-division", "male-reproductive-system", "female-reproductive-system",
                                          "reproduction-humans"))
# A topic whose sections the book lists is reached only if one names the making of gametes.
NEEDS = r"gametogenesis|spermatogenesis|oogenesis|formation of gametes|gamete formation"
AVOID = (r"sexual|contracept|pregnan|\bstis?\b|\bhiv\b|social factors|glossary|science in context|reproduction system|"
         r"mutation|mitosis and meiosis|inherited change|nuclear division")

ANIMALS = {"human": 46, "cow": 60, "goat": 60, "dog": 78, "cat": 38, "rabbit": 44, "pig": 38, "sheep": 54,
           "horse": 64, "mouse": 40}
DIPLOID = {"spermatogonium", "primary spermatocyte", "oogonium", "primary oocyte"}
MADE_BY = {"secondary spermatocyte": "meiosis I", "spermatid": "meiosis II", "secondary oocyte": "meiosis I",
           "first polar body": "meiosis I", "ovum": "meiosis II", "second polar body": "meiosis II"}
DIVISIONS = ["mitosis", "meiosis I", "meiosis II"]

# Each cell: id, kind, row, x, parent id. The arrows into a row are named by ARROWS.
SPERM = [("g", "spermatogonium", 0, 5.3, None), ("p", "primary spermatocyte", 1, 5.3, "g"),
         ("s1", "secondary spermatocyte", 2, 3.9, "p"), ("s2", "secondary spermatocyte", 2, 6.7, "p"),
         ("t1", "spermatid", 3, 3.2, "s1"), ("t2", "spermatid", 3, 4.6, "s1"), ("t3", "spermatid", 3, 6.0, "s2"),
         ("t4", "spermatid", 3, 7.4, "s2"),
         ("z1", "sperm", 4, 3.2, "t1"), ("z2", "sperm", 4, 4.6, "t2"), ("z3", "sperm", 4, 6.0, "t3"),
         ("z4", "sperm", 4, 7.4, "t4")]
EGG = [("g", "oogonium", 0, 3.6, None), ("p", "primary oocyte", 1, 3.6, "g"),
       ("s", "secondary oocyte", 2, 3.6, "p"), ("b1", "first polar body", 2, 7.4, "p"),
       ("o", "ovum", 3, 3.6, "s"), ("b2", "second polar body", 3, 7.4, "s")]
ARROWS = {"sperm": ["growth", "meiosis I", "meiosis II", "changes shape"], "egg": ["growth", "meiosis I", "meiosis II"]}
ROWS = {"sperm": ["spermatogonium", "primary spermatocyte", "secondary spermatocytes", "spermatids", "sperm"]}
ROW_Y = [9.0, 7.2, 5.4, 3.6, 1.8]


def sample(rng: random.Random) -> dict:
    process = rng.choice(["sperm", "egg"])
    plan = SPERM if process == "sperm" else EGG
    cells = [{"id": i, "kind": k} for i, k, *_ in plan]
    q = rng.choice([c["id"] for c in cells if c["kind"] in MADE_BY])
    p = rng.choice([c["id"] for c in cells if c["id"] != q and (c["kind"] in DIPLOID or rng.random() < 0.5)] or
                   [c["id"] for c in cells if c["id"] != q])
    animal = rng.choice(sorted(ANIMALS))
    return {"band": "UP", "process": process, "animal": animal, "two_n": ANIMALS[animal], "cells": cells,
            "letters": {"P": p, "Q": q}}


def _chromosomes(p: dict, kind: str) -> int:
    return p["two_n"] if kind in DIPLOID else p["two_n"] // 2


def draw(p: dict):
    plan = SPERM if p["process"] == "sperm" else EGG
    kind = {c["id"]: c["kind"] for c in p["cells"]}
    lettered = {v: k for k, v in p["letters"].items()}
    fig, ax = new_figure()
    place = {}
    for cid, k, row, x, parent in plan:
        y = ROW_Y[row]
        place[cid] = (x, y)
        big = k in ("primary oocyte", "secondary oocyte", "ovum")
        small = "polar" in k
        r = 0.62 if big else (0.34 if small else 0.45)
        label = lettered.get(cid, str(_chromosomes(p, k)))
        if k == "sperm":
            ax.add_patch(Ellipse((x, y + 0.15), 0.9, 0.62, facecolor="white", edgecolor=INK, linewidth=1.4,
                                 gid=f"cell:{cid}"))
            ty = [y - 0.16 - 0.06 * i for i in range(12)]
            ax.plot([x + 0.08 * ((-1) ** i) for i in range(12)], ty, color=INK, linewidth=1.1)
            r_used = 0.31
        else:
            ax.add_patch(Circle((x, y), r, facecolor="white", edgecolor=INK, linewidth=1.4, gid=f"cell:{cid}"))
            r_used = r
        ty_ = y + (0.15 if k == "sperm" else 0)
        ax.text(x, ty_, label, ha="center", va="center", fontsize=13 if cid in lettered else 10,
                fontweight="bold" if cid in lettered else "normal")
        if parent:
            px, py = place[parent]
            pk = kind[parent]
            pr = 0.62 if pk in ("primary oocyte", "secondary oocyte") else 0.45
            ax.annotate("", xy=(x, y + r_used + 0.06 + (0.15 if k == "sperm" else 0)), xytext=(px, py - pr - 0.06),
                        arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.2, "mutation_scale": 12,
                                    "shrinkA": 0, "shrinkB": 0})
        if p["process"] == "egg":
            ax.text(x + r + 0.15, y, k, ha="left", va="center", fontsize=9)
    rows = 5 if p["process"] == "sperm" else 4
    for i, name in enumerate(ARROWS[p["process"]]):
        ax.text(0.1, (ROW_Y[i] + ROW_Y[i + 1]) / 2, f"↓ {name}", ha="left", va="center", fontsize=10,
                fontweight="bold")
    if p["process"] == "sperm":
        for i, name in enumerate(ROWS["sperm"]):
            ax.text(8.3, ROW_Y[i], name, ha="left", va="center", fontsize=9.5)
    what = "Sperm formation (spermatogenesis)" if p["process"] == "sperm" else "Egg formation (oogenesis)"
    ax.text(0.1, 10.2, f"{what} in a {p['animal']} (2n = {p['two_n']})", ha="left", va="center", fontsize=11,
            fontweight="bold")
    ax.text(0.1, 9.75, "Each number is the number of chromosomes in that cell.", ha="left", va="center", fontsize=9.5)
    bottom = ROW_Y[rows - 1] - (1.2 if p["process"] == "sperm" else 0.9)
    ax.set_xlim(0, 10.6)
    ax.set_ylim(bottom, 10.5)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.set_size_inches(0.62 * 10.6, 0.62 * (10.5 - bottom))
    ax.set_position([0, 0, 1, 1])
    return fig


SETTINGS = ["in a biology lesson", "for revision", "for a class test", "at the science club in Kayonza",
            "for homework", "while revising in Rusizi"]
VERBS = ["studies", "looks at", "copies", "is given"]


def questions(p: dict, rng: random.Random) -> list:
    kind = {c["id"]: c["kind"] for c in p["cells"]}
    cp, cq = kind[p["letters"]["P"]], kind[p["letters"]["Q"]]
    n_p, n_q = _chromosomes(p, cp), _chromosomes(p, cq)
    who = rng.choice(NAMES)
    what = "sperm" if p["process"] == "sperm" else "egg"
    return [short(f"{who} {rng.choice(VERBS)} this diagram of {what} formation {rng.choice(SETTINGS)}. How many "
                  f"chromosomes are in cell P?", n_p, [f"{n_p} chromosomes"]),
            short(f"How many chromosomes are in cell Q of this {p['animal']}?", n_q, [f"{n_q} chromosomes"]),
            mcq("Which division made cell Q?", MADE_BY[cq], [d for d in DIVISIONS if d != MADE_BY[cq]], rng)]
