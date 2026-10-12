"""Angles on a straight line or around a point, drawn to scale, with one marked x."""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc

from ..core import NAMES, new_figure, short

ID = "angles"
KIND = "maths.geometry"
SUBJECT = "mathematics"
# Angles at a point and on a line are Lower Secondary work; Upper Secondary has moved past them.
BANDS = ("LS",)
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "angles-at-a-point", "calculating-angles", "lines-intersecting",
))


def sample(rng: random.Random) -> dict:
    around = rng.random() < 0.4
    total = 360 if around else 180
    k = rng.randint(3, 4) if around else rng.randint(2, 3)
    while True:
        cuts = sorted(rng.sample(range(25, total - 24, 5), k - 1))
        parts = [b - a for a, b in zip([0, *cuts], [*cuts, total])]
        # Around a point, an angle near 180 degrees makes two rays look like one straight line.
        if min(parts) >= 25 and (total == 180 or all(abs(a - 180) > 15 for a in parts)):
            break
    unknown = rng.randrange(k)
    return {"total": total, "parts": parts, "unknown": unknown, "name": rng.choice(NAMES), "letter": rng.choice("OPQRSTAB")}


def draw(p: dict):
    fig, ax = new_figure(5.2, 4.2 if p["total"] == 360 else 3.0)
    edges = [0]
    for a in p["parts"]:
        edges.append(edges[-1] + a)
    if p["total"] == 180:
        ax.plot([-1.2, 1.2], [0, 0], color="#111111")
    for e in edges[:-1] if p["total"] == 360 else edges[1:-1]:
        r = math.radians(e)
        ax.plot([0, 1.1 * math.cos(r)], [0, 1.1 * math.sin(r)], color="#111111")
    # Each angle its own radius, larger angles further out: arcs never join up, and a bigger
    # angle never gets the smaller arc (the review read a 105 degree angle as the smaller one).
    rank = {i: k for k, i in enumerate(sorted(range(len(p["parts"])), key=lambda i: (p["parts"][i], i)))}
    for i, a in enumerate(p["parts"]):
        mid = math.radians(edges[i] + a / 2)
        r = 0.28 + 0.1 * rank[i]
        ax.add_patch(Arc((0, 0), 2 * r, 2 * r, theta1=edges[i], theta2=edges[i + 1], color="#111111"))
        label = "x" if i == p["unknown"] else f"{a}\u00b0"
        ax.text((r + 0.16) * math.cos(mid), (r + 0.16) * math.sin(mid), label, ha="center", va="center", fontsize=12,
                style="italic" if i == p["unknown"] else "normal")
    ax.set_aspect("equal")
    ax.set_xlim(-1.3, 1.3)
    ax.set_ylim(-1.3 if p["total"] == 360 else -0.2, 1.3)
    # The meeting point's letter: below a straight line, or in the widest angle round a point.
    if p["total"] == 180:
        ax.text(0, -0.12, p["letter"], ha="center", va="top", fontsize=12, fontweight="bold")
    else:
        w = max(range(len(p["parts"])), key=lambda i: p["parts"][i])
        mid = math.radians(edges[w] + p["parts"][w] / 2)
        ax.text(0.14 * math.cos(mid), 0.14 * math.sin(mid), p["letter"], ha="center", va="center", fontsize=11, fontweight="bold")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    x = p["parts"][p["unknown"]]
    count = ("Two", "Three", "Four")[len(p["parts"]) - 2]
    # The angles given are on the figure only: the question cannot be done without it.
    where = f"lie on a straight line at {p['letter']}" if p["total"] == 180 else f"meet at the point {p['letter']}"
    return [short(f"In {p['name']}'s diagram, {count.lower()} angles {where}. Work out the value of x.", x, [f"{x}°"])]
