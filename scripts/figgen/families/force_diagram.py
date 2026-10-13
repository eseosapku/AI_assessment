"""Forces on an object (LS, UP): horizontal forces, labelled in newtons, push a box, a cart or a sack of
maize along the ground; its weight W and the ground's push R act up and down. The resultant force (size
and direction), the acceleration (a = F/m) and the weight (W = mg, g stated).

The resultant's options are its size or all the forces added, to the right or the left: a 2 × 2 set, so
nothing gives the answer away without the figure.
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
# Not electric or magnetic forces, fields, pressure, density, work and energy, or turning effects.
AVOID = r"electric|electrostatic|static electricity|magnet|motor effect|nuclear|earthquake|measurement|errors|orbit|relativity|potential|field|pressure|density|archimedes|pascal|environmental|solar system|projectile|work|energy|turning"
THINGS = ["box", "cart", "sack of maize", "crate of bananas", "wheelbarrow"]


def sample(rng: random.Random) -> dict:
    while True:
        n = rng.choice([2, 3])
        forces = [[rng.choice(["right", "left"]), 5 * rng.randint(1, 12)] for _ in range(n)]
        if len({d for d, _ in forces}) < 2:
            continue  # at least one force each way: otherwise the resultant is just their sum
        net = sum(f if d == "right" else -f for d, f in forces)
        mass = rng.choice([4, 5, 10, 20, 25, 50])
        if net and (2 * Fraction(abs(net), mass)).denominator == 1:
            return {"band": rng.choice(BANDS), "thing": rng.choice(THINGS), "forces": forces, "mass": mass}


def draw(p: dict):
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
        ax.add_patch(FancyArrow(x0, y, sign * length, 0, width=0.06, head_width=0.28, head_length=0.3, length_includes_head=True,
                                color=INK))
        ax.text(x0 + sign * (length + 0.15), y, f"{f} N", ha="left" if d == "right" else "right", va="center", fontsize=11)
    ax.add_patch(FancyArrow(0, -0.8, 0, -1.6, width=0.06, head_width=0.28, head_length=0.3, length_includes_head=True, color=INK))
    ax.text(0.25, -2.2, "W", ha="left", va="center", fontsize=12, style="italic")
    ax.add_patch(FancyArrow(0, 0.8, 0, 1.6, width=0.06, head_width=0.28, head_length=0.3, length_includes_head=True, color=INK))
    ax.text(0.25, 2.2, "R", ha="left", va="center", fontsize=12, style="italic")
    ax.set_xlim(-6.2, 6.2)
    ax.set_ylim(-2.7, 2.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    net = sum(f if d == "right" else -f for d, f in p["forces"])
    size, way = abs(net), "right" if net > 0 else "left"
    total = sum(f for _, f in p["forces"])
    other = "left" if way == "right" else "right"
    name = rng.choice(NAMES)
    resultant = mcq(f"{name} pulls and pushes a {p['thing']} along the ground. What is the resultant force on it?", f"{size} N to the {way}",
                    [f"{size} N to the {other}", f"{total} N to the {way}", f"{total} N to the {other}"], rng)
    a = Fraction(size, p["mass"])
    accel = short(f"What is the acceleration of {name}'s {p['mass']} kg {p['thing']}?", exact(a), measure(a, "m/s²") + measure(a, "m/s2")[1:])
    weight = short(f"Take g = 10 N/kg. What is the weight W of {name}'s {p['thing']}?", 10 * p["mass"], measure(10 * p["mass"], "N"))
    return [resultant, accel, weight]
