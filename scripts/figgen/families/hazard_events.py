"""Hazard events (LS, UP; P6 geography): the natural hazards recorded in an invented district, as the Rwanda S1
"Hazards" unit (types of hazards and responses), S6 "Environmental Conservation and Tourism" (catastrophes) and the
IGCSE natural hazards chapters teach hazards with data.

Two sub-types:
- types: a bar chart of the hazard events District P recorded in ten years, by type (floods, landslides, droughts,
  heavy storms, lightning strikes, earthquakes). The most common hazard, the events altogether, how many more of one
  type than another, and floods' share of the events (percentage = events of the type ÷ all events × 100, printed).
- houses: a grouped bar chart of the houses damaged by floods and by landslides in District P in each of five years.
  The houses damaged by both in a year, the year with the most houses damaged by both together, how many more houses
  floods damaged than landslides over the five years, and the number of years in which landslides damaged more houses
  than floods.

Every count sits on a gridline; every "which" leads clearly. The district and its records are invented.
"""
from __future__ import annotations

import random

from ..core import NAMES, count, mcq, short
from ._geo_charts import bar_chart, grouped_bars, num_forms, pct_forms

ID = "hazard_events"
KIND = "graph.bar"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = ("geography.natural-hazards", "geography.flooding", "geography.droughts")
# A topic whose sections the book lists is reached only if its name or a section names hazards, disasters or
# catastrophes.
NEEDS = r"hazard|disaster|catastroph"
# The IGCSE coursebook's introduction names hazards among everything else it introduces.
AVOID = r"^introduction$"
DISTRICT = "District P"
TYPES = ["Floods", "Landslides", "Droughts", "Heavy storms", "Lightning strikes", "Earthquakes"]
# How many of each a hilly district may record in ten years (halved: every count is even): droughts and felt
# earthquakes are rarer than floods, landslides, storms and lightning.
RANGE = {"Floods": (3, 15), "Landslides": (3, 15), "Droughts": (1, 5), "Heavy storms": (2, 12),
         "Lightning strikes": (2, 12), "Earthquakes": (1, 4)}


def _types(rng: random.Random, band: str) -> dict | None:
    kinds = [t for t in TYPES if t in ("Floods", "Landslides") or rng.random() < 0.7]
    if len(kinds) < 4:
        return None
    vals = [2 * rng.randint(*RANGE[k]) for k in kinds]
    ranked = sorted(vals, reverse=True)
    if ranked[0] - ranked[1] < 4 or len(set(vals)) < len(vals):
        return None
    total = sum(vals)
    if vals[kinds.index("Floods")] * 100 % total:
        return None
    a, b = rng.sample(range(len(kinds)), 2)
    if vals[a] < vals[b]:
        a, b = b, a
    start = rng.randint(2010, 2014)
    return {"band": band, "sub": "types", "years": [start, start + 9], "kinds": kinds, "events": vals,
            "ask": {"more": [a, b]}}


def _houses(rng: random.Random, band: str) -> dict | None:
    floods = [10 * rng.randint(2, 18) for _ in range(5)]
    slides = [10 * rng.randint(2, 18) for _ in range(5)]
    both = [f + s for f, s in zip(floods, slides)]
    ranked = sorted(both, reverse=True)
    if ranked[0] - ranked[1] < 20 or sum(floods) <= sum(slides) or 0 in [f - s for f, s in zip(floods, slides)]:
        return None
    more = sum(1 for f, s in zip(floods, slides) if s > f)
    if more == 0:
        return None
    start = rng.randint(2016, 2019)
    return {"band": band, "sub": "houses", "years": [start + k for k in range(5)], "floods": floods, "slides": slides,
            "ask": {"year": rng.randrange(5)}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["types", "houses"])
    while True:
        p = (_types if sub == "types" else _houses)(rng, band)
        if p:
            return p


SHARE = "Percentage of the events = events of the type ÷ all events × 100"


def draw(p: dict):
    if p["sub"] == "types":
        y0, y1 = p["years"]
        top = -(-(max(p["events"]) + 2) // 10) * 10
        fig, _ = bar_chart(p["kinds"], p["events"], top=top, major=10, minor=2, ylabel="Number of events",
                           xlabel="Type of hazard", title=f"Hazard events recorded in {DISTRICT}, {y0} to {y1}",
                           notes=[SHARE], color="#c0504d", size=(8.2, 5.0), wrap_at=11)
        return fig
    top = -(-(max(p["floods"] + p["slides"]) + 10) // 50) * 50
    fig, _ = grouped_bars([str(y) for y in p["years"]], {"Floods": p["floods"], "Landslides": p["slides"]}, top=top,
                          major=50, minor=10, ylabel="Houses damaged", xlabel="Year",
                          title=f"Houses damaged by floods and landslides in {DISTRICT}", colors=["#3182bd", "#a0522d"],
                          size=(8.2, 5.0), legend_title="Hazard")
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on hazards", "for a class test",
            "at the geography club", "while revising in Ngororero", "for a lesson on natural hazards",
            "on a revision card", "while revising in Musanze", "before a talk on disaster safety"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "types":
        y0, y1 = p["years"]
        lead = f"{who} {rng.choice(VERBS)} this bar chart of hazards in {DISTRICT} {rng.choice(SETTINGS)}."
        kinds, v = p["kinds"], p["events"]
        total = sum(v)
        top = kinds[v.index(max(v))]
        a, b = p["ask"]["more"]
        floods = v[kinds.index("Floods")] * 100 // total
        return [
            mcq(f"{lead} Which type of hazard did {DISTRICT} record most often from {y0} to {y1}?", top,
                [k for k in kinds if k != top], rng),
            short(f"How many hazard events did {DISTRICT} record altogether from {y0} to {y1}?", total,
                  num_forms(total, "events", "hazard events")),
            short(f"How many more {kinds[a].lower()} than {kinds[b].lower()} did {DISTRICT} record from {y0} to {y1}?",
                  v[a] - v[b], num_forms(v[a] - v[b], kinds[a].lower(), "events")),
            short(f"{SHARE}. What percentage of the hazard events {DISTRICT} recorded from {y0} to {y1} were floods?",
                  f"{floods}%", pct_forms(floods)),
        ]
    lead = f"{who} {rng.choice(VERBS)} this bar chart of hazard damage in {DISTRICT} {rng.choice(SETTINGS)}."
    years, f, s = p["years"], p["floods"], p["slides"]
    k = p["ask"]["year"]
    both = [x + y for x, y in zip(f, s)]
    worst = both.index(max(both))
    gap = sum(f) - sum(s)
    more = sum(1 for x, y in zip(f, s) if y > x)
    return [
        short(f"{lead} How many houses did floods and landslides damage altogether in {DISTRICT} in {years[k]}?",
              both[k], num_forms(both[k], "houses")),
        mcq(f"In which year did floods and landslides together damage the most houses in {DISTRICT}?", str(years[worst]),
            [str(y) for i, y in enumerate(years) if i != worst], rng),
        short(f"Over the five years {years[0]} to {years[-1]}, how many more houses in {DISTRICT} were damaged by floods "
              "than by landslides?", gap, num_forms(gap, "houses")),
        count(f"In how many of the five years did landslides damage more houses than floods in {DISTRICT}?", more,
              "years"),
    ]
