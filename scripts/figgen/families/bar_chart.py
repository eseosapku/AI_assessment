"""Bar chart of a class survey. Every bar ends on a labelled gridline."""
from __future__ import annotations

import random

from ..core import FILL, grid_y, mcq, new_figure, short

ID = "bar_chart"
KIND = "graph.bar"
SUBJECT = "mathematics"
BANDS = ("P", "LS")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "bar-charts-dual-compound", "tally-charts-bar-charts", "statistical-graphs-presentation-reading", "data-examining", "infographics",
))

SURVEYS = [
    ("Favourite fruit", ["Mango", "Banana", "Orange", "Pineapple", "Avocado", "Papaya"], "students", "chose"),
    ("How students travel to school", ["Walk", "Bus", "Bicycle", "Car", "Motorbike"], "students", "travel by"),
    ("Favourite sport", ["Football", "Basketball", "Volleyball", "Athletics", "Netball"], "students", "chose"),
    ("Books read this term", ["Amina", "Kofi", "Jean", "Grace", "Tunde", "Aisha"], "books", "read by"),
]


def stages(p: dict) -> tuple[int, int] | None:
    """Scales in ones from Stage 1, in twos from Stage 2."""
    if p["band"] != "P":
        return None
    return (1, 6) if p["step"] == 1 else (2, 6)


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    title, cats, unit, verb = rng.choice(SURVEYS)
    k = rng.randint(4, min(6, len(cats)))
    chosen = rng.sample(cats, k)
    step = rng.choice([1, 2] if band == "P" else [2, 5])  # Primary counts in ones and twos
    values = [v * step for v in rng.sample(range(1, 11), k)]  # distinct, so most and least are unique
    return {"band": band, "title": title, "cats": chosen, "values": values, "step": step, "unit": unit, "verb": verb}


def draw(p: dict):
    fig, ax = new_figure()
    ax.bar(p["cats"], p["values"], color=FILL, edgecolor="#111111", width=0.6)
    grid_y(ax, max(p["values"]) + p["step"], p["step"])
    ax.set_ylabel(f"Number of {p['unit']}")
    ax.set_title(p["title"])
    return fig


def _label(p: dict, cat: str) -> str:
    return f"{p['verb']} {cat}" if p["verb"] != "read by" else f"read by {cat}"


def questions(p: dict, rng: random.Random) -> list:
    pairs = sorted(zip(p["values"], p["cats"]), reverse=True)
    top_value, top = pairs[0]
    a_value, a = pairs[1]
    b_value, b = pairs[-1]
    if p["unit"] == "books":
        q1 = mcq("Who read the most books?", top, [c for _, c in pairs[1:]], rng)
        q2 = short(f"How many more books did {a} read than {b}?", a_value - b_value)
        q3 = short("How many books were read altogether?", sum(p["values"]))
    else:
        q1 = mcq("Which was the most common answer?", top, [c for _, c in pairs[1:]], rng)
        q2 = short(f"How many more {p['unit']} {_label(p, a)} than {_label(p, b)}?", a_value - b_value)
        q3 = short(f"How many {p['unit']} were asked altogether?", sum(p["values"]))
    # Which bar has a given height: every figure asks it of its own number.
    v_value, v = pairs[rng.randrange(len(pairs))]
    q4 = mcq(f"Which bar shows {v_value} {p['unit']}?", v, [c for _, c in pairs if c != v], rng)
    return [q1, q2, q3, q4]
