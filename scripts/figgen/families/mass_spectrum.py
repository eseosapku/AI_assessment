"""Mass spectra (UP, AL): the isotope peaks of a real element, m/z against percentage abundance, each peak
labelled with its abundance. Its relative atomic mass, the number of isotopes, the most abundant one, and
which element it is. Two-isotope elements at UP; at AL also magnesium, neon, silicon, sulfur and zinc.

The abundances are the real ones rounded to whole percents that sum to 100, so Ar works out exactly and
lies within 0.1 of the real value. The element is not named on the figure.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, exact, mcq, new_figure, short

ID = "mass_spectrum"
KIND = "graph.bar"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("mass-spectrometry", "relative-atomic-mass", "atomic-number-mass-number-isotopes",
                                             "isotopes"))
AVOID = r"organic|alkane|electrolysis|titration|bonding|enthalpy|rate|chromatograph|nuclear|radioactiv|half-life|periodic table|electronic structure|formulae|introduction|stoichiometry"
ELEMENTS = {  # mass number, % abundance
    "chlorine": [(35, 75), (37, 25)], "boron": [(10, 20), (11, 80)], "lithium": [(6, 8), (7, 92)],
    "copper": [(63, 69), (65, 31)], "bromine": [(79, 51), (81, 49)], "gallium": [(69, 60), (71, 40)],
    "silver": [(107, 52), (109, 48)], "rubidium": [(85, 72), (87, 28)], "potassium": [(39, 93), (41, 7)],
    "magnesium": [(24, 79), (25, 10), (26, 11)], "neon": [(20, 90), (21, 1), (22, 9)],
    "silicon": [(28, 92), (29, 5), (30, 3)], "sulfur": [(32, 95), (33, 1), (34, 4)],
    "zinc": [(64, 49), (66, 28), (67, 4), (68, 18), (70, 1)],
}
TWO = [e for e, peaks in ELEMENTS.items() if len(peaks) == 2]
OTHERS = ["sodium", "aluminium", "argon", "calcium", "iron", "nickel", "phosphorus", "fluorine", "carbon", "nitrogen",
          "oxygen", "manganese", "chromium", "titanium"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    element = rng.choice(TWO if band == "UP" else list(ELEMENTS))
    pool = [e for e in list(ELEMENTS) + OTHERS if e != element]
    return {"band": band, "element": element, "peaks": [list(x) for x in ELEMENTS[element]],
            "decoys": rng.sample(pool, 3), "letter": rng.choice("XQRZ")}


def ar(p: dict) -> Fraction:
    return Fraction(sum(m * a for m, a in p["peaks"]), 100)


def draw(p: dict):
    fig, ax = new_figure(5.6, 4.2)
    lo, hi = p["peaks"][0][0] - 2, p["peaks"][-1][0] + 2
    ax.set_xticks(range(lo, hi + 1))
    ax.set_yticks(range(0, 101, 10))
    ax.yaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(lo, hi)
    ax.set_ylim(0, 110)
    for m, a in p["peaks"]:
        ax.plot([m, m], [0, a], color=INK, linewidth=4, solid_capstyle="butt")
        ax.text(m, a + 2, f"{a}%", ha="center", va="bottom", fontsize=9)
    ax.set_xlabel("m/z")
    ax.set_ylabel("Abundance (%)")
    ax.tick_params(labelsize=8)
    return fig


SETTINGS = ["in a chemistry lesson", "in a revision book", "for homework", "on a past paper", "at the science club"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    x = p["letter"]
    value = ar(p)
    forms = [exact(value)] + [exact(round(value, d)) for d in (1, 2)]
    top = max(p["peaks"], key=lambda q: q[1])[0]
    n = len(p["peaks"])
    return [short(f"{who} found this mass spectrum of a sample of element {x} {rng.choice(SETTINGS)}. Calculate the relative "
                  f"atomic mass, Ar, of {x}.", exact(value), forms),
            short(f"How many isotopes of {x} does the spectrum show?", n, [str(n), f"{n} isotopes"]),
            short(f"{friend} asks which isotope of {x} is the most abundant. What is its mass number?", top, [str(top), f"{x}-{top}", f"{top}{x}"]),
            mcq(f"Which element is {x}?", p["element"], p["decoys"], rng)]
