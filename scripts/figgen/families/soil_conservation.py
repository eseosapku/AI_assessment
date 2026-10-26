"""Soil conservation (LS, UP; P6 geography): soil washed off test plots on a farm's hillside, as the Rwanda S2-S3
agriculture and environmental conservation units, S6 "Environmental Conservation and Tourism" and the NERDC and WAEC
environmental management chapters teach erosion control with field data. The plots and their farm are invented.

Two sub-types:
- methods: a bar chart of the soil lost (tonnes per hectare in a year) from plots on the same slope, one left bare and
  four or five farmed in different ways (crops in rows up and down the slope, crops along the contours, crops with
  mulch, bench terraces, grass strips), with the rule for the percentage reduction printed. How many more tonnes were
  lost from bare soil than from a method, how many times as much, the percentage reduction, and which way of growing
  crops lost the least soil.
- slopes: a grouped bar chart of the soil lost from plots on slopes of 5° to 25°, without and with bench terraces.
  How many tonnes the terraces saved on a slope, how many times as much was lost without them, how much more was lost
  without terraces on a steeper slope than a gentler one, and on how many slopes more than a stated amount was lost
  even with terraces.

The losses keep the order field trials report (bare soil worst, crops up and down the slope next, terraces and grass
strips or mulch least, in no fixed order among them; more soil lost on steeper slopes), every value on a gridline, every "which" clear by 5 tonnes or more.
"""
from __future__ import annotations

import random

from ..core import NAMES, count, mcq, short
from ._geo_charts import bar_chart, grouped_bars, num_forms, pct_forms

ID = "soil_conservation"
KIND = "graph.bar"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = ("geography.soil-conservation", "geography.soil-erosion")
# A topic whose sections the book lists is reached only if its name or a section names soil, erosion, conservation,
# agriculture or the environment.
NEEDS = r"soil|erosion|conserv|agricultur|environment"
# Topics that share soil erosion but teach mining, forests, recycling, hazards or the climate.
AVOID = r"mining|quarr|forest|reduce, reuse|hazard|climate change|carbon|drainage|relief|landform|vegetation"
FARM = "Hill Farm Q"
# Each way of farming the plot, with the range of its yearly loss (tonnes per hectare), in the order trials find.
METHODS = [("Bare soil", (70, 120)), ("Crops in rows up and down the slope", (45, 65)),
           ("Crops in rows along the contours", (20, 40)), ("Crops with mulch", (5, 25)),
           ("Grass strips between crops", (5, 25)), ("Bench terraces", (5, 20))]
CROPS = METHODS[1:]
SLOPES = [5, 10, 15, 20, 25]


