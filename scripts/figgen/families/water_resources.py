"""Water resources (UP; P6 geography): how much fresh water four invented countries have for each person, and what
they use it for, as IGCSE Environmental Management's "The distribution of water on Earth" teaches water availability
with data. The countries and their numbers are invented.

Two sub-types:
- stress: a table of the renewable fresh water and the population of Countries P, Q, R and S (one of them with water
  scarcity, the others in any other band), with water per person = fresh water ÷ population printed, and the water-stress thresholds the coursebook uses (below 1 700 m³ per person a
  year, water stress; below 1 000, water scarcity; below 500, absolute scarcity). One country's water per person, the
  country with the most water per person (never the one with the most water), the country with water scarcity but not
  absolute scarcity, and how many countries are under water stress or worse.
- use: a grouped bar chart of the share of water each of three countries uses for farming, industry and homes. The
  country that uses the largest share for farming, one country's share for homes, the gap between two countries'
  shares for industry, and the country whose industry uses the most water in a stated total (water = share × total ÷
  100).

Every value is printed or on a gridline; every "which" is clear.
"""
from __future__ import annotations

import random

from ..core import NAMES, count, mcq, short
from ._geo_charts import fr, grouped_bars, num_forms, pct_forms
from .econ_tables import titled_table

ID = "water_resources"
KIND = "table.data"
SUBJECT = "geography"
BANDS = ("UP",)
CONCEPTS = ("geography.water-availability", "geography.water-distribution")
# A topic whose sections the book lists is reached only if its name or a section names water.
NEEDS = r"\bwater"
# Topics that share water but teach floods, pollution or the oceans' fish.
AVOID = r"flood|pollution|ocean|fish|hydrograph|drainage"
COUNTRIES = ["P", "Q", "R", "S"]
SECTORS = ["Farming", "Industry", "Homes"]
# Water per person (m³ a year) bands: absolute scarcity, scarcity, stress, and enough, each clear of its thresholds.
BANDS_PP = [(200, 450), (550, 950), (1050, 1650), (1800, 4000)]


