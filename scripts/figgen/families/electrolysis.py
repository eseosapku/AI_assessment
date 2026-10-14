"""Electrolysis (UP, AL): a cell of two electrodes, lettered, dipping into an electrolyte named under the
beaker, wired to a battery whose + and − sides are marked. The product at each electrode by the
discharge rules, which electrode is the cathode, and the ion discharged there. With copper electrodes in
copper(II) sulfate the anode dissolves; it is asked what happens to it, not what it gives off.

The cathode is the electrode joined to the battery's − side.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, formula_forms, mcq, new_figure, short, sup

ID = "electrolysis"
KIND = "chem.structure"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("electrolysis", "redox-reactions", "electrochemistry"))
AVOID = r"organic|alkane|titration|isotope|chromatograph|rate|enthalpy|cell-potential|electrode-potential"
# electrolyte: (name under the beaker, electrode material, cathode product, anode product, ion discharged at the cathode)
ELECTROLYTES = {
    "molten lead(II) bromide": ("molten lead(II) bromide", "carbon", "lead", "bromine", "Pb2+"),
    "molten sodium chloride": ("molten sodium chloride", "carbon", "sodium", "chlorine", "Na+"),
    "molten zinc chloride": ("molten zinc chloride", "carbon", "zinc", "chlorine", "Zn2+"),
    "concentrated sodium chloride solution": ("concentrated sodium chloride solution", "carbon", "hydrogen", "chlorine", "H+"),
    "copper(II) sulfate solution, carbon electrodes": ("copper(II) sulfate solution", "carbon", "copper", "oxygen", "Cu2+"),
    "copper(II) sulfate solution, copper electrodes": ("copper(II) sulfate solution", "copper", "copper", None, "Cu2+"),
    "copper(II) chloride solution": ("concentrated copper(II) chloride solution", "carbon", "copper", "chlorine", "Cu2+"),
    "dilute sulfuric acid": ("dilute sulfuric acid", "carbon", "hydrogen", "oxygen", "H+"),
}
PRODUCT_FORMS = {
    "lead": ["lead", "Pb", "lead metal", "molten lead"], "sodium": ["sodium", "Na", "sodium metal"],
    "zinc": ["zinc", "Zn", "zinc metal"], "copper": ["copper", "Cu", "copper metal"],
    "bromine": ["bromine", "Br2", "Br₂", "bromine gas", "bromine vapour", "bromine vapor"],
    "chlorine": ["chlorine", "Cl2", "Cl₂", "chlorine gas"], "hydrogen": ["hydrogen", "H2", "H₂", "hydrogen gas"],
    "oxygen": ["oxygen", "O2", "O₂", "oxygen gas"],
}
LETTERS = [("A", "B"), ("P", "Q"), ("X", "Y"), ("M", "N")]


def sample(rng: random.Random) -> dict:
    return {"band": rng.choice(BANDS), "electrolyte": rng.choice(list(ELECTROLYTES)), "plus": rng.choice(["left", "right"]),
            "letters": rng.choice(LETTERS)}


def wired_to_plus(p: dict) -> str:
    """The letter of the electrode joined to the battery's + side: the anode."""
    return p["letters"][0] if p["plus"] == "left" else p["letters"][1]


def draw(p: dict):
    label, material, *_ = ELECTROLYTES[p["electrolyte"]]
    fig, ax = new_figure(4.6, 4.6)
    ax.add_patch(Rectangle((-2, 0), 4, 1.6, facecolor="#dfe4e8", edgecolor="none"))
    ax.plot([-2, -2, 2, 2], [2.3, 0, 0, 2.3], color=INK, linewidth=1.6)
    fill = "#5b5b5b" if material == "carbon" else "#c58b5a"
    for side, x in ((0, -1.0), (1, 1.0)):
        ax.add_patch(Rectangle((x - 0.15, 0.45), 0.3, 2.25, facecolor=fill, edgecolor=INK, linewidth=1.0))
        ax.plot([x, x, -0.14 if side == 0 else 0.14], [2.7, 3.7, 3.7], color=INK, linewidth=1.2)
        ax.text(x + (-0.42 if side == 0 else 0.42), 2.15, p["letters"][side], ha="center", va="center",
                fontsize=14, fontweight="bold")
    # The cell: the long thin plate is +, the short thick one −.
    for x, plus in ((-0.14, p["plus"] == "left"), (0.14, p["plus"] == "right")):
        if plus:
            ax.plot([x, x], [3.35, 4.05], color=INK, linewidth=1.3)
        else:
            ax.plot([x, x], [3.52, 3.88], color=INK, linewidth=3.6)
        ax.text(x + (-0.22 if x < 0 else 0.22), 4.2, "+" if plus else "−", ha="center", va="center", fontsize=14)
    ax.text(0, -0.35, label, ha="center", va="top", fontsize=10)
    ax.text(0, -0.85, f"{material} electrodes", ha="center", va="top", fontsize=10)
    ax.set_xlim(-2.6, 2.6)
    ax.set_ylim(-1.35, 4.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a chemistry lesson", "at the science club", "for a class practical", "in the school laboratory", "for homework"]
WHAT_ANODE = ["it dissolves, forming copper ions", "copper is deposited on it", "oxygen bubbles off it", "hydrogen bubbles off it"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    left, right = p["letters"]
    anode = wired_to_plus(p)
    cathode = right if anode == left else left
    _, material, at_cathode, at_anode, ion = ELECTROLYTES[p["electrolyte"]]
    qs = [short(f"{who} set up this electrolysis {rng.choice(SETTINGS)}. Which electrode, {left} or {right}, is the cathode?",
                cathode, [cathode, f"electrode {cathode}"]),
          short(f"Name the product at electrode {cathode}.", at_cathode, PRODUCT_FORMS[at_cathode])]
    if at_anode is None:
        qs.append(mcq(f"{friend} weighs the electrodes afterwards. What happens to electrode {anode}?", WHAT_ANODE[0], WHAT_ANODE[1:], rng))
    else:
        qs.append(short(f"{friend} tests what forms at electrode {anode}. Name the product at electrode {anode}.", at_anode,
                        PRODUCT_FORMS[at_anode]))
    body, charge = ion[:-2] if ion[-2].isdigit() else ion[:-1], ion[-2:] if ion[-2].isdigit() else ion[-1:]
    qs.append(short("Which ion is discharged at the cathode?", body + sup(charge), formula_forms(body, charge)))
    return qs
