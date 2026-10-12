"""Pictogram with a key: one symbol stands for 2, 4, 5 or 10, and half a symbol for half of that."""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Wedge

from ..core import FILL, INK, mcq, new_figure, short

ID = "pictogram"
KIND = "graph.bar"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "pictograms-pictographs", "papygram", "tally-charts-bar-charts", "data-general", "statistics-general",
    "questions-surveys", "blended-handling-data-concepts",
))

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
# title, what is counted, the verb, "on" a day or "by" a class, the rows, and how to ask which row
CONTEXTS = [
    ("Mangoes sold at a market stall", "mangoes", "sold", "on", DAYS, "On which day were {v} mangoes sold?"),
    ("Eggs collected on a farm", "eggs", "collected", "on", DAYS + ["Saturday"], "On which day were {v} eggs collected?"),
    ("Patients seen at the health centre", "patients", "seen", "on", DAYS, "On which day were {v} patients seen?"),
    ("Books borrowed from the library", "books", "borrowed", "by", ["Class 4A", "Class 4B", "Class 5A", "Class 5B", "Class 6A"],
     "Which class borrowed {v} books?"),
    ("Bottles collected for recycling", "bottles", "collected", "by", ["Class 3", "Class 4", "Class 5", "Class 6"],
     "Which class collected {v} bottles?"),
    ("Trees planted on Umuganda day", "trees", "planted", "by", ["Village A", "Village B", "Village C", "Village D", "Village E"],
     "Which village planted {v} trees?"),
]


def sample(rng: random.Random) -> dict:
    ci = rng.randrange(len(CONTEXTS))
    title, items, verb, prep, rows, which = CONTEXTS[ci]
    key = rng.choice([2, 4, 5, 10])
    unit = key // 2 if key % 2 == 0 else key  # half symbols only when the key halves exactly
    k = rng.randint(4, len(rows)) if len(rows) > 4 else 4
    cats = rows[:k] if prep == "on" else sorted(rng.sample(rows, k))
    values = [unit * v for v in rng.sample(range(1, 8 * key // unit + 1), k)]
    return {"band": "P", "context": ci, "title": title, "items": items, "verb": verb, "prep": prep,
            "cats": cats, "values": values, "key": key}


def _symbol(ax, x: float, y: float, half: bool) -> None:
    if half:
        ax.add_patch(Wedge((x, y), 0.32, 90, 270, facecolor=FILL, edgecolor=INK, linewidth=1))
    else:
        ax.add_patch(Circle((x, y), 0.32, facecolor=FILL, edgecolor=INK, linewidth=1))


def draw(p: dict):
    n = len(p["cats"])
    fig, ax = new_figure(7.4, 0.75 * n + 1.9)
    label_w = 2.6
    for r, (cat, v) in enumerate(zip(p["cats"], p["values"])):
        y = n - r
        ax.text(label_w - 0.3, y, cat, ha="right", va="center", fontsize=11)
        whole, part = divmod(v, p["key"])
        for i in range(whole):
            _symbol(ax, label_w + 0.45 + 0.8 * i, y, False)
        if part:
            _symbol(ax, label_w + 0.45 + 0.8 * whole, y, True)
        ax.plot([0, label_w + 6.9], [y - 0.5, y - 0.5], color="#c8c8c8", linewidth=0.8)
    ax.plot([label_w, label_w], [0.5, n + 0.5], color=INK, linewidth=1)
    _symbol(ax, label_w + 0.45, -0.45, False)
    ax.text(label_w + 0.95, -0.45, f"= {p['key']} {p['items']}", va="center", fontsize=11)
    ax.text(label_w - 0.3, -0.45, "Key:", ha="right", va="center", fontsize=11, fontweight="bold")
    ax.set_xlim(0, label_w + 7.0)
    ax.set_ylim(-1.0, n + 0.7)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(p["title"])
    return fig


def questions(p: dict, rng: random.Random) -> list:
    cats, values, items, verb, prep = p["cats"], p["values"], p["items"], p["verb"], p["prep"]
    i = rng.randrange(len(cats))
    a, b = sorted(rng.sample(range(len(cats)), 2), key=lambda j: -values[j])
    w = rng.randrange(len(cats))
    which = CONTEXTS[p["context"]][5].format(v=values[w])
    return [
        short(f"How many {items} were {verb} {prep} {cats[i]}?", values[i]),
        short(f"How many more {items} were {verb} {prep} {cats[a]} than {prep} {cats[b]}?", values[a] - values[b]),
        short(f"How many {items} were {verb} altogether?", sum(values)),
        mcq(which, cats[w], [c for j, c in enumerate(cats) if j != w], rng),
    ]
