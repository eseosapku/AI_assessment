"""Quadrats (LS, UP): a field on a 1 m grid with plants scattered in patches, and four or five 1 m² quadrats
placed at random and lettered. The count in a quadrat, the mean per quadrat, and the estimated number in the
whole field (the mean times the field's area).

AL (P6): the same field with three species of plant, each its own marker in a key, five quadrats, and Simpson's
index of diversity printed (D = 1 − Σ(n/N)²); D for all the quadrats together to 2 decimal places (never near a
rounding boundary), one species' count, and N.

No plant lies near a gridline, so none sits on a quadrat's edge; the field's area divides by the number of
quadrats, so the estimate is a whole number.
"""
from __future__ import annotations

import random
from decimal import ROUND_HALF_UP, Decimal
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import GRID, INK, NAMES, exact, new_figure, short

ID = "quadrat"
KIND = "bio.ecology"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("population-characteristics", "ecosystem-properties-ecological-factors",
                                           "ecological-terms-biodiversity-meaning", "simpsons-index-calculation"))
# Integrated Science teaches this too (P3n): its Lower Secondary topics are reached by these.
ALSO = tuple(f"science.{c}" for c in ('habitats-and-environments', 'ecosystems'))
AVOID = r"cell|enzyme|genetic|inherit|immun|disease|reproduc|excretion|digest|photosynth|respiration|hormone|selection|plant nutrition|variation|glossary|thinking and working scientifically|science in context|scientific method|science skills"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"sampl|quadrat|abundance|population density|population size|measuring population"
SPECIES = [("dandelions", "*"), ("daisies", "o"), ("clover plants", "^"), ("thistles", "x")]
# The AL field's species, with markers told apart at a glance (no star beside a cross).
AL_SPECIES = [("daisies", "o"), ("clover plants", "^"), ("thistles", "x"), ("plantains", "s")]


def concepts_for(p: dict) -> tuple:
    """The LS and UP fields link as they always have; the AL field also teaches Simpson's index."""
    if p.get("kind") == "simpson":
        return CONCEPTS
    return CONCEPTS[:3]


def _peek(rng: random.Random) -> float:
    """Decides the AL sub-type without moving rng: every other seed draws exactly the field it drew before."""
    return random.Random(str(rng.getstate()[1][:8])).random()


def sample(rng: random.Random) -> dict:
    if _peek(rng) < 0.2:
        return _sample_simpson(rng)
    W, H = 10, rng.choice([6, 8])
    n = rng.choice([4, 5])
    cells = []  # a row above each for its letter; never touching, or two read as one long box
    while len(cells) < n:
        c = (rng.randrange(W), rng.randrange(H - 1))
        if all(max(abs(c[0] - d[0]), abs(c[1] - d[1])) >= 2 for d in cells):
            cells.append(c)
    rich = [(rng.uniform(0, W), rng.uniform(0, H)) for _ in range(rng.randint(2, 3))]  # the patches plants grow thick in

    def clear(x, y):
        """Not under a quadrat's letter, which sits in the lower half of the square above it (P3j review)."""
        return not any(cx <= x <= cx + 1 and cy + 1 <= y <= cy + 1.5 for cx, cy in cells)

    plants = []
    for cx in range(W):
        for cy in range(H):
            near = min(((cx + 0.5 - x) ** 2 + (cy + 0.5 - y) ** 2) ** 0.5 for x, y in rich)
            k = max(0, min(4, round(4.0 - near * 0.9 + rng.uniform(-1, 1))))
            here = []
            for _ in range(60):  # each plant 0.22 m inside its square and 0.3 m from the others, so each can be counted
                if len(here) == k:
                    break
                x, y = round(cx + rng.uniform(0.22, 0.78), 3), round(cy + rng.uniform(0.22, 0.78), 3)
                if clear(x, y) and all((x - a) ** 2 + (y - b) ** 2 >= 0.3 ** 2 for a, b in here):
                    here.append([x, y])
            plants += here
    letters = "ABCDE"[:n]
    return {"band": rng.choice(("LS", "UP")), "W": W, "H": H, "plants": plants, "quadrats": {k: list(c) for k, c in zip(letters, cells)},
            "species": rng.randrange(len(SPECIES)), "ask": rng.choice(letters)}


def _simpson(p: dict) -> tuple:
    """D for the plants inside the quadrats, and each species' count there."""
    inside: dict = {}
    for (x, y), k in zip(p["plants"], p["kinds"]):
        if any(int(x) == cx and int(y) == cy for cx, cy in p["quadrats"].values()):
            inside[k] = inside.get(k, 0) + 1
    big = sum(inside.values())
    return 1 - sum(Fraction(v, big) ** 2 for v in inside.values()), inside


