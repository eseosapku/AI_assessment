"""Gibbs free energy (UP, AL): two kinds of figure for the feasibility of a reaction, with ΔG = ΔH − TΔS printed.

- line: ΔG of reaction R plotted against temperature from 0 K as a straight line on a grid; ΔH is where the line meets
  T = 0 and the line crosses ΔG = 0 at a gridline. Asks the temperature above (or below) which R is feasible (feasible
  when ΔG is negative, printed), ΔG at a marked temperature, ΔH, and ΔS from the gradient (ΔS = −gradient, in
  J K⁻¹ mol⁻¹, every value whole).
- table: a stated reaction with its ΔH printed and a table of standard entropies of its substances (data-book values,
  rounded to whole numbers: NIST-JANAF/Atkins tables as Cambridge and Rwanda S5 books print them); asks ΔS (products
  minus reactants, coefficients counted), ΔG at a stated temperature (to one decimal place, exact), and whether the
  reaction is feasible there.

No question can be answered without the figure: the reaction on the graph is unnamed, and the table's values and ΔH
are the figure's own.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, Question, exact, new_figure, short, sub

ID = "gibbs_graph"
KIND = "graph.line"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = ("chemistry.entropy", "chemistry.gibbs-free-energy")
# A topic whose sections the book lists is reached only if one names entropy, free energy or feasibility.
NEEDS = r"entrop|gibbs|free energy|feasib|spontan"
# The NERDC and JAMB "Equilibrium" topics list no sections and teach equilibrium, not feasibility.
AVOID = r"^equilibrium$|states of matter|phase|electrochem|redox|conjugate|reversible|rate"

# Standard entropies at 298 K, J K⁻¹ mol⁻¹, rounded to whole numbers.
ENTROPY = {"N2(g)": 192, "H2(g)": 131, "NH3(g)": 192, "CaCO3(s)": 93, "CaO(s)": 40, "CO2(g)": 214, "Mg(s)": 33,
           "O2(g)": 205, "MgO(s)": 27, "H2O(l)": 70, "H2O(g)": 189, "N2O4(g)": 304, "NO2(g)": 240, "CH4(g)": 186,
           "SO2(g)": 248, "SO3(g)": 257, "NH4Cl(s)": 95, "HCl(g)": 187}
# reaction: (reactants [(coefficient, substance)], products, ΔH in kJ mol⁻¹)
REACTIONS = {
    "ammonia": ([(1, "N2(g)"), (3, "H2(g)")], [(2, "NH3(g)")], -92),
    "limestone": ([(1, "CaCO3(s)")], [(1, "CaO(s)"), (1, "CO2(g)")], 178),
    "magnesium": ([(2, "Mg(s)"), (1, "O2(g)")], [(2, "MgO(s)")], -1204),
    "water": ([(2, "H2(g)"), (1, "O2(g)")], [(2, "H2O(l)")], -572),
    "boiling": ([(1, "H2O(l)")], [(1, "H2O(g)")], 44),
    "dinitrogen": ([(1, "N2O4(g)")], [(2, "NO2(g)")], 58),
    "methane": ([(1, "CH4(g)"), (2, "O2(g)")], [(1, "CO2(g)"), (2, "H2O(l)")], -890),
    "sulfur": ([(2, "SO2(g)"), (1, "O2(g)")], [(2, "SO3(g)")], -198),
    "chloride": ([(1, "NH4Cl(s)")], [(1, "NH3(g)"), (1, "HCl(g)")], 176),
}
# The temperatures asked for each reaction: where its substances are in the states written (a liquid stays near room
# temperature, magnesium below its melting point).
TEMPS = {"ammonia": range(200, 1001, 100), "limestone": range(300, 1501, 100), "magnesium": range(200, 901, 100),
         "water": [300], "boiling": [300], "dinitrogen": range(200, 801, 100), "methane": [300],
         "sulfur": range(300, 1201, 100), "chloride": range(300, 1001, 100)}


def delta_s(reaction: str) -> int:
    left, right, _ = REACTIONS[reaction]
    return sum(k * ENTROPY[s] for k, s in right) - sum(k * ENTROPY[s] for k, s in left)


def delta_g(reaction: str, T: int) -> Fraction:
    return REACTIONS[reaction][2] - Fraction(T * delta_s(reaction), 1000)


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.55:
        m = rng.randint(3, 8)  # the line crosses ΔG = 0 at m hundred kelvin
        g = rng.choice([10, 20, 25, 30, 40, 50])  # kJ mol⁻¹ per gridline
        top = rng.randint(m + 2, min(10, m + 4))
        ask = rng.choice([k for k in range(1, top + 1) if k != m])
        return {"band": band, "kind": "line", "m": m, "g": g, "sign": rng.choice([1, -1]), "top": top, "ask": ask,
                "label": rng.choice("RPQX")}
    reaction = rng.choice(sorted(REACTIONS))
    T = rng.choice([t for t in TEMPS[reaction] if abs(delta_g(reaction, t)) >= 5])
    return {"band": band, "kind": "table", "reaction": reaction, "T": T}


def line_values(p: dict) -> tuple[int, int, int]:
    """ΔH (kJ mol⁻¹), ΔS (J K⁻¹ mol⁻¹) and the crossing temperature (K) of the line kind."""
    return p["sign"] * p["m"] * p["g"], p["sign"] * 10 * p["g"], 100 * p["m"]


# --- drawing ------------------------------------------------------------------------------------------------------

def printed(s: str) -> str:
    return sub(s)


def _equation(reaction: str) -> str:
    left, right, _ = REACTIONS[reaction]
    side = lambda xs: " + ".join((f"{k}" if k > 1 else "") + printed(s) for k, s in xs)  # noqa: E731
    return f"{side(left)} → {side(right)}"


def _draw_line(p: dict):
    dh, ds, cross = line_values(p)
    g, top = p["g"], p["top"]
    end_g = dh - top * 100 * ds // 1000
    lo, hi = min(dh, end_g) - g, max(dh, end_g) + g
    fig, ax = new_figure(6.8, 5.0)
    ax.set_xlim(0, top * 100)
    ax.set_ylim(lo, hi)
    ax.set_xticks(range(0, top * 100 + 1, 100))
    ax.set_yticks(range(lo, hi + 1, g))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.plot([0, top * 100], [0, 0], color=INK, linewidth=1.0)
    ax.plot([0, top * 100], [dh, end_g], color=INK, linewidth=2.0, gid="line")
    ax.set_xlabel("Temperature, T (K)")
    ax.set_ylabel("ΔG (kJ mol⁻¹)")
    ax.tick_params(labelsize=8.5)
    ax.set_title(f"ΔG of reaction {p['label']} at different temperatures\nΔG = ΔH − TΔS;  a reaction is feasible when ΔG is "
                 "negative", fontsize=10.5, loc="left")
    return fig


def _draw_table(p: dict):
    reaction = p["reaction"]
    left, right, dh = REACTIONS[reaction]
    names = [s for _, s in left] + [s for _, s in right]
    fig, ax = new_figure(6.6, 4.8)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    ax.text(0.05, 0.9, _equation(reaction), ha="left", va="center", fontsize=12, fontweight="bold")
    ax.text(0.05, 0.3, f"ΔH = {'+' if dh > 0 else '−'}{abs(dh)} kJ mol⁻¹", ha="left", va="center", fontsize=11,
            gid="dh")
    widths = [3.6, 4.4]
    xs = [0.0, widths[0], sum(widths)]
    top, head_h, row_h = -0.3, 0.9, 0.58
    ys = [top, top - head_h] + [top - head_h - row_h * (k + 1) for k in range(len(names))]
    for y in ys:
        ax.plot([0, xs[-1]], [y, y], color=INK, linewidth=1.1 if y in (ys[0], ys[1], ys[-1]) else 0.7)
    for x in xs:
        ax.plot([x, x], [ys[0], ys[-1]], color=INK, linewidth=0.8)
    ax.text(xs[0] + widths[0] / 2, top - head_h / 2, "Substance", ha="center", va="center", fontsize=10.5, fontweight="bold")
    ax.text(xs[1] + widths[1] / 2, top - head_h / 2, "Standard entropy\n(J K⁻¹ mol⁻¹)", ha="center", va="center",
            fontsize=10.5, fontweight="bold")
    for i, s in enumerate(names):
        y = top - head_h - row_h * (i + 0.5)
        ax.text(xs[0] + widths[0] / 2, y, printed(s), ha="center", va="center", fontsize=10.5)
        ax.text(xs[1] + widths[1] / 2, y, str(ENTROPY[s]), ha="center", va="center", fontsize=10.5, gid=f"S:{s}")
    notes = ["ΔS = total entropy of products − total entropy of reactants",
             "(each entropy times the number of moles in the equation)",
             "ΔG = ΔH − TΔS, with ΔS changed to kJ K⁻¹ mol⁻¹ (÷ 1000)",
             "A reaction is feasible when ΔG is negative."]
    y = ys[-1] - 0.5
    for n in notes:
        ax.text(0.05, y, n, ha="left", va="center", fontsize=10.5)
        y -= 0.45
    ax.set_xlim(-0.2, 12.6)
    ax.set_ylim(y, 1.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_line(p) if p["kind"] == "line" else _draw_table(p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a chemistry lesson", "for homework", "on a revision card", "at the science club in Huye",
            "while revising in Kigali", "for a class test in Musanze", "in a lesson on entropy"]
FEASIBLE = ["feasible: ΔG is negative", "feasible: ΔG is positive", "not feasible: ΔG is positive",
            "not feasible: ΔG is negative"]


def signed_forms(v, unit_forms) -> tuple[str, list[str]]:
    """A signed value: "-40" and "−40", "+40" and "40", each bare and with its units."""
    x = exact(v)
    bare = [x]
    if x.startswith("-"):
        bare.append("−" + x[1:])
    elif x != "0":
        bare.append("+" + x)
    forms = list(bare)
    for b in bare:
        for u in unit_forms:
            forms.append(f"{b} {u}")
            forms.append(f"{b}{u}")
    out = []
    for f in forms:
        if f not in out:
            out.append(f)
    return x, out


KJ = ["kJ mol⁻¹", "kJ/mol", "kJ mol-1", "kJ"]
JK = ["J K⁻¹ mol⁻¹", "J/K/mol", "J K-1 mol-1", "J/(K mol)", "J mol⁻¹ K⁻¹"]


def _questions_line(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    dh, ds, cross = line_values(p)
    side = "above" if p["sign"] > 0 else "below"
    L = p["label"]
    qs = [short(f"{who} plotted ΔG against temperature for reaction {L} {rng.choice(SETTINGS)}. {side.capitalize()} what "
                f"temperature is reaction {L} feasible, in K?", cross, [str(cross), f"{cross} K", f"{cross}K",
                                                                        f"{cross} kelvin"])]
    T = 100 * p["ask"]
    key, forms = signed_forms(Fraction(dh) - Fraction(T * ds, 1000), KJ)
    qs.append(short(f"What is ΔG for reaction {L} at {T} K, in kJ mol⁻¹?", key, forms))
    key, forms = signed_forms(dh, KJ)
    qs.append(short(f"{friend} reads the graph where T = 0. What is ΔH for reaction {L}, in kJ mol⁻¹?", key, forms))
    key, forms = signed_forms(ds, JK)
    qs.append(short(f"Using the gradient of the line, what is ΔS for reaction {L}, in J K⁻¹ mol⁻¹?", key, forms))
    return qs


def _questions_table(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    reaction, T = p["reaction"], p["T"]
    key, forms = signed_forms(delta_s(reaction), JK)
    qs = [short(f"{who} looks up the standard entropies in the table {rng.choice(SETTINGS)}. What is ΔS for the reaction "
                f"{_equation(reaction)}, in J K⁻¹ mol⁻¹?", key, forms)]
    g = delta_g(reaction, T)
    key, forms = signed_forms(g, KJ)
    qs.append(short(f"{friend} uses ΔG = ΔH − TΔS. What is ΔG for the reaction at {T} K, in kJ mol⁻¹?", key, forms))
    good = FEASIBLE[0] if g < 0 else FEASIBLE[2]
    options = list(FEASIBLE)
    rng.shuffle(options)
    qs.append(Question("mcq", f"Is the reaction feasible at {T} K?", str(options.index(good)), options))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    return _questions_line(p, rng) if p["kind"] == "line" else _questions_table(p, rng)
