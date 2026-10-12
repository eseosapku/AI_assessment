"""A straight line on a coordinate grid: gradient, intercept, equation and readings (LS, UP).

Every value asked for is at a grid point: the gradient has a denominator of at most 3, and x
is a multiple of it wherever a reading is asked. At Upper Secondary a second line crosses the
first at a grid point, for simultaneous equations.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, frac, mcq, new_figure, short

ID = "linear_graph"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "linear-functions", "intercepts", "linear-equation-gradient-intercept", "plotting-graphs",
    "simultaneous-equations-graphical", "two-variables-equation",
))

XLIM = (-6, 6)
YLIM = (-8, 8)


def equation(m: Fraction, c: int) -> str:
    """y = 2x + 3, y = -x/2 - 1, y = 2x/3, y = 4."""
    m = Fraction(m)
    if m == 0:
        term = ""
    elif m.denominator == 1:
        term = {1: "x", -1: "-x"}.get(m.numerator, f"{m.numerator}x")
    else:
        top = {1: "x", -1: "-x"}.get(m.numerator, f"{m.numerator}x")
        term = f"{top}/{m.denominator}"
    if not term:
        return f"y = {c}"
    return f"y = {term}" + (f" + {c}" if c > 0 else f" - {-c}" if c < 0 else "")


def _gradient(rng: random.Random, dens=(1, 1, 2, 3)) -> Fraction:
    while True:
        m = Fraction(rng.choice([-3, -2, -1, 1, 2, 3]), rng.choice(dens))
        if abs(m) <= 3:
            return m


def _on_grid(m: Fraction, c: int) -> list[int]:
    """Whole x in range where the line is at a grid point inside the picture."""
    return [x for x in range(XLIM[0], XLIM[1] + 1) if (m * x + c).denominator == 1 and YLIM[0] <= m * x + c <= YLIM[1]]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        m, c = _gradient(rng), rng.randint(-4, 4)
        xs = _on_grid(m, c)
        if len(xs) < 4:
            continue
        p = {"band": band, "m": str(m), "c": c, "xlim": list(XLIM)}
        if band == "UP":
            m2 = _gradient(rng, (1, 1, 2))
            meets = [x for x in xs if m2 != m and abs(x) <= 5]
            if not meets:
                continue
            xi = rng.choice(meets)
            yi = m * xi + c
            c2 = yi - m2 * xi
            if c2.denominator != 1 or not -6 <= c2 <= 6 or len(_on_grid(m2, int(c2))) < 3:
                continue
            p.update(m2=str(m2), c2=int(c2))
        return p


def draw(p: dict):
    fig, ax = new_figure(5.4, 6.4)
    ax.set_xticks(range(XLIM[0], XLIM[1] + 1))
    ax.set_yticks(range(YLIM[0], YLIM[1] + 1))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    for s in ("left", "bottom"):
        ax.spines[s].set_position("zero")
    ax.set_xlim(XLIM[0] - 0.5, XLIM[1] + 0.5)
    ax.set_ylim(YLIM[0] - 0.5, YLIM[1] + 0.5)
    ax.tick_params(labelsize=8)
    lines = [(Fraction(p["m"]), p["c"])] + ([(Fraction(p["m2"]), p["c2"])] if "m2" in p else [])
    for m, c in lines:
        xs = [x / 10 for x in range(10 * (XLIM[0] - 1), 10 * (XLIM[1] + 1) + 1)]
        pts = [(x, float(m) * x + c) for x in xs if YLIM[0] - 0.5 <= float(m) * x + c <= YLIM[1] + 0.5]
        ax.plot([q[0] for q in pts], [q[1] for q in pts], color=INK, linewidth=1.8)
        if len(lines) > 1:  # two lines: each named where it leaves the picture
            lx, ly = pts[int(0.9 * (len(pts) - 1))]
            ax.text(lx + 0.35, ly, "A" if (m, c) == lines[0] else "B", fontsize=13, fontweight="bold", ha="left", va="center")
    ax.set_aspect("equal")
    return fig


def _grad_forms(m: Fraction) -> list[str]:
    forms = [frac(m)]
    if (m * 10).denominator == 1 and m.denominator != 1:
        forms.append(f"{float(m):g}")
    return forms


def questions(p: dict, rng: random.Random) -> list:
    m, c = Fraction(p["m"]), p["c"]
    xs = _on_grid(m, c)
    x_at, x_when = rng.sample([x for x in xs if x != 0] or xs, 2) if len(xs) > 2 else (xs[0], xs[-1])
    two = p["band"] == "UP"
    other = equation(Fraction(p["m2"]), p["c2"]) if two else ""
    # With two lines drawn every question names line A, and the point given is on line A only.
    on_b = (lambda x: Fraction(p["m2"]) * x + p["c2"] == m * x + c) if two else (lambda x: False)
    x_pt = rng.choice([x for x in xs if not on_b(x)] or xs)
    ref, its = ("line A", "line A") if two else ("the line", "its")
    eq = equation(m, c)
    wrong = [equation(-m, c), equation(m, -c) if c else equation(m, c + 1), equation(Fraction(c) if c else Fraction(1), int(m) if m.denominator == 1 else 1),
             equation(1 / m, c), equation(m, c - 1), equation(m, c + 2)]
    qs = [
        short(f"{ref[0].upper() + ref[1:]} passes through ({x_pt}, {int(m * x_pt + c)}). What is the gradient of {its}?", frac(m),
              _grad_forms(m)[1:]),
        short(f"At what value of y does {ref} cross the y-axis?", c, [f"(0, {c})", f"y = {c}"]),
        mcq(f"Which is the equation of {ref}?", eq, [w for w in wrong if w not in (eq, other)], rng),
        short(f"Use the graph: on {ref}, what is y when x = {x_at}?", int(m * x_at + c)),
        short(f"Use the graph: on {ref}, for what value of x is y = {int(m * x_when + c)}?", x_when),
    ]
    if p["band"] == "UP":
        m2, c2 = Fraction(p["m2"]), p["c2"]
        xi = (c2 - c) / (m - m2)
        yi = m * xi + c
        right = f"x = {int(xi)}, y = {int(yi)}"
        xi, yi = int(xi), int(yi)
        wrong = [f"x = {yi}, y = {xi}", f"x = {-xi}, y = {yi}", f"x = {xi}, y = {-yi}", f"x = {xi + 1}, y = {yi}",
                 f"x = {xi}, y = {yi + 2}", f"x = {xi - 2}, y = {yi - 1}", f"x = 0, y = {c}"]
        qs.append(mcq(f"The lines {eq} and {equation(m2, c2)} are drawn. Use the graph to solve the two equations together.",
                      right, [w for w in wrong if w != right], rng))
    return qs
