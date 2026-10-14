"""Turning points of a curve: the maximum, where the gradient is negative, how many times the curve
meets y = k, and at A Level which turning point has a positive second derivative (UP, AL).

A cubic is a(x - c)³ - 3a(x - c) + e expanded, with turning points at x = c - 1 and c + 1 and values
e + 2a and e - 2a, so both are lattice points; a quadratic is a(x - h)² + k. The equation is printed
and the turning points are marked A (and B). y = k is asked only at a k that is no turning value, so
the number of solutions is never a matter of touching.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, curve, function_axes, mcq, new_figure, poly, short

ID = "stationary_points"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "stationary-points", "optimization-practical-maximum-minimum", "derivatives-second", "cubic-polynomials-graphs-moduli",
))
# Polynomial turning points: not exponential, logarithmic or trigonometric chapters, nor modulus equations.
AVOID = r"logarithm|exponential|trigonometric|conics|scale drawings, bearings|simultaneous equations|^integration$"


def value(co, x):
    return sum(c * x ** (len(co) - 1 - i) for i, c in enumerate(co))


def sample(rng: random.Random) -> dict:
    while True:
        p = _draw_numbers(rng)
        # A turning point on an axis, or one square from the x-axis, would put its letter on the axis numbers.
        if all(x != 0 and abs(y) >= 2 for x, y in p["points"]):
            return p


def _draw_numbers(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if band == "AL" or rng.random() < 0.65:
        a, c, e = rng.choice([-3, -2, -1, 1, 2, 3]), rng.randint(-3, 3), rng.randint(-3, 3)
        co = [a, -3 * a * c, 3 * a * c * c - 3 * a, -a * c ** 3 + 3 * a * c + e]
        points = [[c - 1, e + 2 * a], [c + 1, e - 2 * a]]
        kind = "cubic"
    else:
        a, h, k = rng.choice([-1, 1]), rng.randint(-3, 3), rng.randint(-4, 4)
        co = [a, -2 * a * h, a * h * h + k]
        points = [[h, k]]
        kind = "quadratic"
    return {"band": band, "kind": kind, "coeffs": co, "points": points, "equation": poly(co), "name": rng.choice(NAMES)}


def view(p: dict) -> tuple[int, int, int, int]:
    xs, ys = [x for x, _ in p["points"]], [y for _, y in p["points"]]
    return min(min(xs) - 2, 0), max(max(xs) + 2, 0), min(min(ys) - 3, 0), max(max(ys) + 3, 0)


def draw(p: dict):
    x0, x1, y0, y1 = view(p)
    fig, ax = new_figure(5.8, 5.8)
    function_axes(ax, x0, x1, y0, y1, ystep=1 if y1 - y0 <= 16 else 2)
    curve(ax, lambda x: value(p["coeffs"], x), x0 - 0.5, x1 + 0.5, y0 - 0.5, y1 + 0.5)
    for (x, y), name in zip(p["points"], "AB"):
        ax.plot([x], [y], marker="o", markersize=6, color=INK, linestyle="none", zorder=5)
        # The letter outside the bend: above a maximum, below a minimum.
        top = all(y >= value(p["coeffs"], x + d) for d in (-0.5, 0.5))
        ax.text(x, y + (0.6 if top else -0.6), name, fontsize=12, fontweight="bold", ha="center", va="center")
    ax.set_title(f"y = {p['equation']}", fontsize=12)
    return fig


def _pt(x, y) -> str:
    return f"({x}, {y})"


def questions(p: dict, rng: random.Random) -> list:
    eq, pts, lead = p["equation"], p["points"], p["coeffs"][0]
    qs = []
    if p["kind"] == "cubic":
        (xa, ya), (xb, yb) = pts
        (tx, ty), (bx, by) = sorted(pts, key=lambda q: -q[1])
        qs.append(mcq(f"{p['name']} drew the graph of y = {eq}. What are the coordinates of its maximum point?", _pt(tx, ty),
                      [_pt(bx, by), _pt(tx, by), _pt(bx, ty)], rng))  # each coordinate wrong in two of four
        between, outside = f"{xa} < x < {xb}", f"x < {xa} or x > {xb}"
        right = between if lead > 0 else outside
        # Every wrong region takes in somewhere the gradient is not negative: "x < A" is part of the
        # answer when the curve falls outside its turning points, so it is never offered then.
        wrong = [outside, f"x < {xa}", f"x > {xb}"] if lead > 0 else [between, f"x > {xa}", f"x < {xb}"]
        qs.append(mcq("For which values of x is the gradient of the curve negative?", right, wrong, rng))
        lo, hi = min(ya, yb), max(ya, yb)
    else:
        (h, k), = pts
        qs.append(mcq(f"{p['name']} drew the graph of y = {eq}. What are the coordinates of its turning point?", _pt(h, k),
                      [_pt(-h, k), _pt(h, -k), _pt(-h, -k)], rng))  # each sign wrong in two of four
        right = f"x < {h}" if lead > 0 else f"x > {h}"
        # Wrong regions that take in where the gradient is positive: "x > 2" when it is negative for
        # x > -2 would be true as well.
        wrong = [f"x > {h}", f"x > {h - 2}", f"x < {h + 2}"] if lead > 0 else [f"x < {h}", f"x < {h + 2}", f"x > {h - 2}"]
        qs.append(mcq("For which values of x is the gradient of the curve negative?", right, wrong, rng))
        lo = hi = k
    x0, x1, y0, y1 = view(p)
    ks = [v for v in range(y0, y1 + 1) if v not in (lo, hi)]
    level = rng.choice(ks)
    if p["kind"] == "cubic":
        n = 3 if lo < level < hi else 1
    else:
        n = 2 if (level > lo) == (lead > 0) else 0
    qs.append(short(f"Use the graph to find how many solutions the equation {eq} = {level} has.", n,
                    [f"{n} solutions" if n != 1 else "1 solution"]))
    if p["band"] == "AL" and p["kind"] == "cubic":
        (xa, ya), (xb, yb) = pts
        qs.append(mcq("At which of the marked points is d²y/dx² > 0?", "A" if ya < yb else "B",
                      ["B" if ya < yb else "A", "both A and B", "neither A nor B"], rng))
    return qs