def _stress(rng: random.Random) -> dict | None:
    rows = {}
    order = rng.sample(COUNTRIES, 4)
    # one country with water scarcity (but not absolute scarcity); the others in any band but that one
    bands = [BANDS_PP[1]] + [rng.choice([BANDS_PP[0], BANDS_PP[2], BANDS_PP[3]]) for _ in range(3)]
    for c, (lo, hi) in zip(order, bands):
        per = 50 * rng.randint(lo // 50, hi // 50)
        pop = rng.randint(4, 40)
        rows[c] = {"pop": pop, "water": per * pop}
    per = {c: r["water"] // r["pop"] for c, r in rows.items()}
    most_water = max(rows, key=lambda c: rows[c]["water"])
    best = max(per, key=per.get)
    ranked = sorted(per.values(), reverse=True)
    if best == most_water or len({r["water"] for r in rows.values()}) < 4 or ranked[0] - ranked[1] < 100:
        return None
    return {"band": "UP", "sub": "stress", "rows": rows, "ask": {"per": rng.choice(COUNTRIES)}}


def _use(rng: random.Random) -> dict | None:
    names = rng.sample(COUNTRIES, 3)
    shares = []
    for _ in names:
        farm = 5 * rng.randint(6, 17)
        ind = 5 * rng.randint(1, (95 - farm) // 5)
        home = 100 - farm - ind
        if home < 5:
            return None
        shares.append([farm, ind, home])
    farms = [s[0] for s in shares]
    if sorted(farms)[-1] - sorted(farms)[-2] < 10:
        return None
    totals = [rng.choice([1000, 2000, 4000, 5000]) for _ in names]
    ind_water = [s[1] * t // 100 for s, t in zip(shares, totals)]
    ranked = sorted(ind_water, reverse=True)
    if ranked[0] - ranked[1] < 100 or ind_water.index(ranked[0]) == [s[1] for s in shares].index(max(s[1] for s in shares)):
        return None
    a, b = rng.sample(range(3), 2)
    if shares[a][1] == shares[b][1]:
        return None
    if shares[a][1] < shares[b][1]:
        a, b = b, a
    return {"band": "UP", "sub": "use", "names": names, "shares": shares, "totals": totals,
            "ask": {"home": rng.randrange(3), "gap": [a, b]}}


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["stress", "use"])
    while True:
        p = (_stress if sub == "stress" else _use)(rng)
        if p:
            return p


PER = "Water per person (m³ a year) = renewable fresh water (million m³) ÷ population (millions)"
LEVELS = ["Water stress: below 1 700 m³ per person a year", "Water scarcity: below 1 000 m³ per person a year",
          "Absolute scarcity: below 500 m³ per person a year"]
WATER = "Water used = share × total water used ÷ 100"


def draw(p: dict):
    if p["sub"] == "stress":
        rows = [[f"Country {c}", fr(p["rows"][c]["water"]), fr(p["rows"][c]["pop"])] for c in COUNTRIES]
        return titled_table("Fresh water and population of four countries",
                            ["Country", "Renewable fresh water\n(million m³ a year)", "Population\n(millions)"], rows,
                            ["l", "r", "r"], notes=[PER] + LEVELS)
    names, shares, totals = p["names"], p["shares"], p["totals"]
    cats = [f"Country {c}\n(uses {fr(t)}\nmillion m³)" for c, t in zip(names, totals)]
    fig, _ = grouped_bars(cats, {s: [sh[k] for sh in shares] for k, s in enumerate(SECTORS)}, top=100, major=10,
                          minor=5, ylabel="Share of the water used (%)", xlabel="", wrap_at=30,
                          title="What three countries use their water for", notes=[WATER],
                          colors=["#6b8e23", "#8c8c8c", "#3182bd"], size=(8.6, 5.2), legend_title="Used for")
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on water", "for a class test",
            "at the environment club", "while revising in Kigali", "for a lesson on water resources",
            "on a revision card", "while revising in Nyanza", "for a debate on safe water"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "stress":
        lead = f"{who} {rng.choice(VERBS)} this table of fresh water {rng.choice(SETTINGS)}."
        rows = p["rows"]
        per = {c: r["water"] // r["pop"] for c, r in rows.items()}
        c = p["ask"]["per"]
        best = max(per, key=per.get)
        scarce = next(k for k, v in per.items() if 500 <= v < 1000)
        stressed = sum(1 for v in per.values() if v < 1700)
        return [
            short(f"{lead} {PER}. How much renewable fresh water does Country {c} have per person, in m³ a year?", per[c],
                  num_forms(per[c], "m³", "m3", "cubic metres", "m³ per person")),
            mcq(f"{PER}. Which country has the most fresh water per person?", f"Country {best}",
                [f"Country {k}" for k in COUNTRIES if k != best], rng),
            mcq("Using the thresholds printed with the table, which country suffers water scarcity but not absolute "
                "scarcity?", f"Country {scarce}", [f"Country {k}" for k in COUNTRIES if k != scarce], rng),
            count("Using the thresholds printed with the table, how many of the four countries are below the water "
                  "stress line of 1 700 m³ per person a year?", stressed, "countries"),
        ]
    lead = f"{who} {rng.choice(VERBS)} this bar chart of water use {rng.choice(SETTINGS)}."
    names, shares, totals = p["names"], p["shares"], p["totals"]
    farm = max(range(3), key=lambda i: shares[i][0])
    h = p["ask"]["home"]
    a, b = p["ask"]["gap"]
    ind = [s[1] * t // 100 for s, t in zip(shares, totals)]
    big = max(range(3), key=lambda i: ind[i])
    return [
        mcq(f"{lead} Which country uses the largest share of its water for farming?", f"Country {names[farm]}",
            [f"Country {c}" for i, c in enumerate(names) if i != farm], rng),
        short(f"What percentage of its water does Country {names[h]} use in homes?", f"{shares[h][2]}%",
              pct_forms(shares[h][2])),
        short(f"How many percentage points more of its water does Country {names[a]} use for industry than Country "
              f"{names[b]}?", shares[a][1] - shares[b][1],
              pct_forms(shares[a][1] - shares[b][1]) + [f"{shares[a][1] - shares[b][1]} percentage points"]),
        mcq(f"{WATER}. Which country's industry uses the most water, in million m³?", f"Country {names[big]}",
            [f"Country {c}" for i, c in enumerate(names) if i != big], rng),
    ]
