"""The tangent to a curve at a point: its gradient from two points on it, the curve's gradient from
the derivative, the tangent's equation and the normal's gradient (UP).

The curve is a quadratic or a cubic with whole-number coefficients, its equation printed. P is a
lattice point where the gradient is a whole number from -6 to 6, never 0, and Q is a second lattice
point on the tangent at least two squares from P, so both read exactly off the grid.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import INK, NAMES, curve, frac, function_axes, infinite, mcq, new_figure, poly, short

ID = "tangent_gradient"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP",)
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "curve-gradient", "gradient-function", "tangents-normals", "rates-of-change", "differentiation-applications",
))
# Tangents to polynomial curves: not vectors, circular measure, rates of pay, trig identities or integrals.
AVOID = r"vector|circular measure|ratio, rate|trigonometric formulae|integration|reversed|differential equation"


def value(co, x):
    return sum(c * x ** (len(co) - 1 - i) for i, c in enumerate(co))


def slope(co, x):
    n = len(co) - 1
    return sum(c * (n - i) * x ** (n - i - 1) for i, c in enumerate(co[:-1]))


def sample(rng: random.Random) -> dict:
    while True:
        if rng.random() < 0.6:
            co = [rng.choice([1, -1]), rng.randint(-4, 4), rng.randint(-4, 4)]
            xp = rng.randint(-3, 3)
        else:  # a cubic ax³ + bx + c: its gradient 3ax² + b changes with x
            co = [rng.choice([1, -1]), 0, rng.randint(-4, 3), rng.randint(-3, 3)]
            xp = rng.randint(-2, 2)
        g, yp = slope(co, xp), value(co, xp)
        if g == 0 or abs(g) > 6 or abs(yp) > 8:
            continue
        steps = [d for d in (-3, -2, 2, 3) if abs(yp + g * d) <= 10]
        if not steps:
            continue
        d = rng.choice(steps)
        return {"band": "UP", "coeffs": co, "P": [xp, yp], "Q": [xp + d, yp + g * d], "name": rng.choice(NAMES)}


def view(p: dict) -> tuple[int, int, int, int]:
    (xp, yp), (xq, yq) = p["P"], p["Q"]
    return min(xp, xq, 0) - 2, max(xp, xq, 0) + 2, min(yp, yq, 0) - 2, max(yp, yq, 0) + 2


def draw(p: dict):
    co, (xp, yp), (xq, yq) = p["coeffs"], p["P"], p["Q"]
    x0, x1, y0, y1 = view(p)
    fig, ax = new_figure(5.8, 5.8)
    function_axes(ax, x0, x1, y0, y1, ystep=1 if y1 - y0 <= 16 else 2)
    lo, hi = x0 - 0.5, x1 + 0.5
    curve(ax, lambda x: value(co, x), lo, hi, y0 - 0.5, y1 + 0.5)
    g = slope(co, xp)
    infinite(ax.plot([lo, hi], [yp + g * (lo - xp), yp + g * (hi - xp)], color=INK, linewidth=1.3, linestyle=(0, (6, 3))))
    for (x, y), name in (((xp, yp), "P"), ((xq, yq), "Q")):
        ax.plot([x], [y], marker="o", markersize=6, color=INK, linestyle="none", zorder=5)
        # The letter on the side away from the line's slope, so it never sits on the curve or line.
        dx = -0.45 if g > 0 else 0.45
        ax.text(x + dx, y + 0.45, name, fontsize=12, fontweight="bold", ha="center", va="center")
    ax.set_title(f"y = {poly(co)}", fontsize=12)
    return fig


def line(m: int, c: int) -> str:
    """y = mx + c as a student writes it: y = 2x + 3, y = -x, y = 3x - 1."""
    lead = {1: "", -1: "-"}.get(m, str(m))
    return f"y = {lead}x" + ("" if c == 0 else f" {'+' if c > 0 else '-'} {abs(c)}")


def questions(p: dict, rng: random.Random) -> list:
    co, (xp, yp) = p["coeffs"], p["P"]
    g, eq = slope(co, xp), poly(co)
    c = yp - g * xp
    grad = short(f"{p['name']} drew the tangent to y = {eq} at P. Use the marked points P and Q to find the gradient of "
                 "the tangent.", g)
    xr = rng.choice([x for x in range(-3, 4) if x != xp])
    at = short(f"Find the gradient of the curve drawn at the point where x = {xr}.", slope(co, xr))
    wrong = [line(-g, c), line(g, c + g), line(g, yp), line(g, -c if c else 2), line(g, xp)]
    tangent = mcq("Which is the equation of the tangent at P?", line(g, c), [w for w in wrong if w != line(g, c)], rng)
    n = Fraction(-1, g)
    forms = [frac(n)] + ([f"{float(n):g}"] if n.denominator in (2, 4, 5) else [])  # the decimal where it ends
    normal = short("What is the gradient of the normal to the curve at P?", frac(n), forms)
    return [grad, at, tangent, normal]
