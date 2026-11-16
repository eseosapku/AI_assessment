"""Forest cover (LS, UP; P6 geography): how much forest an invented district or forest reserve has, as the Rwanda S2-S4
forestry and environmental conservation units, Cambridge IGCSE Environmental Management's deforestation and the NERDC
and WAEC environmental management chapters teach it with data.

Two sub-types:
- trend: a bar chart of the forest area of District P (km²) in five years, five years apart, with the district's land
  area and the rules for the average yearly loss and the percentage of land under forest printed. The fall between two
  years, the average yearly loss over a stretch of falling years, the percentage of the land under forest in a year,
  and the five-year period in which the forest shrank the most.
- planting: a grouped bar chart of the trees cut down and the trees planted (thousands) in Forest Reserve R in each of
  five years. How many thousand more trees were cut than planted in a year of loss, the year of the greatest net loss,
  the trees planted in the five years, and how many years more trees were planted than cut.

Every value sits on a gridline (tens of km², fives of thousands of trees); every "which" has one clear answer.
"""
from __future__ import annotations

import random

from ..core import NAMES, count, mcq, short
from ._geo_charts import bar_chart, fr, grouped_bars, num_forms, pct_forms

ID = "forest_cover"
KIND = "graph.bar"
SUBJECT = "geography"
BANDS = ("LS", "UP")
TREND = ("geography.deforestation", "geography.forest-distribution")
PLANTING = ("geography.deforestation", "geography.forest-conservation", "geography.forest-exploitation")
CONCEPTS = ("geography.deforestation", "geography.forest-distribution", "geography.forest-conservation",
            "geography.forest-exploitation")
# A topic whose sections the book lists is reached only if its name or a section names forests, deforestation, or
# conserving the environment.
NEEDS = r"forest|deforest|conserv|environment"
# Topics that share deforestation but teach recycling, hazards or the climate, not how much forest a place has.
AVOID = r"reduce, reuse|hazard|climate change|carbon|mining|quarr"
DISTRICT = "District P"
RESERVE = "Forest Reserve R"


def concepts_for(p: dict) -> tuple[str, ...]:
    return TREND if p["sub"] == "trend" else PLANTING


def _trend(rng: random.Random, band: str) -> dict | None:
    start = rng.choice([1995, 2000, 2005])
    years = [start + 5 * k for k in range(5)]
    area = [rng.randrange(220, 401, 10)]
    for _ in range(4):
        area.append(area[-1] + 10 * rng.randint(-7, 4))
    if min(area) < 60 or max(area) > 450:
        return None
    steps = [b - a for a, b in zip(area, area[1:])]
    if sum(1 for s in steps if s < 0) < 2 or sum(1 for s in steps if s > 0) < 1 or 0 in steps:
        return None
    falls = sorted((-s for s in steps if s < 0), reverse=True)
    if len(falls) > 1 and falls[0] - falls[1] < 20:
        return None
    land = rng.choice([400, 500, 800, 1000, 1250])
    whole = [i for i, a in enumerate(area) if a * 100 % land == 0]
    # a stretch of years over which the forest fell, with a whole average loss a year
    runs = [[i, j] for i in range(5) for j in range(i + 1, 5) if area[j] < area[i]
            and (area[i] - area[j]) % (5 * (j - i)) == 0]
    drops = [[i, i + 1] for i in range(4) if area[i + 1] < area[i]]
    if not whole or not runs:
        return None
    return {"band": band, "sub": "trend", "years": years, "area": area, "land": land,
            "ask": {"drop": rng.choice(drops), "run": rng.choice(runs), "share": rng.choice(whole)}}


def _planting(rng: random.Random, band: str) -> dict | None:
    start = rng.randint(2014, 2019)
    years = [start + k for k in range(5)]
    cut = [5 * rng.randint(4, 18) for _ in range(5)]
    planted = [5 * rng.randint(2, 18) for _ in range(5)]
    net = [p - c for p, c in zip(planted, cut)]
    if 0 in net or sum(1 for n in net if n < 0) < 2 or sum(1 for n in net if n > 0) < 1:
        return None
    losses = sorted((-n for n in net if n < 0), reverse=True)
    if losses[0] - losses[1] < 10:
        return None
    loss_years = [i for i in range(5) if net[i] < 0]
    return {"band": band, "sub": "planting", "years": years, "cut": cut, "planted": planted,
            "ask": {"loss": rng.choice(loss_years)}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["trend", "planting"])
    make = _trend if sub == "trend" else _planting
    while True:
        p = make(rng, band)
        if p:
            return p


