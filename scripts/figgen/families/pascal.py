"""Pascal's triangle, rows 0 to 7, with two or three entries shown as P, Q and R (UP): a missing
entry, a binomial coefficient, the sum of a row, and which row expands (a + b)ⁿ.

A hidden entry is never a 1 at the end of a row; the top row is row 0, as the stems say.
"""
from __future__ import annotations

import random
from math import comb

from matplotlib.patches import FancyBboxPatch

from ..core import FILL_2, INK, NAMES, mcq, new_figure, short

ID = "pascal"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("UP",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("binomial-theorem", "factorial-notation"))
ROWS = 8


def sample(rng: random.Random) -> dict:
    inner = [(r, k) for r in range(2, ROWS) for k in range(1, r)]
    picked = rng.sample(inner, rng.choice([2, 3]))
    return {"band": "UP", "holes": {label: list(rk) for label, rk in zip("PQR", picked)}, "name": rng.choice(NAMES)}


def draw(p: dict):
    hidden = {tuple(v): label for label, v in p["holes"].items()}
    fig, ax = new_figure(6.2, 4.6)
    for r in range(ROWS):
        for k in range(r + 1):
            x, y = (k - r / 2) * 1.2, (ROWS - 1 - r) * 1.0
            label = hidden.get((r, k))
            ax.add_patch(FancyBboxPatch((x - 0.42, y - 0.32), 0.84, 0.64, boxstyle="round,pad=0.02,rounding_size=0.15",
                                        facecolor=FILL_2 if label else "white", edgecolor=INK, linewidth=1.0))
            ax.text(x, y, label or str(comb(r, k)), ha="center", va="center", fontsize=11, fontweight="bold" if label else "normal")
        ax.text(-ROWS * 0.6 - 0.9, (ROWS - 1 - r) * 1.0, f"row {r}", ha="right", va="center", fontsize=9)
    ax.set_xlim(-ROWS * 0.6 - 2.4, ROWS * 0.6 + 0.4)
    ax.set_ylim(-0.6, ROWS - 0.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name = p["name"]
    label = rng.choice(sorted(p["holes"]))
    r, k = p["holes"][label]
    gap = short(f"{name} copied Pascal's triangle and hid some numbers. What is the number at {label}?", comb(r, k))
    n = rng.randint(3, ROWS - 1)
    k2 = rng.randint(1, n - 1)
    coef = short(f"Use the triangle: what is the coefficient of x^{k2} in the expansion of (1 + x)^{n}?", comb(n, k2))
    n3 = rng.randint(2, ROWS - 1)
    total = short(f"The top row of {name}'s triangle is row 0. What is the sum of the numbers in row {n3}?", 2 ** n3)
    n4 = rng.randint(2, ROWS - 1)
    row = mcq(f"Which row of the triangle gives the coefficients in the expansion of (a + b)^{n4}?", f"row {n4}",
              [f"row {n4 - 1}", f"row {n4 + 1}", f"row {2 * n4}" if 2 * n4 != n4 + 1 else "row 0"], rng)
    return [gap, coef, total, row]
