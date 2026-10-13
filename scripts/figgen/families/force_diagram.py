"""Forces on an object (LS, UP): horizontal forces, labelled in newtons, push a box, a cart or a sack of
maize along the ground, its weight W and the ground's push R acting up and down; sometimes the forces
balance. At UP, two ropes pull at right angles, seen from above, their sizes from a Pythagorean
triple. The resultant force, the acceleration (a = F/m), the weight (W = mg, g stated), and whether
the object is in equilibrium.

The resultant's options are its size or all the forces added, to the right or the left: a 2 × 2 set, so
nothing gives the answer away without the figure. So is the equilibrium question's: yes or no, by the
resultant zero or not.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import FancyArrow, Rectangle

from ..core import FILL_2, INK, NAMES, exact, mcq, measure, new_figure, short

ID = "force_diagram"
KIND = "physics.force"
SUBJECT = "physics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"physics.{c}" for c in ("forces", "force-mass-and-acceleration", "newtons-laws-of-motion", "mass-weight-and-gravity",
                                          "friction", "scalars-and-vectors"))
# Not electric or magnetic forces, fields, pressure, density, work and energy, turning effects, machines or practicals.
AVOID = (r"electric|electrostatic|static electricity|magnet|motor effect|nuclear|earthquake|measurement|errors|orbit|relativity|potential"
         r"|field|pressure|density|archimedes|pascal|environmental|solar system|projectile|work|energy|turning|centre of gravity"
         r"|simple machines|practical physics")
THINGS = ["box", "cart", "sack of maize", "crate of bananas", "wheelbarrow"]
TRIPLES = [(3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25), (20, 21, 29)]
PLACES = ["at the market", "in the school yard", "on the farm", "at the bus park", "outside the shop", "at the cooperative store"]
EQUILIBRIUM = [f"{a}: the resultant force is {b}" for a in ("Yes", "No") for b in ("zero", "not zero")]


def concepts_for(p: dict) -> tuple[str, ...]:
    """Forces along one line are not yet vectors to add; two at right angles are."""
    return CONCEPTS if p["kind"] == "right" else tuple(c for c in CONCEPTS if c != "physics.scalars-and-vectors")


def sample(rng: random.Random) -> dict:
    band, thing = rng.choice(BANDS), rng.choice(THINGS)
    if band == "UP" and rng.random() < 0.4:
        while True:
            a, b, c = rng.choice(TRIPLES)
            k = rng.choice([1, 2, 4, 5, 10])
            if rng.random() < 0.5:
                a, b = b, a
            mass = rng.choice([4, 5, 10, 20, 25, 50])
            if 15 <= c * k <= 150 and (100 * Fraction(c * k, mass)).denominator == 1:
                return {"band": band, "kind": "right", "thing": thing, "mass": mass,
                        "forces": [[rng.choice(["right", "left"]), a * k], [rng.choice(["up", "down"]), b * k]]}
    balanced = rng.random() < 0.3
    while True:
        n = rng.choice([2, 3])
        forces = [[rng.choice(["right", "left"]), 5 * rng.randint(1, 12)] for _ in range(n)]
        if len({d for d, _ in forces}) < 2:
            continue  # at least one force each way: otherwise the resultant is just their sum
        net = sum(f if d == "right" else -f for d, f in forces)
        mass = rng.choice([4, 5, 10, 20, 25, 50])
        if (net == 0) == balanced and (2 * Fraction(abs(net), mass)).denominator == 1:
            return {"band": band, "kind": "line", "thing": thing, "forces": forces, "mass": mass}


def _arrow(ax, x, y, dx, dy):
    ax.add_patch(FancyArrow(x, y, dx, dy, width=0.06, head_width=0.28, head_length=0.3, length_includes_head=True, color=INK))


def _seen_from_above(p: dict):
    fig, ax = new_figure(5.6, 5.0)
    ax.add_patch(Rectangle((-1.0, -1.0), 2.0, 2.0, facecolor=FILL_2, edgecolor=INK, linewidth=1.6))
    ax.text(0, 0, f"{p['mass']} kg", ha="center", va="center", fontsize=12, fontweight="bold")
    (d1, f1), (d2, f2) = p["forces"]
    longest = max(f1, f2)
    L1, L2 = 1.0 + 2.2 * f1 / longest, 1.0 + 2.2 * f2 / longest
    s1, s2 = (1 if d1 == "right" else -1), (1 if d2 == "up" else -1)
    _arrow(ax, s1 * 1.0, 0, s1 * L1, 0)
    ax.text(s1 * (1.0 + L1 + 0.15), 0, f"{f1} N", ha="left" if s1 > 0 else "right", va="center", fontsize=11)
    _arrow(ax, 0, s2 * 1.0, 0, s2 * L2)
    ax.text(0.25, s2 * (1.0 + L2 - 0.35), f"{f2} N", ha="left", va="center", fontsize=11)
    # Framed to the box and its two arrows, the note below the box on the side away from the vertical arrow.
    x0, x1 = (-1.9 - (L1 + 1.4 if s1 < 0 else 0)), (1.9 + (L1 + 1.4 if s1 > 0 else 0))
    y0, y1 = (-1.9 - (L2 + 0.4 if s2 < 0 else 0)), (1.9 + (L2 + 0.4 if s2 > 0 else 0))
    ax.text(-1.0 if s1 > 0 else 1.0, y0 + 0.2, "seen from above", ha="left" if s1 > 0 else "right", va="bottom", fontsize=10,
            style="italic") if s2 > 0 else ax.text(-s1 * 1.2, y1 - 0.2, "seen from above", ha="right" if s1 > 0 else "left", va="top",
                                                   fontsize=10, style="italic")
    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    if p["kind"] == "right":
        return _seen_from_above(p)
    fig, ax = new_figure(6.4, 4.0)
    ax.add_patch(Rectangle((-1.2, -0.8), 2.4, 1.6, facecolor=FILL_2, edgecolor=INK, linewidth=1.6))
    ax.text(0, 0, f"{p['mass']} kg", ha="center", va="center", fontsize=12, fontweight="bold")
    ax.plot([-5.6, 5.6], [-0.8, -0.8], color=INK, linewidth=1.2)  # the ground
    longest = max(f for _, f in p["forces"])
    ys = {"right": [0.35, -0.35, 0.0], "left": [0.35, -0.35, 0.0]}
    used = {"right": 0, "left": 0}
    for d, f in p["forces"]:
        y = ys[d][used[d]] if sum(1 for dd, _ in p["forces"] if dd == d) > 1 else 0.0
        used[d] += 1
        length = 1.0 + 2.6 * f / longest
        x0, sign = (1.2, 1) if d == "right" else (-1.2, -1)
        _arrow(ax, x0, y, sign * length, 0)
        ax.text(x0 + sign * (length + 0.15), y, f"{f} N", ha="left" if d == "right" else "right", va="center", fontsize=11)
    _arrow(ax, 0, -0.8, 0, -1.6)
    ax.text(0.25, -2.2, "W", ha="left", va="center", fontsize=12, style="italic")
    _arrow(ax, 0, 0.8, 0, 1.6)
    ax.text(0.25, 2.2, "R", ha="left", va="center", fontsize=12, style="italic")
    ax.set_xlim(-6.2, 6.2)
    ax.set_ylim(-2.7, 2.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    thing, mass = p["thing"], p["mass"]
    if p["kind"] == "right":
        (_, f1), (_, f2) = p["forces"]
        size = round((f1 * f1 + f2 * f2) ** 0.5)
        resultant = short(f"{name} and {friend} pull a {thing} across the ground {rng.choice(PLACES)} with two ropes at right angles. "
                          "What is the size of the "
                          "resultant force on it?", size, measure(size, "N"))
    else:
        net = sum(f if d == "right" else -f for d, f in p["forces"])
        size, way = abs(net), "right" if net > 0 else "left"
        stem = f"{name} pulls and pushes a {thing} along the ground {rng.choice(PLACES)}. What is the resultant force on it?"
        if net == 0:
            resultant = short(stem, 0, ["0 N", "0N", "0 newtons", "zero"])
        else:
            total = sum(f for _, f in p["forces"])
            other = "left" if way == "right" else "right"
            resultant = mcq(stem, f"{size} N to the {way}", [f"{size} N to the {other}", f"{total} N to the {way}", f"{total} N to the {other}"],
                            rng)
    a = Fraction(size, mass)
    qs = [resultant,
          short(f"What is the acceleration of {name}'s {mass} kg {thing}?", exact(a), measure(a, "m/s²") + measure(a, "m/s2")[1:]),
          short(f"Take g = 10 N/kg. What is the weight of {name}'s {thing}?", 10 * mass, measure(10 * mass, "N"))]
    if p["kind"] == "line":
        key = EQUILIBRIUM[0] if size == 0 else EQUILIBRIUM[3]
        qs.append(mcq(f"Is the {thing} in equilibrium?", key, [e for e in EQUILIBRIUM if e != key], rng))
    return qs
