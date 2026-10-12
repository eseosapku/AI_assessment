"""Limits and continuity read from a graph: f(a), the limits from the left and the right, whether
the limit exists, and whether f is continuous at a (UP).

f is two straight pieces meeting at x = a: with a jump (the limits differ), a hole (the limits agree
but f(a) is elsewhere), or joined (continuous). An open circle is a value f does not take, a filled
one the value it does; they never sit on the same point.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, function_axes, mcq, new_figure, short

ID = "limit_graph"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("limits-numerical-functions", "one-sided-limits", "function-continuity", "limits-applications"))
# Limits of a function at a point: not integration, nor limits of sequences.
AVOID = r"integration|sequence"
CASES = ("jump", "hole", "continuous")


def sample(rng: random.Random) -> dict:
    while True:
        case = rng.choice(CASES)
        a = rng.randint(-2, 3)
        L = rng.randint(-3, 5)
        R = L if case != "jump" else rng.choice([v for v in range(-3, 6) if abs(v - L) >= 2])
        V = {"jump": rng.choice([L, R]), "hole": rng.choice([v for v in range(-3, 6) if abs(v - L) >= 2]), "continuous": L}[case]
        m1, m2 = rng.choice([-2, -1, 0, 1, 2]), rng.choice([-2, -1, 0, 1, 2])
        x0, x1 = a - rng.choice([2, 3, 4]), a + rng.choice([2, 3, 4])
        ends = [L + m1 * (x0 - a), R + m2 * (x1 - a)]
        if case == "continuous" and m1 == m2 == 0:
            continue
        if max(abs(y) for y in ends) <= 9:
            return {"band": "UP", "case": case, "a": a, "L": L, "R": R, "V": V, "m1": m1, "m2": m2, "x0": x0, "x1": x1,
                    "name": rng.choice(NAMES)}


def view(p: dict) -> tuple[int, int, int, int]:
    a = p["a"]
    ys = [p["L"] + p["m1"] * (p["x0"] - a), p["R"] + p["m2"] * (p["x1"] - a), p["L"], p["R"], p["V"], 0]
    return min(p["x0"], 0) - 1, max(p["x1"], 0) + 1, min(ys) - 1, max(ys) + 1


def draw(p: dict):
    a, L, R, V = p["a"], p["L"], p["R"], p["V"]
    x0, x1, y0, y1 = view(p)
    fig, ax = new_figure(5.6, 5.6)
    function_axes(ax, x0, x1, y0, y1, ystep=1 if y1 - y0 <= 16 else 2)
    ax.plot([p["x0"], a], [L + p["m1"] * (p["x0"] - a), L], color=INK, linewidth=1.8)
    ax.plot([a, p["x1"]], [R, R + p["m2"] * (p["x1"] - a)], color=INK, linewidth=1.8)
    # Both ends of the domain are filled: f is defined there.
    for x, y in ((p["x0"], L + p["m1"] * (p["x0"] - a)), (p["x1"], R + p["m2"] * (p["x1"] - a))):
        ax.plot([x], [y], marker="o", markersize=6, color=INK, linestyle="none", zorder=5)
    if p["case"] != "continuous":
        for y in sorted({L, R}):
            filled = y == V
            ax.plot([a], [y], marker="o", markersize=8, markeredgecolor=INK, markeredgewidth=1.6,
                    markerfacecolor=INK if filled else "white", linestyle="none", zorder=6)
        if V not in (L, R):
            ax.plot([a], [V], marker="o", markersize=8, color=INK, linestyle="none", zorder=6)
    ax.set_title("y = f(x)", fontsize=12)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    a, L, R, V, case = p["a"], p["L"], p["R"], p["V"], p["case"]
    val = short(f"{p['name']}'s graph shows y = f(x) for {p['x0']} ≤ x ≤ {p['x1']}. What is f({a})?", V, [f"f({a}) = {V}"])
    left = short(f"What is the limit of f(x) as x tends to {a} from the left?", L)
    right = short(f"What is the limit of f(x) as x tends to {a} from the right?", R)
    differ, undefined = "No: the limits from the left and the right are different", f"No: f({a}) is not defined"
    if case == "jump":
        exists = mcq(f"Does the limit of f(x) as x tends to {a} exist?", differ, [f"Yes: it is {L}", f"Yes: it is {R}", undefined], rng)
    else:
        exists = mcq(f"Does the limit of f(x) as x tends to {a} exist?", f"Yes: it is {L}",
                     [f"Yes: it is {V}" if V != L else f"Yes: it is {L + 1}", differ, undefined], rng)
    answers = {"jump": f"No: the limit as x tends to {a} does not exist", "hole": f"No: the limit is not equal to f({a})", "continuous": "Yes"}
    # For a jump the limit does not exist, so "it is not equal to f(a)" is arguably true too: not offered.
    wrong = [v for k, v in answers.items() if k != case and not (case == "jump" and k == "hole")] + [undefined]
    cont = mcq(f"Is f continuous at x = {a}?", answers[case], wrong, rng)
    return [val, left, right, exists, cont]
