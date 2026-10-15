"""Concentration table (LS, UP): four solutions, each a mass of solute made up to a volume of solution, in a table with
the formula printed under it. Two kinds:

- mass: four solutions of one solute; the concentration of one in g/dm³, the most or least concentrated, and the mass
  needed to make a volume of solution as concentrated as one of them;
- moles: four solutes with their molar masses printed; the concentration of one in mol/dm³, the highest or lowest in
  mol/dm³ (never the same solution as by grams per dm³, so the table must be worked), and the mass of a solute needed
  for a stated volume and mol/dm³.

Every answer is exact: volumes are whole cm³ (50 to 1000), masses have one or two decimal places at most, and no two
solutions are within a fifth of each other at the top or the bottom of the order.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import INK, NAMES, exact, new_figure, short
from ._bio_parts import letter_choice

ID = "concentration_table"
KIND = "table.data"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = ("chemistry.solutions-and-solubility", "chemistry.mole-concept")
# A topic whose sections the book lists is reached only if one names concentration or calculations with moles.
NEEDS = (r"concentrat|solutions and titration|standard solution|preparation of solutions|calculations on the mole|"
         r"chemical calculations|mass, moles|stoichiometr")
AVOID = (r"gas laws|introduction|states of matter|solubility product|\borganic|electroly|colligative|equilibri|\brates?\b|kinetic|enthalpy|"
         r"energetic|bonding|atomic|periodic|polymer|petro")


def concepts_for(p: dict) -> tuple[str, ...]:
    """Moles only where the table gives molar masses."""
    return CONCEPTS if p["kind"] == "moles" else CONCEPTS[:1]


SOLUTES = ["sodium chloride", "copper(II) sulfate", "sodium hydroxide", "glucose", "potassium nitrate", "sodium carbonate"]
MOLAR = {"sodium hydroxide": 40, "potassium hydroxide": 56, "sodium carbonate": 106, "copper(II) sulfate": 160,
         "sodium hydrogencarbonate": 84, "magnesium sulfate": 120, "ammonium nitrate": 80, "glucose": 180,
         "potassium nitrate": 101, "calcium chloride": 111, "sodium sulfate": 142, "sodium nitrate": 85}
# The most of each that dissolves to make a solution at room temperature, in g/dm³, kept well under saturation.
MOST = {"sodium hydroxide": 400, "potassium hydroxide": 400, "sodium carbonate": 150, "copper(II) sulfate": 150,
        "sodium hydrogencarbonate": 70, "magnesium sulfate": 250, "ammonium nitrate": 500, "glucose": 400,
        "potassium nitrate": 200, "calcium chloride": 400, "sodium sulfate": 150, "sodium nitrate": 400}
VOLUMES = [50, 100, 200, 250, 400, 500]
MOL_VOLUMES = [50, 100, 200, 250, 500, 1000]
MOLARITIES = ["0.05", "0.1", "0.2", "0.25", "0.4", "0.5", "1", "2"]
LETTERS = ["A", "B", "C", "D"]


def _num(f: Fraction):
    """A mass for the params: an int when whole, else a float of at most two places."""
    return int(f) if f.denominator == 1 else float(f)


def _clear(values) -> bool:
    """No near-tie at the top or the bottom of the order."""
    top, low = sorted(values, reverse=True), sorted(values)
    return top[0] >= Fraction(6, 5) * top[1] and low[1] >= Fraction(6, 5) * low[0]


def _sample_mass(rng: random.Random) -> dict:
    solute = rng.choice(SOLUTES)
    while True:
        rows = []
        for L in LETTERS:
            vol = rng.choice(VOLUMES)
            conc = rng.randrange(4, 121, 2)  # g/dm³: even, so every mass has one decimal place at most
            rows.append([L, solute, _num(Fraction(conc * vol, 1000)), vol, None])
        concs = [Fraction(str(r[2])) * 1000 / r[3] for r in rows]
        if _clear(concs) and len(set(concs)) == 4:
            return {"kind": "mass", "rows": rows}


def _sample_moles(rng: random.Random) -> dict:
    high = rng.random() < 0.5
    while True:
        rows = []
        for L, solute in zip(LETTERS, rng.sample(sorted(MOLAR), 4)):
            vol = rng.choice(MOL_VOLUMES)
            mass = Fraction(rng.choice(MOLARITIES)) * MOLAR[solute] * vol / 1000
            if (mass * 100).denominator != 1 or not Fraction(1, 2) <= mass or mass * 1000 / vol > MOST[solute]:
                break
            rows.append([L, solute, _num(mass), vol, MOLAR[solute]])
        if len(rows) < 4:
            continue
        grams = {r[0]: Fraction(str(r[2])) * 1000 / r[3] for r in rows}
        moles = {L: grams[L] / r[4] for L, r in zip(LETTERS, rows)}
        pick = max if high else min
        # the order in mol/dm³ is not the order in g/dm³: the molar masses must be used
        if _clear(moles.values()) and len(set(moles.values())) == 4 and pick(grams, key=grams.get) != pick(moles, key=moles.get):
            return {"kind": "moles", "rows": rows, "high": high}


def sample(rng: random.Random) -> dict:
    p = _sample_mass(rng) if rng.random() < 0.5 else _sample_moles(rng)
    return {"band": rng.choice(BANDS), **p}


# --- drawing ------------------------------------------------------------------------------------------

def _fmt(x) -> str:
    return f"{x:g}"


def draw(p: dict):
    moles = p["kind"] == "moles"
    heads = ["Solution", "Solute"] + (["Molar mass\n(g/mol)"] if moles else []) + ["Mass of\nsolute (g)", "Volume of\nsolution (cm³)"]
    widths = [2.0, 4.8] + ([2.6] if moles else []) + [2.6, 3.0]
    xs = [0.0]
    for w in widths:
        xs.append(xs[-1] + w)
    total = xs[-1]
    fig, ax = new_figure(total * 0.5 + 0.2, 4.6 if moles else 4.1)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    row_h, head_h = 0.62, 1.0
    top = 0.0
    lines = [top, top - head_h] + [top - head_h - row_h * (k + 1) for k in range(4)]
    for y in lines:
        ax.plot([0, total], [y, y], color=INK, linewidth=1.2 if y in (lines[0], lines[1], lines[-1]) else 0.7)
    for x in xs:
        ax.plot([x, x], [lines[0], lines[-1]], color=INK, linewidth=0.8)
    for k, h in enumerate(heads):
        ax.text((xs[k] + xs[k + 1]) / 2, top - head_h / 2, h, ha="center", va="center", fontsize=10, fontweight="bold")
    for i, (L, solute, mass, vol, molar) in enumerate(p["rows"]):
        y = top - head_h - row_h * (i + 0.5)
        cells = [L, solute] + ([str(molar)] if moles else []) + [_fmt(mass), str(vol)]
        for k, c in enumerate(cells):
            ax.text((xs[k] + xs[k + 1]) / 2, y, c, ha="center", va="center", fontsize=10.5,
                    fontweight="bold" if k == 0 else "normal")
    notes = (["number of moles = mass (g) ÷ molar mass (g/mol)",
              "concentration (mol/dm³) = number of moles ÷ volume of solution (dm³)"] if moles else
             ["concentration (g/dm³) = mass of solute (g) ÷ volume of solution (dm³)"]) + ["1 dm³ = 1000 cm³"]
    y = lines[-1] - 0.55
    for n in notes:
        ax.text(0.05, y, n, ha="left", va="center", fontsize=10)
        y -= 0.45
    ax.set_xlim(-0.2, total + 0.2)
    ax.set_ylim(y - 0.1, top + 0.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ----------------------------------------------------------------------------------------

SETTINGS = ["in the school laboratory", "for a class practical in Huye", "at the science club in Musanze",
            "in a chemistry lesson in Kigali", "for a practical test in Rubavu", "in the laboratory at a school in Nyagatare",
            "during a practical on solutions", "for the school's water project"]


def _value_forms(v: Fraction, unit: str) -> tuple[str, list[str]]:
    x = exact(v)
    ups = {"g/dm³": ["g/dm3", "g dm⁻³", "g dm-3", "g per dm³"], "mol/dm³": ["mol/dm3", "mol dm⁻³", "mol dm-3", "M", "mol per dm³"],
           "g": ["grams"]}
    forms = [x, f"{x} {unit}", f"{x}{unit}"] + [f"{x} {u}" for u in ups[unit]]
    return x, forms


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    rows = {r[0]: r for r in p["rows"]}
    grams = {L: Fraction(str(r[2])) * 1000 / r[3] for L, r in rows.items()}
    setting = rng.choice(SETTINGS)
    L = rng.choice(LETTERS)
    if p["kind"] == "mass":
        solute = p["rows"][0][1]
        x, forms = _value_forms(grams[L], "g/dm³")
        qs = [short(f"{who} made four solutions of {solute} {setting}. What is the concentration of solution {L} in g/dm³?", x, forms)]
        high = rng.random() < 0.5
        key = (max if high else min)(grams, key=grams.get)
        by_mass = (max if high else min)(rows, key=lambda k: rows[k][2])  # the slip: the most (or least) solute
        qs.append(letter_choice(f"Which solution is the {'most' if high else 'least'} concentrated?", key,
                                [by_mass] + [k for k in LETTERS if k != key]))
        M = rng.choice([k for k in LETTERS if k != L])
        vol = rng.choice([v for v in (100, 200, 250, 500, 1000) if v != rows[M][3]])
        x, forms = _value_forms(grams[M] * vol / 1000, "g")
        qs.append(short(f"{friend} wants to make {vol} cm³ of {solute} solution with the same concentration as solution {M}. "
                        f"What mass of {solute} is needed?", x, forms))
        return qs
    moles = {k: grams[k] / rows[k][4] for k in rows}
    x, forms = _value_forms(moles[L], "mol/dm³")
    qs = [short(f"{who} made four solutions {setting}. What is the concentration of solution {L} in mol/dm³?", x, forms)]
    high = p["high"]
    key = (max if high else min)(moles, key=moles.get)
    by_grams = (max if high else min)(grams, key=grams.get)  # the slip: ranking by grams per dm³
    qs.append(letter_choice(f"Which solution has the {'highest' if high else 'lowest'} concentration in mol/dm³?", key,
                            [by_grams] + [k for k in LETTERS if k != key]))
    while True:
        solute = rows[rng.choice(LETTERS)][1]
        vol, c = rng.choice(MOL_VOLUMES), rng.choice(MOLARITIES)
        mass = Fraction(c) * vol / 1000 * MOLAR[solute]
        if (mass * 100).denominator == 1 and mass >= Fraction(1, 10) and Fraction(c) * MOLAR[solute] <= MOST[solute]:
            break
    x, forms = _value_forms(mass, "g")
    qs.append(short(f"What mass of {solute} is needed to make {vol} cm³ of a {c} mol/dm³ solution?", x, forms))
    return qs
