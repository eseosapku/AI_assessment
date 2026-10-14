"""Grid references (LS, UP): part of a 1 : 50 000 map, five grid squares each way with numbered eastings and
northings, and four symbols from a key (school, church, health centre, market, water point, mosque), each in a
square of its own. A symbol's four-figure reference, a symbol's six-figure reference, and the 8-point compass
direction from one symbol to another.

Every key is the symbol's place: eastings first. A six-figure reference one tenth out in either direction is accepted,
as mark schemes do. A direction is asked only where it lies plainly inside its 45° sector.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "grid_reference"
KIND = "geo.map"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("map-reading-and-interpretation", "topographic-maps", "map-skills-measurement"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"map|grid reference|direction|bearing|location|topographic"
SYMBOLS = {"school": ("s", "#1a1a1a"), "church": ("P", "#1a1a1a"), "health centre": ("o", "#d62728"),
           "market": ("^", "#1f77b4"), "water point": ("D", "#1f77b4"), "mosque": ("*", "#2a7a3a")}
POINTS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
SHORT = {"north": "N", "north-east": "NE", "east": "E", "south-east": "SE", "south": "S", "south-west": "SW",
         "west": "W", "north-west": "NW"}
N = 5  # squares each way


def _pos(x: dict) -> tuple[float, float]:
    return x["i"] + x["a"] / 10, x["j"] + x["b"] / 10


def direction(a: dict, b: dict) -> tuple[str, float]:
    (x1, y1), (x2, y2) = _pos(a), _pos(b)
    bearing = math.degrees(math.atan2(x2 - x1, y2 - y1)) % 360
    return POINTS[round(bearing / 45) % 8], abs(bearing - 45 * round(bearing / 45))


def sample(rng: random.Random) -> dict:
    while True:
        names = rng.sample(sorted(SYMBOLS), 4)
        squares = rng.sample([(i, j) for i in range(N) for j in range(N)], 4)
        symbols = [{"name": nm, "i": i, "j": j, "a": rng.randint(2, 8), "b": rng.randint(2, 8)} for nm, (i, j) in zip(names, squares)]
        pairs = [(a, b) for a in range(4) for b in range(4) if a != b and direction(symbols[a], symbols[b])[1] <= 12]
        if pairs:
            a, b = rng.choice(pairs)
            return {"band": rng.choice(BANDS), "e0": rng.randint(10, 90), "n0": rng.randint(10, 90), "symbols": symbols,
                    "four": rng.randrange(4), "six": rng.randrange(4), "walk": [a, b]}


def draw(p: dict):
    fig, ax = new_figure(7.4, 5.6)
    ax.add_patch(Rectangle((0, 0), N, N, facecolor="#f4f7ef", edgecolor="none"))
    for k in range(N + 1):
        ax.plot([k, k], [0, N], color="#5f8fb0", linewidth=1.0)
        ax.plot([0, N], [k, k], color="#5f8fb0", linewidth=1.0)
        ax.text(k, -0.18, f"{p['e0'] + k:02d}", ha="center", va="top", fontsize=10)
        ax.text(k, N + 0.18, f"{p['e0'] + k:02d}", ha="center", va="bottom", fontsize=10)
        ax.text(-0.15, k, f"{p['n0'] + k:02d}", ha="right", va="center", fontsize=10)
    for x in p["symbols"]:
        marker, colour = SYMBOLS[x["name"]]
        cx, cy = _pos(x)
        ax.plot([cx], [cy], marker=marker, markersize=10, color=colour, markeredgecolor=INK, markeredgewidth=0.8, linestyle="none")
    # north arrow and scale
    ax.annotate("", xy=(N + 0.55, N - 0.1), xytext=(N + 0.55, N - 0.8), arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.4))
    ax.text(N + 0.55, N + 0.02, "N", ha="center", va="bottom", fontsize=11, fontweight="bold")
    ax.text(N + 0.35, -0.55, "Scale 1 : 50 000", ha="left", va="center", fontsize=9)
    # the key
    ax.text(N + 0.35, N - 1.3, "Key", ha="left", va="center", fontsize=10.5, fontweight="bold")
    for k, x in enumerate(sorted(p["symbols"], key=lambda s: s["name"])):
        marker, colour = SYMBOLS[x["name"]]
        y = N - 1.8 - k * 0.5
        ax.plot([N + 0.5], [y], marker=marker, markersize=9, color=colour, markeredgecolor=INK, markeredgewidth=0.8, linestyle="none")
        ax.text(N + 0.8, y, x["name"], ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-0.7, N + 2.4)
    ax.set_ylim(-0.8, N + 0.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "before a field trip"]


def _six(e: int, a: int, n: int, b: int) -> str:
    return f"{e:02d}{a}{n:02d}{b}"


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    e0, n0 = p["e0"], p["n0"]
    syms = p["symbols"]
    f, s = syms[p["four"]], syms[p["six"]]
    four = f"{e0 + f['i']:02d}{n0 + f['j']:02d}"
    six = _six(e0 + s["i"], s["a"], n0 + s["j"], s["b"])
    near = [_six(e0 + s["i"], a, n0 + s["j"], b) for a in (s["a"] - 1, s["a"], s["a"] + 1) for b in (s["b"] - 1, s["b"], s["b"] + 1)]
    a, b = syms[p["walk"][0]], syms[p["walk"][1]]
    way = direction(a, b)[0]
    return [short(f"{who} reads this map {rng.choice(SETTINGS)}. What is the four-figure grid reference of the square with the "
                  f"{f['name']} in it? Give the eastings first.", four, [four, f"{four[:2]} {four[2:]}"]),
            short(f"What is the six-figure grid reference of the {s['name']}? Give the eastings first.", six,
                  near + [f"{x[:3]} {x[3:]}" for x in near]),
            short(f"{friend} walks straight from the {a['name']} to the {b['name']}. What is the compass direction from the "
                  f"{a['name']} to the {b['name']}?", way, [way, way.replace("-", " "), way.replace("-", ""), SHORT[way]])]
