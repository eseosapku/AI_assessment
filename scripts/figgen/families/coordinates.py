"""Labelled points on a coordinate grid, first quadrant or all four."""
from __future__ import annotations

import random

from ..core import GRID, mcq, new_figure, short

ID = "coordinates"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("P", "LS")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "grid", "position-and-direction", "ordered-pair", "point-location-space", "position-describing",
))


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    # Four quadrants at Lower Secondary; at Primary mostly the first, as before Stage 6.
    four = band == "LS" or rng.random() < 0.3
    lo, hi = (-6, 6) if four else (0, 10)
    cells = [(x, y) for x in range(lo + (0 if four else 1), hi + 1) for y in range(lo + (0 if four else 1), hi + 1)
             if not (four and (abs(x) < 2 or abs(y) < 2))]  # clear of the numbers along each axis
    pts = rng.sample(cells, 4)
    return {"band": band, "lo": lo, "hi": hi, "points": [list(p) for p in pts]}


def draw(p: dict):
    lo, hi = p["lo"], p["hi"]
    fig, ax = new_figure(5.0, 5.0)
    ax.set_xticks(range(lo, hi + 1))
    ax.set_yticks(range(lo, hi + 1))
    ax.set_xlim(lo - 0.5, hi + 0.5)
    ax.set_ylim(lo - 0.5, hi + 0.5)
    ax.grid(True, color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    if lo < 0:
        for s in ("left", "bottom"):
            ax.spines[s].set_position("zero")
    for name, (x, y) in zip("ABCD", p["points"]):
        ax.plot(x, y, marker="x", color="#111111", markersize=8, mew=2)
        ax.text(x + 0.18, y + 0.18, name, fontsize=12, fontweight="bold")
    ax.set_aspect("equal")
    ax.tick_params(labelsize=9)
    return fig


def _pair(x: int, y: int) -> str:
    return f"({x}, {y})"


def questions(p: dict, rng: random.Random) -> list:
    i = rng.randrange(4)
    x, y = p["points"][i]
    j = rng.choice([n for n in range(4) if n != i])
    jx, jy = p["points"][j]
    return [
        short(f"What are the coordinates of point {'ABCD'[i]}?", _pair(x, y), [f"({x},{y})", f"{x}, {y}", f"{x},{y}"]),
        mcq(f"Which point is at {_pair(jx, jy)}?", "ABCD"[j], [c for c in "ABCD" if c != "ABCD"[j]], rng),
        _moved(p, rng),
    ]


def _squares(k: int, way: str) -> str:
    return f"{k} square{'s' if k > 1 else ''} {way}"


def _moved(p: dict, rng: random.Random):
    """A point moved by squares across and up or down: its new coordinates, still on the grid."""
    low = p["lo"] if p["lo"] < 0 else 1
    options = [(n, dx, dy) for n in range(4) for dx in range(-3, 4) for dy in range(-3, 4)
               if (dx or dy) and low <= p["points"][n][0] + dx <= p["hi"] and low <= p["points"][n][1] + dy <= p["hi"]]
    n, dx, dy = rng.choice(options)
    x, y = p["points"][n][0] + dx, p["points"][n][1] + dy
    parts = ([_squares(abs(dx), "right" if dx > 0 else "left")] if dx else []) +             ([_squares(abs(dy), "up" if dy > 0 else "down")] if dy else [])
    return short(f"Point {'ABCD'[n]} moves {' and '.join(parts)}. What are its new coordinates?", _pair(x, y),
                 [f"({x},{y})", f"{x}, {y}", f"{x},{y}"])
