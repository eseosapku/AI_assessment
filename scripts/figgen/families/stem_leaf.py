"""A stem-and-leaf diagram with a key: median, range and counting above a value (LS, UP).

An odd number of values, so the median is one of them.
"""
from __future__ import annotations

import random

from ..core import count, INK, NAMES, new_figure, short

ID = "stem_leaf"
KIND = "graph.stats"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
# One variable: a shared word like "dispersion" is no reason to sit in a two-variable chapter.
AVOID = r"bivariate|scatter|correlation|regression|random variable"
CONCEPTS = tuple(f"mathematics.{c}" for c in ("stem-leaf-diagrams", "median", "range", "mode-finding", "rank-order-list",
                                             "central-tendencies-ungrouped-data", "dispersion-measures"))

# what was measured, its unit, the people or things, the lowest and highest values, and how to
# ask for more than a value ("a mass of more than 50 kg")
DATA = [("masses", "kg", "students", 32, 79, "a mass of more than {t} kg"),
        ("times to run 200 m", "seconds", "runners", 25, 68, "a time of more than {t} seconds"),
        ("marks in a test", "marks", "students", 21, 98, "more than {t} marks"),
        ("heights", "cm", "bean plants", 12, 59, "a height of more than {t} cm"),
        ("ages", "years", "people at a meeting", 18, 75, "an age of more than {t} years")]


def sample(rng: random.Random) -> dict:
    i = rng.randrange(len(DATA))
    what, unit, who, lo, hi, _ = DATA[i]
    n = rng.choice(range(11, 26, 2))
    data = sorted(rng.randint(lo, hi) for _ in range(n))
    return {"band": rng.choice(BANDS), "kind": i, "name": rng.choice(NAMES), "what": what, "unit": unit, "who": who, "data": data}


def draw(p: dict):
    data = p["data"]
    stems = range(data[0] // 10, data[-1] // 10 + 1)
    fig, ax = new_figure(4.6, 0.45 * len(stems) + 1.4)
    for i, s in enumerate(stems):
        y = len(stems) - i
        ax.text(0.4, y, str(s), ha="right", va="center", fontsize=13)
        leaves = "  ".join(str(v % 10) for v in data if v // 10 == s)
        ax.text(0.75, y, leaves, ha="left", va="center", fontsize=13)
    ax.plot([0.58, 0.58], [0.5, len(stems) + 0.5], color=INK, linewidth=1.4)
    eg = data[len(data) // 3]
    ax.text(0.0, -0.2, f"Key: {eg // 10} | {eg % 10} means {eg} {p['unit']}", ha="left", va="center", fontsize=11)
    ax.set_xlim(-0.3, 6.5)
    ax.set_ylim(-0.7, len(stems) + 0.8)
    ax.axis("off")
    ax.set_title(f"The {p['what']} of {len(data)} {p['who']}", fontsize=11)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    data, unit, who = p["data"], p["unit"], p["who"]
    n = len(data)
    t = rng.choice([v for v in range(data[0], data[-1]) if v % 5 == 0] or [data[0]])
    above = sum(1 for v in data if v > t)
    forms = lambda v: [f"{v} {unit}"]  # noqa: E731
    more = DATA[p["kind"]][5].format(t=t)
    return [
        short(f"{p['name']} recorded the {p['what']} of {n} {who}. What is the median?", data[n // 2], forms(data[n // 2])),
        short(f"What is the range of the {p['what']} {p['name']} recorded?", data[-1] - data[0], forms(data[-1] - data[0])),
        count(f"How many of the {who} have {more}?", above, who),
    ]
