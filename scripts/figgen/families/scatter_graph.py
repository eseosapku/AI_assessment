"""Scatter graph with a stated correlation. Points sit on gridline crossings."""
from __future__ import annotations

import random

from ..core import NAMES, count, GRID, mcq, new_figure, short

ID = "scatter_graph"
KIND = "graph.scatter"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "scatter-graphs", "coefficient-correlation", "regression-lines",
))

PAIRS = [
    ("Hours of revision", "Test score (%)", "positive", "a student who revised for {x} hours", "score"),
    ("Age of car (years)", "Value of car (millions of RWF)", "negative", "a car that is {x} years old", "value, in millions of RWF"),
    ("Daily temperature (°C)", "Cold drinks sold", "positive", "a day when the temperature was {x} °C", "number of drinks sold"),
    ("Shoe size", "Mark in a spelling test", "none", "the student with shoe size {x}", "mark"),
]
# What the points are, and what their height measures, for counting points above a value.
COUNTED = {"Hours of revision": ("students", "a test score"), "Age of car (years)": ("cars", "a value"),
           "Daily temperature (°C)": ("days", "cold drink sales"), "Shoe size": ("students", "a spelling mark")}


def _r(xs, ys) -> float:
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    return sxy / (sxx * syy) ** 0.5 if sxx and syy else 0.0


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    xl, yl, trend, who, what = rng.choice(PAIRS)
    while True:
        xs = sorted(rng.sample(range(1, 13), 9))  # distinct x, so each point is named by its x
        if trend == "positive":
            ys = [min(95, max(5, 5 * round((20 + 6 * x + rng.choice([-10, -5, 0, 5, 10])) / 5))) for x in xs]
        elif trend == "negative":
            ys = [min(95, max(5, 5 * round((90 - 6 * x + rng.choice([-10, -5, 0, 5, 10])) / 5))) for x in xs]
        else:
            ys = [5 * rng.randint(4, 16) for _ in xs]
        r = _r(xs, ys)
        if (trend == "positive" and r > 0.8) or (trend == "negative" and r < -0.8) or (trend == "none" and abs(r) < 0.2):
            return {"band": band, "xl": xl, "yl": yl, "trend": trend, "who": who, "what": what, "xs": xs, "ys": ys,
                    "name": rng.choice(NAMES)}


def draw(p: dict):
    fig, ax = new_figure()
    ax.scatter(p["xs"], p["ys"], marker="x", color="#111111", s=50)
    ax.set_xticks(range(0, 14))
    ax.set_xlim(0, 13)
    ax.set_yticks(range(0, 105, 5))
    ax.set_ylim(0, 100)
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlabel(p["xl"])
    ax.set_ylabel(p["yl"])
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name = {"positive": "Positive correlation", "negative": "Negative correlation", "none": "No correlation"}
    i = rng.randrange(len(p["xs"]))
    who = p["who"].format(x=p["xs"][i])
    # Points on both sides of the value asked about, and none on it: a gridline if one is free,
    # else a whole number between gridlines (the points all sit on fives).
    lo, hi = min(p["ys"]), max(p["ys"])
    between = [t for t in range(5, 100, 5) if t not in p["ys"] and lo < t < hi]
    t = rng.choice(between) if between else rng.choice([t for t in range(lo + 1, hi) if t % 5])
    things, measure = COUNTED[p["xl"]]
    return [
        mcq(f"{p['name']} drew this scatter graph. What type of correlation does it show?", name[p["trend"]],
            [v for k, v in name.items() if k != p["trend"]], rng),
        short(f"In {p['name']}'s graph, what is the {p['what']} for {who}?", p["ys"][i]),
        count(f"In {p['name']}'s graph, how many {things} had {measure} of more than {t}?", sum(1 for y in p["ys"] if y > t), things),
    ]
