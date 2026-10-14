"""Exponential growth and decay read from a graph: the starting amount, the half-life or doubling
time, the amount after whole periods, and the equation (UP). A pure variant draws y = kˣ with its
asymptote.

In context the amount halves (or doubles) every T time units, and the y-grid steps by an eighth of
the start (or half of it), so every amount asked for lies on a gridline at a whole-number time.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, count, curve, function_axes, mcq, new_figure, short

ID = "exp_graph"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP",)
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "exponential-equations-practical-applications", "decay-radioactive", "population-growth-problems",
    "continuity-exponential-functions", "exponents-logarithms-applications", "inverse-logarithmic-exponential",
))
# Exponential graphs: not integration, nor limits of rational functions.
AVOID = r"integration|rational and irrational|^sequences$"
# what, its symbol, its unit, the time unit
DECAY = [("the mass of a medicine in a patient's blood", "m", "mg", "hours"), ("the mass of a radioactive sample", "m", "g", "days"),
         ("the mass of a radioactive sample", "m", "g", "years")]
GROWTH = [("the number of bacteria in a dish", "N", "", "hours", "bacteria"),
          ("the number of yeast cells in a bottle of juice", "N", "", "hours", "cells")]


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["decay", "decay", "growth", "pure"])
    name = rng.choice(NAMES)
    if kind == "pure":  # y = a·kˣ, rising, or y = a·(1/k)ˣ, falling
        return {"band": "UP", "kind": kind, "base": rng.choice([2, 3]), "scale": rng.choice([1, 2, 3]), "up": rng.random() < 0.6,
                "name": name}
    T = rng.choice([2, 3, 4, 5])
    if kind == "decay":
        what, symbol, unit, time = rng.choice(DECAY)
        start = rng.choice([40, 80, 160, 200, 240, 320, 400])
        return {"band": "UP", "kind": kind, "what": what, "symbol": symbol, "unit": unit, "time": time, "start": start,
                "period": T, "tmax": 4 * T if 4 * T <= 16 else 3 * T, "ystep": start // 8, "name": name}
    what, symbol, unit, time, noun = rng.choice(GROWTH)
    start = rng.choice([50, 100, 150, 200, 250])
    return {"band": "UP", "kind": kind, "what": what, "symbol": symbol, "unit": unit, "time": time, "noun": noun, "start": start,
            "period": T, "tmax": 3 * T, "ystep": start // 2, "name": name}


def amount(p: dict, t: float) -> float:
    return p["start"] * (2 if p["kind"] == "growth" else 0.5) ** (t / p["period"])


TOP = 9  # the pure variant's grid runs to y = 9


def pure(p: dict, x: float) -> float:
    return p["scale"] * p["base"] ** (x if p["up"] else -x)


def reach(p: dict) -> int:
    """How far along x the pure curve stays on the grid on its rising side."""
    n = 0
    while p["scale"] * p["base"] ** (n + 1) <= TOP:
        n += 1
    return n


def pure_equation(a: int, k: int, up: bool) -> str:
    """y = 2^x, y = 3 × (1/2)^x."""
    base = str(k) if up else f"(1/{k})"
    return f"y = {base}^x" if a == 1 else f"y = {a} × {base}^x"


def view(p: dict) -> tuple[int, int, int, int]:
    if p["kind"] == "pure":
        n = reach(p)
        return (-3, n, 0, TOP) if p["up"] else (-n, 3, 0, TOP)
    top = p["start"] if p["kind"] == "decay" else p["start"] * 8
    return 0, p["tmax"], 0, top


def draw(p: dict):
    x0, x1, y0, y1 = view(p)
    if p["kind"] == "pure":
        fig, ax = new_figure(5.2, 5.6)
        function_axes(ax, x0, x1, -1, y1)
        curve(ax, lambda x: pure(p, x), x0 - 0.5, x1 + 0.5, -1.5, y1 + 0.5)
        ax.set_title("y = f(x)", fontsize=12)
        return fig
    fig, ax = new_figure(6.4, 4.8)
    step = p["ystep"]
    ax.set_xticks(range(0, x1 + 1, 1 if x1 <= 12 else 2))
    ax.set_xticks(range(0, x1 + 1), minor=True)
    ax.set_yticks(range(0, y1 + 1, step * (1 if y1 // step <= 10 else 2)))
    ax.set_yticks(range(0, y1 + 1, step), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(0, x1)
    ax.set_ylim(0, y1 * 1.04)
    curve(ax, lambda t: amount(p, t), 0, x1, 0, y1 * 1.04)
    unit = f" ({p['unit']})" if p["unit"] else ""
    ax.set_xlabel(f"Time ({p['time']})")
    ax.set_ylabel(f"{'Mass' if p['kind'] == 'decay' else 'Number'}{unit}")
    ax.set_title(p["what"][0].upper() + p["what"][1:], fontsize=11)
    ax.tick_params(labelsize=8)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    if p["kind"] == "pure":
        a, k, up = p["scale"], p["base"], p["up"]
        n = reach(p)
        xq = rng.choice([x for x in range(1, n + 1)] if up else [-x for x in range(1, n + 1)])
        # The base, and rising or falling: each wrong in two of the four options.
        return [
            short(f"{p['name']} drew the graph of y = f(x). Where does it cross the y-axis? Give the y-coordinate.", a,
                  [f"(0, {a})", f"y = {a}"]),
            short(f"Use {p['name']}'s graph: what is the value of y when x = {xq}?", round(pure(p, xq))),
            mcq("Which equation is drawn?", pure_equation(a, k, up),
                [pure_equation(a, k, not up), pure_equation(a, 5 - k, up), pure_equation(a, 5 - k, not up)], rng),
            mcq(f"Which line does the curve get closer and closer to as x {'decreases' if up else 'increases'}?", "y = 0",
                ["x = 0", f"y = {a}", "x = 1" if a != 1 else "y = 1"] if a != 1 else ["x = 0", "y = 1", "x = 1"], rng),
        ]
    N0, T, unit, time, sym = p["start"], p["period"], p["unit"], p["time"], p["symbol"]
    grow = p["kind"] == "growth"
    with_unit = lambda v: [f"{v} {unit}"] if unit else []  # noqa: E731
    if grow:
        start = count(f"{p['name']} plotted {p['what']}. How many {p['noun']} were there at the start?", N0, p["noun"])
    else:
        start = short(f"{p['name']} plotted {p['what']}. What was the mass at the start?", N0, with_unit(N0))
    period = short(f"From the graph, what is the {'doubling time' if grow else 'half-life'}, in {time}?", T, [f"{T} {time}"])
    t = rng.choice([T * n for n in (2, 3) if T * n <= p["tmax"] and (N0 * 2 ** n if grow else N0 / 2 ** n) % p["ystep"] == 0])
    later = int(amount(p, t))
    if grow:
        after = count(f"Use {p['name']}'s graph: how many {p['noun']} are there after {t} {time}?", later, p["noun"])
    else:
        after = short(f"Use {p['name']}'s graph: how much is left after {t} {time}?", later, with_unit(later))
    # Doubling or halving, and the period read or one more: each wrong in two of the four options.
    base, other = ("2", "(1/2)") if grow else ("(1/2)", "2")
    eq = mcq(f"Which equation gives {sym} after t {time}?", f"{sym} = {N0} × {base}^(t/{T})",
             [f"{sym} = {N0} × {other}^(t/{T})", f"{sym} = {N0} × {base}^(t/{T + 1})", f"{sym} = {N0} × {other}^(t/{T + 1})"], rng)
    return [start, period, after, eq]
