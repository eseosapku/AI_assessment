"""The area under a curve as a definite integral: the shaded area, the integral that gives it, and
the value of a neighbouring integral (UP, AL).

The curve is y = 3αx² + 2βx + γ, the derivative of αx³ + βx² + γx, so every integral between whole
numbers is a whole number. The shaded region lies above the x-axis: the curve is positive across it.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import FILL_2, INK, NAMES, curve, function_axes, mcq, new_figure, poly, short

ID = "area_under_curve"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("definite-integrals", "integration", "indefinite-integrals", "differentiation-reversed"))
# The area under a polynomial: not mechanics, hyperbolic functions, probability density or differential equations.
AVOID = r"equilibrium|hooke|hyperbolic|projectile|random variable|differential equation|circular motion"


def value(co, x):
    return sum(c * x ** (len(co) - 1 - i) for i, c in enumerate(co))


def antiderivative(co) -> list:
    return [Fraction(c, len(co) - i) for i, c in enumerate(co)] + [0]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        al, be, ga = rng.choice([1, 1, -1, 0]), rng.randint(-3, 3), rng.randint(-2, 12)
        if al == 0 and be == 0:
            continue
        co = [3 * al, 2 * be, ga] if al else [2 * be, ga]
        a = rng.randint(-2, 2)
        b = a + rng.choice([1, 2, 3])
        on = [value(co, a + (b - a) * k / 100) for k in range(101)]
        around = [value(co, a - 1 + (b - a + 2) * k / 100) for k in range(101)]
        if min(on) < 1 or max(on) > 24 or max(around) < 2:
            continue
        return {"band": band, "coeffs": co, "a": a, "b": b, "equation": poly(co), "name": rng.choice(NAMES)}


def view(p: dict) -> tuple[int, int, int, int]:
    co, a, b = p["coeffs"], p["a"], p["b"]
    top = max(value(co, a + (b - a) * k / 100) for k in range(101))
    return min(a - 1, 0), max(b + 1, 0), -1, int(top) + 2


def draw(p: dict):
    co, a, b = p["coeffs"], p["a"], p["b"]
    x0, x1, y0, y1 = view(p)
    fig, ax = new_figure(5.8, 5.4)
    function_axes(ax, x0, x1, y0, y1, ystep=1 if y1 - y0 <= 14 else 2)
    xs = [a + (b - a) * k / 200 for k in range(201)]
    # Under the axes, so the shading never hides the y-axis numbers where it crosses them.
    ax.fill_between(xs, 0, [value(co, x) for x in xs], color=FILL_2, linewidth=0, zorder=0.2)
    for x in (a, b):
        ax.plot([x, x], [0, value(co, x)], color=INK, linewidth=1.1)
    curve(ax, lambda x: value(co, x), x0 - 0.5, x1 + 0.5, y0 - 0.5, y1 + 0.5)
    ax.set_title(f"y = {p['equation']}", fontsize=12)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    co, a, b, eq = p["coeffs"], p["a"], p["b"], p["equation"]
    F = antiderivative(co)
    integral = lambda lo, hi: int(value(F, Fraction(hi)) - value(F, Fraction(lo)))  # noqa: E731
    area = integral(a, b)
    shaded = short(f"{p['name']} shaded a region under the curve y = {eq}. Calculate the area of the shaded region.", area,
                   [f"{area} units²", f"{area} units2", f"{area} square units"])
    form = lambda lo, hi, f: f"∫ from {lo} to {hi} of ({f}) dx"  # noqa: E731
    # The antiderivative in place of the curve: its coefficients are whole numbers by construction.
    # The limits' order and the curve (or its antiderivative): each wrong in two of the four options.
    Feq = poly([int(c) for c in F])
    which = mcq("Which integral gives the shaded area?", form(a, b, eq), [form(b, a, eq), form(a, b, Feq), form(b, a, Feq)], rng)
    # Read on the drawing: the height of the shaded region where it ends (every part of it is drawn).
    h = int(value(co, b))
    part = short("How high is the right-hand edge of the shaded region?", h, [f"y = {h}", f"{h} units"])
    return [shaded, which, part]
