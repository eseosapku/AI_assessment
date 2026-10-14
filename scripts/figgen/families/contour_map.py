"""Contour maps (LS, UP): a hill drawn as five to seven contours, each labelled with its height,
the contours closer together on one side, and points A, B and C each on a contour. The contour interval, the
height at a point, which side of the hill is steeper (MCQ), and the average gradient from A to B, given the
horizontal distance, as 1 in n.

Every key is the drawing: a point's height is its contour's, and the steeper side is where the contours are closest
(nested ellipses whose centres shift towards it).
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Ellipse

from ..core import INK, NAMES, mcq, new_figure, short

ID = "contour_map"
KIND = "geo.map"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("topographic-maps", "cross-sections-sketch-maps", "relief-landforms", "map-reading-and-interpretation"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"contour|relief|topographic|map work|map reading|gradient|slope"
SIDES = {"east": (1, 0), "west": (-1, 0), "north": (0, 1), "south": (0, -1)}
R = 3.0


def ellipse(p: dict, k: int) -> tuple[float, float, float, float]:
    """Contour k's centre and half-widths: each ring smaller, its centre shifted towards the steep side."""
    n = p["n"]
    dr = R / (n + 0.5)
    sx, sy = SIDES[p["steep"]]
    shift = 0.55 * dr * k
    rx = R - k * dr
    return sx * shift, sy * shift * 0.75, rx, rx * 0.75


def at(p: dict, k: int, angle: float) -> tuple[float, float]:
    cx, cy, rx, ry = ellipse(p, k)
    return cx + rx * math.cos(angle), cy + ry * math.sin(angle)


def _angle(side: str) -> float:
    return {"east": 0.0, "north": math.pi / 2, "west": math.pi, "south": 3 * math.pi / 2}[side]


LABEL_TURN = 0.8  # radians round the hill from the gentle side's ray, for the height labels
OPPOSITE = {"east": "west", "west": "east", "north": "south", "south": "north"}
ACROSS = {"east": "north", "west": "south", "north": "west", "south": "east"}


def sample(rng: random.Random) -> dict:
    n = rng.randint(5, 7)
    interval = rng.choice([10, 20, 50])
    base = rng.choice(range(1400, 2100, 100))
    i = rng.randint(0, n - 3)
    j = rng.randint(i + 1, min(n - 1, i + 3))
    rise = (j - i) * interval
    run = rise * rng.choice([5, 8, 10, 12, 15, 20])
    return {"band": rng.choice(BANDS), "n": n, "interval": interval, "base": base, "steep": rng.choice(sorted(SIDES)),
            "points": {"A": i, "B": j, "C": rng.choice([k for k in range(n) if k not in (i, j)])}, "run": run,
            "ask": rng.choice(["A", "B", "C"])}


def draw(p: dict):
    fig, ax = new_figure(6.6, 5.6)
    n, gentle = p["n"], OPPOSITE[p["steep"]]
    for k in range(n):
        cx, cy, rx, ry = ellipse(p, k)
        ax.add_patch(Ellipse((cx, cy), 2 * rx, 2 * ry, facecolor="none", edgecolor="#9b5a1c", linewidth=1.3))
        # the height, on the gentle side between A's ray and C's, where the contours are widest apart
        lx, ly = at(p, k, _angle(gentle) + LABEL_TURN)
        ax.text(lx, ly, str(p["base"] + k * p["interval"]), ha="center", va="center", fontsize=8.5, color="#6b3a10",
                bbox=dict(boxstyle="square,pad=0.08", facecolor="white", edgecolor="none"))
    for name, k in p["points"].items():
        side = ACROSS[p["steep"]] if name == "C" else gentle
        x, y = at(p, k, _angle(side))
        ax.plot([x], [y], marker="o", markersize=6, color=INK, zorder=4)
        # the letter turned the other way round the hill from the height labels, so the two never meet
        t = _angle(side) - math.pi / 2
        ax.text(x + 0.2 * math.cos(t), y + 0.2 * math.sin(t), name, ha="center", va="center", fontsize=11, fontweight="bold", zorder=5)
    ax.annotate("", xy=(R + 0.9, R * 0.75 + 0.3), xytext=(R + 0.9, R * 0.75 - 0.5), arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.4))
    ax.text(R + 0.9, R * 0.75 + 0.4, "N", ha="center", va="bottom", fontsize=11, fontweight="bold")
    ax.set_xlim(-R - 0.5, R + 1.4)
    ax.set_ylim(-R * 0.75 - 0.8, R * 0.75 + 0.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "before a field trip"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    x = p["ask"]
    h = p["base"] + p["points"][x] * p["interval"]
    rise = abs(p["points"]["A"] - p["points"]["B"]) * p["interval"]
    g = p["run"] // rise
    steep = p["steep"].capitalize() + " side"
    return [short(f"{who} reads this contour map {rng.choice(SETTINGS)}. What is the height of the land at point {x}, in metres?",
                  h, [str(h), f"{h} m", f"{h}m"]),
            short(f"{friend} reads the heights on the contours. What is the contour interval, in metres?", p["interval"],
                  [str(p["interval"]), f"{p['interval']} m", f"{p['interval']}m"]),
            mcq(f"{friend} looks at how close the contours are. Which side of the hill is steeper?", steep,
                [s.capitalize() + " side" for s in SIDES if s != p["steep"]], rng),
            short(f"The horizontal distance from A to B is {p['run']} m. What is the average gradient from A to B, as 1 in n?",
                  f"1 in {g}", [f"1 in {g}", f"1:{g}", f"1/{g}", f"1 : {g}"])]
