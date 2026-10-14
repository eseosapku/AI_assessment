"""Electric charges (LS, UP, AL): two small charged spheres, A and B, their charges in microcoulombs and the
distance between their centres. Whether they attract or repel, the force between them (F = kQq/r², k
stated) and the force when the distance doubles, and the charge on each after they touch and share it.

Every force is exact to two decimal places.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle

from ..core import FILL_2, INK, NAMES, exact, mcq, measure, new_figure, short

ID = "coulomb_force"
KIND = "physics.field"
SUBJECT = "physics"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("coulombs-law", "electrostatics", "electric-field", "applications-of-electrostatics"))
AVOID = r"gravitational|magnet|circuit|resistor|kirchhoff|capacit|nuclear"
K = 9 * 10 ** 9
SETTINGS = ["in the school laboratory", "at the science club", "for a class practical", "during a physics lesson", "for a science fair"]


def force(p: dict) -> Fraction:
    return Fraction(K) * abs(p["q1"] * p["q2"]) / 10 ** 12 / (Fraction(p["r_cm"]) / 100) ** 2


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        p = {"band": band, "q1": rng.choice([-1, 1]) * rng.randint(1, 9), "q2": rng.choice([-1, 1]) * rng.randint(1, 9),
             "r_cm": rng.choice([10, 20, 30, 50])}
        F = force(p)
        if band == "LS" or ((F * 100).denominator == 1 and (F / 4 * 100).denominator == 1 and F <= 20):
            return p


def _charge(q: int) -> str:
    return f"{'+' if q > 0 else '−'}{abs(q)} μC"


def draw(p: dict):
    fig, ax = new_figure(6.0, 3.0)
    for x, q, letter in ((0.0, p["q1"], "A"), (6.0, p["q2"], "B")):
        ax.add_patch(Circle((x, 0), 0.7, facecolor=FILL_2, edgecolor=INK, linewidth=1.4))
        ax.text(x, 0, letter, ha="center", va="center", fontsize=14, fontweight="bold")
        ax.text(x, 1.05, _charge(q), ha="center", va="bottom", fontsize=12)
    ax.annotate("", xy=(6.0, -1.25), xytext=(0.0, -1.25), arrowprops=dict(arrowstyle="<|-|>", color=INK, lw=1.0, mutation_scale=12))
    ax.plot([0, 0], [-0.75, -1.45], color=INK, linewidth=0.8, linestyle=(0, (2, 2)))
    ax.plot([6, 6], [-0.75, -1.45], color=INK, linewidth=0.8, linestyle=(0, (2, 2)))
    ax.text(3.0, -1.45, f"{p['r_cm']} cm", ha="center", va="top", fontsize=11)
    ax.set_xlim(-1.3, 7.3)
    ax.set_ylim(-2.1, 1.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    alike = (p["q1"] > 0) == (p["q2"] > 0)
    keys = [f"{a}: the charges are {b}" for a in ("Attract", "Repel") for b in ("opposite", "alike")]
    key = keys[3] if alike else keys[0]
    how = rng.choice(["by rubbing them with a cloth", "with a Van de Graaff generator", "by touching them with a charged rod",
                      "by rubbing them with wool"])
    qs = [mcq(f"{name} charged two small spheres, A and B, {how} {rng.choice(SETTINGS)}. Do they attract or repel each other?", key,
              [k for k in keys if k != key], rng)]
    if p["band"] != "LS":
        F = force(p)
        qs += [short(f"Take k = 9 × 10⁹ N m² C⁻². What is the size of the force between A and B, in newtons?", exact(F), measure(F, "N")),
               short(f"The distance between A and B is doubled to {2 * p['r_cm']} cm. What is the force between them now?", exact(F / 4),
                     measure(F / 4, "N"))]
    shared = Fraction(p["q1"] + p["q2"], 2)
    qs.append(short(f"{friend} lets A and B touch, so they share their charge equally, then moves them apart. What is the charge on each "
                    "sphere now, in μC?",
                    exact(shared), [f"{'+' if shared > 0 else ''}{exact(shared)}", f"{exact(shared)} μC", f"{exact(shared)} microcoulombs"]))
    return qs
