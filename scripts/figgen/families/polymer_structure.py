"""Polymers (LS, UP, AL), for Rwanda S3 "Petroleum products and polymerisation", S6 "Polymers and Polymerization", IGCSE
"Polymers" and "Petrochemicals and polymers", and AS "Reactions of alkanes" (addition polymerisation) and "Condensation
polymerisation". Two kinds:

- addition: part of an addition polymer's chain, two to four repeat units drawn with every bond, the chain running on
  past both ends; real polymers (poly(ethene), poly(propene), poly(chloroethene), PTFE, poly(phenylethene) and, above
  LS, poly(1,1-dichloroethene), poly(but-2-ene), poly(2-methylpropene)). Asks which monomer made it, how many monomer
  molecules joined to make the part shown, the relative formula mass of a repeat unit (Ar printed; LS: the carbon atoms
  in the part shown) and, at AL, how many monomers make a chain of a printed Mr.
- condensation (UP, AL): one repeat unit of a polyester or polyamide in brackets with n, its pieces written as the
  coursebooks write them ((CH₂)₆, C₆H₄); a linkage and the two pieces boxed and lettered. Asks which letter is the
  ester (or amide) linkage, what type of polymer it is, which pair of monomers made it, the Mr of the repeat unit (Ar
  printed) and, at AL, the repeat units in a chain of a printed Mr.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import INK, NAMES, exact, mcq, new_figure, short
from ._bio_parts import letter_choice
from ._molecule import (INCH, bond_midpoints, chain, draw_atoms, draw_bonds, draw_box, frame, half_width, place_letters)

ID = "polymer_structure"
KIND = "chem.structure"
SUBJECT = "chemistry"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("polymers", "addition-polymerization", "condensation-polymerization"))
# A topic whose sections the book lists is reached only if its name or a section names polymers.
NEEDS = r"polymer"
AVOID = r"glossary|thinking and working scientifically|biological molecules|protein synthesis|nucleic|enzyme"


def concepts_for(p: dict) -> tuple[str, ...]:
    c = "chemistry."
    return (c + "polymers", c + ("addition-polymerization" if p["kind"] == "addition" else "condensation-polymerization"))


AR = {"H": 1, "C": 12, "N": 14, "O": 16, "F": 19, "Cl": Fraction(71, 2)}
AR_TEXT = "Relative atomic masses: H = 1, C = 12, N = 14, O = 16, F = 19, Cl = 35.5"
# monomer: (polymer, substituents (up, down) on the CH2-like carbon, on the other carbon, repeat unit formula counts)
MONOMERS = {
    "ethene": ("poly(ethene)", ("H", "H"), ("H", "H"), {"C": 2, "H": 4}),
    "propene": ("poly(propene)", ("H", "H"), ("CH₃", "H"), {"C": 3, "H": 6}),
    "chloroethene": ("poly(chloroethene)", ("H", "H"), ("Cl", "H"), {"C": 2, "H": 3, "Cl": 1}),
    "tetrafluoroethene": ("poly(tetrafluoroethene)", ("F", "F"), ("F", "F"), {"C": 2, "F": 4}),
    "phenylethene": ("poly(phenylethene)", ("H", "H"), ("C₆H₅", "H"), {"C": 8, "H": 8}),
    "1,1-dichloroethene": ("poly(1,1-dichloroethene)", ("H", "H"), ("Cl", "Cl"), {"C": 2, "H": 2, "Cl": 2}),
    "but-2-ene": ("poly(but-2-ene)", ("CH₃", "H"), ("CH₃", "H"), {"C": 4, "H": 8}),
    "2-methylpropene": ("poly(2-methylpropene)", ("H", "H"), ("CH₃", "CH₃"), {"C": 4, "H": 8}),
}
LS_MONOMERS = ["ethene", "propene", "chloroethene", "tetrafluoroethene", "phenylethene"]
# polymer: (linkage, piece from the diol or diamine, piece from the dicarboxylic acid)
CONDENSATION = {
    "polyester-a": ("ester", "(CH₂)₂", "C₆H₄"), "polyester-b": ("ester", "(CH₂)₂", "(CH₂)₄"),
    "polyester-c": ("ester", "(CH₂)₃", "C₆H₄"), "polyester-d": ("ester", "(CH₂)₄", "(CH₂)₄"),
    "polyamide-a": ("amide", "(CH₂)₆", "(CH₂)₄"), "polyamide-b": ("amide", "(CH₂)₆", "(CH₂)₈"),
    "polyamide-c": ("amide", "C₆H₄", "C₆H₄"), "polyamide-d": ("amide", "(CH₂)₄", "C₆H₄"),
}
PIECES = ["(CH₂)₂", "(CH₂)₄", "(CH₂)₆", "(CH₂)₈", "C₆H₄"]
CHAIN_UNITS = [50, 100, 200, 250, 400, 500, 1000, 2000]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if band == "LS" or rng.random() < 0.5:
        pool = LS_MONOMERS if band == "LS" else sorted(MONOMERS)
        mono = rng.choice(pool)
        others = [m for m in pool if m != mono]
        return {"band": band, "kind": "addition", "monomer": mono, "units": rng.randint(2, 4), "first": rng.choice([0, 1]),
                "turn": rng.choice([False, True]), "options": rng.sample(others, 3), "n": rng.choice(CHAIN_UNITS)}
    poly = rng.choice(sorted(CONDENSATION))
    _, p1, p2 = CONDENSATION[poly]
    letters = rng.sample(["A", "B", "D", "P", "Q", "R", "X", "Y", "Z"], 3)  # no C, H, N or O: letters are not atoms
    return {"band": band, "kind": "condensation", "polymer": poly, "boxed": rng.choice([0, 1]),
            "letters": [[letters[0], "linkage"], [letters[1], "first"], [letters[2], "second"]],
            "wrong": rng.choice([x for x in PIECES if x != p2]), "n": rng.choice(CHAIN_UNITS)}


# --- formulas -------------------------------------------------------------------------------------------------------

def _piece_counts(piece: str) -> dict:
    if piece == "C₆H₄":
        return {"C": 6, "H": 4}
    k = int(piece[-1].translate(str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")))
    return {"C": k, "H": 2 * k}


def counts(p: dict) -> dict:
    """The atoms in one repeat unit."""
    if p["kind"] == "addition":
        return dict(MONOMERS[p["monomer"]][3])
    link, p1, p2 = CONDENSATION[p["polymer"]]
    out = {"C": 2, "O": 2}  # the two C=O
    out["O" if link == "ester" else "N"] = out.get("O" if link == "ester" else "N", 0) + 2
    if link == "amide":
        out["H"] = 2  # the two N-H
    for piece in (p1, p2):
        for k, v in _piece_counts(piece).items():
            out[k] = out.get(k, 0) + v
    return out


def mr(p: dict) -> Fraction:
    return sum((AR[k] * v for k, v in counts(p).items()), Fraction(0))


# --- drawing --------------------------------------------------------------------------------------------------------

def _addition_atoms(p: dict):
    """The chain's atoms [sym, x, y] and bonds [i, j, order]; carbons first, left to right."""
    _, a_subs, b_subs, _ = MONOMERS[p["monomer"]]
    n = 2 * p["units"]
    atoms, bonds = [], []
    for k in range(n):
        atoms.append(["C", 1.3 * k, 0.0])
    for k in range(1, n):
        bonds.append([k - 1, k, 1])
    for k in range(n):
        up, down = b_subs if k % 2 == p["first"] else a_subs
        if p["turn"]:
            up, down = down, up
        for sym, y in ((up, 1.0), (down, -1.0)):
            atoms.append([sym, 1.3 * k, y])
            bonds.append([k, len(atoms) - 1, 1])
    return atoms, bonds


