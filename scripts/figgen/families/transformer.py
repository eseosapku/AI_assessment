"""Transformers (UP, AL): an iron core with a primary coil fed by an a.c. supply and a secondary coil,
their turns and voltages labelled, one of the four missing. The missing value, step-up or step-down,
the turns for another output, and at AL the secondary current of an ideal transformer.

Every voltage obeys Vs / Vp = Ns / Np exactly, and every answer is a whole number of turns or a
voltage or current exact to two decimal places.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle, Rectangle

from ..core import FILL_2, INK, NAMES, exact, mcq, measure, new_figure, short

ID = "transformer"
KIND = "physics.circuit"
SUBJECT = "physics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("transformers", "electromagnetic-induction", "alternating-current"))
# Not fields, communications, motors or electronics.
AVOID = r"electric field|electrostatic|static electricity|charged particle|coulomb|communication|signals|^chapter 23: magnetism$|electric motors|electronic|magnetic effect"
TURNS = [100, 200, 250, 400, 500, 800, 1000, 1200, 2000, 2400]
RATIOS = [Fraction(1, 20), Fraction(1, 10), Fraction(1, 5), Fraction(1, 4), Fraction(1, 2), Fraction(2), Fraction(3), Fraction(4), Fraction(5),
          Fraction(10)]
SUPPLY = [6, 12, 24, 120, 230, 240]
LABEL = {"Vp": "voltage across the primary coil", "Vs": "voltage across the secondary coil", "Np": "number of turns on the primary coil",
         "Ns": "number of turns on the secondary coil"}


def _exact2(v: Fraction) -> bool:
    return (v * 100).denominator == 1


def sample(rng: random.Random) -> dict:
    while True:
        Np, k, Vp = rng.choice(TURNS), rng.choice(RATIOS), rng.choice(SUPPLY)
        Ns, Vs = Np * k, Vp * k
        if Ns.denominator == 1 and 20 <= Ns <= 24000 and _exact2(Vs):
            return {"band": rng.choice(BANDS), "Np": Np, "Ns": int(Ns), "Vp": Vp, "Vs": exact(Vs), "missing": rng.choice(list(LABEL))}


def _coil(ax, x0: float, loops: int, lead: int):
    """Slanted strands across a limb of the core from x0 to x0 + 1.5, between y = 1 and y = 5; the
    heights of the lowest and highest strands at their left (lead -1) or right (lead 1) ends."""
    ys = [1.0 + 4.0 * (i + 0.5) / loops for i in range(loops)]
    for y in ys:
        ax.plot([x0 - 0.3, x0 + 1.8], [y - 0.14, y + 0.14], color=INK, linewidth=1.6, solid_capstyle="round")
    return ys[0] + 0.14 * lead, ys[-1] + 0.14 * lead


def draw(p: dict):
    fig, ax = new_figure(6.4, 5.0)
    ax.add_patch(Rectangle((0, 0), 8, 6, facecolor=FILL_2, edgecolor=INK, linewidth=1.4))
    ax.add_patch(Rectangle((1.5, 1.5), 5, 3, facecolor="white", edgecolor=INK, linewidth=1.4))
    big = max(p["Np"], p["Ns"])
    lo_p, hi_p = _coil(ax, 0, max(3, round(10 * p["Np"] / big)), -1)
    lo_s, hi_s = _coil(ax, 6.5, max(3, round(10 * p["Ns"] / big)), 1)
    # The a.c. supply on the left, the output terminals on the right.
    ax.plot([-0.3, -1.6, -1.6], [hi_p, hi_p, 3.45], color=INK, linewidth=1.4)
    ax.plot([-0.3, -1.6, -1.6], [lo_p, lo_p, 2.55], color=INK, linewidth=1.4)
    ax.add_patch(Circle((-1.6, 3.0), 0.45, facecolor="white", edgecolor=INK, linewidth=1.4))
    ax.text(-1.6, 3.0, "~", ha="center", va="center", fontsize=16)
    for y in (lo_s, hi_s):
        ax.plot([8.3, 9.3], [y, y], color=INK, linewidth=1.4)
        ax.add_patch(Circle((9.45, y), 0.15, facecolor="white", edgecolor=INK, linewidth=1.4))
    ax.text(4.0, 6.35, "iron core", ha="center", va="bottom", fontsize=10)
    ax.text(4.0, 3.0, "coils not drawn to scale", ha="center", va="center", fontsize=8, style="italic")  # 1:20 cannot be drawn
    shown = lambda k, text: "?" if p["missing"] == k else text  # noqa: E731
    for x, side, N, V in ((0.75, "primary", "Np", "Vp"), (7.25, "secondary", "Ns", "Vs")):
        ax.text(x, -0.35, f"{side} coil", ha="center", va="top", fontsize=10)
        ax.text(x, -1.0, f"{N[0]}{N[1]} = {shown(N, f'{p[N]} turns')}", ha="center", va="top", fontsize=11)
        ax.text(x, -1.65, f"{V[0]}{V[1]} = {shown(V, f'{p[V]} V')}", ha="center", va="top", fontsize=11)
    ax.set_xlim(-2.6, 10.4)
    ax.set_ylim(-2.4, 7.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in the school laboratory", "at the science club", "for a class practical", "during a physics lesson", "for a science fair",
            "for a school project"]


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    Np, Ns, Vp, Vs = Fraction(p["Np"]), Fraction(p["Ns"]), Fraction(p["Vp"]), Fraction(p["Vs"])
    value = {"Np": Np, "Ns": Ns, "Vp": Vp, "Vs": Vs}[p["missing"]]
    unit = "V" if p["missing"].startswith("V") else "turns"
    up = Ns > Np
    kinds = [f"{a}: the secondary coil has {b} turns than the primary" for a in ("Step-up", "Step-down") for b in ("more", "fewer")]
    key = kinds[0] if up else kinds[3]
    # Another output from the same supply and primary: a whole number of secondary turns.
    others = [Vp * k for k in RATIOS if (Np * k).denominator == 1 and _exact2(Vp * k) and Vp * k != Vs]
    V2 = rng.choice(others)
    qs = [
        short(f"{name} built this transformer {rng.choice(SETTINGS)}. Treat it as ideal. What is the {LABEL[p['missing']]}?", exact(value),
              measure(value, unit)),
        mcq("Is this a step-up or a step-down transformer?", key, [k for k in kinds if k != key], rng),
        short(f"{friend} wants {exact(V2)} V from the same supply and primary coil. How many turns must the secondary coil have?",
              exact(Np * V2 / Vp), measure(Np * V2 / Vp, "turns")),
    ]
    if p["band"] == "AL":
        Ip = rng.choice([i for i in map(Fraction, ("0.1", "0.2", "0.3", "0.5", "0.6", "1", "1.5", "2", "3")) if _exact2(i * Vp / Vs)])
        Is = Ip * Vp / Vs
        qs.append(short(f"The current in the primary coil is {exact(Ip)} A. If the transformer is ideal, what is the current in the secondary "
                        "coil?", exact(Is), measure(Is, "A")))
    return qs
