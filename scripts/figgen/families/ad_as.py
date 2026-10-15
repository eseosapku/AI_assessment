"""Aggregate demand and aggregate supply (AL): an economy's AD and AS on a grid, real GDP in billions of francs across
and the price level (an index) up the side, with one shift and both equilibria lettered E1 and E2, dotted to the axes.

Two sub-types. Short run: a straight AD and SRAS, and either AD shifts (AD1 to AD2) or SRAS shifts (SRAS1 to SRAS2);
which event could have caused the move is asked among four, two causes by two directions (government spending up or
down, firms' costs up or down), so the figure decides it. Keynesian: an AS that is flat, then rising, then upright at
full employment (drawn as three straight pieces, so every equilibrium sits on a gridline crossing), and AD rising
from AD1 to AD2 within or across the ranges; what happens to real GDP and the price level is asked, two outcomes by
two. Both sub-types ask the new price level and the new real GDP, read at E2.

The lines are P = a - bQ and P = c + dQ in grid units, and a shift of AD or SRAS across by a multiple of b + d keeps
the new equilibrium on the grid (the supply_demand pilot's rule). The Keynesian equilibria are chosen on the AS
first, and each AD drawn through its point.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, mcq, new_figure, short
from . import _econ_grid as grid
from .econ_tables import frw

ID = "ad_as"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("AL",)
CONCEPTS = ("economics.aggregate-demand", "economics.aggregate-supply", "economics.macroeconomic-equilibrium")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"aggregate demand|aggregate supply|macro-?equilibrium|\bAD/AS\b"

XU, YU = 1000, 10  # billion Frw and price index points in one grid unit
XMAX, YMAX = 16, 20


def _short(rng: random.Random) -> dict | None:
    b, d = rng.choice([1, 2]), rng.choice([1, 2])
    q1, p1 = rng.randint(5, 10), rng.randint(9, 13)
    a, c = p1 + b * q1, p1 - d * q1
    which = rng.choice(["AD", "AS"])
    s = rng.choice([1, 2]) * (b + d) * rng.choice([1, -1])
    p = {"band": "AL", "kind": "short", "curve": which, "a": a, "b": b, "c": c, "d": d, "a2": a, "c2": c,
         "xunit": XU, "yunit": YU, "e1": [q1, p1]}
    if which == "AD":
        q2 = q1 + b * s // (b + d)
        p2 = c + d * q2
        p["a2"] = a + b * s
    else:
        q2 = q1 + d * s // (b + d)
        p2 = a - b * q2
        p["c2"] = c - d * s
    if not (3 <= q2 <= 13 and 6 <= p2 <= 16):
        return None
    p["e2"] = [q2, p2]
    return p


def _keynes(rng: random.Random) -> dict | None:
    h = rng.randint(6, 9)  # the flat range's price level
    qa = rng.randint(5, 7)  # where AS starts to rise
    run, slope = rng.choice([3, 4]), rng.choice([1, 2])
    qf, pf = qa + run, h + slope * run  # full employment: AS turns upright here
    if pf > 15:
        return None
    flat = [(q, h) for q in range(2, qa)]
    rising = [(q, h + slope * (q - qa)) for q in range(qa + 1, qf)]
    upright = [(qf, pp) for pp in range(pf + 1, 18)]
    ranges = {"flat": flat, "rising": rising, "upright": upright}
    moves = [("flat", "flat"), ("flat", "rising"), ("rising", "rising"), ("rising", "upright"), ("upright", "upright"),
             ("flat", "upright")]
    r1, r2 = rng.choice(moves)
    if r1 == r2:
        if len(ranges[r1]) < 2:
            return None
        e1, e2 = sorted(rng.sample(ranges[r1], 2))
    else:
        e1, e2 = rng.choice(ranges[r1]), rng.choice(ranges[r2])
    b = rng.choice([1, 2])
    a, a2 = e1[1] + b * e1[0], e2[1] + b * e2[0]
    if a2 - a < b * 2:
        return None  # AD moves plainly to the right
    kinks = [[0, h], [qa, h], [qf, pf], [qf, YMAX]]
    return {"band": "AL", "kind": "keynes", "curve": "AD", "a": a, "a2": a2, "b": b, "kinks": kinks, "xunit": XU,
            "yunit": YU, "e1": list(e1), "e2": list(e2)}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["short", "short", "keynes"])
    while True:
        p = _short(rng) if kind == "short" else _keynes(rng)
        if p:
            return p


QEND = 14.2  # the curves stop here, short of the frame, with their names just beyond their ends


def _as_dirs(p: dict, pt) -> list:
    """The directions the AS leaves a point by (grid units): both ways along its piece."""
    if p["kind"] == "short":
        return [(1, p["d"]), (-1, -p["d"])]
    q, pp = pt
    k = p["kinks"]
    for (q0, p0), (q1, p1) in zip(k, k[1:]):
        if q0 <= q <= q1 and min(p0, p1) <= pp <= max(p0, p1) and (q1 - q0) * (pp - p0) == (p1 - p0) * (q - q0):
            return [(q1 - q0, p1 - p0), (q0 - q1, p0 - p1)]
    return []


def draw(p: dict):
    """Drawn in real units, billions of francs across and index points up, so each gridline is the value it marks."""
    fig, ax = new_figure(6.2, 5.2)
    b = p["b"]
    xmax, ymax, qend = XMAX * XU, YMAX * YU, QEND * XU
    line = lambda c0, slope, text, style="-": grid.line(  # noqa: E731
        ax, lambda x: YU * (c0 + slope * x / XU), text, qend, xmax, ymax, style)
    shift_ad = p["curve"] == "AD"
    line(p["a"], -b, "AD1" if shift_ad else "AD")
    if shift_ad:
        line(p["a2"], -b, "AD2", "--")
    if p["kind"] == "short":
        line(p["c"], p["d"], "SRAS" if shift_ad else "SRAS1")
        if not shift_ad:
            line(p["c2"], p["d"], "SRAS2", "--")
    else:
        k = p["kinks"]
        ax.plot([XU * pt[0] for pt in k], [YU * pt[1] for pt in k], color=INK, linewidth=2.0)
        ax.text(XU * (k[-1][0] + 0.2), YU * (YMAX - 0.6), "AS", ha="left", va="center", fontsize=10, fontweight="bold")
    for name in ("E1", "E2"):
        q, pp = p[name.lower()]
        dirs = [(1, -b), (-1, b)] + _as_dirs(p, (q, pp))
        grid.mark(ax, fig, name, (XU * q, YU * pp), [(XU * dx, YU * dy) for dx, dy in dirs], xmax, ymax)
    ax.set_xticks(range(0, xmax + 1, 2 * XU))
    ax.set_xticks(range(0, xmax + 1, XU), minor=True)
    ax.set_xticklabels([frw(x) for x in range(0, xmax + 1, 2 * XU)])
    ax.set_yticks(range(0, ymax + 1, 2 * YU))
    ax.set_yticks(range(0, ymax + 1, YU), minor=True)
    ax.set_xlim(0, xmax)
    ax.set_ylim(0, ymax)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=8.5)
    ax.tick_params(which="minor", length=0)
    ax.set_xlabel("Real GDP (billion Frw)")
    ax.set_ylabel("Price level (index)")
    ax.set_title("Aggregate demand and aggregate supply", fontsize=11.5)
    return fig


VERBS = ["studies", "is given", "draws", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]
# Two causes by two directions: the event behind each kind of shift.
EVENTS = {("AD", 1): "A rise in government spending", ("AD", -1): "A fall in government spending",
          ("AS", 1): "A fall in firms' costs of production", ("AS", -1): "A rise in firms' costs of production"}


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    q2, p2 = p["e2"][0] * p["xunit"], p["e2"][1] * p["yunit"]
    kind = "Keynesian AD/AS diagram" if p["kind"] == "keynes" else "AD/AS diagram"
    qs = [
        short(f"{who} {rng.choice(VERBS)} this {kind} of an economy {rng.choice(SETTINGS)}. The economy moves from "
              "equilibrium E1 to equilibrium E2. What is the new price level at E2?", p2,
              [f"{p2} index points", f"index {p2}"]),
        short("What is real GDP at the new equilibrium E2, in billion Frw?", q2,
              [f"{frw(q2)} billion", f"{q2} billion", f"{frw(q2)} billion Frw", f"{q2} billion Frw", f"{q2:,}"]),
    ]
    if p["kind"] == "short":
        if p["curve"] == "AD":
            key = EVENTS[("AD", 1 if p["a2"] > p["a"] else -1)]
        else:
            key = EVENTS[("AS", 1 if p["c2"] < p["c"] else -1)]  # SRAS lower down is SRAS to the right
        qs.append(mcq("Which event could have moved the economy from E1 to E2?", key, list(EVENTS.values()), rng))
    else:
        (x1, y1), (x2, y2) = p["e1"], p["e2"]
        out = lambda up: "rises" if up else "stays the same"  # noqa: E731
        key = f"Real GDP {out(x2 > x1)} and the price level {out(y2 > y1)}"
        options = [f"Real GDP {out(a)} and the price level {out(b)}" for a in (True, False) for b in (True, False)]
        qs.append(mcq("When AD shifts from AD1 to AD2 along this AS curve, what happens to real GDP and the price level?",
                      key, options, rng))
    return qs
