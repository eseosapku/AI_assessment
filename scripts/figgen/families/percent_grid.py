"""A hundred-square grid with some squares shaded (P, Stages 5–6): the percentage shaded, the fraction
in its lowest terms, the decimal not shaded, the ratio of shaded to unshaded, and how many more to
shade to reach a given percentage.

The squares are shaded a row at a time from the top, so they can be counted in tens.
"""
from __future__ import annotations

import random
from fractions import Fraction
from math import gcd

from matplotlib.patches import Rectangle

from ..core import FILL, INK, NAMES, count, new_figure, short

ID = "percent_grid"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("fractions-percentages", "ratios-proportions-percentages", "working-with-ratio", "fractions-decimals"))
WHAT = ["a hundred square", "a floor of 100 tiles", "a garden of 100 plots", "a hall of 100 seats", "a sheet of 100 stamps"]


def stages(p: dict) -> tuple[int, int]:
    return (5, 6)


def sample(rng: random.Random) -> dict:
    n = rng.randint(5, 95)
    cells = [[i % 10, 9 - i // 10] for i in range(n)]  # row by row from the top
    return {"band": "P", "shaded": n, "cells": cells, "what": rng.choice(WHAT), "name": rng.choice(NAMES)}


def draw(p: dict):
    fig, ax = new_figure(4.4, 4.4)
    for x, y in p["cells"]:
        ax.add_patch(Rectangle((x, y), 1, 1, facecolor=FILL, edgecolor="none"))
    for k in range(11):
        ax.plot([k, k], [0, 10], color=INK, linewidth=1.6 if k in (0, 10) else 0.8)
        ax.plot([0, 10], [k, k], color=INK, linewidth=1.6 if k in (0, 10) else 0.8)
    ax.set_xlim(-0.1, 10.1)
    ax.set_ylim(-0.1, 10.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    n, name = p["shaded"], p["name"]
    f = Fraction(n, 100)
    g = gcd(n, 100 - n)
    pct = short(f"{name} shaded part of {p['what']}. What percentage is shaded?", n, [f"{n}%", f"{n} percent"])
    fraction = short("What fraction of the squares is shaded? Give it in its lowest terms.", f"{f.numerator}/{f.denominator}")
    rest = Fraction(100 - n, 100)
    decimal = short("What decimal of the squares is not shaded?", f"{float(rest):.2f}".rstrip("0").rstrip("."),
                    [f"{float(rest):.2f}"])
    ratio = short("What is the ratio of shaded squares to unshaded squares, in its simplest form?", f"{n // g}:{(100 - n) // g}",
                  [f"{n // g} : {(100 - n) // g}"])
    t = rng.choice([v for v in range(10, 101, 5) if v > n] or [100])
    more = count(f"How many more squares must {name} shade to make {t}% of the squares shaded?", t - n, "squares")
    return [pct, fraction, decimal, ratio, more]
