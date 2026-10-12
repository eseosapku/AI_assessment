"""The graph of y = a(x - p)(x - q), with its equation printed: roots, turning point, intercept,
and solving y = k from the graph (LS, UP).

The roots are whole numbers with p + q even, so the turning point is a grid point too, and
"solve = k" is asked only at a k the curve meets at two grid points.
"""
from __future__ import annotations

import random
import re

from ..core import GRID, INK, mcq, new_figure, short

ID = "quadratic_graph"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "functions-quadratic-graphs", "quadratic-equations-graphical-method", "quadratic-graphs-review", "parabola",
    "quadratic-equations-roots", "quadratic-inequalities",
))


def _poly(a: int, p: int, q: int) -> str:
    """a(x - p)(x - q) written out: x² - 2x - 3, -x² + 4."""
    b, c = -a * (p + q), a * p * q
    out = "x²" if a == 1 else "-x²"
    if b:
        out += f" {'+' if b > 0 else '-'} {'' if abs(b) == 1 else abs(b)}x"
    if c:
        out += f" {'+' if c > 0 else '-'} {abs(c)}"
    return out


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    a = rng.choice([1, -1])
    width = rng.choice([2, 4, 6])
    p = rng.randint(-5, 5 - width)
    q = p + width
    return {"band": band, "a": a, "p": p, "q": q, "equation": _poly(a, p, q)}


def _f(p: dict, x: float) -> float:
    return p["a"] * (x - p["p"]) * (x - p["q"])


def _range(p: dict) -> tuple[int, int, int, int]:
    x0, x1 = p["p"] - 2, p["q"] + 2
    ys = [_f(p, x) for x in range(x0, x1 + 1)]
    return x0, x1, int(min(ys)), int(max(ys))


def draw(p: dict):
    x0, x1, y0, y1 = _range(p)
    y0, y1 = min(y0, -1), max(y1, 1)
    fig, ax = new_figure(5.6, 5.6)
    step = 1 if y1 - y0 <= 16 else 2
    ax.set_xticks(range(x0, x1 + 1))
    ax.set_yticks(range(y0 - y0 % step, y1 + 1, step))
    ax.set_yticks(range(y0, y1 + 1), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    for s in ("left", "bottom"):
        ax.spines[s].set_position("zero")
    xs = [x0 + i * (x1 - x0) / 200 for i in range(201)]
    ax.plot(xs, [_f(p, x) for x in xs], color=INK, linewidth=1.8)
    ax.set_xlim(x0 - 0.5, x1 + 0.5)
    ax.set_ylim(y0 - 0.5, y1 + 0.5)
    ax.tick_params(labelsize=8)
    ax.set_title(f"y = {p['equation']}", fontsize=12)
    return fig


def _two(options: list[str]) -> list[str]:
    """Wrong pairs of roots, never one number twice ("x = 0 or x = 0")."""
    return [o for o in options if not ((m := re.fullmatch(r"x = (-?\d+) or x = (-?\d+)", o)) and m.group(1) == m.group(2))]


def questions(p: dict, rng: random.Random) -> list:
    a, r1, r2, eq = p["a"], p["p"], p["q"], p["equation"]
    h = (r1 + r2) // 2
    k_turn = int(_f(p, h))
    c = int(_f(p, 0))
    roots = mcq(f"The graph of y = {eq} is drawn. Use it to solve {eq} = 0.", f"x = {r1} or x = {r2}",
                _two([f"x = {-r2} or x = {-r1}", f"x = {h} or x = {k_turn}", f"x = 0 or x = {c}", f"x = {r1 - 1} or x = {r2 + 1}"]), rng)
    turn = mcq(f"What are the coordinates of the turning point of y = {eq}?", f"({h}, {k_turn})",
               [f"({k_turn}, {h})", f"({-h}, {k_turn})", f"({h}, {-k_turn})", f"({h}, {c})", f"({h + 1}, {k_turn})"], rng)
    cross = short(f"Where does the graph of y = {eq} cross the y-axis? Give the y-coordinate.", c, [f"(0, {c})", f"y = {c}"])
    # y = k at two grid points: x0 and its mirror image in the axis of symmetry.
    x0 = rng.choice([x for x in range(r1 - 2, r2 + 3) if x not in (r1, r2, h)])
    k = int(_f(p, x0))
    lo, hi = sorted((x0, 2 * h - x0))
    level = mcq(f"Use the graph of y = {eq} to solve {eq} = {k}.", f"x = {lo} or x = {hi}",
                _two([f"x = {r1} or x = {r2}", f"x = {lo - 1} or x = {hi + 1}", f"x = {-hi} or x = {-lo}", f"x = {h} or x = {k}"]), rng)
    xr = rng.choice([x for x in range(r1 - 2, r2 + 3) if x not in (0, x0)])
    reading = short(f"Use the graph of y = {eq}: what is the value of y when x = {xr}?", int(_f(p, xr)))
    qs = [roots, turn, cross, level]
    if p["band"] == "UP":
        inside, outside = f"{r1} < x < {r2}", f"x < {r1} or x > {r2}"
        right = inside if a > 0 else outside
        qs.append(mcq(f"For which values of x is {eq} < 0?", right,
                      [inside if right == outside else outside, f"{-r2} < x < {-r1}", f"x > {r2}", f"x < {r1}"], rng))
    return qs + [reading]
