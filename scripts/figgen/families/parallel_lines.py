"""Two parallel lines cut by a transversal: one angle given, x to find by one angle fact (LS).

The transversal meets the top line at P and the bottom line at Q. Each meeting point has four
corners -- above right (ar), above left (al), below left (bl), below right (br) -- and the pair
marked is chosen so one fact links them in a single step.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc

from ..core import INK, mcq, new_figure, short

ID = "parallel_lines"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("LS",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("calculating-angles", "lines-intersecting", "lines-relationships", "lines-2d"))

FACTS = {"corresponding": "Corresponding angles are equal", "alternate": "Alternate angles are equal",
         "co-interior": "Co-interior angles add up to 180°", "vertically opposite": "Vertically opposite angles are equal"}
PAIRS = {
    "corresponding": [(("P", c), ("Q", c)) for c in ("ar", "al", "bl", "br")],
    "alternate": [(("P", "bl"), ("Q", "ar")), (("P", "br"), ("Q", "al"))],
    "co-interior": [(("P", "bl"), ("Q", "al")), (("P", "br"), ("Q", "ar"))],
    "vertically opposite": [((i, "ar"), (i, "bl")) for i in "PQ"] + [((i, "al"), (i, "br")) for i in "PQ"],
}
GAP = 1.6  # distance between the parallel lines
# The letters at the two meeting points, top then bottom: a different pair from figure to figure.
LETTERS = [("P", "Q"), ("G", "H"), ("S", "T"), ("M", "N"), ("E", "F"), ("K", "L"), ("A", "B"), ("C", "D")]


def sample(rng: random.Random) -> dict:
    theta = rng.choice([t for t in range(30, 151) if abs(t - 90) >= 15])
    fact = rng.choice(sorted(PAIRS))
    a, b = rng.choice(PAIRS[fact])
    given, unknown = (a, b) if rng.random() < 0.5 else (b, a)
    return {"band": "LS", "theta": theta, "fact": fact, "given": list(given), "unknown": list(unknown),
            "letters": list(rng.choice(LETTERS))}


def _corner(theta: float, where: str) -> tuple[float, float]:
    """The corner's two edges, as angles anticlockwise from east, in order."""
    return {"ar": (0, theta), "al": (theta, 180), "bl": (180, 180 + theta), "br": (180 + theta, 360)}[where]


def draw(p: dict):
    t = p["theta"]
    fig, ax = new_figure(6.0, 4.0)
    for y in (0, GAP):
        ax.plot([-3, 3], [y, y], color=INK)
        for dx in (-2.3, -2.15):  # parallel marks: two small arrowheads on each line
            ax.plot([dx - 0.08, dx, dx - 0.08], [y + 0.07, y, y - 0.07], color=INK, linewidth=1.4)
    run = GAP / math.tan(math.radians(t))
    q, pt = (-run / 2, 0.0), (run / 2, GAP)
    ext = 1.1
    d = (math.cos(math.radians(t)), math.sin(math.radians(t)))
    ax.plot([q[0] - ext * d[0], pt[0] + ext * d[0]], [q[1] - ext * d[1], pt[1] + ext * d[1]], color=INK)
    at = {"P": pt, "Q": q}
    size = {"ar": t, "al": 180 - t, "bl": t, "br": 180 - t}
    for (where, corner), label in ((p["given"], f"{size[p['given'][1]]}°"), (p["unknown"], "x")):
        a0, a1 = _corner(t, corner)
        cx, cy = at[where]
        ax.add_patch(Arc((cx, cy), 0.5, 0.5, theta1=a0, theta2=a1, color=INK, linewidth=1.2))
        mid = math.radians((a0 + a1) / 2)
        r = 0.48 if a1 - a0 > 60 else 0.62
        ax.text(cx + r * math.cos(mid), cy + r * math.sin(mid), label, ha="center", va="center", fontsize=12,
                style="italic" if label == "x" else "normal")
    # Each meeting point's letter in a corner there that is not marked, clear of the angles.
    for key, letter in zip("PQ", p["letters"]):
        used = {c for i, c in (p["given"], p["unknown"]) if i == key}
        corner = next(c for c in ("al", "br", "ar", "bl") if c not in used)
        a0, a1 = _corner(t, corner)
        mid = math.radians((a0 + a1) / 2)
        cx, cy = at[key]
        ax.text(cx + 0.3 * math.cos(mid), cy + 0.3 * math.sin(mid), letter, fontsize=11, fontweight="bold", ha="center", va="center")
    ax.set_xlim(-3.1, 3.1)
    ax.set_ylim(-1.3, GAP + 1.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    t = p["theta"]
    size = {"ar": t, "al": 180 - t, "bl": t, "br": 180 - t}
    g, x = size[p["given"][1]], size[p["unknown"][1]]
    at = p["letters"]["PQ".index(p["given"][0])]
    return [
        short(f"The two lines with arrows are parallel. The angle marked at {at} is {g}°. Find the angle x.", x, [f"{x}°"]),
        mcq(f"Which fact links the {g}° angle and the angle x?", FACTS[p["fact"]], [v for k, v in FACTS.items() if k != p["fact"]], rng),
    ]
