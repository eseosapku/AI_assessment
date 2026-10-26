"""Functional groups (UP, AL): real molecules drawn as the textbooks draw them, every bond shown for a chain and a
hexagon with its ring for a benzene compound. Three kinds:

- groups: three or four parts of a molecule boxed and lettered (amine, carboxylic acid, hydroxyl, aldehyde,
  ketone, ester, amide, nitro, a C=C, a chlorine atom, a methyl group, the benzene ring); which letter labels a
  named group, what the group at a letter is called, the molecular formula of a chain molecule;
- classify: a halogenoalkane, alcohol or amine drawn with no letters; primary, secondary or tertiary, the
  molecular formula, its name, how many carbon atoms are bonded to the carbon carrying the group (or to the N);
- chiral: carbon atoms lettered with leader lines; which lettered carbon is a chiral centre (the definition is in
  the stem), how many chiral centres one molecule has, its molecular formula. UP draws amino acids only (Rwanda S5
  teaches the optical isomers of amino acids); AL draws them all.

Each figure carries only the concepts of the groups it draws, and stays away from a chapter named for a group it
does not draw (avoid_for), so a lactic acid figure is no figure for "Preparation of aldehydes and ketones".
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle

from ..core import INK, NAMES, formula_forms, mcq, new_figure, short, sub
from ._bio_parts import letter_choice
from ._molecule import (INCH, LETTER_SIZE, box_of, bond_midpoints, chain, draw_atoms, draw_bonds, draw_box, formula, frame,
                        mirrored, place_letters, text_width)

ID = "functional_groups"
KIND = "chem.structure"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in (
    "organic-functional-groups", "amines", "amino-acids", "carboxylic-acids", "alcohols", "phenol", "aldehydes-and-ketones",
    "esters", "amides", "benzene-and-aromatic-compounds", "halogenoalkanes", "alkene-chemistry", "chirality", "stereoisomerism",
    "isomerism", "substitution-reactions"))
# A topic whose sections the book lists is reached only if its name or a section names a group, chirality or the
# classes of a compound.
NEEDS = (r"amine|amino|amide|ester|carbonyl|aldehyde|ketone|halogeno|alkyl halide|benzene|arene|phenol|aromatic|chiral|"
         r"optical|stereoisomer|functional group|hydroxy compounds|carboxylic|alcohol")
# Polymers have their own family; the general organic chapters of IGCSE and of the West African syllabuses teach no
# amines, amides or chirality.
AVOID = r"polymer|^organic chemistry$|^chapter 11: organic chemistry$|reactions of organic compounds|chemical analysis"


def C(up=None, down=None, left=None, right=None, sym="C") -> dict:
    return {"sym": sym, "up": up, "down": down, "left": left, "right": right}


def N(up=None, down=None, left=None, right=None) -> dict:
    return C(up, down, left, right, sym="N")


def O() -> dict:
    return C(sym="O")


ME_L = C("H", "H", left="H")  # a methyl group at the left end
ME_R = C("H", "H", right="H")
CH2 = C("H", "H")
METHYL_L = [("b", 0), ("s", 0, "up"), ("s", 0, "down"), ("s", 0, "left")]


def _acid(k):
    return [("b", k), ("s", k, "up"), ("s", k, "right")]


# --- groups: chain molecules ---------------------------------------------------------------------------------------
# name: (backbone, bond orders, {part: atoms}, amino acid?)
CHAIN_GROUPS = {
    "2-aminopropanoic acid (alanine)": ([ME_L, C("NH2", "H"), C("=O", right="OH")], None,
                                        {"methyl": METHYL_L, "amine": [("s", 1, "up")], "acid": _acid(2)}, True),
    "2-hydroxypropanoic acid (lactic acid)": ([ME_L, C("OH", "H"), C("=O", right="OH")], None,
                                              {"methyl": METHYL_L, "hydroxyl": [("s", 1, "up")], "acid": _acid(2)}, False),
    "2-amino-3-hydroxypropanoic acid (serine)": ([C("H", "H", left="OH"), C("NH2", "H"), C("=O", right="OH")], None,
                                                 {"hydroxyl": [("s", 0, "left")], "amine": [("s", 1, "up")], "acid": _acid(2)},
                                                 True),
    "3-hydroxybutanal": ([ME_L, C("OH", "H"), CH2, C("=O", right="H")], None,
                         {"methyl": METHYL_L, "hydroxyl": [("s", 1, "up")],
                          "aldehyde": [("b", 3), ("s", 3, "up"), ("s", 3, "right")]}, False),
    "4-hydroxybutan-2-one": ([ME_L, C("=O"), CH2, C("H", "H", right="OH")], None,
                             {"methyl": METHYL_L, "ketone": [("b", 1), ("s", 1, "up")], "hydroxyl": [("s", 3, "right")]}, False),
    "2-oxopropanoic acid (pyruvic acid)": ([ME_L, C("=O"), C("=O", right="OH")], None,
                                           {"methyl": METHYL_L, "ketone": [("b", 1), ("s", 1, "up")], "acid": _acid(2)}, False),
    "ethyl 2-aminoethanoate": ([N("H", "H"), CH2, C("=O"), O(), CH2, ME_R], None,
                               {"amine": [("b", 0), ("s", 0, "up"), ("s", 0, "down")], "ester": [("b", 2), ("s", 2, "up"), ("b", 3)],
                                "methyl": [("b", 5), ("s", 5, "up"), ("s", 5, "down"), ("s", 5, "right")]}, False),
    "methyl 2-hydroxypropanoate": ([ME_L, C("OH", "H"), C("=O"), O(), ME_R], None,
                                   {"methyl": METHYL_L, "hydroxyl": [("s", 1, "up")], "ester": [("b", 2), ("s", 2, "up"), ("b", 3)]},
                                   False),
    "2-chloropropanoic acid": ([ME_L, C("Cl", "H"), C("=O", right="OH")], None,
                               {"methyl": METHYL_L, "chloro": [("s", 1, "up")], "acid": _acid(2)}, False),
    "but-3-en-2-one": ([C("H", "H"), C("H"), C("=O"), ME_R], [2, 1, 1],
                       {"alkene": [("b", 0), ("b", 1)], "ketone": [("b", 2), ("s", 2, "up")],
                        "methyl": [("b", 3), ("s", 3, "up"), ("s", 3, "down"), ("s", 3, "right")]}, False),
    "3-aminobutanoic acid": ([ME_L, C("NH2", "H"), CH2, C("=O", right="OH")], None,
                             {"methyl": METHYL_L, "amine": [("s", 1, "up")], "acid": _acid(3)}, False),
}

# --- groups: benzene compounds ---------------------------------------------------------------------------------------
# name: {vertex: (printed group, part)}; vertex 0 is the top, then clockwise every 60 degrees.
RING_GROUPS = {
    "4-aminophenol": {0: ("OH", "hydroxyl"), 3: ("NH₂", "amine")},
    "N-(4-hydroxyphenyl)ethanamide (paracetamol)": {0: ("OH", "hydroxyl"), 3: ("NHCOCH₃", "amide")},
    "2-ethanoyloxybenzoic acid (aspirin)": {0: ("COOH", "acid"), 1: ("OCOCH₃", "ester")},
    "4-hydroxybenzoic acid": {0: ("COOH", "acid"), 3: ("OH", "hydroxyl")},
    "4-nitrophenol": {0: ("OH", "hydroxyl"), 3: ("NO₂", "nitro")},
    "4-methylphenylamine": {0: ("NH₂", "amine"), 3: ("CH₃", "methyl")},
    "4-hydroxybenzaldehyde": {0: ("CHO", "aldehyde"), 3: ("OH", "hydroxyl")},
    "methyl 4-hydroxybenzoate": {0: ("COOCH₃", "ester"), 3: ("OH", "hydroxyl")},
    "4-aminobenzoic acid": {0: ("COOH", "acid"), 3: ("NH₂", "amine")},
    "4-methylphenol": {0: ("OH", "hydroxyl"), 3: ("CH₃", "methyl")},
    "2-hydroxybenzoic acid": {0: ("COOH", "acid"), 1: ("OH", "hydroxyl")},
    "4-methylbenzoic acid": {0: ("COOH", "acid"), 3: ("CH₃", "methyl")},
    "3-nitrophenylamine": {0: ("NH₂", "amine"), 2: ("NO₂", "nitro")},
    "4-nitromethylbenzene": {0: ("CH₃", "methyl"), 3: ("NO₂", "nitro")},
}

PART_NAMES = {"acid": "carboxylic acid group", "amine": "amine group", "hydroxyl": "hydroxyl group", "aldehyde": "aldehyde group",
              "ketone": "ketone group", "ester": "ester group", "amide": "amide group", "nitro": "nitro group",
              "methyl": "methyl group", "ring": "benzene ring", "alkene": "C=C double bond", "chloro": "chlorine atom"}
# The groups a student mistakes each for: the wrong options of "what is the group labelled X?"
CONFUSED = {"acid": ["ester", "hydroxyl", "aldehyde"], "amine": ["amide", "nitro", "methyl"], "hydroxyl": ["acid", "aldehyde", "methyl"],
            "aldehyde": ["ketone", "acid", "hydroxyl"], "ketone": ["aldehyde", "ester", "acid"], "ester": ["acid", "ketone", "amide"],
            "amide": ["amine", "ester", "ketone"], "nitro": ["amine", "amide", "hydroxyl"], "methyl": ["alkene", "hydroxyl", "amine"],
            "ring": ["alkene", "methyl", "ester"], "alkene": ["ketone", "methyl", "aldehyde"], "chloro": ["hydroxyl", "methyl", "amine"]}

# --- classify --------------------------------------------------------------------------------------------------------
# name: (backbone, class, other names)
CLASSIFY = {
    "halogenoalkane": {
        "1-chloropropane": ([ME_L, CH2, C("H", "H", right="Cl")], "primary", []),
        "2-chloropropane": ([ME_L, C("Cl", "H"), ME_R], "secondary", []),
        "1-bromobutane": ([ME_L, CH2, CH2, C("H", "H", right="Br")], "primary", []),
        "2-bromobutane": ([ME_L, C("Br", "H"), CH2, ME_R], "secondary", []),
        "2-chloro-2-methylpropane": ([ME_L, C("Cl", "CH3"), ME_R], "tertiary", []),
        "1-chloro-2-methylpropane": ([ME_L, C("H", "CH3"), C("H", "H", right="Cl")], "primary", []),
        "2-bromo-2-methylbutane": ([ME_L, C("Br", "CH3"), CH2, ME_R], "tertiary", []),
        "2-iodopropane": ([ME_L, C("I", "H"), ME_R], "secondary", []),
        "3-bromopentane": ([ME_L, CH2, C("Br", "H"), CH2, ME_R], "secondary", []),
        "1-iodobutane": ([ME_L, CH2, CH2, C("H", "H", right="I")], "primary", []),
        "2-chlorobutane": ([ME_L, C("Cl", "H"), CH2, ME_R], "secondary", []),
    },
    "alcohol": {
        "propan-1-ol": ([ME_L, CH2, C("H", "H", right="OH")], "primary", ["1-propanol"]),
        "propan-2-ol": ([ME_L, C("OH", "H"), ME_R], "secondary", ["2-propanol"]),
        "butan-1-ol": ([ME_L, CH2, CH2, C("H", "H", right="OH")], "primary", ["1-butanol"]),
        "butan-2-ol": ([ME_L, C("OH", "H"), CH2, ME_R], "secondary", ["2-butanol"]),
        "2-methylpropan-2-ol": ([ME_L, C("OH", "CH3"), ME_R], "tertiary", []),
        "2-methylpropan-1-ol": ([ME_L, C("H", "CH3"), C("H", "H", right="OH")], "primary", []),
        "pentan-3-ol": ([ME_L, CH2, C("OH", "H"), CH2, ME_R], "secondary", ["3-pentanol"]),
        "2-methylbutan-2-ol": ([ME_L, C("OH", "CH3"), CH2, ME_R], "tertiary", []),
        "pentan-2-ol": ([ME_L, C("OH", "H"), CH2, CH2, ME_R], "secondary", ["2-pentanol"]),
    },
    "amine": {
        "ethylamine": ([ME_L, CH2, N("H", "H")], "primary", ["ethanamine", "aminoethane"]),
        "propylamine": ([ME_L, CH2, CH2, N("H", "H")], "primary", ["propan-1-amine", "1-aminopropane", "propanamine"]),
        "propan-2-amine": ([ME_L, C("NH2", "H"), ME_R], "primary", ["2-aminopropane", "isopropylamine", "2-propanamine"]),
        "dimethylamine": ([ME_L, N("H"), ME_R], "secondary", ["N-methylmethanamine"]),
        "ethylmethylamine": ([ME_L, CH2, N("H"), ME_R], "secondary", ["N-methylethanamine", "methylethylamine"]),
        "diethylamine": ([ME_L, CH2, N("H"), CH2, ME_R], "secondary", ["N-ethylethanamine"]),
        "trimethylamine": ([ME_L, N(down="CH3"), ME_R], "tertiary", ["N,N-dimethylmethanamine"]),
        "N,N-dimethylethanamine": ([ME_L, CH2, N(down="CH3"), ME_R], "tertiary", ["ethyldimethylamine", "dimethylethylamine"]),
    },
}

# --- chiral ----------------------------------------------------------------------------------------------------------
# name: (backbone, orders, the backbone carbons that are chiral centres, amino acid?)
CHIRAL = {
    "butan-2-ol": ([ME_L, C("OH", "H"), CH2, ME_R], None, [1], False),
    "2-chlorobutane": ([ME_L, C("Cl", "H"), CH2, ME_R], None, [1], False),
    "2-bromobutane": ([ME_L, C("Br", "H"), CH2, ME_R], None, [1], False),
    "2-aminopropanoic acid (alanine)": ([ME_L, C("NH2", "H"), C("=O", right="OH")], None, [1], True),
    "2-hydroxypropanoic acid (lactic acid)": ([ME_L, C("OH", "H"), C("=O", right="OH")], None, [1], False),
    "2-aminobutanoic acid": ([ME_L, CH2, C("NH2", "H"), C("=O", right="OH")], None, [2], True),
    "2-amino-3-methylbutanoic acid (valine)": ([ME_L, C("H", "CH3"), C("NH2", "H"), C("=O", right="OH")], None, [2], True),
    "pentan-2-ol": ([ME_L, C("OH", "H"), CH2, CH2, ME_R], None, [1], False),
    "3-chlorobutan-2-ol": ([ME_L, C("OH", "H"), C("Cl", "H"), ME_R], None, [1, 2], False),
    "2,3-dibromobutane": ([ME_L, C("Br", "H"), C("Br", "H"), ME_R], None, [1, 2], False),
    "2-methylbutan-1-ol": ([ME_L, CH2, C("H", "CH3"), C("H", "H", right="OH")], None, [2], False),
    "butan-2-amine": ([ME_L, C("NH2", "H"), CH2, ME_R], None, [1], False),
    "propan-2-ol": ([ME_L, C("OH", "H"), ME_R], None, [], False),
    "pentan-3-ol": ([ME_L, CH2, C("OH", "H"), CH2, ME_R], None, [], False),
    "2-methylpropan-2-ol": ([ME_L, C("OH", "CH3"), ME_R], None, [], False),
    "2-chloropropane": ([ME_L, C("Cl", "H"), ME_R], None, [], False),
}
UP_CHIRAL = ["2-aminopropanoic acid (alanine)", "2-aminobutanoic acid", "2-amino-3-methylbutanoic acid (valine)"]

# Each part: the concepts it shows, and the words of a chapter named for it.
PART_CONCEPTS = {"acid": ("carboxylic-acids",), "amine": ("amines",), "hydroxyl": ("alcohols",), "phenol": ("phenol",),
                 "aldehyde": ("aldehydes-and-ketones",), "ketone": ("aldehydes-and-ketones",), "ester": ("esters",),
                 "amide": ("amides",), "ring": ("benzene-and-aromatic-compounds",), "chloro": ("halogenoalkanes",),
                 "alkene": ("alkene-chemistry",), "nitro": (), "methyl": ()}
WORDS = {"acid": "carboxylic", "amine": "amine|amino", "hydroxyl": "alcohol|hydroxy", "phenol": "phenol",
         "aldehyde": "aldehyde|ketone|carbonyl", "ketone": "aldehyde|ketone|carbonyl", "ester": "ester", "amide": "amide",
         "ring": "benzene|arene|aromatic", "chloro": "halogeno|alkyl halide", "alkene": "alkene"}


def sample(rng: random.Random) -> dict:
    kind = rng.choices(["groups", "classify", "chiral"], [0.45, 0.3, 0.25])[0]
    band = rng.choice(BANDS)
    if kind == "groups":
        mol = rng.choice(sorted(CHAIN_GROUPS) + sorted(RING_GROUPS))
        parts = list(CHAIN_GROUPS[mol][2]) if mol in CHAIN_GROUPS else [v[1] for v in RING_GROUPS[mol].values()] + ["ring"]
        rng.shuffle(parts)
        return {"band": band, "kind": kind, "mol": mol, "letters": [[L, part] for L, part in zip("ABDE", parts)],
                "flip": mol in CHAIN_GROUPS and rng.random() < 0.5}
    if kind == "classify":
        word = rng.choice(sorted(CLASSIFY))
        return {"band": band, "kind": kind, "word": word, "mol": rng.choice(sorted(CLASSIFY[word])), "flip": rng.random() < 0.5}
    mol = rng.choice(UP_CHIRAL if band == "UP" else sorted(CHIRAL))
    backbone, _, chiral, _ = CHIRAL[mol]
    carbons = [k for k, a in enumerate(backbone) if a["sym"] == "C"]
    letters = []
    if chiral:
        pick = [rng.choice(chiral)] + rng.sample([k for k in carbons if k not in chiral], 2)
        rng.shuffle(pick)
        letters = [[L, k] for L, k in zip("ABD", pick)]  # never C, H, N or O: a letter must not read as an atom
    return {"band": band, "kind": kind, "mol": mol, "letters": letters, "flip": rng.random() < 0.5}


# --- structure -------------------------------------------------------------------------------------------------------

def molecule(p: dict):
    """The chain molecule drawn (a _molecule.Mol), or None for a benzene compound."""
    if p["kind"] == "groups":
        if p["mol"] not in CHAIN_GROUPS:
            return None
        backbone, orders, _, _ = CHAIN_GROUPS[p["mol"]]
    elif p["kind"] == "classify":
        backbone, orders = CLASSIFY[p["word"]][p["mol"]][0], None
    else:
        backbone, orders, _, _ = CHIRAL[p["mol"]]
    mol = chain(backbone, orders)
    return mirrored(mol) if p["flip"] else mol


def structure(p: dict):
    """The atoms and bonds drawn, as the tests read them: [(symbol, x, y)], [(i, j, order)]."""
    mol = molecule(p)
    if mol is None:
        return [], []
    return [tuple(a) for a in mol.atoms], [tuple(b) for b in mol.bonds]


def _parts(p: dict) -> dict:
    return dict((L, part) for L, part in p["letters"])


def _part_kinds(p: dict) -> list[str]:
    """The parts the figure shows, a hydroxyl on a ring counted as a phenol."""
    if p["kind"] == "groups":
        kinds = list(_parts(p).values())
        if p["mol"] in RING_GROUPS:
            kinds = ["phenol" if k == "hydroxyl" else k for k in kinds]
        return kinds
    if p["kind"] == "classify":
        return [{"halogenoalkane": "chloro", "alcohol": "hydroxyl", "amine": "amine"}[p["word"]]]
    kinds = []
    for a in CHIRAL[p["mol"]][0]:
        specs = {a[s] for s in ("up", "down", "left", "right") if a[s]}
        if "=O" in specs and "OH" in specs:
            kinds.append("acid")
        elif "OH" in specs:
            kinds.append("hydroxyl")
        if "NH2" in specs or a["sym"] == "N":
            kinds.append("amine")
        if specs & {"Cl", "Br", "I"}:
            kinds.append("chloro")
    return list(dict.fromkeys(kinds))


def concepts_for(p: dict) -> tuple[str, ...]:
    kinds = _part_kinds(p)
    out = [f"chemistry.{c}" for k in kinds for c in PART_CONCEPTS.get(k, ())]
    if p["kind"] == "groups":
        out.append("chemistry.organic-functional-groups")
        if p["mol"] in CHAIN_GROUPS and CHAIN_GROUPS[p["mol"]][3]:
            out.append("chemistry.amino-acids")
    elif p["kind"] == "classify":
        if p["band"] == "AL" and p["word"] == "halogenoalkane":
            out.append("chemistry.substitution-reactions")  # AS chapter 16 classifies them for nucleophilic substitution
    else:
        if p["band"] == "AL":
            out += ["chemistry.chirality", "chemistry.stereoisomerism"]
        else:
            out = ["chemistry.isomerism", "chemistry.amines", "chemistry.amino-acids"]  # the optical isomers of amino acids
        if CHIRAL[p["mol"]][3]:
            out.append("chemistry.amino-acids")
    return tuple(dict.fromkeys(out))


def avoid_for(p: dict) -> str:
    """No chapter named for a group the figure does not draw (unless it also names one it does)."""
    own = sorted({WORDS[k] for k in _part_kinds(p) if k in WORDS})
    absent = sorted({w for k, w in WORDS.items() if w not in own})
    rule = f"^(?!.*(?:{'|'.join(own)})).*(?:{'|'.join(absent)})" if own else "|".join(absent)
    extra = "|^(?!.*halogeno)" if p["kind"] == "classify" and p["word"] == "halogenoalkane" and p["band"] == "AL" else ""
    return f"{AVOID}|{rule}{extra}"


# --- drawing ---------------------------------------------------------------------------------------------------------

def _ring_layout(p: dict):
    """A benzene compound: the hexagon's corners, and each group's bond and printed text."""
    R = 1.0
    corners = [(R * math.cos(math.radians(90 - 60 * k)), R * math.sin(math.radians(90 - 60 * k))) for k in range(6)]
    subs = []
    for v, (label, part) in sorted(RING_GROUPS[p["mol"]].items()):
        ang = math.radians(90 - 60 * v)
        ux, uy = math.cos(ang), math.sin(ang)
        x0, y0 = corners[v]
        x1, y1 = x0 + 0.7 * ux, y0 + 0.7 * uy
        w = text_width(label)
        # text_width measures the ink; the printed text runs a little wider (its side bearings), so the box leaves room
        if abs(ux) < 1e-9:  # straight up or down: the text centred on the bond
            tx, ty, ha = x1, y1 + 0.25 * (1 if uy > 0 else -1), "center"
            rect = (tx - w / 2 - 0.22, ty - 0.27, tx + w / 2 + 0.22, ty + 0.27)
        else:  # to the side: the text starts where the bond ends
            tx, ty, ha = x1 + (0.06 if ux > 0 else -0.06), y1, "left" if ux > 0 else "right"
            rect = (tx - 0.15, ty - 0.27, tx + w + 0.3, ty + 0.27) if ux > 0 else (tx - w - 0.3, ty - 0.27, tx + 0.15, ty + 0.27)
        subs.append({"vertex": v, "label": label, "part": part, "bond": [(x0, y0), (x1, y1)], "at": (tx, ty), "ha": ha,
                     "rect": rect})
    return corners, subs


def _letters_spots(p: dict, mol):
    """Where each letter goes, and the boxes (groups) or carbons (chiral) they mark."""
    parts = _parts(p)
    if p["kind"] == "groups" and mol is not None:
        refs = CHAIN_GROUPS[p["mol"]][2]
        boxes = {L: box_of([mol.atoms[i][1:] for i in mol.group(refs[part])]) for L, part in parts.items()}
        obstacles = [tuple(a[1:]) for a in mol.atoms] + bond_midpoints(mol.atoms, mol.bonds)
        return boxes, place_letters(boxes, obstacles)
    if p["kind"] == "groups":
        corners, subs = _ring_layout(p)
        rects = {s["part"]: s["rect"] for s in subs}
        rects["ring"] = (-0.866 - 0.2, -1.2, 0.866 + 0.2, 1.2)
        boxes = {L: rects[part] for L, part in parts.items()}
        obstacles = corners + [s["at"] for s in subs] + [(0.0, 0.0)]
        return boxes, place_letters(boxes, obstacles)
    # chiral: each letter on a diagonal from its carbon, clear of the atoms and bonds
    spots = {}
    taken = [tuple(a[1:]) for a in mol.atoms] + bond_midpoints(mol.atoms, mol.bonds)
    for L, k in p["letters"]:
        _, x, y = mol.atoms[mol.refs[("b", k)][0]]
        cands = [(x + dx * 0.62, y + dy * 0.62) for dx in (1, -1) for dy in (1, -1)]
        best = max(cands, key=lambda c: min(math.hypot(c[0] - a, c[1] - b) for a, b in taken if (a, b) != (x, y)))
        spots[L] = best
        taken.append(best)
    return {}, spots


def draw(p: dict):
    mol = molecule(p)
    pts = []
    if mol is not None:
        boxes, spots = _letters_spots(p, mol) if p.get("letters") else ({}, {})
        pts = [(x, y) for _, x, y in mol.atoms]
    else:
        boxes, spots = _letters_spots(p, None)
        corners, subs = _ring_layout(p)
        pts = corners + [(r[0], r[1]) for s in subs for r in [s["rect"]]] + [(r[2], r[3]) for s in subs for r in [s["rect"]]]
    xs = [x for x, _ in pts] + [v for r in boxes.values() for v in (r[0], r[2])] + [x for x, _ in spots.values()]
    ys = [y for _, y in pts] + [v for r in boxes.values() for v in (r[1], r[3])] + [y for _, y in spots.values()]
    xmin, xmax, ymin, ymax = min(xs) - 0.55, max(xs) + 0.55, min(ys) - 0.55, max(ys) + 0.55
    fig, ax = new_figure((xmax - xmin) * INCH, (ymax - ymin) * INCH)
    ax.set_position([0, 0, 1, 1])
    if mol is not None:
        draw_bonds(ax, mol.atoms, mol.bonds)
        draw_atoms(ax, mol.atoms)
    else:
        corners, subs = _ring_layout(p)
        ring = corners + [corners[0]]
        ax.plot([c[0] for c in ring], [c[1] for c in ring], color=INK, linewidth=1.4, gid="ring")
        ax.add_patch(Circle((0, 0), 0.6, fill=False, edgecolor=INK, linewidth=1.3, gid="ring-circle"))
        for s in subs:
            (x0, y0), (x1, y1) = s["bond"]
            ax.plot([x0, x1], [y0, y1], color=INK, linewidth=1.4, gid=f"subbond:{s['vertex']}")
            ax.text(*s["at"], s["label"], ha=s["ha"], va="center", fontsize=15, fontweight="bold", gid=f"sub:{s['vertex']}")
    for L in sorted(boxes):
        draw_box(ax, L, boxes[L], spots[L])
    if p["kind"] == "chiral":
        for L, k in p["letters"]:
            _, x, y = mol.atoms[mol.refs[("b", k)][0]]
            sx, sy = spots[L]
            d = math.hypot(x - sx, y - sy)
            ux, uy = (x - sx) / d, (y - sy) / d
            ax.plot([sx + ux * 0.24, x - ux * 0.25], [sy + uy * 0.24, y - uy * 0.25], color=INK, linewidth=1.0, gid=f"leader:{L}")
            ax.text(sx, sy, L, ha="center", va="center", fontsize=LETTER_SIZE, fontweight="bold", gid=f"letter:{L}", zorder=5,
                    bbox=dict(boxstyle="circle,pad=0.18", facecolor="white", edgecolor=INK, linewidth=1.0))
    frame(ax, xmin, xmax, ymin, ymax)
    return fig


# --- questions -------------------------------------------------------------------------------------------------------

SETTINGS = ["in a Senior 5 chemistry lesson", "in a Senior 6 lesson on organic compounds", "while revising for an examination",
            "at the chemistry club in Huye", "in a lesson in Musanze", "for homework in Kigali", "on a revision card in Rubavu",
            "for a class test in Nyanza"]
MET_GROUPS = ["boxed and lettered parts of this molecule", "drew this molecule and lettered some of its groups",
              "lettered the groups of a molecule from a textbook", "marked parts of this molecule for a quiz"]
MET_CLASSIFY = ["drew the displayed formula of this compound", "copied this displayed formula from the board",
                "built a model of this molecule and drew it", "found this displayed formula in a textbook"]
MET_CHIRAL = ["lettered three carbon atoms in this molecule", "drew this molecule and lettered some of its carbon atoms",
              "marked three carbon atoms of this molecule"]
CHIRAL_RULE = "A chiral centre is a carbon atom bonded to four different atoms or groups."


def _formula_q(stem: str, atoms) -> object:
    f = formula([(a[0],) for a in atoms])
    return short(stem, sub(f), formula_forms(f))


def _name_forms(name: str, others) -> list[str]:
    forms = [name] + list(others)
    return forms + [x[0].upper() + x[1:] for x in forms]


def _bonded_carbons(atoms, bonds, i) -> int:
    return sum(1 for a, b, _ in bonds if i in (a, b) and atoms[b if a == i else a][0] == "C")


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    mol = molecule(p)
    if p["kind"] == "groups":
        parts = _parts(p)
        letters = sorted(parts)
        asked = rng.choice([L for L, part in parts.items() if part != "methyl"])
        qs = [letter_choice(f"{who} {rng.choice(MET_GROUPS)} {setting}. Which letter labels the {PART_NAMES[parts[asked]]}?",
                            asked, letters)]
        L = rng.choice([x for x in letters if x != asked])
        part = parts[L]
        qs.append(mcq(f"In the molecule shown, what is the part labelled {L}?", PART_NAMES[part],
                      [PART_NAMES[k] for k in CONFUSED[part]], rng))
        if mol is not None:
            qs.append(_formula_q("What is the molecular formula of the compound shown?", mol.atoms))
        return qs
    if p["kind"] == "classify":
        word, (_, cls, others) = p["word"], CLASSIFY[p["word"]][p["mol"]]
        atoms, bonds = mol.atoms, mol.bonds
        qs = [mcq(f"{who} {rng.choice(MET_CLASSIFY)} {setting}. Is the {word} shown primary, secondary or tertiary?", cls,
                  [c for c in ("primary", "secondary", "tertiary") if c != cls], rng),
              _formula_q(f"What is the molecular formula of the {word} shown?", atoms),
              short(f"Give the name of the {word} shown.", p["mol"], _name_forms(p["mol"], others))]
        if word == "amine":
            n = next(i for i, a in enumerate(atoms) if a[0] == "N")
            qs.append(short("How many carbon atoms are bonded directly to the nitrogen atom in the amine shown?",
                            _bonded_carbons(atoms, bonds, n), []))
        else:
            x = next(i for i, a in enumerate(atoms) if a[0] in ("Cl", "Br", "I", "O"))
            c = next(b if a == x else a for a, b, _ in bonds if x in (a, b))
            what = "the OH group" if word == "alcohol" else f"the {atoms[x][0]} atom"
            qs.append(short(f"How many carbon atoms are bonded directly to the carbon atom that carries {what}?",
                            _bonded_carbons(atoms, bonds, c), []))
        return qs
    chiral = CHIRAL[p["mol"]][2]
    qs = []
    if p["letters"]:
        key = next(L for L, k in p["letters"] if k in chiral)
        qs.append(letter_choice(f"{who} {rng.choice(MET_CHIRAL)} {setting}. {CHIRAL_RULE} Which lettered carbon atom is a "
                                f"chiral centre?", key, [L for L, _ in p["letters"]]))
        lead = ""
    else:
        lead = f"{who} drew this molecule {setting}. "
    qs.append(short(f"{lead}{CHIRAL_RULE} How many chiral centres does one molecule of the compound shown have?", len(chiral),
                    [f"{len(chiral)} chiral centres"]))
    qs.append(_formula_q("What is the molecular formula of the compound shown?", mol.atoms))
    return qs
