"""Fish catch and fish farming (LS, UP; P6 geography): the fish landed from an invented lake or fishing ground, and the
ponds of an invented fish-farming cooperative, as the Rwanda S2-S4 fishing units, S3 "Fishing in Africa" and IGCSE
Environmental Management's world fisheries teach them with data.

Three sub-types:
- kinds: a bar chart of the fish landed from Lake P in a year by kind of fish (tilapia, sambaza, Nile perch, catfish,
  haplochromis, mudfish). The total catch, the kind caught most, how many more tonnes of one kind than another, and
  one kind's share of the catch (percentage = tonnes of the kind ÷ total × 100, printed).
- trend: a line graph of the catch from Fishing Ground P over eight years, which rises and then falls as the ground is
  over-fished, with the sustainable limit drawn and printed. The year the catch first went over the limit, the number
  of years over it, the fall from the highest catch to the last year, and the year of the highest catch.
- ponds: a table of the four ponds of a fish-farming cooperative (area, fingerlings stocked, fish harvested), with the
  stocking density and the yield per square metre printed as rules. One pond's stocking density, the pond with the
  highest yield per square metre (never the pond with the biggest harvest), the total harvest, and one pond's yield.

Every value is on a gridline or printed; every "which" leads the next clearly.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, count, mcq, short
from ._geo_charts import bar_chart, fr, line_chart, num_forms, pct_forms
from .econ_tables import titled_table

ID = "fish_catch"
KIND = "graph.bar"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CATCH = ("geography.fishing",)
FARMING = ("geography.fish-farming",)
CONCEPTS = ("geography.fishing", "geography.fish-farming")
# A topic whose sections the book lists is reached only if its name or a section names fish or the economic activities.
NEEDS = r"fish|economic activit"
# Rivers and lakes as drainage share fishing, but teach the waters, not the catch.
AVOID = r"hydrograph|drainage"
LAKE = "Lake P"
GROUND = "Fishing Ground P"
COOP = "Fish-Farming Cooperative K"
KINDS = ["Tilapia", "Sambaza", "Nile perch", "Catfish", "Haplochromis", "Mudfish"]
PONDS = ["Pond A", "Pond B", "Pond C", "Pond D"]


def concepts_for(p: dict) -> tuple[str, ...]:
    return FARMING if p["sub"] == "ponds" else CATCH


def _kinds(rng: random.Random, band: str) -> dict | None:
    kinds = rng.sample(KINDS, rng.randint(4, 5))
    tonnes = [50 * v for v in rng.sample(range(2, 25), len(kinds))]
    ranked = sorted(tonnes, reverse=True)
    if ranked[0] - ranked[1] < 100:
        return None
    total = sum(tonnes)
    whole = [k for k, t in zip(kinds, tonnes) if t * 100 % total == 0]
    if not whole:
        return None
    a, b = rng.sample(range(len(kinds)), 2)
    if tonnes[a] < tonnes[b]:
        a, b = b, a
    return {"band": band, "sub": "kinds", "year": rng.randint(2015, 2023), "kinds": kinds, "tonnes": tonnes,
            "ask": {"more": [a, b], "share": rng.choice(whole)}}


def _trend(rng: random.Random, band: str) -> dict | None:
    start = rng.randint(2008, 2015)
    peak = rng.randint(3, 5)
    catch = [2 * rng.randint(6, 10)]
    for k in range(1, 8):
        step = 2 * rng.randint(1, 4)
        catch.append(catch[-1] + step if k <= peak else catch[-1] - step)
    if max(catch) > 40 or min(catch) < 6:
        return None
    limit = 2 * rng.randint(9, 15)
    if limit in catch:
        return None
    over = [k for k, c in enumerate(catch) if c > limit]
    if len(over) < 2 or over[-1] - over[0] + 1 != len(over) or over[0] == 0:
        return None
    return {"band": band, "sub": "trend", "years": [start + k for k in range(8)], "catch": catch, "limit": limit}


def _ponds(rng: random.Random, band: str) -> dict | None:
    area = [50 * v for v in rng.sample(range(2, 13), 4)]
    density = [rng.randint(2, 6) for _ in range(4)]
    yields = [Fraction(rng.randint(1, 5), 2) for _ in range(4)]  # kg per m², in halves
    harvest = [a * y for a, y in zip(area, yields)]
    if any(h.denominator != 1 for h in harvest):
        return None
    best = max(range(4), key=lambda i: yields[i])
    if sorted(yields)[-1] - sorted(yields)[-2] < Fraction(1, 2) or best == max(range(4), key=lambda i: harvest[i]):
        return None
    if len(set(harvest)) < 4:
        return None
    return {"band": band, "sub": "ponds", "area": area, "stocked": [a * d for a, d in zip(area, density)],
            "harvest": [int(h) for h in harvest], "ask": {"density": rng.randrange(4), "yield": rng.randrange(4)}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["kinds", "trend", "ponds"])
    make = {"kinds": _kinds, "trend": _trend, "ponds": _ponds}[sub]
    while True:
        p = make(rng, band)
        if p:
            return p


SHARE = "Percentage of the catch = tonnes of the kind ÷ total catch × 100"
DENSITY = "Stocking density = fingerlings stocked ÷ pond area"
YIELD = "Yield = fish harvested ÷ pond area"


def draw(p: dict):
    if p["sub"] == "kinds":
        top = max(p["tonnes"]) + 200
        top -= top % 200
        fig, _ = bar_chart(p["kinds"], p["tonnes"], top=top, major=200, minor=50, ylabel="Fish landed (tonnes)",
                           xlabel="Kind of fish", title=f"Fish landed from {LAKE} in {p['year']}", notes=[SHARE],
                           color="#3a7ca5", size=(7.8, 5.0))
        return fig
    if p["sub"] == "trend":
        lim = p["limit"]

        def limit_line(ax):
            ax.plot([-0.5, 7.5], [lim, lim], color="#c0392b", linewidth=1.6, linestyle="--", zorder=3, gid="limit")
            # its key beside the plot, clear of the catch line wherever the line runs
            ax.plot([1.03, 1.11], [0.95, 0.95], transform=ax.transAxes, clip_on=False, color="#c0392b", linewidth=1.6,
                    linestyle="--", gid="limit-key")
            ax.text(1.03, 0.9, f"Sustainable limit\n({lim} thousand\ntonnes)", transform=ax.transAxes, ha="left",
                    va="top", fontsize=9.5, color="#c0392b", gid="limit-label")
        top = max(p["catch"]) + 10
        top -= top % 10
        fig, _ = line_chart(p["years"], {"catch": p["catch"]}, top=top, major=10, minor=2,
                            ylabel="Fish caught (thousand tonnes)", xlabel="Year",
                            title=f"Fish caught at {GROUND}", size=(8.0, 5.0), extra=limit_line)
        return fig
    rows = [[n, fr(a), fr(s), fr(h)] for n, a, s, h in zip(PONDS, p["area"], p["stocked"], p["harvest"])]
    return titled_table(f"The ponds of {COOP}", ["Pond", "Area (m²)", "Fingerlings\nstocked",
                                                                   "Fish harvested\n(kg)"],
                        rows, ["l", "r", "r", "r"], notes=[DENSITY, YIELD])


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on fishing", "for a class test",
            "at the geography club", "while revising in Rubavu", "for a lesson on fisheries",
            "on a revision card", "while revising in Karongi", "before a visit to a landing site"]


def _fish(name: str) -> str:
    """A kind of fish inside a sentence: "tilapia", but "Nile perch" keeps the river's name."""
    return name if name.startswith("Nile") else name.lower()


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "kinds":
        lead = f"{who} {rng.choice(VERBS)} this bar chart of the fish landed from {LAKE} {rng.choice(SETTINGS)}."
        kinds, t = p["kinds"], p["tonnes"]
        total = sum(t)
        a, b = p["ask"]["more"]
        k = kinds.index(p["ask"]["share"])
        pct = t[k] * 100 // total
        top = kinds[t.index(max(t))]
        return [
            short(f"{lead} How many tonnes of fish were landed from {LAKE} in {p['year']} altogether?", total,
                  num_forms(total, "tonnes", "t")),
            mcq(f"Which kind of fish was landed in the largest amount from {LAKE} in {p['year']}?", top,
                [x for x in kinds if x != top], rng),
            short(f"How many more tonnes of {_fish(kinds[a])} than {_fish(kinds[b])} were landed from {LAKE} in "
                  f"{p['year']}?", t[a] - t[b], num_forms(t[a] - t[b], "tonnes", "t")),
            short(f"{SHARE}. What percentage of the fish landed from {LAKE} in {p['year']} was {_fish(kinds[k])}?",
                  f"{pct}%", pct_forms(pct)),
        ]
    if p["sub"] == "trend":
        lead = f"{who} {rng.choice(VERBS)} this graph of the catch at {GROUND} {rng.choice(SETTINGS)}."
        years, c, lim = p["years"], p["catch"], p["limit"]
        over = [k for k in range(8) if c[k] > lim]
        first = years[over[0]]
        hi = c.index(max(c))
        fall = c[hi] - c[-1]
        return [
            mcq(f"{lead} In which year did the catch at {GROUND} first go over the sustainable limit?", str(first),
                [str(years[k]) for k in (over[0] - 1, over[0] + 1, hi, over[-1], over[-1] + 1, over[0] - 2,
                                         over[0] + 2) if 0 <= k < 8 and years[k] != first], rng),
            count(f"For how many years was the catch at {GROUND} over the sustainable limit of {lim} thousand tonnes?",
                  len(over), "years"),
            short(f"By how many thousand tonnes did the catch at {GROUND} fall from its highest year to {years[-1]}?",
                  fall, num_forms(fall, "thousand tonnes", "thousand", "000 tonnes")),
            mcq(f"In which year was the catch at {GROUND} highest?", str(years[hi]),
                [str(years[k]) for k in (hi - 1, hi + 1, hi - 2, hi + 2) if 0 <= k < 8], rng),
        ]
    lead = f"{who} {rng.choice(VERBS)} this table of fish ponds {rng.choice(SETTINGS)}."
    area, stocked, harvest = p["area"], p["stocked"], p["harvest"]
    d = p["ask"]["density"]
    y = p["ask"]["yield"]
    rate = [Fraction(h, a) for h, a in zip(harvest, area)]
    best = max(range(4), key=lambda i: rate[i])
    total = sum(harvest)
    yv = rate[y]
    ytext = str(yv.numerator) if yv.denominator == 1 else f"{float(yv):.1f}"
    return [
        short(f"{lead} {DENSITY}. What is the stocking density of {PONDS[d]} at {COOP}, in fingerlings per m²?",
              stocked[d] // area[d], num_forms(stocked[d] // area[d], "fingerlings per m²", "per m²", "per m2")),
        mcq(f"{YIELD}. Which pond at {COOP} gave the highest yield of fish per m²?", PONDS[best],
            [x for i, x in enumerate(PONDS) if i != best], rng),
        short(f"How many kilograms of fish were harvested from the four ponds at {COOP} altogether?", total,
              num_forms(total, "kg", "kilograms")),
        short(f"{YIELD}. What was the yield of {PONDS[y]} at {COOP}, in kg per m²?", ytext,
              num_forms(float(yv) if yv.denominator != 1 else int(yv), "kg per m²", "kg/m²", "kg per m2", "kg/m2")),
    ]
