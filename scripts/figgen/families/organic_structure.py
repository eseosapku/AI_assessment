"""Organic structures (UP, AL): the displayed formula of a C1–C5 alkane, alkene, alcohol or carboxylic acid,
every bond drawn. Its name, molecular formula, homologous series and number of hydrogen atoms.

The functional group sits at the end of the chain (an alkene's double bond from carbon 1); at AL an alcohol's
OH may sit on carbon 2. No but-2-ene: its displayed formula would draw one of two geometric isomers.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, formula_forms, mcq, new_figure, short, sub

ID = "organic_structure"
KIND = "chem.structure"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("alkanes", "alkene-chemistry", "alcohols", "carboxylic-acids",
                                             "organic-functional-groups", "homologous-series"))
AVOID = r"ionic|electrolysis|equilibrium|rate|titration|metal|periodic|isotope|bonding-ionic|masses of atoms|amine|benzene|carbonyl|analysis|halogeno|polymer"
STEM = ["meth", "eth", "prop", "but", "pent"]
SERIES = {"alkane": "alkanes", "alkene": "alkenes", "alcohol": "alcohols", "acid": "carboxylic acids"}
GAP = 1.3  # carbon to carbon
ARM = 1.0  # carbon to the atom on its bond
# A few molecules can be drawn only one way: under 40 different figures in 60 seeds (22 molecules, mirrored).
MIN_VARIETY = 30


def sample(rng: random.Random) -> dict:
    series = rng.choice(list(SERIES))
    n = rng.randint(2 if series == "alkene" else 1, 5)
    band = rng.choice(BANDS)
    position = 2 if band == "AL" and series == "alcohol" and n >= 3 and rng.random() < 0.5 else 1
    return {"band": band, "series": series, "n": n, "position": position, "flip": rng.choice([False, True])}


def structure(p: dict):
    """The atoms drawn, [(symbol, x, y)], and the bonds, [(i, j, order)]. Carbon 1 is the right-hand end."""
    n, series = p["n"], p["series"]
    atoms = [("C", (n - 1 - k) * GAP, 0.0) for k in range(n)]  # atoms[c - 1] is carbon c, from the right
    bonds = []
    for c in range(1, n):
        bonds.append((c - 1, c, 2 if series == "alkene" and c == p["position"] else 1))

    def add(sym, x, y, to, order=1):
        atoms.append((sym, x, y))
        bonds.append((to, len(atoms) - 1, order))
        return len(atoms) - 1

    for c in range(1, n + 1):
        i = c - 1
        x = atoms[i][1]
        free = ["up", "down"] + (["right"] if c == 1 else []) + (["left"] if c == n else [])
        need = 4 - sum(o for a, b, o in bonds if i in (a, b))
        if series == "acid" and c == 1:
            add("O", x, ARM, i, 2)  # C=O up
            o = add("O", x + ARM, 0.0, i)  # C-O-H to the right
            add("H", x + 2 * ARM, 0.0, o)
            free.remove("up")
            free.remove("right")
            free.sort(key=lambda slot: slot != "left")  # methanoic acid's one H on the left, opposite its OH
            need -= 3
        if series == "alcohol" and c == p["position"]:
            if "right" in free:
                o = add("O", x + ARM, 0.0, i)
                add("H", x + 2 * ARM, 0.0, o)
                free.remove("right")
            else:  # on a middle carbon: down, the H below it
                o = add("O", x, -ARM, i)
                add("H", x, -2 * ARM, o)
                free.remove("down")
            need -= 1
        for slot in free[:need]:
            dx, dy = {"up": (0, ARM), "down": (0, -ARM), "right": (ARM, 0), "left": (-ARM, 0)}[slot]
            add("H", x + dx, dy, i)
    if p["flip"]:
        atoms = [(s, -x, y) for s, x, y in atoms]
    return atoms, bonds


def draw(p: dict):
    atoms, bonds = structure(p)
    xs, ys = [a[1] for a in atoms], [a[2] for a in atoms]
    w, h = max(xs) - min(xs) + 1.0, max(ys) - min(ys) + 1.0
    fig, ax = new_figure(max(2.4, 0.62 * w), max(2.0, 0.62 * h))
    cut = 0.27  # the bond stops short of each letter
    for i, j, order in bonds:
        (_, x1, y1), (_, x2, y2) = atoms[i], atoms[j]
        L = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        for k in range(order):
            off = (k - (order - 1) / 2) * 0.13
            ox, oy = -uy * off, ux * off
            ax.plot([x1 + ux * cut + ox, x2 - ux * cut + ox], [y1 + uy * cut + oy, y2 - uy * cut + oy], color=INK, linewidth=1.4)
    for sym, x, y in atoms:
        ax.text(x, y, sym, ha="center", va="center", fontsize=15, fontweight="bold" if sym != "H" else "normal")
    ax.set_xlim(min(xs) - 0.5, max(xs) + 0.5)
    ax.set_ylim(min(ys) - 0.5, max(ys) + 0.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def name(p: dict) -> tuple[str, list[str]]:
    """The IUPAC name, and the other names a student may fairly give."""
    n, series, pos = p["n"], p["series"], p["position"]
    s = STEM[n - 1]
    if series == "alkane":
        return s + "ane", []
    if series == "acid":
        return s + "anoic acid", []
    if series == "alkene":
        if n < 4:
            return s + "ene", []
        return f"{s}-1-ene", [f"1-{s}ene", f"{s}ene"]
    if n < 3:
        return s + "anol", []
    key = f"{s}an-{pos}-ol"
    return key, [f"{pos}-{s}anol"] + ([f"{s}anol"] if pos == 1 else [])


def formulas(p: dict) -> tuple[str, list[str]]:
    """The molecular formula, and the structural ones also fair: C2H6O and C2H5OH."""
    n, series = p["n"], p["series"]
    c = "C" + (str(n) if n > 1 else "")
    if series == "alkane":
        return f"{c}H{2 * n + 2}", []
    if series == "alkene":
        return f"{c}H{2 * n}", []
    if series == "alcohol":
        return f"{c}H{2 * n + 2}O", [f"{c}H{2 * n + 1}OH"]
    rest = "H" if n == 1 else "C" + (str(n - 1) if n > 2 else "") + f"H{2 * n - 1}"
    return f"{c}H{2 * n}O2", [f"{rest}COOH"]


SETTINGS = ["in a chemistry lesson", "on a revision card", "for homework", "at the science club", "for a class test"]
MET = ["drew the displayed formula of an organic compound", "copied this displayed formula from the board",
       "built a model of a molecule and drew its displayed formula", "found this displayed formula in a textbook"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    key, others = name(p)
    names = [key] + others
    names += [x[0].upper() + x[1:] for x in names]
    f, fs = formulas(p)
    forms = formula_forms(f)
    for x in fs:
        forms += [y for y in formula_forms(x) if y not in forms]
    atoms, _ = structure(p)
    h = sum(1 for a in atoms if a[0] == "H")
    series = SERIES[p["series"]]
    return [short(f"{who} {rng.choice(MET)} {rng.choice(SETTINGS)}. What is the name of the compound?",
                  key, names),
            short("What is the molecular formula of the compound?", sub(f), forms),
            mcq("To which homologous series does the compound belong?", series, [v for v in SERIES.values() if v != series], rng),
            short(f"{friend} counts the hydrogen atoms. How many are there in one molecule?", h, [str(h), f"{h} hydrogen atoms", f"{h} atoms"])]
