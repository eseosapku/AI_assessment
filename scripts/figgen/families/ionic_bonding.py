"""Ionic bonding (LS, UP): dot-and-cross diagrams of an ionic compound, each ion in square brackets with its
charge, outer shells only: the metal ion's emptied outer shell, the non-metal ion's full eight, its own
electrons as dots and the one or two it gained as crosses. The formula, the metal ion's charge, the
electrons each metal atom gives, and the electrons in the non-metal ion's outer shell.

The charges always balance, and every non-metal ion has a full outer shell of eight.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle

from ..core import INK, NAMES, formula_forms, new_figure, short, sub, sup

ID = "ionic_bonding"
KIND = "chem.structure"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("ionic-bonding", "chemical-formulae", "electronic-configuration"))
AVOID = r"organic|alkane|alcohol|covalent|electrolysis|equilibrium|rate|enthalpy"
# compound: metal, its charge, count; non-metal, its charge, count
COMPOUNDS = {"sodium chloride": ("Na", 1, 1, "Cl", -1, 1), "magnesium oxide": ("Mg", 2, 1, "O", -2, 1),
             "calcium chloride": ("Ca", 2, 1, "Cl", -1, 2), "sodium oxide": ("Na", 1, 2, "O", -2, 1),
             "lithium fluoride": ("Li", 1, 1, "F", -1, 1), "potassium chloride": ("K", 1, 1, "Cl", -1, 1),
             "magnesium chloride": ("Mg", 2, 1, "Cl", -1, 2), "calcium oxide": ("Ca", 2, 1, "O", -2, 1),
             "lithium oxide": ("Li", 1, 2, "O", -2, 1), "potassium fluoride": ("K", 1, 1, "F", -1, 1),
             "sodium bromide": ("Na", 1, 1, "Br", -1, 1), "potassium oxide": ("K", 1, 2, "O", -2, 1),
             "calcium fluoride": ("Ca", 2, 1, "F", -1, 2), "magnesium fluoride": ("Mg", 2, 1, "F", -1, 2),
             "sodium fluoride": ("Na", 1, 1, "F", -1, 1), "potassium bromide": ("K", 1, 1, "Br", -1, 1),
             "magnesium bromide": ("Mg", 2, 1, "Br", -1, 2), "calcium bromide": ("Ca", 2, 1, "Br", -1, 2)}
NONMETAL_OWN = {"Cl": 7, "O": 6, "F": 7, "Br": 7}


def sample(rng: random.Random) -> dict:
    name = rng.choice(list(COMPOUNDS))
    m, mc, mn, x, xc, xn = COMPOUNDS[name]
    return {"band": rng.choice(BANDS), "compound": name,
            "ions": [{"symbol": m, "charge": mc, "count": mn, "outer": 0}, {"symbol": x, "charge": xc, "count": xn, "outer": 8}],
            "order": rng.choice(["metal first", "non-metal first"])}


def _ion(ax, x, symbol, charge, outer, own):
    R = 0.9
    ax.add_patch(Circle((x, 0), R, facecolor="none", edgecolor=INK, linewidth=1.1))
    ax.text(x, 0, symbol, ha="center", va="center", fontsize=14, fontweight="bold")
    for j in range(outer):
        k, side = divmod(j, 2)
        a = math.pi / 4 + k * math.pi / 2 + (0.16 if side else -0.16)
        mark = "o" if j < own else "X"  # its own electrons as dots; those it gained as crosses
        ax.plot([x + R * math.cos(a)], [R * math.sin(a)], marker=mark, markersize=6 if mark == "o" else 7, color=INK,
                markerfacecolor=INK if mark == "o" else INK)
    ax.text(x - 1.2, 0, "[", ha="center", va="center", fontsize=46)
    ax.text(x + 1.2, 0, "]", ha="center", va="center", fontsize=46)
    ax.text(x + 1.46, 0.62, sup(f"{abs(charge) if abs(charge) > 1 else ''}{'+' if charge > 0 else '-'}"), ha="left", va="center", fontsize=16)


def draw(p: dict):
    metal, nonmetal = p["ions"]
    items = []
    for ion in (metal, nonmetal) if p["order"] == "metal first" else (nonmetal, metal):
        items += [ion] * ion["count"]
    fig, ax = new_figure(2.5 * len(items) + 0.6, 2.8)
    for i, ion in enumerate(items):
        own = NONMETAL_OWN.get(ion["symbol"], 0)
        _ion(ax, 3.4 * i, ion["symbol"], ion["charge"], ion["outer"], own)
    ax.set_xlim(-1.7, 3.4 * (len(items) - 1) + 2.2)
    ax.set_ylim(-1.4, 1.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a chemistry lesson", "on a revision card", "for homework", "at the science club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    metal, nonmetal = p["ions"]
    formula = metal["symbol"] + (str(metal["count"]) if metal["count"] > 1 else "") + nonmetal["symbol"] + \
        (str(nonmetal["count"]) if nonmetal["count"] > 1 else "")
    c = metal["charge"]
    return [short(f"{name} drew the ions in an ionic compound {rng.choice(SETTINGS)}. What is the formula of the compound?", sub(formula),
                  formula_forms(formula)),
          short(f"What is the charge on the {metal['symbol']} ion?", f"{c}+", [f"{c}+", f"+{c}", "+" if c == 1 else f"{c}+", f"{sup(str(c) if c > 1 else '')}⁺"]),
          short(f"{friend} asks how many electrons each {metal['symbol']} atom gives away to form its ion. How many?", c,
                [str(c), f"{c} electrons" if c > 1 else "1 electron"]),
          short(f"How many electrons are in the outer shell of the {nonmetal['symbol']} ion?", 8, ["8", "8 electrons", "eight"])]
