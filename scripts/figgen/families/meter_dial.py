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
# Not fields, magnets, turning, pressure, nuclei or natural disasters.
AVOID = r"field|electrostatic|static electricity|charged particle|coulomb|centre of gravity|environmental|induction|^magnetism$|magnetic effect|electromagnetic forces|telecommunication|motor effect|nuclear|turning|moment|pressure|solar system|earthquake|work, energy|scalars and vectors"
# the meter, its unit, full scale, and the size of one small division: at most 12 divisions, in steps a
# learner counts easily, since dials of 20 to 50 divisions were misread by one (P3f review)
SCALES = [("ammeter", "A", 1, Fraction(1, 10)), ("ammeter", "A", 3, Fraction(1, 4)), ("ammeter", "A", 5, Fraction(1, 2)),
          ("ammeter", "A", 10, Fraction(1)), ("voltmeter", "V", 3, Fraction(1, 4)), ("voltmeter", "V", 5, Fraction(1, 2)),
          ("voltmeter", "V", 6, Fraction(1, 2)), ("voltmeter", "V", 10, Fraction(1)), ("voltmeter", "V", 12, Fraction(1)),
          ("voltmeter", "V", 20, Fraction(2)), ("newton meter", "N", 10, Fraction(1)), ("newton meter", "N", 20, Fraction(2)),
          ("newton meter", "N", 50, Fraction(5))]
# What hangs from a newton meter, by its full scale: a weight that fits the dial (no 47 N pineapple).
LOADS = {10: ["a pineapple", "a cabbage", "a bunch of bananas"], 20: ["a bag of sugar", "a bag of rice", "a bag of beans"],
         50: ["a small jerrycan of water", "a bag of maize flour", "a bucket of potatoes"]}
WORD = {"A": "current", "V": "voltage", "N": "force"}


def concepts_for(p: dict) -> tuple[str, ...]:
    return MEASURING + MEASURES[p["meter"]]
SWEEP = (150, 30)  # the scale runs from 150° on the left to 30° on the right


def sample(rng: random.Random) -> dict:
    meter, unit, full, minor = rng.choice(SCALES)
    steps = int(full / minor)
    k = rng.randint(2, steps - 2)  # clear of the stops at either end
    return {"band": rng.choice(BANDS), "meter": meter, "unit": unit, "full": full, "minor": str(minor), "value": exact(minor * k)}


def label_step(p: dict) -> Fraction:
    """The numbered step: the smallest round one that ends on the full scale in 3 to 10 steps, with at least
    two small divisions in each, so "one small division" means something (P3f re-review)."""
    minor = Fraction(p["minor"])
    return next(L for L in map(Fraction, ("0.1", "0.2", "0.5", "1", "2", "4", "5", "10"))
                if (L / minor).denominator == 1 and L / minor >= 2 and (p["full"] / L).denominator == 1 and 3 <= p["full"] / L <= 10)


def _angle(p: dict, v: float) -> float:
    a0, a1 = SWEEP
    return math.radians(a0 + (a1 - a0) * v / p["full"])


def draw(p: dict):
    minor = Fraction(p["minor"])
    steps = int(p["full"] / minor)
    label = label_step(p)
    major = int(label / minor)
    R = 3.0  # a large dial: the needle's thin tip meets the ticks on the scale's arc
    fig, ax = new_figure(6.4, 4.8)
    ax.add_patch(FancyBboxPatch((-3.9, -1.6), 7.8, 5.7, boxstyle="round,pad=0.05,rounding_size=0.3", facecolor=FILL_2, edgecolor=INK,
                                linewidth=1.6))
    ax.add_patch(Arc((0, 0), 2 * R, 2 * R, theta1=SWEEP[1], theta2=SWEEP[0], color=INK, linewidth=1.2))
    for i in range(steps + 1):
        a = _angle(p, float(minor * i))
        big = i % major == 0
        mid = major >= 4 and major % 2 == 0 and i % (major // 2) == 0
        r0 = R - (0.5 if big else 0.36 if mid else 0.26)
        ax.plot([r0 * math.cos(a), R * math.cos(a)], [r0 * math.sin(a), R * math.sin(a)], color=INK, linewidth=1.4 if big else 1.0)
        if big:
            ax.text((R + 0.4) * math.cos(a), (R + 0.4) * math.sin(a), exact(minor * i), ha="center", va="center", fontsize=10)
    a = _angle(p, float(Fraction(p["value"])))
    ax.plot([0, R * math.cos(a)], [0, R * math.sin(a)], color=INK, linewidth=1.3)  # the tip ends on the arc, where the ticks end
    ax.plot([0], [0], marker="o", markersize=7, color=INK)
    # The unit and the meter's name below the pivot, where the needle never goes.
    ax.text(0, -0.55, p["unit"], ha="center", va="center", fontsize=16, fontweight="bold")
    ax.text(0, -1.15, p["meter"], ha="center", va="center", fontsize=10)
    ax.set_xlim(-4.1, 4.1)
    ax.set_ylim(-1.8, 4.3)
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
        load = rng.choice(LOADS[p["full"]])
        first = f"{name} hung {load} from a newton meter. What is the weight of the {load.split(' ', 1)[1]}?"
    else:
        first = f"{name} read the {p['meter']} in a circuit. What is its reading?"
    return [
        short(first, exact(v), measure(v, unit)),
        short(f"What does one small division on this {p['meter']} stand for?", exact(minor), measure(minor, unit)),
        short(f"The needle shows the first reading. Later the {p['meter']} reads {exact(later)} {unit}. By how much has the {word} changed?",
              exact(change), measure(change, unit)),
    ]
