"""Weighted price index (UP): a household basket of three or four goods bought in Rwanda (rice, beans, charcoal, a bus
fare), each with its weight and its price in francs in a base year and a later year. One good's price index, the
weighted price index (base year = 100) to one decimal place, and the rate of inflation between the two years.

The method is the one Rwandan and Cambridge textbooks teach, stated in the stem: a good's price index is its price
now ÷ its base-year price × 100, and the weighted index is the sum of weight × price index ÷ the sum of the
weights. Every price index is a whole number and the weighted index exact to one decimal place.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, short
from .econ_tables import frw, titled_table

ID = "price_index"
KIND = "business.document"
SUBJECT = "economics"
BANDS = ("UP",)
# The same weighted index in Cambridge AS Level's chapters on price stability, which measure inflation with it (P4).
ALSO_BANDS = {"UP": ("AL",)}
CONCEPTS = tuple(f"economics.{c}" for c in ("index-numbers-and-measurement", "inflation-measurement", "price-index",
                                            "price-level-measurement"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"price ind|index|inflation|cost of living|consumer price|price stability"

# item, sold per, base-year prices it may have (Frw)
BASKET = [
    ("rice", "1 kg", [1000, 1100, 1200, 1300, 1400]),
    ("beans", "1 kg", [600, 700, 800, 900, 1000]),
    ("maize flour", "1 kg", [500, 600, 700, 800]),
    ("milk", "1 litre", [400, 500, 600]),
    ("cooking oil", "1 litre", [2000, 2400, 2500, 3000]),
    ("charcoal", "1 sack", [10000, 12000, 15000, 20000]),
    ("bus fare", "1 trip", [300, 400, 500]),
    ("sugar", "1 kg", [1000, 1200, 1400, 1500]),
    ("soap", "1 bar", [500, 600, 800]),
    ("rent", "1 month", [40000, 50000, 60000, 80000]),
]
CHANGES = [90, 95, 105, 110, 115, 120, 125, 130, 140, 150]  # a good's price index; never 100
TOWNS = ["Huye", "Musanze", "Rubavu", "Nyagatare", "Kigali", "Muhanga", "Rusizi", "Rwamagana"]


def _index(goods: list) -> Fraction:
    return sum(Fraction(w * p1 * 100, p0) for _, _, w, p0, p1 in goods) / sum(w for _, _, w, _, _ in goods)


def sample(rng: random.Random) -> dict:
    while True:
        k = rng.choice([3, 4])
        items = rng.sample(BASKET, k)
        total = rng.choice([10, 100])
        if total == 10:
            cuts = sorted(rng.sample(range(1, 10), k - 1))
            weights = [b - a for a, b in zip([0] + cuts, cuts + [10])]
        else:
            cuts = sorted(rng.sample(range(1, 20), k - 1))
            weights = [5 * (b - a) for a, b in zip([0] + cuts, cuts + [20])]
        goods = []
        for (name, per, prices), w in zip(items, weights):
            p0 = rng.choice(prices)
            r = rng.choice(CHANGES)
            goods.append([name, per, w, p0, p0 * r // 100])
        if any(p1 % 10 for _, _, _, _, p1 in goods):  # prices in tens of francs, as a shop marks them
            continue
        index = _index(goods)
        if (index * 10).denominator != 1 or not 101 <= index <= 140:
            continue
        base = rng.randint(2017, 2021)
        return {"band": "UP", "town": rng.choice(TOWNS), "base": base, "year": base + rng.choice([2, 3, 4, 5]),
                "goods": goods, "ask": rng.randrange(k)}


def draw(p: dict):
    heads = ["Item", "Weight", f"Price in {p['base']}\n(Frw)", f"Price in {p['year']}\n(Frw)"]
    rows = [[f"{g.capitalize()} ({per})", str(w), frw(p0), frw(p1)] for g, per, w, p0, p1 in p["goods"]]
    return titled_table(f"Prices paid by a household in {p['town']}", heads, rows, ["l", "c", "r", "r"], least=0.9)


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    base, year = p["base"], p["year"]
    name, _, _, p0, p1 = p["goods"][p["ask"]]
    rel = p1 * 100 // p0
    index = _index(p["goods"])
    key = f"{float(index):.1f}"
    rate = f"{float(index - 100):.1f}"
    return [
        short(f"{who} {rng.choice(VERBS)} the prices a household in {p['town']} pays {rng.choice(SETTINGS)}. A good's price "
              f"index = its price in {year} ÷ its price in {base} × 100. What is the price index for {name} in {year}?",
              rel, [str(rel)]),
        short("The weighted price index = the sum of (weight × each good's price index) ÷ the sum of the weights. What is "
              f"the weighted price index for {year}, with {base} = 100, to one decimal place?", key, [key]),
        short(f"What is the rate of inflation between {base} and {year} shown by this index, as a percentage to one decimal "
              "place?", f"{rate}%", [rate, f"{rate} %", f"{rate} per cent", f"{rate} percent"]),
    ]
