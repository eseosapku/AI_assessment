"""pH curves (UP, AL): the pH as an alkali is added to an acid, solved from the charge balance: a strong acid
with sodium hydroxide, a weak acid (ethanoic, methanoic, propanoic) with sodium hydroxide, and at AL a
strong acid with aqueous ammonia. The equivalence volume, the starting pH, whether the acid is strong or
weak, an indicator whose colour change lies inside the jump, and at AL the pKa from the half-way point.

The equivalence volume is a whole number of 5 cm³ on a gridded axis; the concentrations are chosen so the
moles of acid and alkali match there exactly.
"""
from __future__ import annotations

import math
import random

from ..core import GRID, INK, NAMES, exact, mcq, measure, new_figure, short

ID = "ph_curve"
KIND = "graph.line"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("acid-base-titrations", "ph-scale", "acid-base-indicators",
                                             "weak-acids-and-bases", "acids-and-bases"))
AVOID = r"organic|alkane|electrolysis|isotope|periodic|bonding|enthalpy|rate|chromatograph|amine|analysis|environment|benzene|preparation of salts|solubility|stoichiometry|group"
KW = 1e-14
STRONG = ["hydrochloric acid", "nitric acid"]
WEAK = {"ethanoic acid": 4.76, "methanoic acid": 3.75, "propanoic acid": 4.87}
NH4 = 9.25  # pKa of the ammonium ion
# (acid concentration, acid volume, alkali concentration): the equivalence volume Ca·Va/Cb a multiple of 5 from 10 to 40
COMBOS = [(ca, va, cb) for ca in (0.05, 0.1, 0.2) for va in (10, 20, 25) for cb in (0.05, 0.1, 0.2, 0.25)
          if abs(ca * va / cb - round(ca * va / cb / 5) * 5) < 1e-9 and 10 <= ca * va / cb <= 40]
INDICATORS = {  # name and the pH range of its colour change
    "phenolphthalein": (8.3, 10.0), "methyl orange": (3.1, 4.4), "thymol blue": (1.2, 2.8),
    "bromocresol green": (3.8, 5.4), "methyl red": (4.4, 6.2), "alizarin yellow": (10.1, 12.0),
    "thymol blue (its second change)": (8.0, 9.6),
}
CHOICES = {"weak-strong": ("phenolphthalein", ["methyl orange", "thymol blue", "bromocresol green"]),
           "strong-weak": ("methyl red", ["phenolphthalein", "alizarin yellow", "thymol blue (its second change)"])}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = rng.choice(["strong-strong", "weak-strong"] + (["strong-weak"] if band == "AL" else []))
    ca, va, cb = rng.choice(COMBOS)
    acid = rng.choice(list(WEAK)) if kind == "weak-strong" else rng.choice(STRONG)
    return {"band": band, "kind": kind, "acid": acid, "Ca": ca, "Va": va, "Cb": cb, "veq": round(ca * va / cb)}


def ph(p: dict, v: float) -> float:
    """The pH after v cm³ of alkali: the [H+] that balances the charges, found by halving its range."""
    tot = p["Va"] + v
    ca, cb = p["Ca"] * p["Va"] / tot, p["Cb"] * v / tot
    ka = 10 ** -WEAK[p["acid"]] if p["kind"] == "weak-strong" else None

    def excess(h):  # positive charge minus negative: rises with [H+]
        cation = cb * h / (h + 10 ** -NH4) if p["kind"] == "strong-weak" else cb
        anion = ca * ka / (ka + h) if ka else ca
        return h + cation - anion - KW / h

    lo, hi = -15.0, 1.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if excess(10 ** mid) > 0:
            hi = mid
        else:
            lo = mid
    return -(lo + hi) / 2


def draw(p: dict):
    fig, ax = new_figure(6.4, 4.6)
    end = 5 * math.ceil(p["veq"] * 1.6 / 5)
    big, small = (5, 1) if end <= 30 else (10, 5)  # a long axis gridded every cm³ is a blur; the jump is on a 5 anyway
    ax.set_xticks(range(0, end + 1, big))
    ax.set_xticks(range(0, end + 1, small), minor=True)
    ax.set_yticks(range(0, 15, 2))
    ax.set_yticks([v / 2 for v in range(0, 29)], minor=True)  # half-pH lines to estimate between
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, end)
    ax.set_ylim(0, 14)
    vs = [end * k / 1200 for k in range(1201)]
    ax.plot(vs, [ph(p, v) for v in vs], color=INK, linewidth=1.8)
    alkali = "aqueous ammonia" if p["kind"] == "strong-weak" else "sodium hydroxide"
    ax.set_xlabel(f"Volume of {alkali} added (cm³)")
    ax.set_ylabel("pH")
    ax.tick_params(labelsize=8)
    return fig


SETTINGS = ["in a chemistry lesson", "in the school laboratory", "for a class practical", "at the science club"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    veq, kind = p["veq"], p["kind"]
    alkali = "aqueous ammonia" if kind == "strong-weak" else "sodium hydroxide solution"
    start = round(ph(p, 0), 1)
    strong = kind.startswith("strong")
    shapes = ("the pH starts low and changes little until the jump", "the pH starts higher, rises quickly, then levels off before the jump")
    options = [f"{k}: {e}" for k in ("strong", "weak") for e in shapes]
    key = f"{'strong' if strong else 'weak'}: {shapes[0] if strong else shapes[1]}"
    qs = [short(f"{who} added {alkali} to {p['Va']}.0 cm³ of {p['acid']} {rng.choice(SETTINGS)} and recorded the pH. "
                "What volume of alkali was needed to reach the equivalence point?", veq, measure(veq, "cm³") + [f"{veq}.0 cm³", f"{veq}.0"]),
          short("Estimate the pH at the start, before any alkali was added, to one decimal place.", exact(start),
                [exact(start), f"pH {exact(start)}"], tolerance=0.25),
          mcq(f"{friend} says the curve shows what kind of acid was used. Is the acid strong or weak?", key, [o for o in options if o != key], rng)]
    if kind in CHOICES:
        right, wrong = CHOICES[kind]

        def show(name):
            a, b = INDICATORS[name]
            return f"{name}, colour change at pH {a}–{b}"
        qs.append(mcq("Which indicator would show the end-point of this titration?", show(right), [show(w) for w in wrong], rng))
    else:
        qs.append(short("What is the pH at the equivalence point?", "7", ["7", "7.0", "pH 7"], tolerance=0.2))
    if p["band"] == "AL" and kind == "weak-strong" and veq % 10 == 0:
        pka = WEAK[p["acid"]]
        qs.append(short(f"Estimate the pKa of {p['acid']} from the pH when half of the acid has been neutralised, after {veq // 2} cm³.",
                        exact(round(ph(p, veq / 2), 1)), [exact(round(pka, 1)), exact(round(ph(p, veq / 2), 2))], tolerance=0.25))
    return qs
