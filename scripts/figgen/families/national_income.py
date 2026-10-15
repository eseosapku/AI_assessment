"""National income by expenditure (UP): a table of an economy's spending in one year, in billions of Rwandan francs:
consumer spending (C), investment (I), government spending (G), exports (X) and imports (M). GDP by the
expenditure method, with its formula in the stem; net exports, which are often negative, as Rwanda's are; and GDP
per head for a population stated in the stem.

The figures are of a size Rwanda's accounts have (GDP of some ten to twenty thousand billion francs), but the table
names no country and no year, so they are never passed off as a real record. GDP per head is a whole number of
francs: the population is a whole or half million and GDP is chosen from GDP per head.
"""
from __future__ import annotations

import random

from ..core import NAMES, money, num, short
from .econ_tables import frw, titled_table

ID = "national_income"
KIND = "business.document"
SUBJECT = "economics"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same layout in Cambridge AS Level, where the chapter is named for it
CONCEPTS = tuple(f"economics.{c}" for c in ("gdp-gni", "national-income-measurement", "national-income-statistics",
                                            "national-income"))
AVOID = r"nigeria|excludab"  # another country's economy; public goods, whose sections only cite a GDP table
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"national income|\bGDP\b|gross domestic|national product"

ITEMS = [("Consumer spending (C)", "C"), ("Investment (I)", "I"), ("Government spending (G)", "G"),
         ("Exports (X)", "X"), ("Imports (M)", "M")]


def _tens(rng: random.Random, gdp: int, lo: float, hi: float) -> int:
    return 10 * rng.randint(int(gdp * lo) // 10 + 1, int(gdp * hi) // 10)


def sample(rng: random.Random) -> dict:
    while True:
        halves = rng.randint(20, 32)  # the population in half millions: 10 to 16 million
        head = 20000 * rng.randint(35, 70)  # GDP per head, 700 000 to 1 400 000 Frw
        gdp = head * halves // 2000  # billions of Frw: a multiple of 10
        nx = _tens(rng, gdp, -0.25, 0.05)
        m = _tens(rng, gdp, 0.2, 0.35)
        x = m + nx
        g = _tens(rng, gdp, 0.1, 0.2)
        i = _tens(rng, gdp, 0.15, 0.3)
        c = gdp - i - g - nx
        values = [c, i, g, x, m]
        if nx == 0 or x < 0.1 * gdp or not 0.6 * gdp <= c <= 0.9 * gdp or len(set(values)) < 5:
            continue
        return {"band": "UP", "C": c, "I": i, "G": g, "X": x, "M": m, "pop": halves / 2}


def draw(p: dict):
    rows = [[label, frw(p[k])] for label, k in ITEMS]
    return titled_table("National expenditure for one year", ["Item", "Billion Frw"], rows, ["l", "r"], least=1.4)


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club"]
READS = ["reads", "finds", "is told", "notes"]


def _billions(v: int) -> list[str]:
    """A number of billions of francs, negative or not, in the forms a student may write."""
    shown = frw(abs(v))
    out = []
    for sign in (["-", "−"] if v < 0 else [""]):
        for n in (str(abs(v)), shown, f"{abs(v):,}"):
            for unit in ("", " billion", " billion Frw", " bn", " billion francs"):
                form = f"{sign}{n}{unit}"
                if form not in out:
                    out.append(form)
    return out


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    gdp = p["C"] + p["I"] + p["G"] + p["X"] - p["M"]
    nx = p["X"] - p["M"]
    pop = num(p["pop"])
    head = gdp * 1000 * 2 // round(p["pop"] * 2)
    return [
        short(f"{who} {rng.choice(VERBS)} these national accounts {rng.choice(SETTINGS)}. GDP = C + I + G + (X − M). What is "
              "GDP by the expenditure method, in billions of Frw?", gdp, _billions(gdp)),
        short("What are net exports (X − M), in billions of Frw?", nx, _billions(nx)),
        short(f"{friend} {rng.choice(READS)} that the population is {pop} million. What is GDP per head, in Frw?", head,
              money(head)),
    ]
