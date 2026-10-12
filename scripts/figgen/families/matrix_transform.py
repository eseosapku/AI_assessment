"""The unit square OABC and its image under a 2 × 2 matrix: which matrix it is, where a corner goes,
the area of the image and the determinant (UP, AL).

The matrix has whole-number entries from -3 to 3, a non-zero determinant, and b ≠ c, so its
transpose is a different matrix; no image corner lands on a corner of the square. A wrong option
never maps the square onto the same image.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon

from ..core import FILL, FILL_2, GRID, INK, NAMES, mcq, new_figure, short

ID = "matrix_transform"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("linear-transformation-2d", "transformation-matrices", "operations-linear-transformation", "matrices"))
# Matrix transformations: not statistics.
AVOID = r"statistic"
SQUARE = [(0, 0), (1, 0), (1, 1), (0, 1)]


def image(M) -> list[tuple[int, int]]:
    a, b, c, d = M
    return [(a * x + b * y, c * x + d * y) for x, y in SQUARE]


def sample(rng: random.Random) -> dict:
    while True:
        M = [rng.randint(-3, 3) for _ in range(4)]
        a, b, c, d = M
        corners = image(M)
        if a * d - b * c == 0 or b == c or set(corners[1:]) & set(SQUARE) or max(abs(v) for pt in corners for v in pt) > 6:
            continue
        return {"band": rng.choice(BANDS), "M": M, "name": rng.choice(NAMES)}


def view(p: dict) -> tuple[int, int, int, int]:
    pts = image(p["M"]) + SQUARE
    xs, ys = [x for x, _ in pts], [y for _, y in pts]
    return min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1


def matrix(a: int, b: int, c: int, d: int) -> str:
    return f"rows ({a}, {b}) and ({c}, {d})"


def _label(ax, pts, names):
    cx, cy = sum(x for x, _ in pts) / 4, sum(y for _, y in pts) / 4
    for (x, y), name in zip(pts, names):
        if name:
            dx, dy = x - cx, y - cy
            n = max((dx * dx + dy * dy) ** 0.5, 1e-9)
            ax.text(x + 0.32 * dx / n, y + 0.32 * dy / n, name, fontsize=11, fontweight="bold", ha="center", va="center")


def draw(p: dict):
    x0, x1, y0, y1 = view(p)
    fig, ax = new_figure(5.8, 5.8 * (y1 - y0 + 1) / (x1 - x0 + 1))
    ax.set_xticks(range(x0, x1 + 1))
    ax.set_yticks(range(y0, y1 + 1))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.axhline(0, color=INK, linewidth=0.9)
    ax.axvline(0, color=INK, linewidth=0.9)
    ax.set_xlim(x0 - 0.5, x1 + 0.5)
    ax.set_ylim(y0 - 0.5, y1 + 0.5)
    ax.set_aspect("equal")
    ax.tick_params(labelsize=8)
    img = image(p["M"])
    ax.add_patch(Polygon(img, closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.6, alpha=0.55))
    ax.add_patch(Polygon(SQUARE, closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.6))
    _label(ax, SQUARE, ["O", "A", "B", "C"])
    _label(ax, img, ["", "A′", "B′", "C′"])
    return fig


def questions(p: dict, rng: random.Random) -> list:
    a, b, c, d = p["M"]
    right = image(p["M"])
    wrong = [M for M in ((a, c, b, d), (d, b, c, a), (-a, b, -c, d), (a, -b, c, -d), (b, a, d, c))
             if set(image(M)) != set(right)]
    which = mcq(f"{p['name']} drew the unit square OABC and its image O′A′B′C′. Which matrix maps OABC onto O′A′B′C′?",
                matrix(a, b, c, d), [matrix(*M) for M in wrong], rng)
    x, y = rng.choice([(2, 1), (1, 2), (2, 3), (3, 1), (1, 3), (3, 2), (2, -1), (-1, 2), (3, -1), (-2, 1)])
    u, v = a * x + b * y, c * x + d * y
    corner = short(f"Under {p['name']}'s matrix, where does the point ({x}, {y}) go?", f"({u}, {v})", [f"({u},{v})", f"{u}, {v}"])
    det = a * d - b * c
    area = short("What is the area of O′A′B′C′?", abs(det), [f"{abs(det)} square units", f"{abs(det)} units²", f"{abs(det)} units2"])
    determinant = short(f"A′ is at ({a}, {c}). What is the determinant of the matrix that maps OABC onto O′A′B′C′?", det)
    return [which, corner, area, determinant]
