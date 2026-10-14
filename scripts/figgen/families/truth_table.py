"""Truth tables (UP, AL): the truth table of a two- or three-input expression, rows numbered, inputs in binary order,
and two or three output cells left blank. A blank cell, how many rows give X = 1 once the blanks are filled in, and
which of four expressions the table shows.

The three wrong expressions each disagree with a row the table prints, so the table decides the answer.
"""
from __future__ import annotations

import itertools
import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short
from .logic import inputs, sample_tree, table, text

ID = "truth_table"
KIND = "cs.logic"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("logic-expressions", "boolean-algebra", "logic-gates"))
AVOID = r"spreadsheet|database|network|internet|security|graphic|document|presentation|email|python|html"


def sample(rng: random.Random) -> dict:
    while True:
        tree, alts = sample_tree(rng)
        names = inputs(tree)
        out = table(tree, names)
        n = len(out)
        blanks = sorted(rng.sample(range(n), rng.choice([2, 3])))
        shown = [i for i in range(n) if i not in blanks]
        if all(any(table(a, names)[i] != out[i] for i in shown) for a in alts if text(a) != text(tree)):
            return {"band": rng.choice(BANDS), "expr": tree, "alts": alts, "inputs": names, "blanks": blanks,
                    "ask": rng.choice(blanks)}


def draw(p: dict):
    names = p["inputs"]
    out = table(p["expr"], names)
    cols = ["row"] + names + ["X"]
    n = len(out)
    w, h = 0.9, 0.55
    fig, ax = new_figure(1.0 + 0.9 * len(cols), 0.55 * (n + 1) + 0.6)
    for j, c in enumerate(cols):
        ax.add_patch(Rectangle((j * w, n * h), w, h, facecolor="#dfe4e8", edgecolor=INK, linewidth=1.1))
        ax.text(j * w + w / 2, n * h + h / 2, c, ha="center", va="center", fontsize=11, fontweight="bold")
    for i, bits in enumerate(itertools.product((0, 1), repeat=len(names))):
        y = (n - 1 - i) * h
        cells = [str(i + 1)] + [str(b) for b in bits] + ["?" if i in p["blanks"] else str(out[i])]
        for j, v in enumerate(cells):
            ax.add_patch(Rectangle((j * w, y), w, h, facecolor="none", edgecolor=INK, linewidth=1.0))
            ax.text(j * w + w / 2, y + h / 2, v, ha="center", va="center", fontsize=11,
                    fontweight="bold" if j == len(cells) - 1 else "normal", color="#555555" if j == 0 else INK)
    ax.set_xlim(-0.05, len(cols) * w + 0.05)
    ax.set_ylim(-0.05, (n + 1) * h + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computer science lesson", "on a revision card", "for homework", "at the coding club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    names = p["inputs"]
    out = table(p["expr"], names)
    k = p["ask"]
    ones = sum(out)
    key = f"X = {text(p['expr'])}"
    return [short(f"{who} worked out this truth table {rng.choice(SETTINGS)}. What is the value of X in row {k + 1}?", out[k], [str(out[k])]),
            mcq(f"{friend} wants the expression the table shows. Which expression matches every row printed?", key,
                [f"X = {text(t)}" for t in p["alts"] if text(t) != text(p["expr"])], rng),
            short("Once the blanks are filled in, how many rows give X = 1?", ones, [str(ones), f"{ones} rows"])]
