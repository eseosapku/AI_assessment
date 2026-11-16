"""Born–Haber cycles (AL): the cycle for a Group 1 or Group 2 halide drawn as an energy-level diagram (not to scale),
every level a line with its species written on it, every step an arrow lettered in a circle with its enthalpy change
in kJ mol⁻¹ beside it, and one value replaced by ?.

The up steps (atomising the metal and the halogen, ionising the metal, in one of two textbook orders) climb one
column; electron gain and the lattice energy fall in a second column; the enthalpy change of formation falls on the
left from the elements to the solid. Asks the value marked ? (Hess's law: formation = the sum of the other route's
steps), which letter shows a named step, and the total enthalpy change from the elements to the gaseous ions.

Data: one data-book set (Cambridge/NIST values, kJ mol⁻¹): atomisation Li +159, Na +107, K +89, Mg +148, Ca +178;
F +79, Cl +122, Br +112 (from Br₂(l)), I +107 (from I₂(s)); first ionisation energies Li 520, Na 496, K 419, Mg 738,
Ca 590, second Mg 1451, Ca 1145; first electron affinities F −328, Cl −349, Br −325, I −295; formation enthalpies
below. The lattice energy is worked from these, so the cycle always closes.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, exact, new_figure, short, sub, sup
from ._bio_parts import letter_choice

ID = "born_haber"
KIND = "chem.energy"
SUBJECT = "chemistry"
BANDS = ("AL",)
CONCEPTS = tuple(f"chemistry.{c}" for c in ("hess-law", "ionization-energy", "enthalpy-changes"))
# Only topics that name lattice energy or the Born–Haber cycle.
NEEDS = r"lattice|born.haber"
AVOID = r"electrochem|redox|rate|equilibri|entropy"

# metal: (name, enthalpy change of atomisation, ionisation energies)
METALS = {"Li": ("lithium", 159, [520]), "Na": ("sodium", 107, [496]), "K": ("potassium", 89, [419]),
          "Mg": ("magnesium", 148, [738, 1451]), "Ca": ("calcium", 178, [590, 1145])}
# halogen: (name, ion name, state of the element, enthalpy change of atomisation, first electron affinity)
HALOGENS = {"F": ("fluorine", "fluoride", "g", 79, -328), "Cl": ("chlorine", "chloride", "g", 122, -349),
            "Br": ("bromine", "bromide", "l", 112, -325), "I": ("iodine", "iodide", "s", 107, -295)}
# compound: (metal, halogen, enthalpy change of formation)
COMPOUNDS = {"NaCl": ("Na", "Cl", -411), "KCl": ("K", "Cl", -437), "NaBr": ("Na", "Br", -361), "KBr": ("K", "Br", -394),
             "LiF": ("Li", "F", -616), "LiCl": ("Li", "Cl", -409), "KF": ("K", "F", -567), "NaI": ("Na", "I", -288),
             "KI": ("K", "I", -328), "MgCl2": ("Mg", "Cl", -641), "CaCl2": ("Ca", "Cl", -796), "MgF2": ("Mg", "F", -1124),
             "MgBr2": ("Mg", "Br", -524), "CaBr2": ("Ca", "Br", -683)}
STEP_NAMES = {"atM": "atomisation of the metal", "atX": "atomisation of the halogen", "ie1": "first ionisation energy",
              "ie2": "second ionisation energy", "ea": "electron affinity", "latt": "lattice energy",
              "hf": "enthalpy change of formation"}
FIRSTS = ["A", "J", "P"]


def sample(rng: random.Random) -> dict:
    compound = rng.choice(sorted(COMPOUNDS))
    n = len(METALS[COMPOUNDS[compound][0]][2])
    blanks = ["latt", "latt", "hf", "ea", "ie1", "atM", "atX"] + (["ie2"] if n == 2 else [])
    asks = ["ie1", "latt", "ea", "atM", "atX", "hf"] + (["ie2"] if n == 2 else [])
    return {"band": "AL", "compound": compound, "order": rng.choice(["atomise", "ionise"]), "blank": rng.choice(blanks),
            "first": rng.choice(FIRSTS), "ask": rng.choice(asks)}


def compound_name(compound: str) -> str:
    M, X, _ = COMPOUNDS[compound]
    return f"{METALS[M][0]} {HALOGENS[X][1]}"


def steps(p: dict) -> list[tuple[str, int]]:
    """The indirect route's steps in order, (step, enthalpy change); the lattice energy closes the cycle."""
    M, X, hf = COMPOUNDS[p["compound"]]
    _, atm, ies = METALS[M]
    _, _, _, atx, ea = HALOGENS[X]
    n = len(ies)
    ionise = [("ie1", ies[0])] + ([("ie2", ies[1])] if n == 2 else [])
    up = [("atM", atm), ("atX", n * atx)] + ionise if p["order"] == "atomise" else [("atM", atm)] + ionise + [("atX", n * atx)]
    route = up + [("ea", n * ea)]
    return route + [("latt", hf - sum(v for _, v in route))]


