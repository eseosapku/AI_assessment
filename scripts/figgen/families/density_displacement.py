"""Density by displacement (LS, UP): a measuring cylinder of water before and after a stone is lowered
in, and the stone's mass on a balance. The stone's volume, its density, and the mass of the same rock
that would fill a given volume.

Both levels lie on marked divisions, and the density is exact to 2 decimal places.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import FILL, FILL_2, INK, NAMES, exact, measure, new_figure, short

ID = "density_displacement"
KIND = "instrument.reading"
SUBJECT = "physics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"physics.{c}" for c in ("density", "measurement-of-length-and-volume", "measurement-precision-and-uncertainty"))
# Not motion, manometers or pressure chapters.
AVOID = r"motion|manometer|pascal|agriculture|^chapter 6: pressure$"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"densit|displace|archimedes|volume|measur|float|sink|upthrust"
# rocks and metals, with densities in g/cm³ a learner might meet
STONES = [("stone", [Fraction(5, 2), Fraction(27, 10), Fraction(3)]), ("piece of iron", [Fraction(39, 5)]),
          ("piece of copper", [Fraction(89, 10)]), ("piece of granite", [Fraction(27, 10)]), ("piece of glass", [Fraction(5, 2)])]


def sample(rng: random.Random) -> dict:
    while True:
        thing, rhos = rng.choice(STONES)
        rho = rng.choice(rhos)
        mark = rng.choice([1, 2, 5])
        before = mark * rng.randint(10 // mark + 2, 40 // mark)
        v = mark * rng.randint(2, 30 // mark)
        grams = rho * v
        if (grams * 10).denominator == 1 and before + v <= 80:
            return {"band": rng.choice(BANDS), "thing": thing, "mark": mark, "before": before, "after": before + v,
                    "grams": exact(grams)}


def _cylinder(ax, x0: float, level: int, mark: int, top: int, stone: bool):
    ax.plot([x0, x0], [0, top], color=INK, linewidth=1.6)
    ax.plot([x0 + 3, x0 + 3], [0, top], color=INK, linewidth=1.6)
    ax.plot([x0, x0 + 3], [0, 0], color=INK, linewidth=1.6)
    ax.add_patch(Rectangle((x0, 0), 3, level, facecolor=FILL_2, edgecolor="none"))
    ax.plot([x0, x0 + 3], [level, level], color=INK, linewidth=1.4)
    if stone:
        ax.add_patch(Rectangle((x0 + 1.0, 0.4), 1.0, 3.0, facecolor=FILL, edgecolor=INK, linewidth=1.0))
    for y in range(0, top + 1, mark):
        big = y % (5 * mark) == 0 or y % 10 == 0
        ax.plot([x0, x0 + (0.9 if big else 0.5)], [y, y], color=INK, linewidth=0.8)
        if y % 10 == 0 and y:
            ax.text(x0 - 0.2, y, f"{y}", ha="right", va="center", fontsize=8)


def draw(p: dict):
    top = 10 * ((p["after"] + 15) // 10)
    fig, ax = new_figure(5.6, 5.4)
    _cylinder(ax, 1.5, p["before"], p["mark"], top, False)
    _cylinder(ax, 8.0, p["after"], p["mark"], top, True)
    ax.text(3.0, top + 2, "before", ha="center", va="bottom", fontsize=10)
    ax.text(9.5, top + 2, "after", ha="center", va="bottom", fontsize=10)
    ax.text(0.1, top + 4.5, "cm³", ha="left", va="bottom", fontsize=9)
    # The balance, showing the stone's mass.
    ax.add_patch(Rectangle((13.0, 0), 5.5, 6, facecolor="white", edgecolor=INK, linewidth=1.4))
    ax.add_patch(Rectangle((13.6, 2.2), 4.3, 2.4, facecolor=FILL_2, edgecolor=INK, linewidth=1.0))
    ax.text(15.75, 3.4, f"{p['grams']} g", ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text(15.75, 7.0, f"the {p['thing']}", ha="center", va="bottom", fontsize=10)
    ax.set_xlim(-1.5, 19.5)
    ax.set_ylim(-1, top + 8)
    ax.set_aspect(0.32)
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    v = p["after"] - p["before"]
    rho = Fraction(p["grams"]).limit_denominator(1000) / v
    k = rng.choice([50, 100, 200, 250, 500])
    more = rho * k
    return [
        short(f"{name} lowered a {p['thing']} into water that stood at {p['before']} cm³. What is the volume of the {p['thing']}, in cm³?", v,
              measure(v, "cm³") + measure(v, "cm3")[1:]),
        short(f"What is the density of the {p['thing']}, in g/cm³?", exact(rho), measure(rho, "g/cm³") + measure(rho, "g/cm3")[1:]),
        short(f"What would be the mass of {k} cm³ of the same material as {name}'s {p['thing']}?", exact(more), measure(more, "g")),
    ]
