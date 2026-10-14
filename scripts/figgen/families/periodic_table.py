"""Periodic table (LS, UP): the outline of the first four periods, the transition elements shaded in
period 4, and five cells lettered V to Z in place of the elements' symbols: a noble gas, an alkali metal,
a metal of group 2 or 3, a non-metal of group 5, 6 or 7, and one more. Which letter is a noble gas or an
alkali metal, the group or period of a letter, and at UP the formula of the compound two letters form.

Only one letter sits in group 1 and none on hydrogen; only one sits in group 8 (0). Groups are numbered 1
to 8, and 13 to 18 is accepted as well.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, NAMES, formula_forms, mcq, new_figure, short, sub

ID = "periodic_table"
KIND = "chem.structure"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("periodic-table-structure", "groups-and-periods", "group-1-alkali-metals",
                                             "noble-gases", "ionic-bonding"))
AVOID = r"organic|alkane|alcohol|electrolysis|equilibrium|rate|enthalpy|titration"
LETTERS = "VWXYZ"
W = 0.8  # a cell
GAP = 3.2  # the transition elements' width, between groups 2 and 3


def _cells(rng: random.Random) -> list[tuple[int, int]]:
    """(period, group) of the five lettered cells."""
    noble = (rng.randint(1, 4), 8)
    alkali = (rng.randint(2, 4), 1)
    metal = rng.choice([(rng.randint(2, 4), 2), (rng.randint(3, 4), 3)])  # beryllium to calcium; aluminium, gallium
    nonmetal = rng.choice([(2, 5), (3, 5), (2, 6), (3, 6), (4, 6), (2, 7), (3, 7), (4, 7)])
    taken = {noble, alkali, metal, nonmetal}
    spare = [(per, g) for per in (2, 3, 4) for g in (2, 3, 4, 5, 6, 7) if (per, g) not in taken]
    return [noble, alkali, metal, nonmetal, rng.choice(spare)]


def sample(rng: random.Random) -> dict:
    roles = ["noble", "alkali", "metal", "nonmetal", "spare"]
    places = _cells(rng)
    letters = rng.sample(LETTERS, 5)
    cells = [{"letter": letters[k], "period": per, "group": g, "role": roles[k]} for k, (per, g) in enumerate(places)]
    return {"band": rng.choice(BANDS), "cells": sorted(cells, key=lambda c: c["letter"]),
            "ask_group": rng.choice(["alkali", "metal", "nonmetal", "spare", "noble"]),
            "ask_period": rng.choice(["alkali", "metal", "nonmetal", "spare", "noble"]),
            "pair_metal": rng.choice(["alkali", "metal"])}


def _x(group: int) -> float:
    return (group - 1) * W + (GAP if group > 2 else 0)


def _y(period: int) -> float:
    return -(period - 1) * W


def draw(p: dict):
    fig, ax = new_figure(6.4, 2.6)
    boxes = [(1, 1), (1, 8)] + [(per, g) for per in (2, 3, 4) for g in range(1, 9)]
    for per, g in boxes:
        ax.add_patch(Rectangle((_x(g), _y(per)), W, W, facecolor="none", edgecolor=INK, linewidth=1.0))
    ax.add_patch(Rectangle((_x(2) + W, _y(4)), GAP - W, W, facecolor=FILL_2, edgecolor=INK, linewidth=1.0))
    ax.text(_x(2) + W + (GAP - W) / 2, _y(4) + W / 2, "transition\nelements", ha="center", va="center", fontsize=8, linespacing=1.1)
    for c in p["cells"]:
        ax.text(_x(c["group"]) + W / 2, _y(c["period"]) + W / 2, c["letter"], ha="center", va="center",
                fontsize=14, fontweight="bold")
    ax.set_xlim(-0.15, _x(8) + W + 0.15)
    ax.set_ylim(_y(4) - 0.15, W + 0.15)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a chemistry lesson", "on a revision card", "for homework", "at the science club", "for a class test"]


def _group_forms(g: int) -> list[str]:
    forms = [str(g), f"group {g}", f"Group {g}"]
    roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][g - 1]
    forms += [roman, f"group {roman}"]
    if g >= 3:  # numbered across the transition elements too, 13 to 18
        forms += [str(g + 10), f"group {g + 10}"]
    if g == 8:
        forms += ["0", "group 0"]
    return forms


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    by_role = {c["role"]: c for c in p["cells"]}
    letters = [c["letter"] for c in p["cells"]]

    def pick(role, stem):
        key = by_role[role]["letter"]
        return mcq(stem, key, rng.sample([x for x in letters if x != key], 3), rng)

    first, second = rng.sample([("noble", "noble gas"), ("alkali", "alkali metal")], 2)
    g = by_role[p["ask_group"]]
    per = by_role[p["ask_period"]]
    qs = [pick(first[0], f"{name} lettered five elements on a periodic table {rng.choice(SETTINGS)}. Which letter is {'a noble gas' if first[0] == 'noble' else 'an alkali metal'}?"),
          pick(second[0], f"Which letter is {'a noble gas' if second[0] == 'noble' else 'an alkali metal'}?"),
          short(f"In which group is element {g['letter']}?", g["group"], _group_forms(g["group"])),
          short(f"{friend} counts the rows. In which period is element {per['letter']}?", per["period"],
                [str(per["period"]), f"period {per['period']}", f"Period {per['period']}"])]
    if p["band"] == "UP":
        m, n = by_role[p["pair_metal"]], by_role["nonmetal"]
        cm, cn = m["group"], 8 - n["group"]  # the metal loses its outer electrons; the non-metal gains to eight
        from math import gcd
        k = gcd(cm, cn)
        formula = m["letter"] + (str(cn // k) if cn // k > 1 else "") + n["letter"] + (str(cm // k) if cm // k > 1 else "")
        qs.append(short(f"What is the formula of the compound formed between {m['letter']} and {n['letter']}?",
                        sub(formula), formula_forms(formula)))
    return qs
