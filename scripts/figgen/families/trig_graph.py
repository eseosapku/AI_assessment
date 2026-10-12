"""A sine or cosine graph for 0 ≤ x ≤ 360: its amplitude, period and greatest value, its equation,
how many times it meets y = k, and a value read at a turning point or crossing (UP).

y = a sin(bx) + c or a cos(bx) + c with whole a, b and c. The x-grid steps by 15°, so every maximum,
minimum and crossing of the middle line is on a gridline; y = k is asked only strictly between the
least and greatest values, and never at the middle line of a sine, which it would meet at 0 and 360
too.
"""
from __future__ import annotations

import math
import random

from ..core import GRID, INK, NAMES, curve, mcq, new_figure, num, short

ID = "trig_graph"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP",)
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "trigonometric-functions-graphs", "trigonometric-inequalities", "equations-inequalities", "simple-harmonic-motion",
))
# Sine and cosine graphs: not differential equations.
AVOID = r"differential equation|solving equations of the type"


def sample(rng: random.Random) -> dict:
    return {"band": "UP", "fn": rng.choice(["sin", "cos"]), "a": rng.choice([1, 2, 3, 4]), "b": rng.choice([1, 2, 3]),
            "c": rng.choice([-2, -1, 0, 1, 2]), "name": rng.choice(NAMES)}


def f(p: dict, x: float) -> float:
    return p["a"] * (math.sin if p["fn"] == "sin" else math.cos)(math.radians(p["b"] * x)) + p["c"]


def equation(a: int, b: int, c: int, fn: str) -> str:
    """y = 2sin(3x) + 1, y = cos(x), y = 3cos(2x) - 1."""
    return f"y = {'' if a == 1 else a}{fn}({'' if b == 1 else b}x)" + ("" if c == 0 else f" {'+' if c > 0 else '-'} {abs(c)}")


def draw(p: dict):
    a, c = p["a"], p["c"]
    y0, y1 = min(c - a - 1, -1), max(c + a + 1, 1)
    fig, ax = new_figure(7.0, 4.4)
    every = 45 if p["b"] == 2 else 30
    ax.set_xticks(range(0, 361, every))
    ax.set_xticks(range(0, 361, 15), minor=True)
    ax.set_yticks(range(y0, y1 + 1))
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    for s in ("left", "bottom"):
        ax.spines[s].set_position("zero")
    ax.set_xlim(0, 365)
    ax.set_ylim(y0 - 0.3, y1 + 0.3)
    curve(ax, lambda x: f(p, x), 0, 360, y0 - 0.3, y1 + 0.3, n=1440)
    ax.tick_params(labelsize=8)
    ax.text(366, 0, "x", ha="left", va="center", fontsize=11, style="italic", clip_on=False)
    ax.set_title("y = f(x)", fontsize=12)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    a, b, c, fn = p["a"], p["b"], p["c"], p["fn"]
    amp = short(f"{p['name']} drew the graph of y = f(x) for 0 ≤ x ≤ 360. What is its amplitude?", a)
    period = short("What is the period of the graph, in degrees?", 360 // b, [f"{360 // b}°", f"{360 // b} degrees"])
    top = short("What is the greatest value of y?", a + c, [f"y = {a + c}"])
    other = "cos" if fn == "sin" else "sin"
    # sin or cos, by b or another: each wrong in two of the four options, so none can be picked unseen.
    b2 = b + 1 if b < 3 else b - 1
    eq = mcq("Which equation is drawn?", equation(a, b, c, fn), [equation(a, b, c, other), equation(a, b2, c, fn), equation(a, b2, c, other)], rng)
    # Strictly between the least and greatest values, in half units (a sine of amplitude 1 has no whole
    # number there but its middle line, which it meets at 0 and 360 as well).
    ks = [c - a + h / 2 for h in range(1, 4 * a) if not (fn == "sin" and c - a + h / 2 == c)]
    k = num(rng.choice(ks))
    count = short(f"{p['name']} draws the line y = {k} across the graph. How many times does it meet the curve for 0 ≤ x ≤ 360?",
                  2 * b, [f"{2 * b} times"])
    xq = rng.choice([x for x in range(0, 361, 90 // b)])
    reading = short(f"Use {p['name']}'s graph: what is the value of y when x = {xq}?", round(f(p, xq)))
    return [amp, period, top, eq, count, reading]