def _methods(rng: random.Random, band: str) -> dict | None:
    chosen = [METHODS[0]] + sorted(rng.sample(CROPS, rng.randint(4, 5)), key=CROPS.index)
    vals = [5 * rng.randint(lo // 5, hi // 5) for _, (lo, hi) in chosen]
    if len(set(vals)) < len(vals):
        return None
    crops = sorted(vals[1:])
    if crops[1] - crops[0] < 5:
        return None
    bare = vals[0]
    times = [i for i in range(1, len(vals)) if bare % vals[i] == 0]
    cut = [i for i in range(1, len(vals)) if (bare - vals[i]) * 100 % bare == 0]
    if not times or not cut:
        return None
    return {"band": band, "sub": "methods", "slope": rng.choice([10, 12, 15, 20]), "names": [n for n, _ in chosen],
            "loss": vals, "ask": {"more": rng.randrange(1, len(vals)), "times": rng.choice(times), "cut": rng.choice(cut)}}


def _slopes(rng: random.Random, band: str) -> dict | None:
    without = sorted(5 * v for v in rng.sample(range(2, 25), 5))
    terraced = sorted(5 * v for v in rng.sample(range(1, 8), 5))
    if any(t >= w for t, w in zip(terraced, without)):
        return None
    times = [i for i in range(5) if without[i] % terraced[i] == 0 and without[i] // terraced[i] >= 2]
    limit = rng.choice([10, 15, 20, 25])
    over = sum(1 for t in terraced if t > limit)
    if not times or over == 0 or over == 5 or limit in terraced:
        return None
    a, b = sorted(rng.sample(range(5), 2))
    return {"band": band, "sub": "slopes", "without": without, "terraced": terraced, "limit": limit,
            "ask": {"saved": rng.randrange(5), "times": rng.choice(times), "steeper": [a, b]}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["methods", "slopes"])
    while True:
        p = (_methods if sub == "methods" else _slopes)(rng, band)
        if p:
            return p


REDUCTION = "Reduction in soil loss (%) = (loss from bare soil − loss with the method) ÷ loss from bare soil × 100"


def draw(p: dict):
    if p["sub"] == "methods":
        top = max(p["loss"]) + 20
        top -= top % 20
        fig, _ = bar_chart(p["names"], p["loss"], top=top, major=20, minor=5,
                           ylabel="Soil lost (tonnes per hectare per year)", xlabel="How the plot was farmed",
                           title=f"Soil lost from test plots on a {p['slope']}° slope at {FARM}", notes=[REDUCTION],
                           color="#b5651d", size=(8.6, 5.6), wrap_at=13)
        return fig
    top = max(p["without"]) + 20
    top -= top % 20
    fig, _ = grouped_bars([f"{s}°" for s in SLOPES], {"Without terraces": p["without"],
                                                      "With bench terraces": p["terraced"]},
                          top=top, major=20, minor=5, ylabel="Soil lost (tonnes per hectare per year)",
                          xlabel="Slope of the plot", title=f"Soil lost from test plots at {FARM}",
                          colors=["#b5651d", "#6b8e23"], size=(8.6, 5.2))
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on soil erosion", "for a class test",
            "at the environment club", "while revising in Musanze", "for a lesson on conservation",
            "before a visit to a farm", "on a revision card", "while revising in Nyagatare"]


def _short_name(name: str) -> str:
    return name[0].lower() + name[1:]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    lead = f"{who} {rng.choice(VERBS)} this bar chart of soil erosion at {FARM} {rng.choice(SETTINGS)}."
    ask = p["ask"]
    t = "tonnes per hectare"
    if p["sub"] == "methods":
        names, loss = p["names"], p["loss"]
        bare = loss[0]
        i, j, k = ask["more"], ask["times"], ask["cut"]
        more = bare - loss[i]
        times = bare // loss[j]
        cut = (bare - loss[k]) * 100 // bare
        best = min(range(1, len(loss)), key=lambda x: loss[x])
        return [
            short(f"{lead} How many more tonnes of soil per hectare were lost from the bare soil plot than from the plot "
                  f"farmed with {_short_name(names[i])}?", more, num_forms(more, "tonnes", t, "t/ha")),
            short(f"At {FARM}, how many times as much soil was lost from the bare soil plot as from the plot farmed with "
                  f"{_short_name(names[j])}?", times, num_forms(times, "times")),
            short(f"{REDUCTION}. By what percentage was the soil lost at {FARM} reduced on the plot farmed with "
                  f"{_short_name(names[k])}?",
                  f"{cut}%", pct_forms(cut)),
            mcq(f"Which way of growing crops lost the least soil from the test plots at {FARM}?", names[best],
                [names[x] for x in range(1, len(loss)) if x != best], rng),
        ]
    w, tr = p["without"], p["terraced"]
    s = ask["saved"]
    j = ask["times"]
    a, b = ask["steeper"]
    saved = w[s] - tr[s]
    rise = w[b] - w[a]
    over = sum(1 for v in tr if v > p["limit"])
    return [
        short(f"{lead} How many tonnes of soil per hectare did bench terraces save on the {SLOPES[s]}° slope?", saved,
              num_forms(saved, "tonnes", t, "t/ha")),
        short(f"On the {SLOPES[j]}° slope at {FARM}, how many times as much soil was lost without terraces as with "
              "bench terraces?", w[j] // tr[j], num_forms(w[j] // tr[j], "times")),
        short(f"Without terraces, how many more tonnes of soil per hectare were lost at {FARM} on the {SLOPES[b]}° "
              f"slope than on the {SLOPES[a]}° slope?", rise, num_forms(rise, "tonnes", t, "t/ha")),
        count(f"Even with bench terraces, on how many of the five slopes at {FARM} was more than {p['limit']} tonnes "
              "of soil per hectare lost?", over, "slopes"),
    ]