def letters(p: dict) -> dict[str, str]:
    """Each step's letter: the route's steps in order, then the formation arrow."""
    start = ord(p["first"])
    names = [s for s, _ in steps(p)] + ["hf"]
    return {s: chr(start + k) for k, s in enumerate(names)}


def _species(p: dict) -> list[str]:
    """The species on each level: the elements, after each step of the route, and the solid."""
    M, X, _ = COMPOUNDS[p["compound"]]
    n = len(METALS[M][2])
    state = HALOGENS[X][2]
    half = "½" if n == 1 else ""
    halogen = f"{half}{X}₂({state})"
    atoms = f"{'2' if n == 2 else ''}{X}(g)"
    out = [f"{M}(s) + {halogen}"]
    metal, electrons, other = f"{M}(g)", "", halogen
    for s, _ in steps(p):
        if s == "atM":
            metal = f"{M}(g)"
        elif s == "atX":
            other = atoms
        elif s == "ie1":
            metal, electrons = f"{M}{sup('+')}(g)", " + e⁻"
        elif s == "ie2":
            metal, electrons = f"{M}{sup('2+')}(g)", " + 2e⁻"
        elif s == "ea":
            electrons, other = "", f"{'2' if n == 2 else ''}{X}{sup('-')}(g)"
        if s == "latt":
            out.append(sub(p["compound"]) + "(s)")
        else:
            out.append(f"{metal}{electrons} + {other}")
    return out


def signed(v: int) -> str:
    return f"+{v}" if v > 0 else f"−{abs(v)}"


# --- drawing ------------------------------------------------------------------------------------------------------

XA, XB, XC = 0.3, 3.2, 5.3  # the formation arrow, the climbing column, the falling column
GAP = 0.62  # the least height between two levels


def layout(p: dict) -> dict:
    """Each level's energy and height: in energy order, at least GAP apart, otherwise to scale."""
    route = steps(p)
    energies = [0]
    for _, v in route:
        energies.append(energies[-1] + v)
    order = sorted(range(len(energies)), key=lambda i: energies[i])
    span = max(energies) - min(energies)
    scale = 4.6 / span
    ys = {}
    y = 0.0
    for k, i in enumerate(order):
        if k:
            y += max(GAP, scale * (energies[i] - energies[order[k - 1]]))
        ys[i] = y
    return {"energies": energies, "ys": [ys[i] for i in range(len(energies))]}


def _arrow(ax, x, y0, y1, gid):
    ax.annotate("", xy=(x, y1), xytext=(x, y0), gid=gid,
                arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.4, shrinkA=0, shrinkB=0, mutation_scale=14))


def _tag(ax, x, y, letter, value, gid, right=True):
    ax.text(x, y, letter, ha="center", va="center", fontsize=10, fontweight="bold", gid=f"letter:{gid}",
            bbox=dict(boxstyle="circle,pad=0.18", facecolor="white", edgecolor=INK, linewidth=0.9))
    ax.text(x + (0.26 if right else -0.26), y, value, ha="left" if right else "right", va="center", fontsize=10.5,
            gid=f"value:{gid}")


