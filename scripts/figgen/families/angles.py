"""Angles on a straight line or around a point, drawn to scale, with one marked x."""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc

from ..core import new_figure, short

ID = "angles"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")


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
    return {"total": total, "parts": parts, "unknown": unknown}


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
    # Neighbouring arcs at different radii, so each visibly stops at its own two rays; with
    # one radius they joined into a single semicircle and x could not be told apart.
    cycle = 3 if p["total"] == 360 and len(p["parts"]) % 2 == 1 else 2
    for i, a in enumerate(p["parts"]):
        mid = math.radians(edges[i] + a / 2)
        r = (0.32, 0.46, 0.6)[i % cycle]
        ax.add_patch(Arc((0, 0), 2 * r, 2 * r, theta1=edges[i], theta2=edges[i + 1], color="#111111"))
        label = "x" if i == p["unknown"] else f"{a}\u00b0"
        ax.text((r + 0.16) * math.cos(mid), (r + 0.16) * math.sin(mid), label, ha="center", va="center", fontsize=12,
                style="italic" if i == p["unknown"] else "normal")
    ax.set_aspect("equal")
    ax.set_xlim(-1.3, 1.3)
    ax.set_ylim(-1.3 if p["total"] == 360 else -0.2, 1.3)
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    x = p["parts"][p["unknown"]]
    where = "on a straight line" if p["total"] == 180 else "around a point"
    return [short(f"The angles {where} are shown. Work out the value of x.", x, [f"{x}°"])]
