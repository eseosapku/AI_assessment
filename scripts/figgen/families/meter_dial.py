"""An analogue meter (LS, UP): an ammeter, voltmeter or newton meter dial with its needle on a division.
The reading, the size of one small division, and how much a later reading has changed.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Arc, FancyBboxPatch

from ..core import FILL_2, INK, NAMES, exact, measure, new_figure, short

ID = "meter_dial"
KIND = "instrument.reading"
SUBJECT = "physics"
BANDS = ("LS", "UP")
MEASURING = tuple(f"physics.{c}" for c in ("measurement-precision-and-uncertainty", "measurement-instrumentation-procedures"))
MEASURES = {"ammeter": ("physics.electric-current",), "voltmeter": ("physics.potential-difference",),
            "newton meter": ("physics.forces", "physics.mass-weight-and-gravity")}
CONCEPTS = MEASURING + tuple(c for cs in MEASURES.values() for c in cs)
AVOID = r"field|electrostatic|static electricity|charged particle|coulomb"
# the meter, its unit, full scale, and the size of one small division
SCALES = [("ammeter", "A", 1, Fraction(1, 50)), ("ammeter", "A", 1, Fraction(1, 20)), ("ammeter", "A", 3, Fraction(1, 10)),
          ("ammeter", "A", 5, Fraction(1, 10)), ("ammeter", "A", 10, Fraction(1, 5)), ("voltmeter", "V", 3, Fraction(1, 10)),
          ("voltmeter", "V", 5, Fraction(1, 10)), ("voltmeter", "V", 6, Fraction(1, 5)), ("voltmeter", "V", 10, Fraction(1, 5)),
          ("voltmeter", "V", 15, Fraction(1, 2)), ("voltmeter", "V", 20, Fraction(1, 2)), ("newton meter", "N", 10, Fraction(1, 5)),
          ("newton meter", "N", 20, Fraction(1, 2)), ("newton meter", "N", 50, Fraction(1))]
LOADS = ["a bag of beans", "a pineapple", "a bag of sugar", "a bunch of bananas", "a bag of rice", "a cabbage"]
WORD = {"A": "current", "V": "voltage", "N": "force"}


def concepts_for(p: dict) -> tuple[str, ...]:
    return MEASURING + MEASURES[p["meter"]]
SWEEP = (150, 30)  # the scale runs from 150° on the left to 30° on the right


def sample(rng: random.Random) -> dict:
    meter, unit, full, minor = rng.choice(SCALES)
    steps = int(full / minor)
    k = rng.randint(1, steps - 1)
    return {"band": rng.choice(BANDS), "meter": meter, "unit": unit, "full": full, "minor": str(minor), "value": exact(minor * k)}


def _angle(p: dict, v: float) -> float:
    a0, a1 = SWEEP
    return math.radians(a0 + (a1 - a0) * v / p["full"])


def draw(p: dict):
    minor = Fraction(p["minor"])
    steps = int(p["full"] / minor)
    # Label every L, the smallest round step that ends on the full scale with 3 to 10 labelled steps.
    label = next(L for L in map(Fraction, ("0.1", "0.2", "0.5", "1", "2", "5", "10"))
                 if (L / minor).denominator == 1 and (p["full"] / L).denominator == 1 and 3 <= p["full"] / L <= 10)
    major = int(label / minor)
    fig, ax = new_figure(5.0, 3.8)
    ax.add_patch(FancyBboxPatch((-3.3, -0.9), 6.6, 4.3, boxstyle="round,pad=0.05,rounding_size=0.3", facecolor=FILL_2, edgecolor=INK,
                                linewidth=1.6))
    ax.add_patch(Arc((0, 0), 5.0, 5.0, theta1=SWEEP[1], theta2=SWEEP[0], color=INK, linewidth=1.2))
    for i in range(steps + 1):
        a = _angle(p, float(minor * i))
        big = i % major == 0
        mid = major % 2 == 0 and i % (major // 2) == 0
        r0 = 2.5 - (0.35 if big else 0.26 if mid else 0.18)
        ax.plot([r0 * math.cos(a), 2.5 * math.cos(a)], [r0 * math.sin(a), 2.5 * math.sin(a)], color=INK, linewidth=1.0 if big else 0.6)
        if big:
            ax.text(2.85 * math.cos(a), 2.85 * math.sin(a), exact(minor * i), ha="center", va="center", fontsize=8)
    a = _angle(p, float(Fraction(p["value"])))
    ax.plot([0, 2.45 * math.cos(a)], [0, 2.45 * math.sin(a)], color=INK, linewidth=1.6)  # the tip reaches the scale
    ax.plot([0], [0], marker="o", markersize=6, color=INK)
    ax.text(0, 0.9, p["unit"], ha="center", va="center", fontsize=16, fontweight="bold")
    ax.text(0, -0.55, p["meter"], ha="center", va="center", fontsize=10)
    ax.set_xlim(-3.5, 3.5)
    ax.set_ylim(-1.1, 3.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    v, minor, unit = Fraction(p["value"]), Fraction(p["minor"]), p["unit"]
    word = WORD[unit]
    later = rng.choice([minor * k for k in range(1, int(p["full"] / minor)) if minor * k != v])
    change = abs(later - v)
    if p["meter"] == "newton meter":
        load = rng.choice(LOADS)
        first = f"{name} hung {load} from a newton meter. What is the weight of the {load.split(' ', 1)[1]}?"
    else:
        first = f"{name} read the {p['meter']} in a circuit. What is its reading?"
    return [
        short(first, exact(v), measure(v, unit)),
        short(f"What does one small division on this {p['meter']} stand for?", exact(minor), measure(minor, unit)),
        short(f"Later the {p['meter']} reads {exact(later)} {unit}. By how much has the {word} changed?", exact(change), measure(change, unit)),
    ]