def _draw_addition(p: dict):
    atoms, bonds = _addition_atoms(p)
    n = 2 * p["units"]
    xmax = 1.3 * (n - 1)
    x0, x1, y0, y1 = -1.4, xmax + 1.4, -2.3 if p["band"] != "LS" else -1.7, 1.9
    width = max(x1 - x0, 7.6)
    x0, x1 = (x0 + x1) / 2 - width / 2, (x0 + x1) / 2 + width / 2
    fig, ax = new_figure((x1 - x0) * INCH, (y1 - y0) * INCH)
    ax.set_position([0, 0, 1, 1])
    draw_bonds(ax, atoms, bonds)
    draw_atoms(ax, atoms)
    for x, d in ((0.0, -1), (xmax, 1)):  # the chain runs on past both ends
        ax.plot([x + d * 0.27, x + d * 1.05], [0, 0], color=INK, linewidth=1.4, gid=f"end:{d}")
    ax.text((x0 + x1) / 2, 1.6, "Part of the chain of an addition polymer", ha="center", va="center", fontsize=11)
    if p["band"] != "LS":
        ax.text((x0 + x1) / 2, -1.85, AR_TEXT, ha="center", va="center", fontsize=9.5)
    frame(ax, x0, x1, y0, y1)
    return fig


def condensation_mol(p: dict):
    link, p1, p2 = CONDENSATION[p["polymer"]]
    co = {"sym": "C", "up": "=O"}
    joint = {"sym": "O"} if link == "ester" else {"sym": "N", "down": "H"}
    return chain([co, dict(joint), {"sym": p1}, dict(joint), dict(co), {"sym": p2}])