AVERAGE = "Average yearly loss = fall in forest area ÷ number of years"
SHARE = "Percentage of land under forest = forest area ÷ land area × 100"
NET = "Net change = trees planted − trees cut down"


def draw(p: dict):
    if p["sub"] == "trend":
        top = max(p["area"]) + 50
        top -= top % 50
        fig, _ = bar_chart([str(y) for y in p["years"]], p["area"], top=top, major=50, minor=10,
                           ylabel="Forest area (km²)", xlabel="Year", title=f"Forest area of {DISTRICT}",
                           notes=[f"Land area of {DISTRICT}: {fr(p['land'])} km²", AVERAGE, SHARE], color="#4f8f3a",
                           size=(7.6, 5.4))
        return fig
    top = max(p["cut"] + p["planted"]) + 10
    top -= top % 10
    fig, _ = grouped_bars([str(y) for y in p["years"]], {"Trees cut down": p["cut"], "Trees planted": p["planted"]},
                          top=top, major=10, minor=5, ylabel="Number of trees (thousands)", xlabel="Year",
                          title=f"Trees cut down and planted in {RESERVE}", notes=[NET],
                          colors=["#a0522d", "#4f8f3a"], size=(8.2, 5.0))
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on forests", "for a class test",
            "at the environment club", "while revising in Huye", "for a lesson on conservation",
            "before a fieldwork visit", "on a revision card", "while revising in Rubavu"]


def _period(p: dict, i: int) -> str:
    return f"{p['years'][i]} to {p['years'][i + 1]}"


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    lead = f"{who} {rng.choice(VERBS)} this bar chart {rng.choice(SETTINGS)}."
    years, ask = p["years"], p["ask"]
    if p["sub"] == "trend":
        area = p["area"]
        a, b = ask["drop"]
        i, j = ask["run"]
        s = ask["share"]
        fall = area[a] - area[b]
        avg = (area[i] - area[j]) // (years[j] - years[i])
        pct = area[s] * 100 // p["land"]
        steps = [area[k] - area[k + 1] for k in range(4)]
        worst = max(range(4), key=lambda k: steps[k])
        return [
            short(f"{lead} By how many km² did the forest area of {DISTRICT} fall from {years[a]} to {years[b]}?", fall,
                  num_forms(fall, "km²", "km2", "square kilometres")),
            short(f"Average yearly loss = fall in forest area ÷ number of years. What was the average yearly loss of "
                  f"forest in {DISTRICT} from {years[i]} to {years[j]}, in km² per year?", avg,
                  num_forms(avg, "km²", "km2", "km² per year", "km2 per year", "km²/year")),
            short(f"The land area of {DISTRICT} is {fr(p['land'])} km². What percentage of its land was under forest in "
                  f"{years[s]}?", f"{pct}%", pct_forms(pct)),
            mcq(f"In which five-year period did the forest area of {DISTRICT} fall the most?", _period(p, worst),
                [_period(p, k) for k in range(4) if k != worst], rng),
        ]
    cut, planted = p["cut"], p["planted"]
    net = [x - c for x, c in zip(planted, cut)]
    k = ask["loss"]
    gap = cut[k] - planted[k]
    worst = min(range(5), key=lambda y: net[y])
    gains = sum(1 for n in net if n > 0)
    total = sum(planted)
    return [
        short(f"{lead} How many thousand more trees were cut down than planted in {RESERVE} in {years[k]}?", gap,
              num_forms(gap, "thousand", "thousand trees") + [f"{gap * 1000:,}", f"{gap * 1000}",
                                                               f"{gap * 1000:,}".replace(",", " ")]),
        mcq(f"Net change = trees planted − trees cut down. In which year did {RESERVE} have its greatest net loss "
            "of trees?", str(years[worst]), [str(y) for i, y in enumerate(years) if i != worst], rng),
        short(f"How many thousand trees were planted in {RESERVE} in the five years {years[0]} to {years[-1]} "
              "altogether?", total, num_forms(total, "thousand", "thousand trees") + [f"{total * 1000}",
                                                                                     f"{total * 1000:,}",
                                                                                     f"{total * 1000:,}".replace(",", " ")]),
        count(f"In how many of the five years were more trees planted than cut down in {RESERVE}?", gains, "years"),
    ]
