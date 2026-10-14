"""Map distances (LS, UP): part of a 1 : 50 000 map, five grid squares each way, each square 1 km across. A straight
road between two places runs along a gridline or as a 3-4-5 diagonal, and a forest fills whole squares. The road's
length, the forest's area, and the distance on the ground a line of a given length on the map stands for.

Every key is counted on the grid: the road's ends sit on gridline crossings, and at 1 : 50 000 one centimetre on the
map is half a kilometre on the ground.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, exact, new_figure, short

ID = "map_distance"
KIND = "geo.map"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("map-skills-measurement", "topographic-maps", "map-reading-and-interpretation", "map-enlargement-reduction"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"map|scale|distance|area|topographic|measur"
N = 5
PLACES = ["school", "market", "health centre", "church", "bus stop", "cooperative"]


def _crossed(road) -> set[tuple[int, int]]:
    """The squares the road runs through or along, sampled finely."""
    (x1, y1), (x2, y2) = road
    out = set()
    for k in range(101):
        x, y = x1 + (x2 - x1) * k / 100, y1 + (y2 - y1) * k / 100
        for dx in (-0.01, 0.01):
            for dy in (-0.01, 0.01):
                i, j = int(x + dx), int(y + dy)
                if 0 <= i < N and 0 <= j < N:
                    out.add((i, j))
    return out


def sample(rng: random.Random) -> dict:
    while True:
        if rng.random() < 0.5:
            dx, dy = rng.choice([(3, 4), (4, 3)])
            dx, dy = dx * rng.choice([1, -1]), dy * rng.choice([1, -1])
        else:
            length = rng.randint(2, 5)
            dx, dy = rng.choice([(length, 0), (0, length)])
        x1, y1 = rng.randint(0, N), rng.randint(0, N)
        x2, y2 = x1 + dx, y1 + dy
        if not (0 <= x2 <= N and 0 <= y2 <= N):
            continue
        road = [[x1, y1], [x2, y2]]
        free = [(i, j) for i in range(N) for j in range(N) if (i, j) not in _crossed(road)]
        if len(free) < 6:
            continue
        # a forest of three to seven whole squares, joined side to side
        start = rng.choice(free)
        forest, target = [start], rng.randint(3, 7)
        for _ in range(60):
            if len(forest) >= target:
                break
            i, j = rng.choice(forest)
            nb = [(i + a, j + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (i + a, j + b) in free and (i + a, j + b) not in forest]
            if nb:
                forest.append(rng.choice(nb))
        if len(forest) < 3:
            continue
        ends = rng.sample(PLACES, 2)
        return {"band": rng.choice(BANDS), "road": road, "forest": sorted([list(f) for f in forest]), "ends": ends,
                "cm": rng.randint(2, 12)}


def draw(p: dict):
    fig, ax = new_figure(7.2, 5.6)
    ax.add_patch(Rectangle((0, 0), N, N, facecolor="#f4f7ef", edgecolor="none"))
    for i, j in p["forest"]:
        ax.add_patch(Rectangle((i, j), 1, 1, facecolor="#9cc58f", edgecolor="none", hatch="..", zorder=1))
    for k in range(N + 1):
        ax.plot([k, k], [0, N], color="#5f8fb0", linewidth=1.0, zorder=2)
        ax.plot([0, N], [k, k], color="#5f8fb0", linewidth=1.0, zorder=2)
    (x1, y1), (x2, y2) = p["road"]
    ax.plot([x1, x2], [y1, y2], color="#8b4a1c", linewidth=3.2, solid_capstyle="round", zorder=3)
    for (x, y), name in zip(p["road"], p["ends"]):
        ax.plot([x], [y], marker="s", markersize=9, color="#1a1a1a", zorder=4)
        right = x <= N - 2  # a name near the key goes on the left of its place
        ax.text(x + 0.12 if right else x - 0.12, y + 0.14, name, ha="left" if right else "right", va="bottom", fontsize=9.5,
                fontweight="bold", zorder=5,
                bbox=dict(boxstyle="round,pad=0.15", facecolor="white", edgecolor="none", alpha=0.85))
    kx = N + 0.4
    ax.text(kx, N - 0.1, "Key", ha="left", va="center", fontsize=10.5, fontweight="bold")
    ax.add_patch(Rectangle((kx, N - 0.85), 0.4, 0.35, facecolor="#9cc58f", edgecolor=INK, hatch="..", linewidth=0.6))
    ax.text(kx + 0.55, N - 0.67, "forest", ha="left", va="center", fontsize=9.5)
    ax.plot([kx, kx + 0.4], [N - 1.35, N - 1.35], color="#8b4a1c", linewidth=3.2)
    ax.text(kx + 0.55, N - 1.35, "road", ha="left", va="center", fontsize=9.5)
    ax.text(kx, 0.6, "Scale 1 : 50 000", ha="left", va="center", fontsize=9.5)
    ax.text(kx, 0.2, "One grid square\nis 1 km across", ha="left", va="center", fontsize=9)
    ax.set_xlim(-0.6, N + 2.6)
    ax.set_ylim(-0.4, N + 0.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "before a field trip"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    (x1, y1), (x2, y2) = p["road"]
    km = round(((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5)
    area = len(p["forest"])
    cm = p["cm"]
    ground = exact(cm * 50000 / 100000)
    a, b = p["ends"]
    return [short(f"{who} measures this map {rng.choice(SETTINGS)}. How long is the straight road from the {a} to the {b}, in km?",
                  km, [str(km), f"{km} km", f"{km}km"]),
            short(f"{friend} counts the grid squares. What is the area of the forest, in km²?", area,
                  [str(area), f"{area} km²", f"{area} km2", f"{area} square kilometres"]),
            short(f"A line {cm} cm long on this map stands for how many km on the ground?", ground, [ground, f"{ground} km", f"{ground}km"])]
