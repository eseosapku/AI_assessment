"""HIV/AIDS and population (UP; P6 geography): how HIV/AIDS shows in an invented country's population data, as the
IGCSE Geography global theme "HIV/AIDS" and IGCSE Environmental Management's "Changes in population size" teach it.
The countries and their numbers are invented; no real country's statistics are drawn.

Two sub-types:
- life: a line graph of life expectancy at birth in Country P and Country Q every five years from 1985 to 2020.
  Country P's rises, falls in the years HIV/AIDS spread, and recovers once treatment reached people; Country Q's rises
  steadily. The fall in Country P from 1990 to its lowest year, the year it was lowest, the gap between the two
  countries in a year, and Country P's rise from its lowest year to 2020.
- ages: a bar chart of the percentage of adults living with HIV in each age group in Country P, with the rule for the
  number of people printed. The age group with the highest percentage, the gap between two groups, and how many
  people live with HIV in a group whose size the stem states (people = percentage × group size ÷ 100).

Every value sits on a gridline; every "which" is clear.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, short
from ._geo_charts import bar_chart, line_chart, num_forms, pct_forms

ID = "hiv_impact"
KIND = "graph.line"
SUBJECT = "geography"
BANDS = ("UP",)
CONCEPTS = ("geography.hiv-aids-impact",)
# A topic whose sections the book lists is reached only if its name or a section names HIV, AIDS or population.
NEEDS = r"hiv|aids|population"
YEARS = [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020]
GROUPS = ["15–19", "20–24", "25–29", "30–34", "35–39", "40–44", "45–49"]


def _life(rng: random.Random) -> dict | None:
    """Every value even, so it sits on a gridline 2 years apart."""
    peak = 2 * rng.randint(28, 32)
    low_at = rng.choice([3, 4, 5])  # 2000, 2005 or 2010
    low = peak - 2 * rng.randint(5, 9)
    p = [peak - 2 * rng.randint(1, 2), peak]
    p += sorted(rng.sample(range(low + 2, peak, 2), low_at - 2), reverse=True) + [low]
    while len(p) < 8:
        p.append(p[-1] + 2 * rng.randint(1, 3))
    q = [2 * rng.randint(24, 27)]
    for _ in range(7):
        q.append(q[-1] + 2 * rng.randint(0, 2))
    gaps = [k for k in range(8) if q[k] != p[k]]
    if max(p + q) > 78 or low < 42 or not gaps or p.count(low) > 1:
        return None
    return {"band": "UP", "sub": "life", "p": p, "q": q, "ask": {"gap": rng.choice(gaps)}}


def _ages(rng: random.Random) -> dict | None:
    top = rng.randint(2, 4)  # the age group hit hardest: 25-29 to 35-39
    vals = []
    for k in range(7):
        d = abs(k - top)
        vals.append(max(1, rng.randint(9, 14) - 3 * d + rng.randint(-1, 1)))
    ranked = sorted(vals, reverse=True)
    if ranked[0] - ranked[1] < 2:
        return None
    a, b = rng.sample(range(7), 2)
    if vals[a] == vals[b]:
        return None
    if vals[a] < vals[b]:
        a, b = b, a
    size = rng.choice([200_000, 300_000, 400_000, 500_000, 600_000])
    return {"band": "UP", "sub": "ages", "vals": vals, "size": size,
            "ask": {"gap": [a, b], "people": rng.randrange(7)}}


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["life", "ages"])
    while True:
        p = (_life if sub == "life" else _ages)(rng)
        if p:
            return p


PEOPLE = "People living with HIV = percentage × number of people in the age group ÷ 100"


def draw(p: dict):
    if p["sub"] == "life":
        fig, _ = line_chart(YEARS, {"Country P": p["p"], "Country Q": p["q"]}, top=80, major=10, minor=2, bottom=40,
                            ylabel="Life expectancy at birth (years)", xlabel="Year",
                            title="Life expectancy in Country P and Country Q", size=(8.4, 5.4))
        return fig
    top = -(-(max(p["vals"]) + 1) // 5) * 5
    fig, _ = bar_chart([f"{g} years" for g in GROUPS], p["vals"], top=top, major=5, minor=1,
                       ylabel="Adults living with HIV (%)", xlabel="Age group",
                       title="Adults living with HIV in Country P, by age", notes=[PEOPLE], color="#b03a2e",
                       size=(8.4, 5.0), wrap_at=8)
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on population", "for a class test",
            "at the geography club", "while revising in Kigali", "for a lesson on global themes",
            "on a revision card", "while revising in Huye", "before a health talk"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "life":
        lead = f"{who} {rng.choice(VERBS)} this graph of life expectancy {rng.choice(SETTINGS)}."
        lp, lq = p["p"], p["q"]
        low = lp.index(min(lp))
        k = p["ask"]["gap"]
        gap = abs(lq[k] - lp[k])
        higher = "Country Q" if lq[k] > lp[k] else "Country P"
        lower = "Country P" if higher == "Country Q" else "Country Q"
        return [
            short(f"{lead} By how many years did life expectancy in Country P fall from 1990 to its lowest point?",
                  lp[1] - lp[low], num_forms(lp[1] - lp[low], "years")),
            mcq("In which year was life expectancy in Country P at its lowest?", str(YEARS[low]),
                [str(YEARS[i]) for i in sorted(range(8), key=lambda i: (abs(i - low), i))[1:4]], rng),
            short(f"In {YEARS[k]}, how many years longer was life expectancy in {higher} than in {lower}?", gap,
                  num_forms(gap, "years")),
            short(f"By how many years did life expectancy in Country P rise from {YEARS[low]} to 2020?",
                  lp[-1] - lp[low], num_forms(lp[-1] - lp[low], "years")),
        ]
    lead = f"{who} {rng.choice(VERBS)} this bar chart of HIV in Country P {rng.choice(SETTINGS)}."
    v = p["vals"]
    top = v.index(max(v))
    a, b = p["ask"]["gap"]
    k = p["ask"]["people"]
    people = v[k] * p["size"] // 100
    size = f"{p['size']:,}".replace(",", " ")
    return [
        mcq(f"{lead} Which age group in Country P has the highest percentage of adults living with HIV?",
            f"{GROUPS[top]} years", [f"{GROUPS[i]} years" for i in sorted(range(7), key=lambda i: (abs(i - top), i))[1:4]],
            rng),
        short(f"How many percentage points higher is the share of adults living with HIV in Country P aged "
              f"{GROUPS[a]} than aged {GROUPS[b]}?", v[a] - v[b], pct_forms(v[a] - v[b]) +
              [f"{v[a] - v[b]} percentage points"]),
        short(f"{PEOPLE}. Country P has {size} people aged {GROUPS[k]}. How many of them live with HIV?", people,
              num_forms(people, "people")),
    ]
