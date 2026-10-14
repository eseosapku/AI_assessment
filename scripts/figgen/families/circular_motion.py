"""Motion in a circle (UP, AL), seen from above: a car on a roundabout, a stone whirled on a string, or a moto
on a bend, at one point of its circle with its velocity arrowed, and its mass, speed and radius labelled.
The direction of the resultant force, the centripetal acceleration (a = v²/r), the force (F = mv²/r), and at
AL the time for one turn (T = 2πr/v, π = 3.14).

Every answer is exact to two decimal places.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Circle, FancyArrowPatch

from ..core import FILL_2, INK, NAMES, exact, mcq, measure, new_figure, short

ID = "circular_motion"
KIND = "physics.force"
SUBJECT = "physics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("motion-in-a-circle", "centripetal-acceleration-and-force", "angular-displacement-and-velocity"))
AVOID = r"electric|magnet|wave|optic|lens|radioactiv|nuclear|thermal|heat|generator|relativity|degradation|power generation|describing motion"
# the thing, its masses (kg), speeds (m/s) and radii (m), and where it goes round
CONTEXTS = {"car": ([800, 1000, 1200, 1500], [5, 6, 8, 10, 12], [10, 15, 20, 25, 40, 50], "on a roundabout in Kigali"),
            "stone": (["0.1", "0.2", "0.25", "0.4", "0.5"], [2, 3, 4, 5, 6], ["0.5", "0.8", "1", "1.25", "1.5"], "on a string"),
            "moto": ([150, 200, 250], [8, 10, 12, 15], [20, 25, 40, 50], "on a bend in the road")}
DIRS = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}
WAYS = {"up": "up the page", "down": "down the page", "left": "left across the page", "right": "right across the page"}
PI = Fraction("3.14")


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        thing = rng.choice(list(CONTEXTS))
        masses, speeds, radii, _ = CONTEXTS[thing]
        p = {"band": band, "thing": thing, "m": str(rng.choice(masses)), "v": rng.choice(speeds), "r": str(rng.choice(radii)),
             "at": rng.choice(list(DIRS)), "turn": rng.choice(["anticlockwise", "clockwise"])}
        m, v, r = Fraction(p["m"]), Fraction(p["v"]), Fraction(p["r"])
        values = [v * v / r, m * v * v / r] + ([2 * PI * r / v] if band == "AL" else [])
        if all((x * 100).denominator == 1 for x in values):
            return p


def draw(p: dict):
    fig, ax = new_figure(5.6, 5.0)
    R = 2.6
    ax.add_patch(Circle((0, 0), R, facecolor="none", edgecolor=INK, linewidth=1.0, linestyle=(0, (5, 4))))
    ax.plot([0], [0], marker="o", markersize=5, color=INK)
    ax.text(0.15, -0.3, "centre", ha="left", va="top", fontsize=9)
    dx, dy = DIRS[p["at"]]
    x, y = R * dx, R * dy
    ax.plot([0, x], [0, y], color=INK, linewidth=0.9)
    ax.text(x / 2 + 0.25 * abs(dy) - 0.0, y / 2 + 0.25 * abs(dx), f"r = {p['r']} m", ha="left" if dy else "center", va="bottom",
            fontsize=10, rotation=0)
    ax.add_patch(Circle((x, y), 0.3, facecolor=FILL_2, edgecolor=INK, linewidth=1.4, zorder=3))
    # The velocity along the tangent: anticlockwise turns (dx, dy) to (-dy, dx).
    tx, ty = (-dy, dx) if p["turn"] == "anticlockwise" else (dy, -dx)
    ax.add_patch(FancyArrowPatch((x + 0.35 * tx, y + 0.35 * ty), (x + 1.5 * tx, y + 1.5 * ty), arrowstyle="-|>", mutation_scale=16,
                                 color=INK, lw=1.6, zorder=4))
    ax.text(x + 1.0 * tx + 0.35 * dx, y + 1.0 * ty + 0.35 * dy, f"{p['v']} m/s", ha="left" if dx >= 0 else "right",
            va="bottom" if dy >= 0 else "top", fontsize=10)
    ax.text(x + 0.45 * dx - 0.45 * tx, y + 0.45 * dy - 0.45 * ty, f"{p['m']} kg", ha="left" if dx >= 0 else "right",
            va="bottom" if dy >= 0 else "top", fontsize=10)
    ax.text(-4.3, 4.3, "seen from above", ha="left", va="top", fontsize=10, style="italic")
    ax.set_xlim(-4.4, 4.4)
    ax.set_ylim(-4.4, 4.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    m, v, r = Fraction(p["m"]), Fraction(p["v"]), Fraction(p["r"])
    _, _, _, where = CONTEXTS[p["thing"]]
    out = DIRS[p["at"]]
    inward = next(d for d, u in DIRS.items() if u == (-out[0], -out[1]))
    who = {"car": f"{name} drives a car", "stone": f"{name} whirls a stone", "moto": f"{name} rides a moto"}[p["thing"]]
    a = v * v / r
    qs = [mcq(f"{who} {where} at a steady speed. Which way does the resultant force on the {p['thing']} act at the point shown?", WAYS[inward],
              [w for d, w in WAYS.items() if d != inward], rng),
          short(f"What is the centripetal acceleration of the {p['thing']}, in m/s²?", exact(a), measure(a, "m/s²") + measure(a, "m/s2")[1:]),
          short(f"{friend} works out the resultant force on the {p['m']} kg {p['thing']}. What is its size?", exact(m * a), measure(m * a, "N"))]
    if p["band"] == "AL":
        T = 2 * PI * r / v
        qs.append(short(f"Take π = 3.14. How long does the {p['thing']} take to go once round the circle?", exact(T), measure(T, "s")))
    return qs