def _sample_simpson(rng: random.Random) -> dict:
    while True:
        W, H = 10, rng.choice([6, 8])
        n = 5
        cells: list = []
        while len(cells) < n:
            c = (rng.randrange(W), rng.randrange(H - 1))
            if all(max(abs(c[0] - d[0]), abs(c[1] - d[1])) >= 2 for d in cells):
                cells.append(c)
        mix = sorted(rng.sample(range(len(AL_SPECIES)), 3))
        weights = [rng.uniform(1, 4) for _ in mix]

        def clear(x, y, cells=cells):
            """Nothing within a marker's width of a quadrat's letter, so no letter sits on a plant."""
            return not any(cx - 0.1 <= x <= cx + 1.1 and cy + 1 <= y <= cy + 1.85 for cx, cy in cells)

        plants, kinds = [], []
        for cx in range(W):
            for cy in range(H):
                k = rng.randint(0, 3) if (cx, cy) not in cells else rng.randint(2, 4)
                here: list = []
                for _ in range(60):
                    if len(here) == k:
                        break
                    x, y = round(cx + rng.uniform(0.22, 0.78), 3), round(cy + rng.uniform(0.22, 0.78), 3)
                    if clear(x, y) and all((x - a) ** 2 + (y - b) ** 2 >= 0.3 ** 2 for a, b in here):
                        here.append([x, y])
                plants += here
                kinds += rng.choices(mix, weights, k=len(here))
        p = {"band": "AL", "kind": "simpson", "W": W, "H": H, "plants": plants, "kinds": kinds, "mix": mix,
             "quadrats": {k: list(c) for k, c in zip("ABCDE", cells)}}
        d, inside = _simpson(p)
        if set(inside) == set(mix) and abs((d * 100) % 1 - Fraction(1, 2)) > Fraction(1, 10):
            p["ask"] = rng.choice(mix)
            return p


def draw(p: dict):
    if p.get("kind") == "simpson":
        return _draw_simpson(p)
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
        ax.add_patch(Rectangle((cx, cy), 1, 1, facecolor="none", edgecolor=INK, linewidth=2.2, zorder=4))
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


def _draw_simpson(p: dict):
    W, H = p["W"], p["H"]
    fig, ax = new_figure(9.6, 0.66 * H + 1.2)
    ax.add_patch(Rectangle((0, 0), W, H, facecolor="#f3f6ef", edgecolor=INK, linewidth=1.4, zorder=0))
    for x in range(1, W):
        ax.plot([x, x], [0, H], color=GRID, linewidth=0.5, zorder=1)
    for y in range(1, H):
        ax.plot([0, W], [y, y], color=GRID, linewidth=0.5, zorder=1)
    for k in p["mix"]:
        _, marker = AL_SPECIES[k]
        pts = [xy for xy, kk in zip(p["plants"], p["kinds"]) if kk == k]
        ax.plot([q[0] for q in pts], [q[1] for q in pts], linestyle="none", marker=marker, markersize=6.5, color=INK,
                markerfacecolor="white" if marker == "o" else INK, markeredgewidth=1.4, zorder=3)
    for letter, (cx, cy) in p["quadrats"].items():
        ax.add_patch(Rectangle((cx, cy), 1, 1, facecolor="none", edgecolor=INK, linewidth=2.2, zorder=4))
        ax.text(cx + 0.5, cy + 1.12, letter, ha="center", va="bottom", fontsize=11, fontweight="bold", zorder=5,
                bbox={"boxstyle": "round,pad=0.12", "facecolor": "white", "edgecolor": "none"})
    x0, top = W + 0.6, H - 0.3
    ax.text(x0, top, "Key", ha="left", va="center", fontsize=10.5, fontweight="bold")
    for j, k in enumerate(p["mix"]):
        name, marker = AL_SPECIES[k]
        y = top - 0.75 * (j + 1)
        ax.plot([x0 + 0.25], [y], linestyle="none", marker=marker, markersize=7, color=INK,
                markerfacecolor="white" if marker == "o" else INK, markeredgewidth=1.4)
        ax.text(x0 + 0.65, y, name, ha="left", va="center", fontsize=10)
    y = top - 0.75 * 4 - 0.2
    for j, line in enumerate(["Simpson's index of diversity:", "D = 1 − Σ(n/N)²", "n = number of one species",
                              "N = number of all the plants", "(both in all the quadrats)"]):
        ax.text(x0, y - 0.55 * j, line, ha="left", va="center", fontsize=10, fontweight="bold" if j < 2 else "normal")
    ax.set_xlim(-0.1, W + 6.2)
    ax.set_ylim(-0.1, H + 0.1)
    ax.set_xticks(range(0, W + 1, 2))
    ax.set_yticks(range(0, H + 1, 2))
    ax.set_xlabel("Distance (m)")
    ax.set_ylabel("Distance (m)")
    ax.tick_params(labelsize=8)
    ax.spines["bottom"].set_bounds(0, W)
    ax.set_aspect("equal")
    return fig


SETTINGS = ["on a school field trip", "in an ecology lesson", "for a class project", "near the school garden"]


def _questions_simpson(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    d, inside = _simpson(p)
    names = [AL_SPECIES[k][0] for k in p["mix"]]
    exact_d = Decimal(d.numerator) / Decimal(d.denominator)
    two = str(exact_d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    three = str(exact_d.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))
    big = sum(inside.values())
    k = p["ask"]
    name = AL_SPECIES[k][0]
    return [short(f"{who} placed 5 quadrats of 1 m² at random {rng.choice(SETTINGS)} and counted the {names[0]}, "
                  f"{names[1]} and {names[2]} in them. Using all the quadrats together, what is Simpson's index of "
                  f"diversity, D? Give it to 2 decimal places.", two, [two, three, f"D = {two}"]),
            short(f"How many {name} are there in all 5 quadrats together?", inside[k], [f"{inside[k]} {name}"]),
            short("What is N, the total number of plants in all 5 quadrats?", big, [f"N = {big}", f"{big} plants"])]


def questions(p: dict, rng: random.Random) -> list:
    if p.get("kind") == "simpson":
        return _questions_simpson(p, rng)
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
