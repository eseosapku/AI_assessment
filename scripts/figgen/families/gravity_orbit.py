"""Gravitational field strength with distance (UP, AL): g against distance from the centre of the Earth, the
Moon, Venus, Saturn or Jupiter, in planet radii, falling as the inverse square. g at the surface and at 2R
(read), a satellite's weight at 2R, and g at 4R by the inverse square law.

The surface values are the real ones rounded as textbooks give them (Earth 10, Moon 1.6, Venus 8.8,
Saturn 10.4, Jupiter 24 N/kg); g at R and 2R lie on gridlines.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, curve, exact, measure, new_figure, short

ID = "gravity_orbit"
KIND = "physics.field"
SUBJECT = "physics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("gravitational-field", "gravitational-field-strength", "newtons-law-of-gravitation",
                                          "orbiting-under-gravity", "kepler-laws", "satellites", "solar-system-structure"))
AVOID = r"electric|magnet|circuit|wave|optic|radioactiv|thermal|heat|coulomb|stellar|stars|forces and motion"
BODIES = {"the Earth": "10", "the Moon": "1.6", "Venus": "8.8", "Saturn": "10.4", "Jupiter": "24"}
# Too few bodies for 40 different figures in 60: five bodies, two ranges, two bands.
MIN_VARIETY = 14


def sample(rng: random.Random) -> dict:
    body = rng.choice(list(BODIES))
    return {"band": rng.choice(BANDS), "body": body, "g0": BODIES[body], "xmax": rng.choice([4, 5])}


def g(p: dict, r: float) -> float:
    return float(Fraction(p["g0"])) / r ** 2


def draw(p: dict):
    g0 = Fraction(p["g0"])
    step = g0 / 4
    fig, ax = new_figure(6.0, 4.4)
    ax.set_xticks(range(0, p["xmax"] + 1))
    ax.set_xticks([k / 2 for k in range(0, 2 * p["xmax"] + 1)], minor=True)
    ax.set_yticks([float(step * k) for k in range(5)], [exact(step * k) for k in range(5)])
    ax.set_yticks([float(step * k / 2) for k in range(9)], minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, p["xmax"])
    ax.set_ylim(0, float(g0) * 1.1)
    curve(ax, lambda r: g(p, r), 1, p["xmax"], 0, float(g0) * 1.1)
    ax.plot([1, 1], [0, float(g0) * 1.1], color=INK, linewidth=0.8, linestyle=(0, (4, 3)))
    ax.text(1.05, float(g0) * 1.05, "surface", ha="left", va="top", fontsize=9)
    ax.set_xlabel(f"Distance from the centre of {p['body']} (in radii of {p['body']})")
    ax.set_ylabel("g (N/kg)")
    ax.tick_params(labelsize=9)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    g0 = Fraction(p["g0"])
    mass = rng.choice([50, 100, 200, 400, 500, 1000])
    qs = [short(f"{name} plotted how the gravitational field strength changes with distance from {p['body']}. What is g at its surface?",
                exact(g0), measure(g0, "N/kg")),
          short(f"What is g at a distance of 2 radii from the centre of {p['body']}?", exact(g0 / 4), measure(g0 / 4, "N/kg")),
          short(f"A {mass} kg satellite built by {friend}'s team is 2 radii from the centre of {p['body']}. What is its weight there?",
                exact(mass * g0 / 4),
                measure(mass * g0 / 4, "N"))]
    if (g0 / 16 * 100).denominator == 1:
        qs.append(short(f"Using the inverse square law, what is g at 4 radii from the centre of {p['body']}?", exact(g0 / 16),
                        measure(g0 / 16, "N/kg")))
    return qs
