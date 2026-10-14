"""Energy profiles (UP, AL): a reaction pathway, the energy in kJ/mol on a gridded axis, the reactants'
and products' levels flat at either end, and the path with a catalyst dashed under the hump. The enthalpy
change with its sign, the activation energy with and without the catalyst, exothermic or endothermic,
and at AL the activation energy of the reverse reaction.

Every level sits on a gridline; the catalysed peak lies between the higher of the two levels and the
uncatalysed peak, so each energy reads exactly.
"""
from __future__ import annotations

import math
import random

from ..core import GRID, INK, NAMES, mcq, measure, new_figure, short

ID = "energy_profile"
KIND = "chem.energy"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("enthalpy-changes", "bond-energy", "catalysis", "thermochemistry"))
AVOID = r"organic|alkane|electrolysis|titration|isotope|periodic|bonding-ionic|chromatograph|group|lattice|redox|transition|states of matter|alcohol|benzene|bond|experimental|fertili|npk|phase|stoichiometry|quantitative chemical equilibrium"
def sample(rng: random.Random) -> dict:
    # No named reaction: a real one's enthalpy change would not match the made-up levels.
    exo = rng.random() < 0.5
    step = rng.choice([10, 20, 25, 50])
    if exo:
        r = rng.randint(4, 7)
        pr = rng.randint(1, r - 2)
        peak = rng.randint(r + 3, r + 6)
        low = r
    else:
        r = rng.randint(1, 4)
        pr = rng.randint(r + 2, r + 5)
        peak = rng.randint(pr + 2, pr + 5)
        low = pr
    cat = rng.randint(low + 1, peak - 1)
    top = peak + rng.randint(1, 2)
    return {"band": rng.choice(BANDS), "step": step, "reactants": r * step, "products": pr * step,
            "peak": peak * step, "catalysed": cat * step, "top": top * step}


def _path(p: dict, peak: float, n: int = 400):
    """Flat at the reactants, a smooth hump to the peak, flat at the products."""
    r, pr = p["reactants"], p["products"]
    xs, ys = [], []
    for k in range(n + 1):
        x = 10 * k / n
        if x <= 2.5:
            y = r
        elif x <= 5:
            y = r + (peak - r) * (1 - math.cos(math.pi * (x - 2.5) / 2.5)) / 2
        elif x <= 7.5:
            y = peak - (peak - pr) * (1 - math.cos(math.pi * (x - 5) / 2.5)) / 2
        else:
            y = pr
        xs.append(x)
        ys.append(y)
    return xs, ys


def draw(p: dict):
    fig, ax = new_figure(7.4, 4.4)
    step, top = p["step"], p["top"]
    ax.set_yticks(range(0, top + 1, step))
    ax.set_ylim(0, top)
    ax.set_xlim(0, 10)
    ax.set_xticks([])
    ax.yaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    xs, ys = _path(p, p["peak"])
    ax.plot(xs, ys, color=INK, linewidth=1.8, label="without a catalyst")
    xs, ys = _path(p, p["catalysed"])
    cut = [(x, y) for x, y in zip(xs, ys) if 2.5 <= x <= 7.5]
    ax.plot([x for x, _ in cut], [y for _, y in cut], color=INK, linewidth=1.6, linestyle=(0, (5, 3)), label="with a catalyst")
    ax.text(1.25, p["reactants"] + 0.3 * step, "reactants", ha="center", va="bottom", fontsize=10)
    ax.text(8.75, p["products"] + 0.3 * step, "products", ha="center", va="bottom", fontsize=10)
    ax.set_xlabel("Progress of reaction")
    ax.set_ylabel("Energy (kJ/mol)")
    ax.tick_params(labelsize=8)
    ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), fontsize=9, frameon=False, handlelength=2.6)
    return fig


SETTINGS = ["in a chemistry lesson", "on a revision card", "for homework", "at the science club", "for a class test"]


def _kj(v: int) -> list[str]:
    forms = measure(v, "kJ/mol")
    for n in [f for f in forms if " " not in f and "kJ" not in f]:  # the bare numbers, -60 and −60
        for unit in (" kJ mol⁻¹", " kJ mol-1", " kJ"):
            if n + unit not in forms:
                forms.append(n + unit)
    if v > 0:
        forms += [f"+{f}" for f in list(forms)]
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    r, pr, peak, cat = p["reactants"], p["products"], p["peak"], p["catalysed"]
    dh = pr - r
    exo = dh < 0
    options = [f"{kind}: the products have {how} energy than the reactants" for kind in ("exothermic", "endothermic")
               for how in ("less", "more")]
    key = f"{'exothermic' if exo else 'endothermic'}: the products have {'less' if exo else 'more'} energy than the reactants"
    qs = [short(f"{who} drew the energy profile of a reaction {rng.choice(SETTINGS)}. What is the enthalpy change, ΔH, of the reaction in kJ/mol?",
                str(dh), _kj(dh)),
          short("What is the activation energy of the reaction without the catalyst, in kJ/mol?", peak - r, _kj(peak - r)),
          mcq("Is the reaction exothermic or endothermic?", key, [o for o in options if o != key], rng),
          short(f"{friend} adds a catalyst. What is the activation energy with the catalyst, in kJ/mol?", cat - r, _kj(cat - r))]
    if p["band"] == "AL":
        qs.append(short("What is the activation energy of the reverse reaction, without the catalyst, in kJ/mol?",
                        peak - pr, _kj(peak - pr)))
    return qs
