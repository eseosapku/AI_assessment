"""A spring's extension against the load on it (LS, UP): a straight line through the origin up to the
limit of proportionality, then curving away. The spring constant, the extension for a load, the limit,
and at Upper Secondary the energy stored (½Fx).

The spring stretches a whole or half number of centimetres per newton, so every reading inside the limit
is on a gridline.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, curve, exact, measure, new_figure, short

ID = "spring_graph"
KIND = "graph.line"
SUBJECT = "physics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"physics.{c}" for c in ("hookes-law", "forces"))
# Hooke's law, forces and matter: not electric or magnetic forces, pressure, turning, or machines.
AVOID = r"electric|electrostatic|static electricity|magnet|installation|environmental|earthquake|pressure|density|turning|moment|centre of gravity|machines|frictional"


def sample(rng: random.Random) -> dict:
    # Loads in steps of 1, 2 or 5 N, each stretching it 0.5 to 4 cm: spring constants that are exact
    # decimals (0.25 to 10 N/cm), every extension inside the limit on a gridline.
    step = rng.choice([1, 2, 5])
    c = rng.choice([Fraction(1, 2), Fraction(1), Fraction(2), Fraction(5, 2), Fraction(4)])
    return {"band": rng.choice(BANDS), "cm_per_n": str(c / step), "step": step, "limit": step * rng.randint(4, 8),
            "ystep": str(Fraction(1, 2) if c.denominator == 2 else 1)}


def extension(p: dict, F: float) -> float:
    e, L = float(Fraction(p["cm_per_n"])), p["limit"]
    over = (F - L) / p["step"]
    return F * e if F <= L else L * e + (F - L) * e * (1 + 0.45 * over)  # past the limit it stretches more and more


def view(p: dict) -> tuple[int, int, int, float]:
    top = p["limit"] + 2 * p["step"]
    return 0, top, 0, float(int(extension(p, top)) + 1)


def draw(p: dict):
    x0, x1, y0, y1 = view(p)
    ystep = float(Fraction(p["ystep"]))
    fig, ax = new_figure(6.0, 4.6)
    ax.set_xticks(range(0, x1 + 1, p["step"]))
    ys = [i * ystep for i in range(int(y1 / ystep) + 1)]
    ax.set_yticks([y for y in ys if y == int(y) and (int(y) % (1 if y1 <= 12 else 2) == 0)])
    ax.set_yticks(ys, minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(0, x1)
    ax.set_ylim(0, y1)
    curve(ax, lambda F: extension(p, F), 0, x1, 0, y1)
    ax.set_xlabel("Load (N)")
    ax.set_ylabel("Extension (cm)")
    ax.tick_params(labelsize=9)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    e, L = Fraction(p["cm_per_n"]), p["limit"]
    name = rng.choice(NAMES)
    k = 1 / e
    thing = rng.choice(["the spring from a pen", "a spring from a mattress", "the spring of a spring balance", "the spring from a toy car",
                        "the spring that closes a door"])
    qs = [short(f"{name} hung loads on {thing} and drew this graph. What is the spring constant, in N/cm?", exact(k),
                measure(k, "N/cm") + [f"{exact(k * 100)} N/m"]),
          ]
    F = p["step"] * rng.randint(1, L // p["step"])
    qs.append(short(f"What is the extension of {thing.replace('the spring', 'that spring').replace('a spring', 'that spring')} for a load of {F} N?",
                    exact(F * e), measure(F * e, "cm")))
    qs.append(short("Up to what load does the spring obey Hooke's law?", L, measure(L, "N")))
    if p["band"] == "UP":
        F2 = p["step"] * rng.randint(2, L // p["step"])
        energy = Fraction(1, 2) * F2 * F2 * e / 100
        qs.append(short(f"How much energy is stored in the spring when it holds a load of {F2} N? Give your answer in joules.",
                        exact(energy), measure(energy, "J")))
    return qs
