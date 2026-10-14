"""An area model for multiplying brackets (LS, UP): a rectangle whose sides are split into an x part
and a number part, so its area is (ax + b)(cx + d). The perimeter, the expanded area, the area for a
given x, and at Upper Secondary x from a given area.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL, FILL_2, INK, NAMES, mcq, new_figure, poly, short

ID = "algebra_area"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "algebraic-expressions-constructing", "working-with-brackets", "simplifying-expressions", "algebraic-expressions-substituting-evaluating",
))
# Expanding brackets: not ratio, sequences, indices, linear equations, calculus or a book's index.
AVOID = r"ratio|sequence|glossary|indices|surds|linear equations|project|pascal|gradient|mappings|integration|fraction|more equations, formulae and functions"


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        a1 = 1 if band == "LS" else rng.choice([1, 1, 2])
        sides = [[a1, rng.randint(1, 6)], [1, rng.randint(1, 6)]] if rng.random() < 0.75 else [[0, rng.randint(2, 6)], [1, rng.randint(1, 6)]]
        if band == "UP" and sides[0][0] == 0:
            continue
        if sides[0] != sides[1]:
            return {"band": band, "sides": sides, "name": rng.choice(NAMES)}


def _side(a: int, b: int) -> str:
    return poly([a, b]) if a else str(b)


def draw(p: dict):
    (a1, b1), (a2, b2) = p["sides"]
    X = 3.0  # how long x is drawn
    w1, w2 = a1 * X, b1 * 0.55 + 0.6  # across: the x part, then the number part
    h1, h2 = a2 * X, b2 * 0.55 + 0.6  # down
    fig, ax = new_figure(5.4, 4.8)
    cols = [(0, w1), (w1, w2)] if a1 else [(0, w2)]
    rows = [(0, h2), (h2, h1)]
    for cx, cw in cols:
        for ry, rh in rows:
            ax.add_patch(Rectangle((cx, ry), cw, rh, facecolor=FILL_2 if (cx == 0) == (ry == h2) else FILL, edgecolor=INK, linewidth=1.6))
    width, height = sum(cw for _, cw in cols), h1 + h2
    # Each part's length along the top and down the left side.
    tops = [("x" if a1 == 1 else f"{a1}x", 0, w1), (str(b1), w1, w2)] if a1 else [(str(b1), 0, w2)]
    for text, cx, cw in tops:
        ax.text(cx + cw / 2, height + 0.35, text, ha="center", va="bottom", fontsize=13, style="italic" if "x" in text else "normal")
    for text, ry, rh in (("x", h2, h1), (str(b2), 0, h2)):
        ax.text(-0.35, ry + rh / 2, text, ha="right", va="center", fontsize=13, style="italic" if "x" in text else "normal")
    ax.set_xlim(-1.4, width + 0.4)
    ax.set_ylim(-0.4, height + 1.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    (a1, b1), (a2, b2) = p["sides"]
    name = p["name"]
    perim = poly([2 * (a1 + a2), 2 * (b1 + b2)])
    perimeter = mcq(f"{name} drew this rectangle, with its sides split into parts. Which expression gives its perimeter?", perim,
                    [poly([a1 + a2, b1 + b2]), poly([2 * (a1 + a2), b1 + b2]), poly([a1 * a2, a1 * b2 + a2 * b1, b1 * b2]),
                     poly([4 * (a1 + a2), 2 * (b1 + b2)])], rng)
    area_c = [a1 * a2, a1 * b2 + a2 * b1, b1 * b2]
    right = poly(area_c)
    wrong = [poly([a1 * a2, 0, b1 * b2]), poly([a1 * a2, b1 + b2, b1 * b2]), poly([a1 * a2, a1 * b2 + a2 * b1, b1 + b2]),
             poly([a1 * a2, b1 * b2, a1 * b2 + a2 * b1])]
    area = mcq("Which expression gives the area of the whole rectangle?", right, [w for w in wrong if w != right], rng)
    x = rng.randint(2, 9)
    v = (a1 * x + b1) * (a2 * x + b2)
    value = short(f"When x = {x} cm, what is the area of {name}'s rectangle?", v, [f"{v} cm²", f"{v} cm2", f"{v}cm²"])
    qs = [perimeter, area, value]
    if p["band"] == "UP":
        root = rng.choice([r for r in range(1, 10) if r != x])
        N = (a1 * root + b1) * (a2 * root + b2)
        qs.append(short(f"For another value of x, the area is {N} cm². Find this value of x.", root, [f"x = {root}", f"{root} cm"]))
    return qs
