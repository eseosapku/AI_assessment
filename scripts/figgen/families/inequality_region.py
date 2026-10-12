"""A region R on a grid, bounded by lines: which inequalities describe it, which point lies in it,
and the largest whole x in it on a given row (LS, UP).

A solid line is included (≤, ≥), a dashed one is not (<, >). Lower Secondary bounds R by
vertical and horizontal lines; Upper Secondary adds a sloping line. Each wrong description is
kept only if it describes a different set of grid points.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon

from ..core import FILL_2, GRID, INK, infinite, label_spot, mcq, new_figure, short

ID = "inequality_region"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "regions-plane", "simultaneous-linear-inequalities-solving", "inequalities-forming-solving", "linear-inequalities-solving",
))

LIM = 6
FLIP = {"≤": "≥", "≥": "≤", "<": ">", ">": "<"}
STRICT = {"≤": "<", "<": "≤", "≥": ">", ">": "≥"}


def _rhs(c: dict) -> str:
    if c["var"] in ("x", "y") and "m" not in c:
        return str(c["k"])
    m, k = c["m"], c["k"]
    term = {1: "x", -1: "-x"}.get(m, f"{m}x")
    return term + (f" + {k}" if k > 0 else f" - {-k}" if k < 0 else "")


def text(c: dict) -> str:
    return f"{c['var']} {c['op']} {_rhs(c)}"


def _line(c: dict) -> str:
    """The boundary line itself: x = 2, y = 2x + 1."""
    return f"{c['var']} = {_rhs(c)}"


def _holds(c: dict, x: float, y: float) -> bool:
    left = x if c["var"] == "x" else y
    right = c["m"] * x + c["k"] if "m" in c else c["k"]
    return {"≤": left <= right, "≥": left >= right, "<": left < right, ">": left > right}[c["op"]]


def contains(p: dict, x: float, y: float) -> bool:
    return all(_holds(c, x, y) for c in p["conds"])


def _points(conds: list[dict]) -> frozenset:
    return frozenset((x, y) for x in range(-8, 9) for y in range(-8, 9) if all(_holds(c, x, y) for c in conds))


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        # Never on an axis: a dashed boundary drawn over an axis looks solid.
        a, b = sorted(rng.sample([v for v in range(-5, 6) if v], 2))
        c, d = sorted(rng.sample([v for v in range(-5, 6) if v], 2))
        if b - a < 3 or d - c < 3:
            continue
        conds = [{"var": "x", "op": rng.choice(["≥", ">"]), "k": a}, {"var": "y", "op": rng.choice(["≥", ">"]), "k": c}]
        if band == "LS":
            conds += [{"var": "x", "op": rng.choice(["≤", "<"]), "k": b}, {"var": "y", "op": rng.choice(["≤", "<"]), "k": d}]
        else:
            m = rng.choice([1, -1, 2, -2])
            k = rng.randint(-3, 4)
            conds.append({"var": "y", "op": rng.choice(["≤", "<"]), "m": m, "k": k})
        p = {"band": band, "conds": conds}
        pts = _points(conds)
        inside_view = [q for q in pts if abs(q[0]) <= LIM and abs(q[1]) <= LIM]
        if 4 <= len(inside_view) and len(pts) == len(inside_view):  # bounded, and all of it in the picture
            return p


def _clip(poly, c):
    """The part of a polygon on the allowed side of one boundary line (Sutherland-Hodgman)."""
    def f(pt):
        x, y = pt
        left = x if c["var"] == "x" else y
        right = c["m"] * x + c["k"] if "m" in c else c["k"]
        return (left - right) if c["op"] in ("≥", ">") else (right - left)
    out = []
    for i, cur in enumerate(poly):
        prev = poly[i - 1]
        fc, fp = f(cur), f(prev)
        if fc >= 0:
            if fp < 0:
                t = fp / (fp - fc)
                out.append((prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])))
            out.append(cur)
        elif fp >= 0:
            t = fp / (fp - fc)
            out.append((prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])))
    return out


def draw(p: dict):
    fig, ax = new_figure(5.4, 5.4)
    ax.set_xticks(range(-LIM, LIM + 1))
    ax.set_yticks(range(-LIM, LIM + 1))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    for s in ("left", "bottom"):
        ax.spines[s].set_position("zero")
    poly = [(-LIM - 0.5, -LIM - 0.5), (LIM + 0.5, -LIM - 0.5), (LIM + 0.5, LIM + 0.5), (-LIM - 0.5, LIM + 0.5)]
    for c in p["conds"]:
        poly = _clip(poly, c)
    ax.add_patch(Polygon(poly, closed=True, facecolor=FILL_2, edgecolor="none", alpha=0.9, zorder=0.5))
    cx, cy = label_spot(poly)
    ax.text(cx, cy, "R", ha="center", va="center", fontsize=14, fontweight="bold")
    ends = (-LIM - 0.5, LIM + 0.5)
    for c in p["conds"]:
        style = (0, (5, 3)) if c["op"] in ("<", ">") else "solid"
        if c["var"] == "x":
            infinite(ax.plot([c["k"], c["k"]], list(ends), color=INK, linewidth=1.6, linestyle=style))
        elif "m" in c:
            infinite(ax.plot(list(ends), [c["m"] * x + c["k"] for x in ends], color=INK, linewidth=1.6, linestyle=style))
        else:
            infinite(ax.plot(list(ends), [c["k"], c["k"]], color=INK, linewidth=1.6, linestyle=style))
    ax.set_xlim(-LIM - 0.5, LIM + 0.5)
    ax.set_ylim(-LIM - 0.5, LIM + 0.5)
    ax.tick_params(labelsize=8)
    ax.set_aspect("equal")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    conds = p["conds"]
    right = ", ".join(text(c) for c in conds)
    region = _points(conds)
    wrong = []
    for i, c in enumerate(conds):
        for change in ({"op": FLIP[c["op"]]}, {"op": STRICT[c["op"]]}, {"var": "y" if c["var"] == "x" else "x"} if "m" not in c else {"k": c["k"] + 1}):
            alt = [dict(d) for d in conds]
            alt[i].update(change)
            t = ", ".join(text(d) for d in alt)
            if _points(alt) != region and t not in wrong and t != right:
                wrong.append(t)
    lines = ", ".join(_line(c) for c in conds)
    which = mcq(f"The region R is bounded by the lines {lines}. Which inequalities describe R?", right,
                rng.sample(wrong, min(3, len(wrong))), rng)
    # One grid point inside R; three outside, one of them on a dashed edge where there is one.
    inside = rng.choice(sorted(region))
    near = [(x, y) for x in range(-LIM, LIM + 1) for y in range(-LIM, LIM + 1) if (x, y) not in region
            and min(abs(x - a) + abs(y - b) for a, b in region) <= 2]
    out = rng.sample(near, 3)
    point = mcq("Which of these points lies in the region R?", f"({inside[0]}, {inside[1]})", [f"({x}, {y})" for x, y in out], rng)
    k = rng.choice(sorted({y for _, y in region}))
    best = max(x for x, y in region if y == k)
    largest = short(f"A point in R has whole-number coordinates and y = {k}. What is the largest possible x-coordinate?", best,
                    [f"x = {best}"])
    return [which, point, largest]
