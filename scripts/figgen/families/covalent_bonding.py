"""Covalent bonding (LS, UP): a dot-and-cross diagram of a small molecule, outer shells only. Each atom's
outer shell is a circle; bonded atoms' circles overlap, with the shared pairs in the overlap, one electron
from each atom, and the lone pairs on the circle. One atom's electrons are dots, the others' crosses. The
number of shared pairs, the lone pairs on one atom, the formula, and at UP the pairs shared in one bond.

Every outer electron is drawn, and every atom ends with a full outer shell: two for hydrogen, eight for
the rest.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle

from ..core import INK, NAMES, formula_forms, new_figure, short, sub

ID = "covalent_bonding"
KIND = "chem.structure"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("covalent-bonding",
                                             "chemical-formulae"))
# Integrated Science teaches this too (P3n): its Lower Secondary topics are reached by these.
ALSO = tuple(f"science.{c}" for c in ('chemical-bonding',))
AVOID = r"organic|alkene|alcohol|ionic|electrolysis|equilibrium|rate|enthalpy|titration|polymer|petro|amine|benzene|electrochem|stoichiometry|mixture|oxide|reactions|introduction|chemical equations|states of matter|arrangement of elements|group 1[345]|carboxylic|glossary|thinking and working scientifically|science in context|scientific method|science skills|materials and their structure"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"covalent|molecul|\bbond|dot.and.cross|formula"
# formula: atoms (the first is the one asked about), bonds (i, j, order), lone pairs, each neighbour's
# direction from atom 0 in degrees (atoms beyond the first two hang off atom 0).
MOLECULES = {
    "H2": (["H", "H"], [(0, 1, 1)], [0, 0], [0]),
    "Cl2": (["Cl", "Cl"], [(0, 1, 1)], [3, 3], [0]),
    "F2": (["F", "F"], [(0, 1, 1)], [3, 3], [0]),
    "HCl": (["Cl", "H"], [(0, 1, 1)], [3, 0], [0]),
    "HF": (["F", "H"], [(0, 1, 1)], [3, 0], [0]),
    "H2O": (["O", "H", "H"], [(0, 1, 1), (0, 2, 1)], [2, 0, 0], [180, 270]),
    "NH3": (["N", "H", "H", "H"], [(0, 1, 1), (0, 2, 1), (0, 3, 1)], [1, 0, 0, 0], [180, 270, 0]),
    "CH4": (["C", "H", "H", "H", "H"], [(0, k, 1) for k in (1, 2, 3, 4)], [0] * 5, [0, 90, 180, 270]),
    "CO2": (["C", "O", "O"], [(0, 1, 2), (0, 2, 2)], [0, 2, 2], [0, 180]),
    "O2": (["O", "O"], [(0, 1, 2)], [2, 2], [0]),
    "N2": (["N", "N"], [(0, 1, 3)], [1, 1], [0]),
    "HCN": (["C", "H", "N"], [(0, 1, 1), (0, 2, 3)], [0, 0, 1], [180, 0]),
    "CH3Cl": (["C", "H", "H", "H", "Cl"], [(0, k, 1) for k in (1, 2, 3, 4)], [0, 0, 0, 0, 3], [90, 180, 270, 0]),
}
R = 1.0  # outer shell
D = 1.55  # bonded atoms' centres: the circles overlap enough to hold a triple bond's three pairs


def sample(rng: random.Random) -> dict:
    formula = rng.choice(list(MOLECULES))
    atoms, bonds, lone, _ = MOLECULES[formula]
    return {"band": rng.choice(BANDS), "formula": formula, "atoms": list(atoms), "bonds": [list(b) for b in bonds],  # lists: the spec is stored as JSON
            "lone": list(lone), "centre": 0, "turn": rng.choice([0, 90, 180, 270]), "dots": rng.choice(["first", "others"])}


def _places(p: dict) -> list[tuple[float, float]]:
    turn = MOLECULES[p["formula"]][3]
    out = [(0.0, 0.0)]
    for deg in turn:
        a = math.radians(deg + p["turn"])
        out.append((D * math.cos(a), D * math.sin(a)))
    return out


def _mark(ax, x, y, dot):
    ax.plot([x], [y], marker="o" if dot else "X", markersize=5.5 if dot else 7, color=INK, zorder=4)


def draw(p: dict):
    at = _places(p)
    fig, ax = new_figure(4.8, 4.8)
    dot_first = p["dots"] == "first"
    is_dot = [(i == 0) == dot_first for i in range(len(p["atoms"]))]
    for (x, y), sym in zip(at, p["atoms"]):
        ax.add_patch(Circle((x, y), R, facecolor="none", edgecolor=INK, linewidth=1.1))
        ax.text(x, y, sym, ha="center", va="center", fontsize=15, fontweight="bold", zorder=5)
    used = {i: [] for i in range(len(at))}  # each atom's bond directions, to keep its lone pairs clear
    for i, j, order in p["bonds"]:
        (xi, yi), (xj, yj) = at[i], at[j]
        ux, uy = (xj - xi) / D, (yj - yi) / D
        used[i].append(math.atan2(uy, ux))
        used[j].append(math.atan2(-uy, -ux))
        mx, my = (xi + xj) / 2, (yi + yj) / 2
        for k in range(order):
            off = (k - (order - 1) / 2) * 0.3
            cx, cy = mx - uy * off, my + ux * off
            _mark(ax, cx - ux * 0.1, cy - uy * 0.1, is_dot[i])  # atom i's electron on its side of the pair
            _mark(ax, cx + ux * 0.1, cy + uy * 0.1, is_dot[j])
    for i, n in enumerate(p["lone"]):
        if not n:
            continue
        x, y = at[i]
        if len(used[i]) == 1:  # a pendant atom: its lone pairs spread round the side away from its bond
            angles = [used[i][0] + math.pi + (k - (n - 1) / 2) * math.pi / 2 for k in range(n)]
        else:  # the free quarter-turns of the four
            taken = {round(math.degrees(a)) % 360 for a in used[i]}
            free = [d for d in (0, 90, 180, 270) if all(abs((d - t + 180) % 360 - 180) > 45 for t in taken)]
            angles = [math.radians(d) for d in free[:n]]
        for a in angles:
            for s in (-0.17, 0.17):
                _mark(ax, x + R * math.cos(a + s), y + R * math.sin(a + s), is_dot[i])
    xs, ys = [x for x, _ in at], [y for _, y in at]
    pad = R + 0.25
    ax.set_xlim(min(xs) - pad, max(xs) + pad)
    ax.set_ylim(min(ys) - pad, max(ys) + pad)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a chemistry lesson", "on a revision card", "for homework", "at the science club", "for a class test"]
MET = ["drew a dot-and-cross diagram of a molecule", "copied this dot-and-cross diagram from the board",
       "found this dot-and-cross diagram in a textbook", "built a model of a molecule and drew its dot-and-cross diagram"]
NAME = {"H": "hydrogen", "Cl": "chlorine", "F": "fluorine", "O": "oxygen", "N": "nitrogen", "C": "carbon"}


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    atoms, bonds, lone = p["atoms"], p["bonds"], p["lone"]
    shared = sum(o for _, _, o in bonds)
    c = atoms[p["centre"]]
    each = len(atoms) == 2 and atoms[0] == atoms[1]
    where = f"each {NAME[c]} atom" if each else f"the {NAME[c]} atom"
    n = lone[p["centre"]]
    qs = [short(f"{name} {rng.choice(MET)} {rng.choice(SETTINGS)}. How many pairs of electrons are shared?",
                shared, [str(shared), f"{shared} pairs", f"{shared} shared pairs"]),
          short(f"How many lone pairs (pairs not shared) are on {where}?", n, [str(n), f"{n} lone pairs", f"{n} pairs"] + (["none"] if n == 0 else [])),
          short(f"{friend} names the molecule from the diagram. What is its formula?", sub(p["formula"]), formula_forms(p["formula"]))]
    multiple = [b for b in bonds if b[2] > 1]
    if p["band"] == "UP" and len(bonds) > 1 and multiple:
        # Counted on the figure, for one named multiple bond: a bond-type MCQ was guessable (P3g review), and "between
        # the carbon and hydrogen atoms" read as a total and repeated the first question (P3h review).
        i, j, order = multiple[0]
        centre, other = (atoms[i], atoms[j]) if i == p["centre"] else (atoms[j], atoms[i])
        several = sum(1 for a in atoms if a == other) > 1
        qs.append(short(f"How many pairs of electrons are shared in the bond between the {NAME[centre]} atom and "
                        f"{'one of the' if several else 'the'} {NAME[other]} atom{'s' if several else ''}?", order,
                        [str(order), f"{order} pairs", f"{order} shared pairs"]))
    return qs
