"""Quadrats (LS, UP): a field on a 1 m grid with plants scattered in patches, and four or five 1 m² quadrats
placed at random and lettered. The count in a quadrat, the mean per quadrat, and the estimated number in the
whole field (the mean times the field's area).

No plant lies near a gridline, so none sits on a quadrat's edge; the field's area divides by the number of
quadrats, so the estimate is a whole number.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import GRID, INK, NAMES, exact, new_figure, short

ID = "quadrat"
KIND = "bio.ecology"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("population-characteristics", "ecosystem-properties-ecological-factors",
                                           "ecological-terms-biodiversity-meaning"))
AVOID = r"cell|enzyme|genetic|inherit|immun|disease|reproduc|excretion|digest|photosynth|respiration|hormone|selection|plant nutrition|variation"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"sampl|quadrat|abundance|population density|population size|measuring population"
SPECIES = [("dandelions", "*"), ("daisies", "o"), ("clover plants", "^"), ("thistles", "x")]


def sample(rng: random.Random) -> dict:
    W, H = 10, rng.choice([6, 8])
    n = rng.choice([4, 5])
    rich = [(rng.uniform(0, W), rng.uniform(0, H)) for _ in range(rng.randint(2, 3))]  # the patches plants grow thick in
    plants = []
    for cx in range(W):
        for cy in range(H):
            near = min(((cx + 0.5 - x) ** 2 + (cy + 0.5 - y) ** 2) ** 0.5 for x, y in rich)
            k = max(0, min(5, round(4.5 - near * 0.9 + rng.uniform(-1, 1))))
            here = []
            for _ in range(40):  # each plant at least 0.25 m from the others in its square, so each can be counted
                if len(here) == k:
                    break
                x, y = round(cx + rng.uniform(0.15, 0.85), 3), round(cy + rng.uniform(0.15, 0.85), 3)
                if all((x - a) ** 2 + (y - b) ** 2 >= 0.3 ** 2 for a, b in here):
                    here.append([x, y])
            plants += here
    cells = []  # a row above each for its letter; never touching, or two read as one long box
    while len(cells) < n:
        c = (rng.randrange(W), rng.randrange(H - 1))
        if all(max(abs(c[0] - d[0]), abs(c[1] - d[1])) >= 2 for d in cells):
            cells.append(c)
    letters = "ABCDE"[:n]
    return {"band": rng.choice(BANDS), "W": W, "H": H, "plants": plants, "quadrats": {k: list(c) for k, c in zip(letters, cells)},
            "species": rng.randrange(len(SPECIES)), "ask": rng.choice(letters)}


def draw(p: dict):
    W, H = p["W"], p["H"]
    fig, ax = new_figure(6.6, 0.66 * H + 0.9)
    ax.add_patch(Rectangle((0, 0), W, H, facecolor="#f3f6ef", edgecolor=INK, linewidth=1.4, zorder=0))
    for x in range(1, W):
        ax.plot([x, x], [0, H], color=GRID, linewidth=0.5, zorder=1)
    for y in range(1, H):
        ax.plot([0, W], [y, y], color=GRID, linewidth=0.5, zorder=1)
    name, marker = SPECIES[p["species"]]
    xs, ys = [q[0] for q in p["plants"]], [q[1] for q in p["plants"]]
    ax.plot(xs, ys, linestyle="none", marker=marker, markersize=5.5, color=INK, markerfacecolor="white" if marker == "o" else INK,
            zorder=3)
    for letter, (cx, cy) in p["quadrats"].items():
        ax.add_patch(Rectangle((cx, cy), 1, 1, facecolor="none", edgecolor=INK, linewidth=2.6, zorder=4))
        ax.text(cx + 0.5, cy + 1.12, letter, ha="center", va="bottom", fontsize=11, fontweight="bold", zorder=5,
                bbox={"boxstyle": "round,pad=0.12", "facecolor": "white", "edgecolor": "none"})
    ax.set_xlim(-0.1, W + 0.1)
    ax.set_ylim(-0.1, H + 0.1)
    ax.set_xticks(range(0, W + 1, 2))
    ax.set_yticks(range(0, H + 1, 2))
    ax.set_xlabel("Distance (m)")
    ax.set_ylabel("Distance (m)")
    ax.tick_params(labelsize=8)
    ax.set_aspect("equal")
    return fig


SETTINGS = ["on a school field trip", "in an ecology lesson", "for a class project", "near the school garden"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    name, _ = SPECIES[p["species"]]
    quads = p["quadrats"]
    count = {k: sum(1 for x, y in p["plants"] if int(x) == c[0] and int(y) == c[1]) for k, c in quads.items()}
    mean = Fraction(sum(count.values()), len(count))
    est = mean * p["W"] * p["H"]
    x = p["ask"]
    n = len(quads)
    return [short(f"{who} placed {n} quadrats of 1 m² at random {rng.choice(SETTINGS)} and counted the {name}. "
                  f"How many {name} are in quadrat {x}?", count[x], [str(count[x]), f"{count[x]} {name}"]),
            short(f"What is the mean number of {name} per quadrat?", exact(mean), [exact(mean), f"{exact(mean)} {name}",
                                                                                    f"{exact(mean)} per m²", f"{exact(mean)} per quadrat"]),
            short(f"{friend} measures the field: {p['W']} m by {p['H']} m. Estimate the number of {name} in the whole field.",
                  exact(est), [exact(est), f"{exact(est)} {name}"])]
