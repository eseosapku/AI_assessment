"""Complex numbers on an Argand diagram: which point a number is at, which number a point is, a
modulus, and the conjugate or a sum (UP, AL).

Points A, B and C sit at whole-number coordinates off both axes; C is often a Pythagorean point, so
its modulus is a whole number (otherwise it is asked to 1 decimal place, with the surd accepted).
B is the conjugate of A half the time, and the conjugate question is asked only when one of the
points is the conjugate of A.
"""
from __future__ import annotations

import math
import random

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "argand"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "complex-numbers-applications", "modulus-complex-numbers", "polar-coordinate-system", "exponential-form-complex-definition",
))
# Argand diagrams: not logarithmic equations.
AVOID = r"logarithm|differential equations|conics"
PYTHAGOREAN = [(sx * a, sy * b) for a, b in ((3, 4), (4, 3), (6, 8), (8, 6)) for sx in (1, -1) for sy in (1, -1)]


def fmt(x: int, y: int) -> str:
    """3 + 2i, 3 - 2i, -3 + i, 2i, -i, 5."""
    if y == 0:
        return str(x)
    im = ("" if abs(y) == 1 else str(abs(y))) + "i"
    if x == 0:
        return ("-" if y < 0 else "") + im
    return f"{x} {'+' if y > 0 else '-'} {im}"


def forms(x: int, y: int) -> list[str]:
    out = [fmt(x, y), fmt(x, y).replace(" ", "")]
    if x == 0 and y:  # "0 + 3i" for 3i
        im = ("" if abs(y) == 1 else str(abs(y))) + "i"
        out += [f"0 {'+' if y > 0 else '-'} {im}", f"0{'+' if y > 0 else '-'}{im}"]
    return out


def sample(rng: random.Random) -> dict:
    def off_axes():
        while True:
            x, y = rng.randint(-6, 6), rng.randint(-6, 6)
            if x and y:
                return x, y
    while True:
        A = off_axes()
        B = (A[0], -A[1]) if rng.random() < 0.5 else off_axes()
        C = rng.choice(PYTHAGOREAN) if rng.random() < 0.6 else off_axes()
        if len({A, B, C}) == 3:
            return {"band": rng.choice(BANDS), "points": {"A": list(A), "B": list(B), "C": list(C)}, "name": rng.choice(NAMES)}


def view(p: dict) -> tuple[int, int, int, int]:
    xs = [v[0] for v in p["points"].values()] + [0]
    ys = [v[1] for v in p["points"].values()] + [0]
    return min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1


def draw(p: dict):
    x0, x1, y0, y1 = view(p)
    fig, ax = new_figure(5.8, 5.8 * (y1 - y0 + 1) / (x1 - x0 + 1) if x1 > x0 else 5.8)
    ax.set_xticks(range(x0, x1 + 1))
    ax.set_yticks(range(y0, y1 + 1))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    for s in ("left", "bottom"):
        ax.spines[s].set_position("zero")
    ax.set_xlim(x0 - 0.5, x1 + 0.5)
    ax.set_ylim(y0 - 0.5, y1 + 0.5)
    ax.set_aspect("equal")
    ax.tick_params(labelsize=8)
    ax.text(x1 + 0.45, 0.35, "Re", ha="right", va="bottom", fontsize=11, style="italic")
    ax.text(0.3, y1 + 0.45, "Im", ha="left", va="top", fontsize=11, style="italic")
    pts = p["points"]
    for name, (x, y) in pts.items():
        ax.plot([x], [y], marker="o", markersize=6, color=INK, linestyle="none", zorder=5)
        # The letter on the diagonal furthest from the other points, so it is plainly this point's; on a
        # tie, the side away from both axes and their numbers.
        others = [v for k, v in pts.items() if k != name]
        best = max(((dx, dy) for dx in (-0.32, 0.32) for dy in (-0.32, 0.32)),
                   key=lambda d: (round(min(((x + d[0] - u) ** 2 + (y + d[1] - v) ** 2) ** 0.5 for u, v in others), 2),
                                  (d[0] > 0) == (x > 0), (d[1] > 0) == (y > 0)))
        ax.text(x + best[0], y + best[1], name, fontsize=12, fontweight="bold", ha="center", va="center")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    pts = {k: tuple(v) for k, v in p["points"].items()}
    target = rng.choice(["B", "C"])
    which = mcq(f"{p['name']} marked the points A, B and C on an Argand diagram. Which point represents {fmt(*pts[target])}?",
                target, ["A", "B", "C", "none of them"], rng)
    xa, ya = pts["A"]
    number = mcq("Which complex number does A represent?", fmt(xa, ya),
                 [fmt(ya, xa) if xa != ya else fmt(xa + 1, ya), fmt(xa, -ya), fmt(-xa, ya), fmt(-xa, -ya)], rng)
    xc, yc = pts["C"]
    n = xc * xc + yc * yc
    r = math.sqrt(n)
    if r == int(r):
        modulus = short("What is the modulus of the number at C?", int(r), [f"|z| = {int(r)}"])
    else:
        modulus = short("What is the modulus of the number at C? Give your answer to 1 decimal place.", f"{r:.1f}",
                        [f"√{n}", f"sqrt({n})", f"{r:.2f}"])
    conj = (xa, -ya)
    holders = [k for k, v in pts.items() if v == conj and k != "A"]
    if holders:
        last = mcq("Which point represents the conjugate of the number at A?", holders[0], ["A", "B", "C", "none of them"], rng)
    else:
        last = short("What is the sum of the numbers at A and C?", fmt(xa + xc, ya + yc), forms(xa + xc, ya + yc))
    return [which, number, modulus, last]
