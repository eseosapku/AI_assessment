"""Waste and recycling (UP; P6 geography): the household waste of an invented town and how much of it is recycled, as
the IGCSE Geography global theme "Reduce, reuse, recycle", Rwanda S6 "Environmental Conservation and Tourism"
(pollution) and the NERDC and WAEC environmental management chapters teach waste with data.

Two sub-types:
- waste: a pie chart of the household waste Town P collected in a week, each kind marked in the key as able to be
  recycled, composted or neither, the week's total printed. The percentage that could be recycled, the tonnes of one
  kind (tonnes = percentage × total ÷ 100, printed), a sector's angle, and the recyclable kind there is most of.
- rates: a grouped bar chart of the waste Town P collected and the waste it recycled in five years, with the recycling
  rate = recycled ÷ collected × 100 printed. One year's recycling rate, the year with the highest rate (never the year
  that recycled the most tonnes), the rise in tonnes recycled from the first year to the last, and the waste collected
  in the five years.

Every share is a multiple of 5 and every rate a whole number; every bar ends on a gridline; every "which" is
clear.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, mcq, short
from ._geo_charts import fr, grouped_bars, num_forms, pct_forms, pie_chart

ID = "waste_recycling"
KIND = "graph.pie"
SUBJECT = "geography"
BANDS = ("UP",)
CONCEPTS = ("geography.environmental-conservation", "geography.sustainable-development")
# A topic whose sections the book lists is reached only if its name or a section names waste, recycling, pollution or
# the environment.
NEEDS = r"recycl|\bwaste|reduce|reuse|pollution|environment"
# Topics that share conservation or sustainable development but teach ecosystems, energy, farming, fieldwork or the
# climate.
AVOID = r"ecosystem|fossil|energy|agricultur|fieldwork|climate|forest|fish|mining|water|carbon|atmosph"
TOWN = "Town P"
# Each kind of household waste: how the key marks it, and the range of its share (per cent, multiples of 5).
KINDS = {"Food and garden waste": ("can be composted", (35, 60)), "Plastic": ("can be recycled", (10, 20)),
         "Paper and card": ("can be recycled", (5, 20)), "Glass": ("can be recycled", (5, 15)),
         "Metal": ("can be recycled", (5, 15)), "Other waste": ("cannot be recycled", (5, 15))}
COLOUR = {"Food and garden waste": "#6b8e23", "Plastic": "#3182bd", "Paper and card": "#f2d388", "Glass": "#9ecae1",
          "Metal": "#8c8c8c", "Other waste": "#c47a5a"}


def _waste(rng: random.Random) -> dict | None:
    names = list(KINDS)
    vals = [5 * rng.randint(lo // 5, hi // 5) for _, (lo, hi) in KINDS.values()]
    if sum(vals) != 100:
        return None
    rec = {n: v for n, v in zip(names, vals) if KINDS[n][0] == "can be recycled"}
    ranked = sorted(rec.values(), reverse=True)
    if ranked[0] - ranked[1] < 5:
        return None
    order = names[:]
    rng.shuffle(order)
    share = dict(zip(names, vals))
    total = rng.choice([40, 60, 80, 120, 200])
    exact = [n for n in names if share[n] * total % 100 == 0]
    return {"band": "UP", "sub": "waste", "parts": [[n, share[n]] for n in order], "total": total,
            "ask": {"tonnes": rng.choice(exact), "angle": rng.choice(names)}}


# Waste collected in a year, in hundreds of tonnes: sizes whose recycled share can be a whole percentage of 20% or more.
SIZES = [a for a in range(10, 31) if any(b * 100 % a == 0 for b in range(2, a * 7 // 10 + 1))]


def _rates(rng: random.Random) -> dict | None:
    start = rng.randint(2015, 2019)
    collected, recycled = [], []
    first = rng.randrange(len(SIZES) - 7)
    for a in sorted(rng.sample(SIZES[first:first + 8], 5)):  # hundreds of tonnes, growing as the town grows
        b = rng.choice([b for b in range(2, a * 7 // 10 + 1) if b * 100 % a == 0])
        collected.append(100 * a)
        recycled.append(100 * b)
    rate = [Fraction(r * 100, c) for r, c in zip(recycled, collected)]
    ranked = sorted(rate, reverse=True)
    if ranked[0] - ranked[1] < 5 or recycled.count(max(recycled)) > 1:
        return None
    if rate.index(ranked[0]) == recycled.index(max(recycled)) or recycled[-1] <= recycled[0]:
        return None
    return {"band": "UP", "sub": "rates", "years": [start + k for k in range(5)], "collected": collected,
            "recycled": recycled, "ask": {"rate": rng.randrange(5)}}


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["waste", "rates"])
    while True:
        p = (_waste if sub == "waste" else _rates)(rng)
        if p:
            return p


TONNES = "Tonnes = percentage × total ÷ 100"
ANGLE = "Angle of a sector = percentage × 3.6°"
RATE = "Recycling rate = waste recycled ÷ waste collected × 100"


def draw(p: dict):
    if p["sub"] == "waste":
        fig, _ = pie_chart([[f"{n} ({KINDS[n][0]})", v] for n, v in p["parts"]],
                           title=f"Household waste collected in {TOWN} in one week",
                           notes=[f"Total waste collected: {fr(p['total'])} tonnes", TONNES, ANGLE], size=(9.2, 5.0),
                           colors=[COLOUR[n] for n, _ in p["parts"]])
        return fig
    top = -(-(max(p["collected"]) + 100) // 500) * 500
    fig, _ = grouped_bars([str(y) for y in p["years"]], {"Waste collected": p["collected"],
                                                         "Waste recycled": p["recycled"]},
                          top=top, major=500, minor=100, ylabel="Waste (tonnes)", xlabel="Year",
                          title=f"Waste collected and recycled in {TOWN}", notes=[RATE], colors=["#8c8c8c", "#2e8b57"],
                          size=(8.4, 5.0))
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on waste", "for a class test",
            "at the environment club", "while revising in Kigali", "for a lesson on reducing waste",
            "on a revision card", "while revising in Huye", "before a clean-up day"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "waste":
        lead = f"{who} {rng.choice(VERBS)} this pie chart of {TOWN}'s household waste {rng.choice(SETTINGS)}."
        share = {n: v for n, v in p["parts"]}
        rec = {n: v for n, v in share.items() if KINDS[n][0] == "can be recycled"}
        t = p["ask"]["tonnes"]
        tonnes = share[t] * p["total"] // 100
        g = p["ask"]["angle"]
        top = max(rec, key=rec.get)
        return [
            short(f"{lead} What percentage of the household waste {TOWN} collected that week can be recycled?",
                  f"{sum(rec.values())}%", pct_forms(sum(rec.values()))),
            short(f"{TONNES}. How many tonnes of {t.lower()} did {TOWN} collect that week?", tonnes,
                  num_forms(tonnes, "tonnes", "t")),
            short(f"{ANGLE}. What is the angle of the {g.lower()} sector in the pie chart of {TOWN}'s waste?",
                  f"{share[g] * 18 // 5}°", num_forms(share[g] * 18 // 5, "°", "degrees")),
            mcq(f"Of the kinds of waste that can be recycled, which made up the largest share of {TOWN}'s household "
                "waste that week?", top, [n for n in share if n != top and n != "Food and garden waste"], rng),
        ]
    lead = f"{who} {rng.choice(VERBS)} this bar chart of {TOWN}'s waste {rng.choice(SETTINGS)}."
    years, col, rec = p["years"], p["collected"], p["recycled"]
    k = p["ask"]["rate"]
    rate = [Fraction(r * 100, c) for r, c in zip(rec, col)]
    best = max(range(5), key=lambda i: rate[i])
    return [
        short(f"{lead} {RATE}. What was {TOWN}'s recycling rate in {years[k]}?", f"{int(rate[k])}%",
              pct_forms(int(rate[k]))),
        mcq(f"{RATE}. In which year did {TOWN} have its highest recycling rate?", str(years[best]),
            [str(y) for i, y in enumerate(years) if i != best], rng),
        short(f"By how many tonnes did the waste {TOWN} recycled rise from {years[0]} to {years[-1]}?", rec[-1] - rec[0],
              num_forms(rec[-1] - rec[0], "tonnes", "t")),
        short(f"How many tonnes of waste did {TOWN} collect in the five years {years[0]} to {years[-1]} altogether?",
              sum(col), num_forms(sum(col), "tonnes", "t")),
    ]
