"""A reciprocal curve y = k/(x - p) + q with its asymptotes dashed: the vertical and horizontal
asymptotes, where it crosses the y-axis, its equation, what y does as x tends to p from the right,
and a value read off the curve (UP, AL).

p divides k, so the curve crosses the y-axis at a whole number, and the value asked for is read where
x - p divides k: every value is a lattice point. The asymptotes lie on gridlines.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, curve, function_axes, mcq, new_figure, short

ID = "rational_graph"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("asymptotes", "rational-functions", "curves-relationships"))
# Reciprocal curves: not probability, hyperbolic, exponential or trigonometric chapters, nor polynomial roots.
AVOID = r"random variable|hyperbolic|logarithm|exponential|trigonometric|roots of polynomial"


def sample(rng: random.Random) -> dict:
    while True:
        k = rng.choice([1, 2, 3, 4, 6, -1, -2, -3, -4, -6])
        h = rng.choice([d for d in (-3, -2, -1, 1, 2, 3) if k % d == 0])
        q = rng.randint(-3, 3)
        if q - k // h != 0:  # a y-intercept at the origin would sit on both axes' numbers
            return {"band": rng.choice(BANDS), "k": k, "p": h, "q": q, "name": rng.choice(NAMES)}


def view(p: dict) -> tuple[int, int, int, int]:
    return min(p["p"] - 5, -1), max(p["p"] + 5, 1), min(p["q"] - 6, -1), max(p["q"] + 6, 1)


def equation(k: int, h: int, q: int) -> str:
    """y = 2/(x - 1) + 3, y = -3/(x + 3) - 1, y = 4/(x - 2)."""
    return f"y = {k}/(x {'-' if h > 0 else '+'} {abs(h)})" + ("" if q == 0 else f" {'+' if q > 0 else '-'} {abs(q)}")


def draw(p: dict):
    k, h, q = p["k"], p["p"], p["q"]
    x0, x1, y0, y1 = view(p)
    fig, ax = new_figure(5.8, 5.8)
    function_axes(ax, x0, x1, y0, y1)
    lo, hi = y0 - 0.5, y1 + 0.5
    curve(ax, lambda x: k / (x - h) + q, x0 - 0.5, h - 1e-3, lo, hi, n=1200)
    curve(ax, lambda x: k / (x - h) + q, h + 1e-3, x1 + 0.5, lo, hi, n=1200)
    dash = {"color": INK, "linewidth": 1.1, "linestyle": (0, (5, 4))}
    ax.plot([h, h], [lo, hi], **dash)
    ax.plot([x0 - 0.5, x1 + 0.5], [q, q], **dash)
    ax.set_title("y = f(x)", fontsize=12)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    k, h, q = p["k"], p["p"], p["q"]
    x0, x1, _, _ = view(p)
    vert = short(f"{p['name']} drew the curve y = f(x) and its asymptotes. What is the equation of the vertical asymptote?",
                 f"x = {h}", [f"x={h}", str(h)])
    horiz = short("What is the equation of the horizontal asymptote?", f"y = {q}", [f"y={q}", str(q)])
    c0 = q - k // h
    cross = short("Where does the curve cross the y-axis? Give the y-coordinate.", c0, [f"(0, {c0})", f"(0,{c0})", f"y = {c0}", f"y={c0}"])
    # The sign of k and of p: each wrong in two of the four options.
    eq = mcq("Which equation is drawn?", equation(k, h, q), [equation(-k, h, q), equation(k, -h, q), equation(-k, -h, q)], rng)
    up, down = "increases without limit", "decreases without limit"
    toward = mcq(f"As x tends to {h} from the right, what happens to y?", up if k > 0 else down,
                 [down if k > 0 else up, f"it tends to {q}", "it tends to 0" if q else "it tends to 1"], rng)
    xs = [h + d for d in range(-5, 6) if d and k % d == 0 and h + d != 0 and x0 <= h + d <= x1 and abs(k // d) <= 6]
    xq = rng.choice(xs)
    reading = short(f"{p['name']}'s graph is drawn for {x0} ≤ x ≤ {x1}. What is the value of y when x = {xq}?", k // (xq - h) + q)
    return [vert, horiz, cross, eq, toward, reading]