def draw(p: dict):
    route = steps(p)
    lay = layout(p)
    ys = lay["ys"]
    names = _species(p)
    let = letters(p)
    blank = p["blank"]
    M, X, hf = COMPOUNDS[p["compound"]]
    n_up = next(k for k, (s, _) in enumerate(route) if s == "ea")
    top_level = n_up  # the level reached by the last climbing step
    y_lo, y_hi = min(ys), max(ys)
    fig, ax = new_figure(8.0, 7.4)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    # levels: the elements and every climbing level span the left part; the top one reaches the falling column
    left_end = -2.0
    for i in range(top_level + 1):
        x1 = XC + 0.3 if i == top_level else XB + 0.3
        ax.plot([left_end if i else XA - 0.3, x1], [ys[i], ys[i]], color=INK, linewidth=1.5, gid=f"level:{i}")
        ax.text(XB - 0.15, ys[i] + 0.09, names[i], ha="right", va="bottom", fontsize=10.5, gid=f"species:{i}")
    ea_level = top_level + 1
    ax.plot([XC - 0.3, XC + 2.6], [ys[ea_level], ys[ea_level]], color=INK, linewidth=1.5, gid=f"level:{ea_level}")
    ax.text(XC + 0.2, ys[ea_level] - 0.1, names[ea_level], ha="left", va="top", fontsize=10.5, gid=f"species:{ea_level}")
    solid = ea_level + 1
    ax.plot([XA - 0.3, XC + 0.3], [ys[solid], ys[solid]], color=INK, linewidth=1.5, gid=f"level:{solid}")
    ax.text((XA + XC) / 2, ys[solid] - 0.12, names[solid], ha="center", va="top", fontsize=10.5, fontweight="bold",
            gid=f"species:{solid}")
    # arrows
    for k, (s, v) in enumerate(route):
        x = XB if k < n_up else XC
        _arrow(ax, x, ys[k], ys[k + 1], f"arrow:{s}")
        _tag(ax, x + 0.32, (ys[k] + ys[k + 1]) / 2, let[s], "?" if s == blank else signed(v), s)
    _arrow(ax, XA, ys[0], ys[solid], "arrow:hf")
    _tag(ax, XA + 0.32, (ys[0] + ys[solid]) / 2, let["hf"], "?" if blank == "hf" else signed(hf), "hf")
    ax.text(left_end, y_hi + 1.5, f"Born–Haber cycle for {compound_name(p['compound'])} (not to scale)", ha="left",
            va="center", fontsize=11.5, fontweight="bold")
    ax.text(left_end, y_hi + 1.08, "Enthalpy changes in kJ mol⁻¹. Lattice energy: the enthalpy change when one mole of the",
            ha="left", va="center", fontsize=9.5)
    ax.text(left_end, y_hi + 0.78, "solid forms from its gaseous ions.", ha="left", va="center", fontsize=9.5)
    ax.set_xlim(left_end - 0.1, XC + 2.8)
    ax.set_ylim(y_lo - 0.6, y_hi + 1.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a lesson on lattice energy", "for homework", "on a revision card", "while revising for a test in Kigali",
            "at the science club in Huye", "for a class test in Musanze"]


def _kj(v: int) -> tuple[str, list[str]]:
    x = str(v)
    bare = [x] + (["−" + x[1:]] if v < 0 else ["+" + x])
    forms = list(bare)
    for b in bare:
        for u in ("kJ mol⁻¹", "kJ/mol", "kJ mol-1", "kJ"):
            forms += [f"{b} {u}", f"{b}{u}"]
    return x, forms


def _named(p: dict, step: str) -> str:
    M, X, _ = COMPOUNDS[p["compound"]]
    metal, halogen = METALS[M][0], HALOGENS[X][0]
    n = len(METALS[M][2])
    return {"ie1": f"the first ionisation energy of {metal}", "ie2": f"the second ionisation energy of {metal}",
            "latt": f"the lattice energy of {compound_name(p['compound'])}",
            "ea": f"the step in which {halogen} atoms gain electrons" if n == 2 else f"the first electron affinity of {halogen}",
            "atM": f"the enthalpy change of atomisation of {metal}",
            "atX": f"the step in which {halogen} becomes gaseous atoms",
            "hf": f"the enthalpy change of formation of {compound_name(p['compound'])}"}[step]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    route = steps(p)
    let = letters(p)
    M, X, hf = COMPOUNDS[p["compound"]]
    values = dict(route)
    values["hf"] = hf
    blank = p["blank"]
    key, forms = _kj(values[blank])
    qs = [short(f"{who} drew this Born–Haber cycle for {compound_name(p['compound'])} {rng.choice(SETTINGS)}. "
                f"What is the enthalpy change of step {let[blank]}, marked ?, in kJ mol⁻¹?", key, forms)]
    ask = p["ask"]
    others = [L for s, L in let.items() if s != ask]
    qs.append(letter_choice(f"Which letter shows {_named(p, ask)}?", let[ask], rng.sample(others, len(others))))
    ions = hf - values["latt"]
    n = len(METALS[M][2])
    ion_text = f"{M}{sup('+' if n == 1 else '2+')}(g) + {'2' if n == 2 else ''}{X}{sup('-')}(g)"
    key, forms = _kj(ions)
    qs.append(short(f"Use the cycle to find the total enthalpy change from the elements to the gaseous ions, {ion_text}, "
                    "in kJ mol⁻¹.", key, forms))
    return qs