def _rect(mol, k: int):
    """A box round backbone piece k, wide enough for its printed text."""
    _, x, y = mol.atoms[mol.refs[("b", k)][0]]
    hw = max(0.2, half_width(mol.atoms[mol.refs[("b", k)][0]][0])) + 0.2
    return (x - hw, y - 0.36, x + hw, y + 0.36)


def boxes(p: dict, mol) -> dict:
    """The lettered boxes: a whole linkage (C=O and the O or N-H beside it), and each piece."""
    pick = [0, 1] if p["boxed"] == 0 else [3, 4]
    idx = [mol.refs[("b", k)][0] for k in pick] + mol.group([("s", pick[0] if pick[0] == 0 else 4, "up")])
    if CONDENSATION[p["polymer"]][0] == "amide":
        idx += mol.group([("s", pick[1] if pick[1] == 1 else 3, "down")])
    pts = [mol.atoms[i][1:] for i in idx]
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    link = (min(xs) - 0.36, min(ys) - 0.36, max(xs) + 0.36, max(ys) + 0.36)
    parts = {"linkage": link, "first": _rect(mol, 2), "second": _rect(mol, 5)}
    return {L: parts[part] for L, part in p["letters"]}


def _draw_condensation(p: dict):
    mol = condensation_mol(p)
    xs = [a[1] for a in mol.atoms]
    last = mol.atoms[mol.refs[("b", 5)][0]]
    left, right = min(xs) - 0.85, last[1] + half_width(last[0]) + 0.55
    bx = boxes(p, mol)
    obstacles = [tuple(a[1:]) for a in mol.atoms] + bond_midpoints(mol.atoms, mol.bonds)
    obstacles += [(left, y) for y in (-1.2, 0, 1.4)] + [(right, y) for y in (-1.2, 0, 1.4)]
    spots = place_letters(bx, obstacles)
    allx = xs + [left - 0.6, right + 0.8] + [s[0] for s in spots.values()]
    ally = [a[2] for a in mol.atoms] + [s[1] for s in spots.values()] + [-1.5, 1.7]
    x0, x1 = min(allx) - 0.4, max(allx) + 0.4
    width = max(x1 - x0, 9.0)
    x0, x1 = (x0 + x1) / 2 - width / 2, (x0 + x1) / 2 + width / 2
    y0, y1 = min(ally) - 1.0, max(ally) + 0.9
    fig, ax = new_figure((x1 - x0) * INCH, (y1 - y0) * INCH)
    ax.set_position([0, 0, 1, 1])
    draw_bonds(ax, mol.atoms, mol.bonds)
    draw_atoms(ax, mol.atoms)
    first = mol.atoms[mol.refs[("b", 0)][0]]
    ax.plot([left - 0.45, first[1] - 0.27], [0, 0], color=INK, linewidth=1.4, gid="end:left")
    ax.plot([last[1] + half_width(last[0]) + 0.24, right + 0.45], [0, 0], color=INK, linewidth=1.4, gid="end:right")
    for x, d in ((left, 1), (right, -1)):  # square brackets round the repeat unit
        ax.plot([x + d * 0.18, x, x, x + d * 0.18], [-1.2, -1.2, 1.4, 1.4], color=INK, linewidth=1.5, gid=f"bracket:{d}")
    ax.text(right + 0.12, -1.35, "n", ha="left", va="center", fontsize=14, fontstyle="italic", gid="n")
    for L in sorted(bx):
        draw_box(ax, L, bx[L], spots[L])
    ax.text((x0 + x1) / 2, y1 - 0.35, "One repeat unit of a condensation polymer", ha="center", va="center", fontsize=11)
    ax.text((x0 + x1) / 2, y0 + 0.35, AR_TEXT, ha="center", va="center", fontsize=9.5)
    frame(ax, x0, x1, y0, y1)
    return fig


