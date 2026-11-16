"""Farm production (LS, UP; P6 geography): crops and livestock on invented farms, as the Rwanda S1 "Economic
activities", S2-S3 agricultural systems and S4 "Agriculture in Rwanda" units teach farming with data.

Three sub-types:
- farms: a table of five farms in Sector Q growing one crop (maize, beans, rice, Irish potatoes, wheat or sorghum),
  each farm's area and harvest, with yield = harvest ÷ area printed. One farm's yield, the farm with the highest
  yield (never the farm with the biggest harvest), the total harvest and the total area.
- modernise: a bar chart of the maize yield on trial plots farmed in four or five ways, from local seed with no
  fertiliser to improved seed with fertiliser and irrigation, with the rule for a percentage increase printed. How
  many tonnes per hectare one way added over local seed, the percentage increase, and the harvest of a farm of a
  stated size farmed that way (harvest = yield × area, printed).
- livestock: a bar chart of the animals kept in Sector Q (cattle, goats, sheep, pigs, rabbits, chickens), with the
  small animals named in the title's note as the S4 book names them. The kind kept in the largest number, how many
  more of one kind than another, and how many small animals altogether.

Every value is printed or on a gridline, every yield exact to one decimal place, every "which" clear.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, mcq, short
from ._geo_charts import bar_chart, fr, num_forms, pct_forms
from .econ_tables import titled_table

ID = "farm_production"
KIND = "graph.bar"
SUBJECT = "geography"
BANDS = ("LS", "UP")
MORE = {"farms": ("geography.agricultural-yields", "geography.subsistence-farming"),
        "modernise": ("geography.agriculture-modernisation", "geography.agricultural-yields"),
        "livestock": ("geography.livestock-farming", "geography.small-animal-keeping")}
CONCEPTS = ("geography.agricultural-yields", "geography.subsistence-farming", "geography.agriculture-modernisation",
            "geography.livestock-farming", "geography.small-animal-keeping")
# A topic whose sections the book lists is reached only if its name or a section names farming, crops, livestock or
# the economic activities.
NEEDS = r"agricultur|farming|\bcrops?\b|livestock|economic activit"
# Topics that share a farming concept but teach soils, forests, conservation or the environment.
AVOID = r"\bsoils?\b|forest|conservation|environment|fish"
SECTOR = "Sector Q"
# Each crop and the range of its yields on smallholdings, in tenths of a tonne per hectare.
CROPS = {"maize": (12, 40), "beans": (5, 15), "rice": (30, 60), "Irish potatoes": (80, 200), "wheat": (12, 30),
         "sorghum": (10, 20)}
FARMS = ["Farm A", "Farm B", "Farm C", "Farm D", "Farm E"]
# Ways of farming a maize plot, in the order the yields rise (tonnes per hectare, in tenths).
WAYS = [("Local seed, no fertiliser", (8, 14)), ("Improved seed", (16, 22)), ("Local seed with manure", (16, 22)),
        ("Improved seed with fertiliser", (26, 36)), ("Improved seed, fertiliser and irrigation", (40, 50))]
ANIMALS = ["Cattle", "Goats", "Sheep", "Pigs", "Rabbits", "Chickens"]
SMALL = {"Goats", "Sheep", "Pigs", "Rabbits", "Chickens"}


def concepts_for(p: dict) -> tuple[str, ...]:
    return MORE[p["sub"]]


def _farms(rng: random.Random, band: str) -> dict | None:
    crop = rng.choice(sorted(CROPS))
    lo, hi = CROPS[crop]
    area = [Fraction(rng.randint(2, 10), 2) for _ in FARMS]  # hectares, in halves
    yields = [Fraction(rng.randint(lo, hi), 10) for _ in FARMS]
    harvest = [a * y for a, y in zip(area, yields)]
    if any((h * 10).denominator != 1 for h in harvest) or any((y * 10).denominator != 1 for y in yields):
        return None
    best = max(range(5), key=lambda i: yields[i])
    ranked = sorted(yields, reverse=True)
    if ranked[0] - ranked[1] < Fraction(lo, 50) or best == max(range(5), key=lambda i: harvest[i]):
        return None
    if len(set(harvest)) < 5:
        return None
    return {"band": band, "sub": "farms", "crop": crop, "area": [str(a) for a in area],
            "harvest": [str(h) for h in harvest], "ask": {"yield": rng.randrange(5)}}


def _modernise(rng: random.Random, band: str) -> dict | None:
    ways = [WAYS[0]] + sorted(rng.sample(WAYS[1:], rng.randint(3, 4)), key=WAYS.index)
    vals = [2 * rng.randint(lo // 2, hi // 2) for _, (lo, hi) in ways]  # tenths, even: every bar on a 0.2 gridline
    if len(set(vals)) < len(vals) or vals[0] >= min(vals[1:]):
        return None
    base = vals[0]
    pct = [i for i in range(1, len(vals)) if (vals[i] - base) * 100 % base == 0]
    if not pct:
        return None
    return {"band": band, "sub": "modernise", "ways": [w for w, _ in ways], "yield": vals,
            "ask": {"gain": rng.randrange(1, len(vals)), "pct": rng.choice(pct), "farm": rng.randrange(1, len(vals)),
                    "hectares": rng.choice([2, 3, 4, 5])}}


def _livestock(rng: random.Random, band: str) -> dict | None:
    animals = [a for a in ANIMALS if a == "Cattle" or rng.random() < 0.8]
    if len(animals) < 5:
        return None
    vals = [200 * rng.randint(2, 15) for _ in animals]
    ranked = sorted(vals, reverse=True)
    if ranked[0] - ranked[1] < 200 or len(set(vals)) < len(vals):
        return None
    a, b = rng.sample(range(len(animals)), 2)
    if vals[a] < vals[b]:
        a, b = b, a
    return {"band": band, "sub": "livestock", "animals": animals, "count": vals, "ask": {"more": [a, b]}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["farms", "modernise", "livestock"])
    make = {"farms": _farms, "modernise": _modernise, "livestock": _livestock}[sub]
    while True:
        p = make(rng, band)
        if p:
            return p


YIELD = "Yield = harvest ÷ area"
INCREASE = "Percentage increase = increase in yield ÷ yield with local seed and no fertiliser × 100"
HARVEST = "Harvest = yield × area"


def dec(x: Fraction) -> str:
    """An exact number to one decimal place at most: 3, 2.5."""
    return str(x.numerator) if x.denominator == 1 else f"{float(x):.1f}"


def _crop_title(crop: str) -> str:
    return crop[0].upper() + crop[1:]


def draw(p: dict):
    if p["sub"] == "farms":
        area = [Fraction(a) for a in p["area"]]
        harvest = [Fraction(h) for h in p["harvest"]]
        rows = [[f, dec(a), dec(h)] for f, a, h in zip(FARMS, area, harvest)]
        return titled_table(f"{_crop_title(p['crop'])} grown on five farms in {SECTOR}",
                            ["Farm", "Area (hectares)", "Harvest (tonnes)"], rows, ["l", "r", "r"], notes=[YIELD],
                            least=1.6)
    if p["sub"] == "modernise":
        vals = [v / 10 for v in p["yield"]]
        top = (max(p["yield"]) + 10) // 10
        fig, ax = bar_chart(p["ways"], vals, top=top, major=1, minor=0.2, ylabel="Maize yield (tonnes per hectare)",
                            xlabel="How the plot was farmed", title=f"Maize yields on trial plots in {SECTOR}",
                            notes=[INCREASE, HARVEST], color="#d4a017", size=(8.8, 5.4), wrap_at=14)
        return fig
    top = -(-(max(p["count"]) + 200) // 1000) * 1000
    fig, _ = bar_chart(p["animals"], p["count"], top=top, major=1000, minor=200, ylabel="Number of animals",
                       xlabel="Kind of animal", title=f"Animals kept by the farmers of {SECTOR}",
                       notes=["Small animals: goats, sheep, pigs, rabbits and chickens"], color="#8c6d46",
                       size=(7.8, 5.0))
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on farming", "for a class test",
            "at the agriculture club", "while revising in Nyagatare", "for a lesson on agriculture",
            "on a revision card", "while revising in Huye", "before a visit to a farm"]


def _tph(x: Fraction) -> list[str]:
    v = dec(x)
    return num_forms(float(v) if "." in v else int(v), "tonnes per hectare", "t/ha", "tonnes")


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "farms":
        lead = f"{who} {rng.choice(VERBS)} this table of farms in {SECTOR} {rng.choice(SETTINGS)}."
        crop = p["crop"]
        area = [Fraction(a) for a in p["area"]]
        harvest = [Fraction(h) for h in p["harvest"]]
        yields = [h / a for h, a in zip(harvest, area)]
        k = p["ask"]["yield"]
        best = max(range(5), key=lambda i: yields[i])
        total = sum(harvest)
        land = sum(area)
        return [
            short(f"{lead} {YIELD}. What was the yield of {crop} on {FARMS[k]}, in tonnes per hectare?", dec(yields[k]),
                  _tph(yields[k])),
            mcq(f"{YIELD}. Which farm in {SECTOR} got the highest yield of {crop}?", FARMS[best],
                [f for i, f in enumerate(FARMS) if i != best], rng),
            short(f"How many tonnes of {crop} did the five farms in {SECTOR} harvest altogether?", dec(total),
                  num_forms(float(dec(total)) if "." in dec(total) else int(total), "tonnes", "t")),
            short(f"How many hectares of {crop} did the five farms in {SECTOR} grow altogether?", dec(land),
                  num_forms(float(dec(land)) if "." in dec(land) else int(land), "hectares", "ha")),
        ]
    if p["sub"] == "modernise":
        lead = f"{who} {rng.choice(VERBS)} this bar chart of maize trials in {SECTOR} {rng.choice(SETTINGS)}."
        ways = p["ways"]
        y = [Fraction(v, 10) for v in p["yield"]]
        g, c, f = p["ask"]["gain"], p["ask"]["pct"], p["ask"]["farm"]
        ha = p["ask"]["hectares"]
        gain = y[g] - y[0]
        pct = (y[c] - y[0]) * 100 / y[0]
        crop = y[f] * ha
        return [
            short(f"{lead} By how many tonnes per hectare was the maize yield in {SECTOR} higher with "
                  f"\"{ways[g].lower()}\" than with local seed and no fertiliser?", dec(gain), _tph(gain)),
            short(f"{INCREASE}. What was the percentage increase in the maize yield in {SECTOR} with "
                  f"\"{ways[c].lower()}\"?", f"{int(pct)}%", pct_forms(int(pct))),
            short(f"{HARVEST}. A farmer in {SECTOR} grows maize on {ha} hectares with \"{ways[f].lower()}\". How many "
                  "tonnes of maize should the farmer harvest, at the yield on the chart?", dec(crop),
                  num_forms(float(dec(crop)) if "." in dec(crop) else int(crop), "tonnes", "t")),
        ]
    lead = f"{who} {rng.choice(VERBS)} this bar chart of the animals kept in {SECTOR} {rng.choice(SETTINGS)}."
    animals, n = p["animals"], p["count"]
    a, b = p["ask"]["more"]
    top = animals[n.index(max(n))]
    small = sum(v for x, v in zip(animals, n) if x in SMALL)
    return [
        mcq(f"{lead} Which kind of animal do the farmers of {SECTOR} keep in the largest number?", top,
            [x for x in animals if x != top], rng),
        short(f"How many more {animals[a].lower()} than {animals[b].lower()} do the farmers of {SECTOR} keep?",
              n[a] - n[b], num_forms(n[a] - n[b], animals[a].lower())),
        short(f"Small animals are goats, sheep, pigs, rabbits and chickens. How many small animals do the farmers of "
              f"{SECTOR} keep altogether?", small, num_forms(small, "animals", "small animals")),
    ]
