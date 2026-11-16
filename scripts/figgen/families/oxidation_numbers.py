"""Oxidation numbers and redox (UP, AL), for IGCSE "Redox reactions" and AS "What is a redox reaction?". Two kinds:

- ladder: an oxidation-number ladder for nitrogen, sulfur, chlorine or manganese, every rung numbered, five rungs
  lettered; three of the element's compounds or ions listed beside it. Asks which letter marks the element's
  oxidation number in a listed species (worked out from its formula, found on the ladder).
- equation: a balanced redox equation, four species lettered beneath (the two forms of the element oxidised and of
  the element reduced); "oxidation is an increase in oxidation number" printed. Asks which lettered reactant is
  oxidised, which is the oxidising agent, the oxidation number of an element in a lettered species and, at AL, the
  change in an oxidation number between two letters.

Every oxidation number comes from a fixed table a teacher would agree with; the letters make the figure needed.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, new_figure, short
from ._bio_parts import letter_choice
from ._molecule import text_width

ID = "oxidation_numbers"
KIND = "chem.structure"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("oxidation-numbers", "redox-reactions", "disproportionation"))
# A topic whose sections the book lists is reached only if one names redox, oxidation or reduction.
NEEDS = r"redox|oxidation|reduction|oxidising|reducing"
AVOID = (r"glossary|electroly|electrochem|electrode|cells?\b|organic|alkane|alcohol|carboxylic|aldehyde|ketone|"
         r"titration|corrosion|rusting|extraction|transition|energ|enthalp|rates?\b|equilibri|fertili|npk|environment|"
         r"stoichiometry|industrial|group 1\d")


def concepts_for(p: dict) -> tuple[str, ...]:
    c = "chemistry."
    out = (c + "oxidation-numbers", c + "redox-reactions")
    return out + ((c + "disproportionation",) if p.get("eq") in DISPROPORTION else ())


# element: (name, the ladder's lowest and highest rung, {species: oxidation number})
LADDERS = {
    "N": ("nitrogen", -3, 5, {"NH₃": -3, "NH₄⁺": -3, "N₂": 0, "N₂O": 1, "NO": 2, "NO₂⁻": 3, "NO₂": 4, "HNO₃": 5, "NO₃⁻": 5}),
    "S": ("sulfur", -2, 6, {"H₂S": -2, "S": 0, "S₂O₃²⁻": 2, "SO₂": 4, "SO₃²⁻": 4, "SO₃": 6, "H₂SO₄": 6, "SO₄²⁻": 6}),
    "Cl": ("chlorine", -1, 7, {"HCl": -1, "Cl⁻": -1, "Cl₂": 0, "ClO⁻": 1, "HClO": 1, "ClO₂": 4, "ClO₃⁻": 5, "ClO₄⁻": 7}),
    "Mn": ("manganese", 0, 7, {"Mn": 0, "Mn²⁺": 2, "MnO": 2, "Mn₂O₃": 3, "MnO₂": 4, "MnO₄²⁻": 6, "MnO₄⁻": 7}),
}
# equation: (species in order, reactant count, marks {index: (element, oxidation number)}, oxidised element, reduced)
EQUATIONS = {
    "zinc + copper ions": (["Zn", "Cu²⁺", "Zn²⁺", "Cu"], 2, {0: ("zinc", 0), 1: ("copper", 2), 2: ("zinc", 2), 3: ("copper", 0)},
                           "zinc", "copper"),
    "iron(II) + chlorine": (["2Fe²⁺", "Cl₂", "2Fe³⁺", "2Cl⁻"], 2,
                            {0: ("iron", 2), 1: ("chlorine", 0), 2: ("iron", 3), 3: ("chlorine", -1)}, "iron", "chlorine"),
    "iron(III) + iodide": (["2Fe³⁺", "2I⁻", "2Fe²⁺", "I₂"], 2,
                           {0: ("iron", 3), 1: ("iodine", -1), 2: ("iron", 2), 3: ("iodine", 0)}, "iodine", "iron"),
    "magnesium + acid": (["Mg", "2H⁺", "Mg²⁺", "H₂"], 2, {0: ("magnesium", 0), 1: ("hydrogen", 1), 2: ("magnesium", 2),
                                                        3: ("hydrogen", 0)}, "magnesium", "hydrogen"),
    "copper oxide + hydrogen": (["CuO", "H₂", "Cu", "H₂O"], 2,
                                {0: ("copper", 2), 1: ("hydrogen", 0), 2: ("copper", 0), 3: ("hydrogen", 1)}, "hydrogen", "copper"),
    "iron oxide + carbon monoxide": (["Fe₂O₃", "3CO", "2Fe", "3CO₂"], 2,
                                     {0: ("iron", 3), 1: ("carbon", 2), 2: ("iron", 0), 3: ("carbon", 4)}, "carbon", "iron"),
    "chlorine + potassium iodide": (["Cl₂", "2KI", "2KCl", "I₂"], 2,
                                    {0: ("chlorine", 0), 1: ("iodine", -1), 2: ("chlorine", -1), 3: ("iodine", 0)}, "iodine",
                                    "chlorine"),
    "manganese dioxide + hydrochloric acid": (["MnO₂", "4HCl", "MnCl₂", "Cl₂", "2H₂O"], 2,
                                              {0: ("manganese", 4), 1: ("chlorine", -1), 2: ("manganese", 2), 3: ("chlorine", 0)},
                                              "chlorine", "manganese"),
    "copper + concentrated nitric acid": (["Cu", "4HNO₃", "Cu(NO₃)₂", "2NO₂", "2H₂O"], 2,
                                          {0: ("copper", 0), 1: ("nitrogen", 5), 2: ("copper", 2), 3: ("nitrogen", 4)},
                                          "copper", "nitrogen"),
    "chlorine + cold alkali": (["Cl₂", "2OH⁻", "Cl⁻", "ClO⁻", "H₂O"], 2,
                               {0: ("chlorine", 0), 2: ("chlorine", -1), 3: ("chlorine", 1), 1: ("oxygen", -2)}, "chlorine",
                               "chlorine"),
}
UP_EQUATIONS = ["zinc + copper ions", "iron(II) + chlorine", "iron(III) + iodide", "magnesium + acid",
                "copper oxide + hydrogen", "iron oxide + carbon monoxide", "chlorine + potassium iodide"]
DISPROPORTION = {"chlorine + cold alkali"}
LETTER_SETS = ["ABDEG", "PQRST", "JKLMU", "VWXYZ"]  # no C, H, N or O: a letter under an equation is not an atom


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    letters = list(rng.choice(LETTER_SETS))
    if rng.random() < 0.5:
        el = rng.choice(sorted(LADDERS))
        _, lo, hi, species = LADDERS[el]
        while True:
            listed = rng.sample(sorted(species), 3)
            ons = [species[s] for s in listed]
            if len(set(ons)) == 3:
                break
        others = rng.sample([v for v in range(lo, hi + 1) if v not in ons], 2)
        rungs = sorted(ons + others)
        rng.shuffle(letters)
        return {"band": band, "kind": "ladder", "element": el, "listed": listed,
                "rungs": [[L, v] for L, v in zip(letters, rungs)], "ask": rng.sample(range(3), 2)}
    pool = UP_EQUATIONS if band == "UP" else sorted(EQUATIONS)
    eq = rng.choice(pool)
    marks = sorted(EQUATIONS[eq][2])
    rng.shuffle(letters)
    return {"band": band, "kind": "equation", "eq": eq, "letters": [[L, i] for L, i in zip(letters, marks)],
            "read": rng.choice(marks)}


# --- drawing --------------------------------------------------------------------------------------------------------

def _draw_ladder(p: dict):
    name, lo, hi, _ = LADDERS[p["element"]]
    fig, ax = new_figure(6.6, 5.6)
    ax.plot([0, 0], [lo - 0.4, hi + 0.4], color=INK, linewidth=2.0, gid="rail")
    marked = {v: L for L, v in p["rungs"]}
    for v in range(lo, hi + 1):
        ax.plot([-0.25, 0.25], [v, v], color=INK, linewidth=1.2, gid=f"rung:{v}")
        ax.text(-0.45, v, f"+{v}" if v > 0 else str(v).replace("-", "−"), ha="right", va="center", fontsize=11,
                gid=f"number:{v}")
        if v in marked:
            ax.text(0.65, v, marked[v], ha="center", va="center", fontsize=12, fontweight="bold", gid=f"letter:{marked[v]}",
                    bbox=dict(boxstyle="circle,pad=0.18", facecolor="white", edgecolor=INK, linewidth=1.0))
    ax.text(0, hi + 0.95, f"Oxidation numbers of {name}", ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text(2.0, (lo + hi) / 2 + 1.4, f"Some species containing {name}:", ha="left", va="center", fontsize=10.5)
    for k, s in enumerate(p["listed"]):
        ax.text(2.3, (lo + hi) / 2 + 0.4 - 1.0 * k, s, ha="left", va="center", fontsize=13, gid=f"species:{k}")
    ax.set_xlim(-1.4, 6.2)
    ax.set_ylim(lo - 0.9, hi + 1.4)
    ax.axis("off")
    return fig


def _draw_equation(p: dict):
    species, n_react, marks, _, _ = EQUATIONS[p["eq"]]
    pieces = []
    for k, s in enumerate(species):
        if k:
            pieces.append(("→" if k == n_react else "+", None))
        pieces.append((s, k))
    widths = [text_width(t, 18) for t, _ in pieces]
    gap = 0.35
    total = sum(widths) + gap * (len(pieces) - 1)
    fig, ax = new_figure(max(6.0, total * 0.62 + 1.2), 3.0)
    x = -total / 2
    letter_of = {i: L for L, i in p["letters"]}
    for (t, k), w in zip(pieces, widths):
        ax.text(x + w / 2, 1.0, t, ha="center", va="center", fontsize=18, gid=f"piece:{k}" if k is not None else f"op:{t}")
        if k in letter_of:
            ax.plot([x + w / 2, x + w / 2], [0.62, 0.25], color=INK, linewidth=1.0, gid=f"leader:{letter_of[k]}")
            ax.text(x + w / 2, -0.05, letter_of[k], ha="center", va="center", fontsize=12, fontweight="bold",
                    gid=f"letter:{letter_of[k]}", bbox=dict(boxstyle="circle,pad=0.18", facecolor="white", edgecolor=INK,
                                                            linewidth=1.0))
        x += w + gap
    ax.text(0, 2.1, "Oxidation is an increase in oxidation number; reduction is a decrease.", ha="center", va="center",
            fontsize=10)
    ax.set_xlim(-total / 2 - 0.6, total / 2 + 0.6)
    ax.set_ylim(-0.6, 2.5)
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_ladder(p) if p["kind"] == "ladder" else _draw_equation(p)


# --- questions ------------------------------------------------------------------------------------------------------

SETTINGS = ["in a lesson on redox", "while revising in Huye", "for homework", "at the chemistry club in Musanze",
            "for a class test in Kigali", "in a lesson in Rubavu", "on a revision card"]
VERBS = ["drew", "copied", "was given", "studied"]


def _signed(v: int) -> list[str]:
    s = f"+{v}" if v > 0 else str(v)
    return [s, str(v), s.replace("-", "−"), f"{s} oxidation number"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["kind"] == "ladder":
        name, _, _, species = LADDERS[p["element"]]
        at = {v: L for L, v in p["rungs"]}
        letters = sorted(at.values())
        qs = []
        for n, k in enumerate(p["ask"]):
            s = p["listed"][k]
            lead = f"{who} {rng.choice(VERBS)} this ladder of oxidation numbers {setting}. " if n == 0 else ""
            qs.append(letter_choice(f"{lead}Which letter marks the oxidation number of {name} in {s}?", at[species[s]], letters))
        return qs
    species, n_react, marks, oxidised, reduced = EQUATIONS[p["eq"]]
    letter_of = {i: L for L, i in p["letters"]}
    letters = sorted(letter_of.values())
    react = [i for i in marks if i < n_react]
    ox = next(i for i in react if marks[i][0] == oxidised and (oxidised != reduced or marks[i][1] == 0))
    agent = next(i for i in react if marks[i][0] == reduced and (oxidised != reduced or marks[i][1] == 0))
    qs = []
    if oxidised != reduced:
        qs.append(letter_choice(f"{who} {rng.choice(VERBS)} this equation {setting}. Which lettered reactant is oxidised?",
                                letter_of[ox], letters))
        qs.append(letter_choice("Which lettered reactant is the oxidising agent?", letter_of[agent], letters))
    else:  # chlorine is both oxidised and reduced: which product shows each
        up = next(i for i in marks if i >= n_react and marks[i][0] == oxidised and marks[i][1] > 0)
        qs.append(letter_choice(f"{who} {rng.choice(VERBS)} this equation {setting}. In this reaction chlorine is both "
                                f"oxidised and reduced. Which lettered product contains the chlorine that was oxidised?",
                                letter_of[up], letters))
    i = p["read"]
    el, v = marks[i]
    qs.append(short(f"What is the oxidation number of {el} in the species marked {letter_of[i]}?", _signed(v)[0], _signed(v)))
    if p["band"] == "AL":
        a = ox
        b = next(j for j in marks if j >= n_react and marks[j][0] == marks[a][0] and marks[j][1] != marks[a][1])
        change = abs(marks[b][1] - marks[a][1])
        qs.append(short(f"By how much does the oxidation number of {marks[a][0]} change between {letter_of[a]} and "
                        f"{letter_of[b]}?", change, [str(change), f"by {change}"]))
    return qs
