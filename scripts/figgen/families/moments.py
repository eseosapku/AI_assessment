"""Moments (LS, UP, AL): a metre rule balanced on a pivot with loads hanging at marked distances, one
load unknown. The unknown load, the moment of a load, and at Upper Secondary and A Level the force of the
pivot. At Lower Secondary the pivot is at the 50 cm mark, so the rule's own weight turns nothing; above
it the pivot may be elsewhere and the rule's weight (at 50 cm) counts.

Every load hangs at a multiple of 5 cm, and the unknown load is a whole number of newtons.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, exact, measure, new_figure, short

ID = "moments"
KIND = "physics.force"
SUBJECT = "physics"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("moments-and-turning-effects", "stability-and-equilibrium", "centre-of-mass-and-gravity",
                                          "simple-machines"))


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        pivot = 50 if band == "LS" else rng.choice([30, 40, 50, 60, 70])
        rule = 0 if pivot == 50 else rng.choice([1, 2, 3, 4])  # the rule's weight, at its 50 cm mark
        side = rng.choice([-1, 1])  # the side the known loads hang on
        n = rng.choice([1, 2])
        spots = [x for x in range(0, 101, 5) if (x - pivot) * side > 0]
        if len(spots) < n + 1:
            continue
        xs = rng.sample(spots, n)
        others = [x for x in range(0, 101, 5) if (x - pivot) * side < 0]
        if not others:
            continue
        ux = rng.choice(others)
        # Every load at least 10 cm from the others and from the pivot: their boxes and strings never meet.
        if any(abs(a - b) < 10 for a in xs + [ux] for b in xs + [ux, pivot] if a != b) or any(abs(x - pivot) < 10 for x in xs + [ux]):
            continue
        loads = [[x, rng.randint(1, 12)] for x in xs]
        turning = sum(f * (x - pivot) for x, f in loads) + rule * (50 - pivot)
        if turning % (pivot - ux) == 0 and 0 < turning // (pivot - ux) <= 40:
            return {"band": band, "pivot": pivot, "rule": rule, "loads": loads, "unknown": [ux, turning // (pivot - ux)]}


def draw(p: dict):
    fig, ax = new_figure(7.2, 3.4)
    ax.add_patch(Rectangle((0, 0), 100, 3, facecolor=FILL_2, edgecolor=INK, linewidth=1.4))
    for x in range(0, 101, 5):
        ax.plot([x, x], [3, 3 - (1.4 if x % 10 == 0 else 0.8)], color=INK, linewidth=0.8)
        if x % 10 == 0:
            ax.text(x, 3.6, f"{x}", ha="center", va="bottom", fontsize=8)
    ax.text(106, 3.6, "cm", ha="left", va="bottom", fontsize=8)
    px = p["pivot"]
    ax.add_patch(Polygon([(px, 0), (px - 3.5, -7), (px + 3.5, -7)], closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.2))
    for (x, f), label in [((x, f), f"{f} N") for x, f in p["loads"]] + [((p["unknown"][0], 0), "W")]:
        ax.plot([x, x], [0, -6], color=INK, linewidth=1.0)
        ax.add_patch(Rectangle((x - 3.2, -11), 6.4, 5, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.text(x, -8.5, label, ha="center", va="center", fontsize=10, fontweight="bold", style="italic" if label == "W" else "normal")
    ax.set_xlim(-6, 113)
    ax.set_ylim(-13, 7)
    ax.set_aspect(1.4)
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    ux, uf = p["unknown"]
    pivot = p["pivot"]
    rule = f" The rule weighs {p['rule']} N." if p["rule"] else ""
    qs = [short(f"{name} balanced a metre rule on a pivot at the {pivot} cm mark.{rule} What is the weight W?", uf, measure(uf, "N"))]
    x, f = rng.choice(p["loads"])
    mom = exact(f * abs(x - pivot) / 100)
    qs.append(short(f"What is the moment of the {f} N load at {x} cm about the pivot, in N m?", mom,
                    measure(f * abs(x - pivot) / 100, "N m") + [f"{mom} Nm", f"{f * abs(x - pivot)} N cm"]))
    if p["band"] != "LS":
        up = sum(f for _, f in p["loads"]) + uf + p["rule"]
        qs.append(short("The rule is balanced. What is the upward force of the pivot on the rule?", up, measure(up, "N")))
    return qs
