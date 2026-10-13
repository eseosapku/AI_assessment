"""Models of an atom (UP): a nucleus of protons and neutrons, shaded apart to be counted, with or
without the electrons in their shells, for a real isotope of one of the first twenty elements. The proton
number, the nucleon number, the nucleus in symbol form, and for a beta emitter the nucleus its
decay leaves.

The drawing is built from `layout`, so a test can count what is drawn; the shells fill 2, 8, 8, 2.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle

from ..core import FILL_2, INK, NAMES, mcq, new_figure, short

ID = "nucleus"
KIND = "chem.particle"
SUBJECT = "physics"
BANDS = ("UP",)  # the lower-secondary physics topics never reach the atom
CONCEPTS = tuple(f"physics.{c}" for c in ("atomic-structure", "nuclear-structure", "nuclear-atom", "radioactivity"))
AVOID = r"fission|fusion|reactor|half-life|photoelectric|quantum|static electricity|electromagnetic spectrum|particle nature"
ELEMENTS = ["hydrogen", "helium", "lithium", "beryllium", "boron", "carbon", "nitrogen", "oxygen", "fluorine", "neon", "sodium",
            "magnesium", "aluminium", "silicon", "phosphorus", "sulfur", "chlorine", "argon", "potassium", "calcium", "scandium"]
SYMBOLS = ["H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca", "Sc"]
# Real isotopes (Z, A); the beta-minus emitters among them that are asked about.
ISOTOPES = [(1, 1), (1, 2), (2, 4), (3, 6), (3, 7), (4, 9), (5, 10), (5, 11), (6, 12), (6, 13), (6, 14), (7, 14), (7, 15), (8, 16), (8, 17),
            (8, 18), (9, 19), (10, 20), (10, 22), (11, 23), (11, 24), (12, 24), (12, 25), (12, 26), (13, 27), (14, 28), (15, 31), (15, 32),
            (16, 32), (16, 35), (17, 35), (17, 37), (18, 40), (19, 39), (19, 40), (20, 40)]
BETA = {(6, 14), (11, 24), (15, 32), (16, 35), (19, 40)}
# 36 real isotopes, drawn with or without their electrons: 72 figures in all, so 60 seeds show about 40.
MIN_VARIETY = 30
SUP, SUB = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹"), str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")


def sample(rng: random.Random) -> dict:
    Z, A = rng.choice(ISOTOPES)
    return {"band": "UP", "Z": Z, "A": A, "beta": (Z, A) in BETA, "electrons": rng.random() < 0.6}


def layout(p: dict) -> list[tuple[float, float, str]]:
    """Each nucleon's place, packed on a sunflower spiral, protons and neutrons mixed in a fixed order."""
    kinds = ["proton"] * p["Z"] + ["neutron"] * (p["A"] - p["Z"])
    random.Random(p["Z"] * 100 + p["A"]).shuffle(kinds)
    out = []
    for k, kind in enumerate(kinds):
        r, a = 0.18 * math.sqrt(k + 0.5), k * math.radians(137.508)  # neighbours at least 0.278 apart
        out.append((r * math.cos(a), r * math.sin(a), kind))
    return out


def shells(p: dict) -> list[int]:
    left, out = p["Z"], []
    for cap in (2, 8, 8, 2):
        if left <= 0:
            break
        out.append(min(cap, left))
        left -= out[-1]
    return out


def draw(p: dict):
    fig, ax = new_figure(6.4, 5.0)
    nucleus = layout(p)
    core = max(math.hypot(x, y) for x, y, _ in nucleus) + 0.14
    for x, y, kind in nucleus:
        ax.add_patch(Circle((x, y), 0.13, facecolor=INK if kind == "proton" else FILL_2, edgecolor=INK, linewidth=0.8, zorder=3))
    for i, n in enumerate(shells(p) if p["electrons"] else []):
        R = core + 0.55 + 0.6 * i
        ax.add_patch(Circle((0, 0), R, facecolor="none", edgecolor=INK, linewidth=0.9))
        for j in range(n):
            a = math.pi / 2 + 2 * math.pi * j / n
            ax.plot([R * math.cos(a)], [R * math.sin(a)], marker="X", markersize=7, color=INK, zorder=4)
    outer = core + 0.55 + 0.6 * (len(shells(p)) - 1) if p["electrons"] else max(core, 1.2)
    lx = outer + 0.8
    for k, (label, face) in enumerate((("proton", INK), ("neutron", FILL_2))):
        ax.add_patch(Circle((lx, 1.0 - 0.5 * k), 0.12, facecolor=face, edgecolor=INK, linewidth=0.8))
        ax.text(lx + 0.25, 1.0 - 0.5 * k, label, ha="left", va="center", fontsize=10)
    if p["electrons"]:
        ax.plot([lx], [0.0], marker="X", markersize=7, color=INK)
        ax.text(lx + 0.25, 0.0, "electron", ha="left", va="center", fontsize=10)
    ax.set_xlim(-outer - 0.2, lx + 1.9)
    ax.set_ylim(-outer - 0.2, outer + 0.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _symbol(A: int, Z: int, sym: str) -> str:
    return f"{str(A).translate(SUP)}{str(Z).translate(SUB)}{sym}"


SETTINGS = ["in the school laboratory", "at the science club", "for a class practical", "during a physics lesson", "for a science fair",
            "on a revision card"]


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    Z, A = p["Z"], p["A"]
    N, sym, element = A - Z, SYMBOLS[Z - 1], ELEMENTS[Z - 1]
    key = _symbol(A, Z, sym)
    wrong = []
    for top, bottom in ((Z, A), (N, Z), (A, N), (A, A), (N, A), (A + Z, Z)):
        option = _symbol(top, bottom, sym)
        if option != key and option not in wrong:
            wrong.append(option)
    qs = [
        short(f"{name} drew this model of {'an atom' if p['electrons'] else 'the nucleus of an atom'} {rng.choice(SETTINGS)}. "
              "What is its proton number?", Z, [f"{Z} protons"]),
        short("What is its nucleon number?", A, [f"{A} nucleons"]),
        mcq(f"The atom is {element}. Which shows its nucleus in symbol form?", key, wrong[:3], rng),
    ]
    if p["beta"]:
        # A neutron becomes a proton: the nucleon number stays and the proton number rises by one.
        options = [_symbol(a, z, SYMBOLS[z - 1]) for a in (A, A - 4) for z in (Z + 1, Z - 1)]
        qs.append(mcq(f"{element.capitalize()}-{A} is radioactive and decays by giving out a beta particle. Which nucleus is formed?", options[0],
                      options[1:], rng))
    return qs
