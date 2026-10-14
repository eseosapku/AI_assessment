"""Energy levels (UP, AL): four energy levels of a hydrogen, sodium or mercury atom in eV (their real values,
rounded), with four downward transitions arrowed and lettered A to D. The energy of a transition's photon,
the transition giving the highest frequency, the ionisation energy, and at AL the longest wavelength.

No two transitions have the same energy, so each question has one answer.
"""
from __future__ import annotations

import itertools
import random
from fractions import Fraction

from matplotlib.patches import FancyArrowPatch

from ..core import INK, NAMES, exact, mcq, measure, new_figure, short

ID = "energy_levels"
KIND = "physics.wave"
SUBJECT = "physics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("line-spectra", "spectra-and-quantum-physics", "photon-and-light-energy"))
AVOID = r"radioactiv|nuclear|decay|circuit|lens|mirror|sound|\bwaves$|superposition|medical|stellar|stars|electromagnetic spectrum"
ATOMS = {"hydrogen": ["-13.6", "-3.4", "-1.51", "-0.85"], "sodium": ["-5.14", "-3.03", "-1.95", "-1.52"],
         "mercury": ["-10.4", "-5.5", "-3.7", "-1.6"]}
LETTERS = "ABCD"
SOURCES = {"hydrogen": ["a hydrogen discharge tube", "a hydrogen lamp in the laboratory", "a lamp in a school demonstration", "a gas tube at the science club"],
           "sodium": ["a sodium street lamp", "a sodium lamp in the laboratory", "salt in a Bunsen flame", "a yellow street light"],
           "mercury": ["a mercury vapour lamp", "a fluorescent tube", "a mercury lamp in the laboratory", "an old street light"]}


def sample(rng: random.Random) -> dict:
    atom = rng.choice(list(ATOMS))
    levels = ATOMS[atom]
    while True:
        pairs = rng.sample(list(itertools.combinations(range(4), 2)), 4)  # (lower, upper)
        gaps = [Fraction(levels[u]) - Fraction(levels[lo]) for lo, u in pairs]
        if len(set(gaps)) == 4:
            break
    trans = [{"letter": LETTERS[i], "lower": lo, "upper": u} for i, (lo, u) in enumerate(pairs)]
    return {"band": rng.choice(BANDS), "atom": atom, "levels": levels, "transitions": trans}


def draw(p: dict):
    fig, ax = new_figure(6.0, 5.0)
    # Drawn on a square-root scale, as many textbooks draw them, so the upper levels do not crowd together;
    # each level is labelled with its true energy.
    E = [-abs(float(Fraction(e))) ** 0.5 for e in p["levels"]]
    for k, e in enumerate(E):
        ax.plot([0, 8], [e, e], color=INK, linewidth=1.6)
        ax.text(-0.2, e, f"{p['levels'][k].replace('-', '−')} eV", ha="right", va="center", fontsize=10)
    ax.plot([0, 8], [0, 0], color=INK, linewidth=0.8, linestyle=(0, (4, 3)))
    ax.text(-0.2, 0, "0 eV", ha="right", va="center", fontsize=10)
    for i, t in enumerate(sorted(p["transitions"], key=lambda t: t["letter"])):
        x = 1.4 + 1.7 * i
        top, bottom = E[t["upper"]], E[t["lower"]]
        ax.add_patch(FancyArrowPatch((x, top), (x, bottom), arrowstyle="-|>", mutation_scale=14, color=INK, lw=1.4, shrinkA=0, shrinkB=0))
        mid = (top + bottom) / 2
        while any(abs(mid - e) < 0.14 for e in E):  # off any level the arrow passes through
            mid += 0.16
        ax.text(x + 0.18, mid, t["letter"], ha="left", va="center", fontsize=12, fontweight="bold")
    ax.set_xlim(-2.6, 8.3)
    ax.set_ylim(E[0] - 0.3, 0.3)
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    levels = [Fraction(e) for e in p["levels"]]
    gaps = {t["letter"]: levels[t["upper"]] - levels[t["lower"]] for t in p["transitions"]}
    first = p["transitions"][0]["letter"]
    hi = max(gaps, key=gaps.get)
    source = rng.choice(SOURCES[p["atom"]])
    qs = [short(f"{name} studied the light from {source} and drew four energy levels of a {p['atom']} atom. What is the energy of the photon "
                f"given out in transition {first}, in eV?",
                exact(gaps[first]), measure(gaps[first], "eV")),
          mcq("Which transition gives out light of the highest frequency?", hi, [x for x in LETTERS if x != hi], rng),
          short(f"{friend} wants the energy needed to free an electron from the lowest level. What is this ionisation energy, in eV?",
                exact(-levels[0]), measure(-levels[0], "eV"))]
    if p["band"] == "AL":
        lo = min(gaps, key=gaps.get)
        qs.append(mcq("Which transition gives out light of the longest wavelength?", lo, [x for x in LETTERS if x != lo], rng))
    return qs
