"""Triangular graphs (UP): a triangle with 10% gridlines for three parts that add to 100%, and lettered points on
gridline crossings. Either soil texture (sand, silt and clay) or employment structure (primary, secondary and
tertiary jobs). The percentage of one part at a point, of another part at another point, and which point has the
most of a part.

Every key is the point's place: each part is read along its own gridlines, labelled on its own side of the triangle,
and the three parts of every point add to 100.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon

from ..core import INK, NAMES, mcq, new_figure, short

ID = "ternary_graph"
KIND = "graph.line"
SUBJECT = "geography"
BANDS = ("UP",)
CONCEPTS = tuple(f"geography.{c}" for c in ("soil-properties", "soil-classification", "development-indicators", "statistical-presentation"))
AVOID = r"exam-style|^introduction$|hiv|trade and commerce|transport and communication"  # topics that teach none of it, read by name and section (P3m)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"soil|texture|employment|development|economic|statistic|graph|triangular|ternary"
CONTEXTS = {"soil": ["sand", "silt", "clay"], "employment": ["primary", "secondary", "tertiary"]}
H = math.sqrt(3) / 2


def concepts_for(p: dict) -> frozenset[str]:
    keep = ("soil-properties", "soil-classification") if p["context"] == "soil" else ("development-indicators",)
    return frozenset(f"geography.{c}" for c in keep + ("statistical-presentation",))


def xy(v) -> tuple[float, float]:
    """Parts (left vertex, right vertex, top vertex) in % to a place on the triangle, sides 100 long."""
    a, b, c = v
    return b + c / 2, c * H


def sample(rng: random.Random) -> dict:
    context = rng.choice(sorted(CONTEXTS))
    crossings = [(a, b, 100 - a - b) for a in range(10, 90, 10) for b in range(10, 90, 10) if 100 - a - b >= 10]
    while True:
        pts = dict(zip("ABCD", rng.sample(crossings, 4)))
        most = rng.randrange(3)
        values = [v[most] for v in pts.values()]
        if values.count(max(values)) == 1:
            first, second = rng.sample(range(3), 2)
            return {"band": "UP", "context": context, "parts": CONTEXTS[context], "points": {k: list(v) for k, v in pts.items()},
                    "ask": [rng.choice("ABCD"), first, rng.choice("ABCD"), second], "most": most}


def draw(p: dict):
    fig, ax = new_figure(6.6, 6.0)
    parts = p["parts"]
    ax.add_patch(Polygon([(0, 0), (100, 0), (50, 100 * H)], closed=True, facecolor="#f7f8f4", edgecolor=INK, linewidth=1.5))
    for k in range(10, 100, 10):
        # constant top part (horizontal), constant right part (parallel to the left side), constant left part (parallel to the right)
        for a, b in (((0, 100 - k, k), (100 - k, 0, k)), ((100 - k, k, 0), (0, k, 100 - k)), ((k, 100 - k, 0), (k, 0, 100 - k))):
            (x1, y1), (x2, y2) = xy(a), xy(b)
            ax.plot([x1, x2], [y1, y2], color="#b9c2ca", linewidth=0.7, zorder=1)
    # angled ticks: each number at the end of a short tick that carries on its own part's gridline beyond the edge, so it
    # is plain which lines to follow (P3o review)
    for k in range(0, 101, 10):
        for edge, inside, ha, va in (((100 - k, 0, k), (0, 100 - k, k), "right", "center"),   # top part: horizontal lines
                                     ((0, k, 100 - k), (100 - k, k, 0), "left", "center"),    # right part: parallel to the left side
                                     ((k, 100 - k, 0), (k, 0, 100 - k), "center", "top")):    # left part: parallel to the right side
            (x0, y0), (x1, y1) = xy(edge), xy(inside)
            d = math.hypot(x1 - x0, y1 - y0) or 1.0
            ux, uy = (x0 - x1) / d, (y0 - y1) / d  # outward, along the gridline
            (line,) = ax.plot([x0, x0 + 3.5 * ux], [y0, y0 + 3.5 * uy], color=INK, linewidth=0.9)
            line.set_gid("tick")
            ax.text(x0 + 5.5 * ux, y0 + 5.5 * uy, str(k), ha="center", va="center", fontsize=8)
    ax.text(3.0, 56.0, f"% {parts[2]}", ha="center", va="center", fontsize=10.5, fontweight="bold", rotation=60)
    ax.text(99.0, 58.0, f"% {parts[1]}", ha="center", va="center", fontsize=10.5, fontweight="bold", rotation=-60)
    ax.text(50, -16, f"% {parts[0]}", ha="center", va="center", fontsize=10.5, fontweight="bold")
    for name, v in p["points"].items():
        x, y = xy(v)
        ax.plot([x], [y], marker="o", markersize=7, color="#c0392b", markeredgecolor=INK, zorder=4)
        ax.text(x + 1.8, y + 1.8, name, ha="left", va="bottom", fontsize=11.5, fontweight="bold", zorder=5,
                bbox=dict(boxstyle="square,pad=0.05", facecolor="white", edgecolor="none", alpha=0.85))
    ax.set_title("Soil texture" if p["context"] == "soil" else "Employment structure", fontsize=11)
    ax.set_xlim(-22, 124)
    ax.set_ylim(-20, 100 * H + 8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "in a fieldwork project"]


def _part(context: str, name: str, point: str) -> str:
    # "of tertiary jobs at point A" read as a share of all tertiary jobs (P3m review): the jobs at the point, in a sector
    return f"{name} is there at point {point}" if context == "soil" else f"the jobs at point {point} are {name}"


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    parts, pts, ctx = p["parts"], p["points"], p["context"]
    x, i, y, j = p["ask"]
    most = parts[p["most"]]
    top = max(pts, key=lambda k: pts[k][p["most"]])
    what = "soil samples" if ctx == "soil" else "countries"
    return [short(f"{who} plots {what} on this triangular graph {rng.choice(SETTINGS)}. What percentage of {_part(ctx, parts[i], x)}?",
                  pts[x][i], [str(pts[x][i]), f"{pts[x][i]}%", f"{pts[x][i]} %"]),
            short(f"{friend} reads another point. What percentage of {_part(ctx, parts[j], y)}?", pts[y][j],
                  [str(pts[y][j]), f"{pts[y][j]}%", f"{pts[y][j]} %"]),
            mcq(f"Which point has the most {most}{'' if ctx == 'soil' else ' jobs'}?", f"Point {top}", [f"Point {k}" for k in "ABCD" if k != top], rng)]
