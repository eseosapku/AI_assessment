"""Flowcharts (LS, UP): Start, an input box, a starting value, one decision and a loop back to it, an output and
Stop, every arrow headed. Three programs: subtract a step while n is above a limit and count the subtractions;
double n while it is at most a limit; add n to a total while n is above 0, taking a step off n each time. The
output for an input, how many times the loop's counting box runs, and the value of n when the flowchart stops.

Every key is the flowchart executed. Not an even/odd test: its output is known without the figure.
"""
from __future__ import annotations

import random

from matplotlib.patches import Ellipse, Polygon, Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "flowchart"
KIND = "process.flow"
SUBJECT = "computing"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("algorithms", "conditional-logic", "iteration-control", "problem-solving-design"))
AVOID = r"spreadsheet|database|network|internet|security|graphic|document|presentation|email|python|html|logic gate|boolean|processor handles|scheduling|introduction to java|introduction to visual basic|complex data structure|digital project"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"flow ?chart|algorithm|problem.solving|decision|loop|iteration|selection|sequence|repetition|program"
FILL = "#eef1f3"


def run(p: dict) -> tuple[int, int, int]:
    """The output, how many times round the loop, and n at the end."""
    v, n, count = p["values"], p["input"], 0
    if p["template"] == "subtract":
        while n > v["limit"]:
            n, count = n - v["step"], count + 1
        return count, count, n
    if p["template"] == "double":
        while n <= v["limit"]:
            n, count = n * 2, count + 1
        return n, count, n
    total = 0
    while n > 0:
        total, n, count = total + n, n - v["step"], count + 1
    return total, count, n


def boxes(p: dict) -> tuple[str, str, list[str], str, str]:
    """The starting value, the decision, the loop's boxes, the output, and the line counted."""
    v = p["values"]
    if p["template"] == "subtract":
        return "count ← 0", f"Is n > {v['limit']}?", [f"n ← n − {v['step']}", "count ← count + 1"], "OUTPUT count", "count ← count + 1"
    if p["template"] == "double":
        return "count ← 0", f"Is n ≤ {v['limit']}?", ["n ← n × 2", "count ← count + 1"], "OUTPUT n", "count ← count + 1"
    return "total ← 0", "Is n > 0?", ["total ← total + n", f"n ← n − {v['step']}"], "OUTPUT total", "total ← total + n"


def sample(rng: random.Random) -> dict:
    t = rng.choice(["subtract", "double", "add"])
    while True:
        if t == "subtract":
            v, start = {"limit": rng.randint(0, 15), "step": rng.randint(3, 9)}, rng.randint(20, 60)
        elif t == "double":
            v, start = {"limit": rng.choice([20, 30, 40, 50, 60, 80, 100])}, rng.randint(1, 9)
        else:
            v, start = {"step": rng.choice([1, 2, 3])}, rng.randint(4, 12)
        p = {"band": rng.choice(BANDS), "template": t, "values": v, "input": start}
        if 2 <= run(p)[1] <= 6:
            return p


def _arrow(ax, a, b):
    ax.annotate("", xy=b, xytext=a, arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.3, shrinkA=0, shrinkB=0, mutation_scale=14))


def _text(ax, x, y, s, size=11):
    ax.text(x, y, s, ha="center", va="center", fontsize=size, family="DejaVu Sans")


def draw(p: dict):
    init, ask, loop, out, _ = boxes(p)
    fig, ax = new_figure(6.4, 7.0)
    cx, ox = 3.6, 8.2  # the main column and the output column
    # Start
    ax.add_patch(Ellipse((cx, 11.4), 2.4, 0.9, facecolor=FILL, edgecolor=INK, linewidth=1.3))
    _text(ax, cx, 11.4, "Start")
    # INPUT n: a parallelogram
    ax.add_patch(Polygon([(cx - 1.5, 9.5), (cx + 1.9, 9.5), (cx + 1.5, 10.3), (cx - 1.9, 10.3)], closed=True, facecolor=FILL,
                         edgecolor=INK, linewidth=1.3))
    _text(ax, cx, 9.9, "INPUT n")
    # the starting value
    ax.add_patch(Rectangle((cx - 1.6, 7.9), 3.2, 0.8, facecolor=FILL, edgecolor=INK, linewidth=1.3))
    _text(ax, cx, 8.3, init)
    # the decision
    dy = 6.1
    ax.add_patch(Polygon([(cx, dy + 1.0), (cx + 2.0, dy), (cx, dy - 1.0), (cx - 2.0, dy)], closed=True, facecolor=FILL,
                         edgecolor=INK, linewidth=1.3))
    _text(ax, cx, dy, ask, 10.5)
    # the loop's process box
    ax.add_patch(Rectangle((cx - 1.8, 2.9), 3.6, 1.5, facecolor=FILL, edgecolor=INK, linewidth=1.3))
    _text(ax, cx, 4.0, loop[0])
    _text(ax, cx, 3.3, loop[1])
    # the output and Stop
    ax.add_patch(Polygon([(ox - 1.5, 3.9), (ox + 1.9, 3.9), (ox + 1.5, 4.7), (ox - 1.9, 4.7)], closed=True, facecolor=FILL,
                         edgecolor=INK, linewidth=1.3))
    _text(ax, ox, 4.3, out)
    ax.add_patch(Ellipse((ox, 1.9), 2.4, 0.9, facecolor=FILL, edgecolor=INK, linewidth=1.3))
    _text(ax, ox, 1.9, "Stop")
    # the arrows, every one headed
    _arrow(ax, (cx, 10.95), (cx, 10.3))
    _arrow(ax, (cx, 9.5), (cx, 8.7))
    _arrow(ax, (cx, 7.9), (cx, dy + 1.0))
    _arrow(ax, (cx, dy - 1.0), (cx, 4.4))
    ax.text(cx + 0.15, dy - 1.35, "Yes", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.plot([cx + 2.0, ox], [dy, dy], color=INK, linewidth=1.3)
    _arrow(ax, (ox, dy), (ox, 4.7))
    ax.text(cx + 2.35, dy + 0.3, "No", ha="left", va="center", fontsize=10, fontweight="bold")
    _arrow(ax, (ox, 3.9), (ox, 2.35))
    # back round the loop: down, left, up, and into the decision's left corner
    ax.plot([cx, cx, 0.6, 0.6], [2.9, 2.3, 2.3, dy], color=INK, linewidth=1.3)
    _arrow(ax, (0.6, dy), (cx - 2.0, dy))
    ax.set_xlim(0.2, 10.4)
    ax.set_ylim(1.2, 12.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    out, count, end = run(p)
    counted = boxes(p)[4]
    n = p["input"]
    qs = [short(f"{who} follows this flowchart {rng.choice(SETTINGS)} with the input n = {n}. What is output?", out, [str(out)]),
          short(f"How many times is the box {counted} carried out when {friend} inputs n = {n}?", count,
                [str(count), f"{count} times"])]
    if p["template"] != "double":  # for doubling, n at the end is the output itself
        qs.append(short(f"What is the value of n when the flowchart stops, for the input n = {n}?", end, [str(end)]))
    return qs