def draw(p: dict):
    return _draw_addition(p) if p["kind"] == "addition" else _draw_condensation(p)


# --- questions ------------------------------------------------------------------------------------------------------

SETTINGS = {"LS": ["in a Senior 3 lesson on plastics", "at the science club in Huye", "for homework",
                   "while revising in Rubavu", "for a class test in Kigali", "in a lesson in Muhanga"],
            "UP": ["in a lesson on polymers", "at the chemistry club in Musanze", "for homework", "while revising in Huye",
                   "for a class test in Kigali", "on a revision card in Rubavu"],
            "AL": ["in an AS chemistry lesson", "while revising for an examination", "for homework",
                   "in a lesson on polymerisation", "at the chemistry club in Kigali", "on a revision card"]}
VERBS = ["drew", "copied", "was given", "found"]


def _monomer_text(kind: str, piece: str) -> str:
    return {"diol": f"HO–{piece}–OH", "diamine": f"H₂N–{piece}–NH₂", "acid": f"HOOC–{piece}–COOH"}[kind]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS[p["band"]])
    m = exact(mr(p))
    if p["kind"] == "addition":
        units = p["units"]
        qs = [mcq(f"{who} {rng.choice(VERBS)} this part of a polymer chain {setting}. Which monomer was used to make the "
                  f"polymer?", p["monomer"], p["options"], rng),
              short("How many monomer molecules joined together to make the part of the chain shown?", units,
                    [f"{units} molecules", f"{units} monomers", f"{units} monomer molecules"])]
        if p["band"] == "LS":
            c = counts(p)["C"] * units
            qs.append(short("How many carbon atoms are there in the part of the chain shown?", c, [f"{c} carbon atoms", f"{c} atoms"]))
        else:
            qs.append(short("Using the relative atomic masses printed, what is the relative formula mass (Mr) of one repeat "
                            "unit of this polymer?", m, [m]))
        if p["band"] == "AL":
            total = exact(mr(p) * p["n"])
            qs.append(short(f"One chain of this polymer has a relative molecular mass of {total}. Ignoring the ends of the "
                            f"chain, how many monomer molecules joined to make it?", p["n"], [str(p["n"]), f"{p['n']} molecules"]))
        return qs
    link, p1, p2 = CONDENSATION[p["polymer"]]
    letter = {part: L for L, part in p["letters"]}
    kind = "a polyester" if link == "ester" else "a polyamide"
    joiner = "diol" if link == "ester" else "diamine"
    other = "diamine" if link == "ester" else "diol"
    good, bad = _monomer_text("acid", p2), _monomer_text("acid", p["wrong"])
    pairs = [f"{_monomer_text(joiner, p1)} and {good}", f"{_monomer_text(other, p1)} and {good}",
             f"{_monomer_text(joiner, p1)} and {bad}", f"{_monomer_text(other, p1)} and {bad}"]
    qs = [letter_choice(f"{who} {rng.choice(VERBS)} this repeat unit of a polymer {setting}. Which letter shows "
                        f"{'an ester' if link == 'ester' else 'an amide'} linkage?", letter["linkage"], sorted(letter.values())),
          mcq("What type of polymer has the repeat unit shown?", kind, ["a polyester", "a polyamide", "an addition polymer"], rng),
          mcq("Which pair of monomers could be used to make the polymer shown?", pairs[0], pairs[1:], rng),
          short("Using the relative atomic masses printed, what is the relative formula mass (Mr) of the repeat unit shown?",
                m, [m])]
    if p["band"] == "AL":
        total = exact(mr(p) * p["n"])
        qs.append(short(f"One chain of this polymer has a relative molecular mass of {total}. Ignoring the ends of the chain, "
                        f"how many repeat units does it have?", p["n"], [str(p["n"]), f"{p['n']} repeat units"]))
    return qs
