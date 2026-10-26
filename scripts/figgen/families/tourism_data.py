"""Tourism data (LS, UP; P6 geography): visitors to an invented national park and an invented country's earnings from
tourism, as the Rwanda S1 "Economic activities", S3 "Tourism in Africa" and S6 "Environmental Conservation and
Tourism" units teach tourism with data.

Two sub-types:
- months: a bar chart of the visitors to National Park P in each month of a year (busiest in the long dry season and
  the short dry season), with the entry fee printed. The busiest month, how many more visitors came in one month than
  another, the visitors in the four months June to September, and the park's earnings from entry fees in a month
  (earnings = visitors × fee, printed).
- earnings: a line graph of Country P's earnings from tourism (million US$) over eight years, with the rule for a
  percentage increase printed. The rise between two years, the percentage increase over a stretch, the year with the
  biggest rise from the year before, and the first year earnings passed a stated amount.

Every value sits on a gridline; every "which" is clear by a gridline or more.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, short
from ._geo_charts import bar_chart, fr, line_chart, num_forms, pct_forms

ID = "tourism_data"
KIND = "graph.bar"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = ("geography.tourism", "geography.tourism-impacts")
# A topic whose sections the book lists is reached only if its name or a section names tourism or the economic
# activities.
NEEDS = r"touris|economic activit"
# Rivers, lakes and relief share tourism as one of their uses, but teach the land and the waters.
AVOID = r"hydrograph|drainage|relief"
PARK = "National Park P"
COUNTRY = "Country P"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
# Visitors in hundreds in a typical year: busiest in the long dry season (June to September) and the short dry season
# (December to February), quietest in the long rains (March to May).
SEASON = [14, 13, 8, 6, 7, 15, 20, 22, 17, 10, 9, 13]
FEES = [20, 30, 40, 50]


def _months(rng: random.Random, band: str) -> dict | None:
    vals = [100 * max(3, s + rng.randint(-3, 3)) for s in SEASON]
    ranked = sorted(vals, reverse=True)
    if ranked[0] - ranked[1] < 200:
        return None
    a, b = rng.sample(range(12), 2)
    if vals[a] == vals[b]:
        return None
    if vals[a] < vals[b]:
        a, b = b, a
    return {"band": band, "sub": "months", "year": rng.randint(2016, 2023), "visitors": vals, "fee": rng.choice(FEES),
            "ask": {"more": [a, b], "fee": rng.randrange(12)}}


def _earnings(rng: random.Random, band: str) -> dict | None:
    start = rng.randint(2008, 2014)
    vals = [10 * rng.randint(10, 25)]
    for _ in range(7):
        vals.append(vals[-1] + 10 * rng.randint(-2, 6))
    if min(vals) <= 50 or max(vals) > 500:
        return None
    rises = [b - a for a, b in zip(vals, vals[1:])]
    ranked = sorted(rises, reverse=True)
    if ranked[0] - ranked[1] < 20 or sum(1 for r in rises if r < 0) > 2:
        return None
    pct = [[i, j] for i in range(8) for j in range(i + 1, 8) if vals[j] > vals[i] and (vals[j] - vals[i]) * 100 % vals[i] == 0]
    mark = 50 * rng.randint(2, 9)
    above = [k for k, v in enumerate(vals) if v > mark]
    if not pct or not above or above[0] == 0 or mark in vals:
        return None
    i, j = sorted(rng.sample(range(8), 2))
    return {"band": band, "sub": "earnings", "years": [start + k for k in range(8)], "earnings": vals, "mark": mark,
            "ask": {"rise": [i, j], "pct": rng.choice(pct)}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["months", "earnings"])
    while True:
        p = (_months if sub == "months" else _earnings)(rng, band)
        if p:
            return p


EARN = "Earnings from entry fees = visitors × entry fee"
INCREASE = "Percentage increase = increase ÷ earnings in the first year × 100"


def draw(p: dict):
    if p["sub"] == "months":
        top = -(-(max(p["visitors"]) + 100) // 500) * 500
        fig, _ = bar_chart([m[:3] for m in MONTHS], p["visitors"], top=top, major=500, minor=100,
                           ylabel="Number of visitors", xlabel="Month",
                           title=f"Visitors to {PARK} each month in {p['year']}",
                           notes=[f"Entry fee: {p['fee']} US$ per visitor", EARN], color="#2e8b57", size=(8.6, 5.0),
                           bar_width=0.65)
        return fig
    top = max(p["earnings"]) + 50
    top -= top % 50
    fig, _ = line_chart(p["years"], {"earnings": p["earnings"]}, top=top, major=50, minor=10,
                        ylabel="Earnings from tourism (million US$)", xlabel="Year",
                        title=f"{COUNTRY}'s earnings from tourism", notes=[INCREASE], size=(8.0, 5.0))
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on tourism", "for a class test",
            "at the geography club", "while revising in Musanze", "for a lesson on tourism in Africa",
            "on a revision card", "while revising in Rusizi", "before a trip to a national park"]


def _usd(v: int, million: bool = False) -> list[str]:
    units = ("million US$", "million", "million dollars") if million else ("US$", "dollars", "US dollars")
    forms = num_forms(v, *units)
    for b in num_forms(v):
        for f in (f"US${b}", f"${b}", f"US$ {b}") + ((f"US${b} million", f"${b} million") if million else ()):
            if f not in forms:
                forms.append(f)
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "months":
        lead = f"{who} {rng.choice(VERBS)} this bar chart of the visitors to {PARK} {rng.choice(SETTINGS)}."
        v, y = p["visitors"], p["year"]
        top = max(range(12), key=lambda k: v[k])
        a, b = p["ask"]["more"]
        dry = sum(v[5:9])
        f = p["ask"]["fee"]
        earn = v[f] * p["fee"]
        near = sorted((k for k in range(12) if k != top), key=lambda k: -v[k])[:3]
        return [
            mcq(f"{lead} In which month of {y} did {PARK} have the most visitors?", MONTHS[top],
                [MONTHS[k] for k in near], rng),
            short(f"How many more people visited {PARK} in {MONTHS[a]} {y} than in {MONTHS[b]} {y}?", v[a] - v[b],
                  num_forms(v[a] - v[b], "visitors", "people")),
            short(f"How many people visited {PARK} in the four months June to September {y} altogether?", dry,
                  num_forms(dry, "visitors", "people")),
            short(f"{EARN}. How much did {PARK} earn from entry fees in {MONTHS[f]} {y}, in US$?", earn, _usd(earn)),
        ]
    lead = f"{who} {rng.choice(VERBS)} this graph of {COUNTRY}'s tourism earnings {rng.choice(SETTINGS)}."
    years, e = p["years"], p["earnings"]
    i, j = p["ask"]["rise"]
    x, z = p["ask"]["pct"]
    pct = (e[z] - e[x]) * 100 // e[x]
    rises = [e[k + 1] - e[k] for k in range(7)]
    best = max(range(7), key=lambda k: rises[k])
    first = next(k for k in range(8) if e[k] > p["mark"])
    change = e[j] - e[i]
    word = "rise" if change >= 0 else "fall"
    return [
        short(f"{lead} By how many million US$ did {COUNTRY}'s earnings from tourism {word} from {years[i]} to "
              f"{years[j]}?", abs(change), _usd(abs(change), million=True)),
        short(f"{INCREASE}. What was the percentage increase in {COUNTRY}'s earnings from tourism from {years[x]} to "
              f"{years[z]}?", f"{pct}%", pct_forms(pct)),
        mcq(f"In which year did {COUNTRY}'s earnings from tourism rise the most from the year before?",
            str(years[best + 1]), [str(years[k + 1]) for k in sorted(range(7), key=lambda k: -rises[k])[1:4]], rng),
        mcq(f"In which year did {COUNTRY}'s earnings from tourism first go above {fr(p['mark'])} million US$?",
            str(years[first]), [str(years[k]) for k in sorted(range(8), key=lambda k: (abs(k - first), k))[1:4]], rng),
    ]
