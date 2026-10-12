"""A frequency table: mode and total (Primary); mean, median and range (Lower Secondary); and at
Upper Secondary sometimes grouped data, with the modal class and an estimate of the mean.

The mode is always a single value, the number of values is odd so the median is one value, and
a mean asked "to 1 decimal place" is never a hair from a rounding boundary.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import count, FILL_2, INK, NAMES, mcq, new_figure, short

ID = "frequency_table"
KIND = "table.data"
SUBJECT = "mathematics"
BANDS = ("P", "LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "frequency-distribution-table", "central-tendencies-ungrouped-data", "mode-finding", "median",
    "calculating-statistics-grouped-data", "grouped-data-definition", "class-boundaries",
))

# what was counted, the column heading, the values, who or what was asked, and how to ask how
# many had a given value
UNGROUPED = [
    ("goals scored in each match", "Goals", range(0, 6), "matches", "In how many matches were {x} goals scored?"),
    ("brothers and sisters each student has", "Brothers and sisters", range(0, 7), "students",
     "How many students have {x} brothers and sisters?"),
    ("eggs laid by each hen in a week", "Eggs", range(2, 8), "hens", "How many hens laid {x} eggs in the week?"),
    ("people living in each house", "People", range(1, 8), "houses", "How many houses have {x} people living in them?"),
    ("books each student read last month", "Books", range(0, 6), "students", "How many students read {x} books last month?"),
]
# Equal widths: with unequal ones "the modal class" means different things in different syllabuses.
GROUPED = [("time taken to walk to school", "Time (t minutes)", "t", [(0, 10), (10, 20), (20, 30), (30, 40), (40, 50)], "students"),
           ("mass of each bag of beans", "Mass (m kg)", "m", [(0, 5), (5, 10), (10, 15), (15, 20), (20, 25)], "bags"),
           ("height of each seedling", "Height (h cm)", "h", [(0, 4), (4, 8), (8, 12), (12, 16), (16, 20)], "seedlings")]


def _clean(v: float) -> bool:
    return abs((v * 10) % 1 - 0.5) > 0.05


def stages(p: dict) -> tuple[int, int] | None:
    """Frequency tables: Stage 3 on."""
    return (3, 6) if p["band"] == "P" else None


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if band == "UP" and rng.random() < 0.5:
        while True:
            title, head, var, classes, who = rng.choice(GROUPED)
            fs = [rng.randint(1, 20) for _ in classes]
            mean = sum((lo + hi) / 2 * f for (lo, hi), f in zip(classes, fs)) / sum(fs)
            if fs.count(max(fs)) == 1 and _clean(mean):
                return {"band": band, "grouped": True, "title": title, "head": head, "var": var,
                        "classes": [list(c) for c in classes], "freqs": fs, "who": who, "values": []}
    while True:
        ui = rng.randrange(len(UNGROUPED))
        title, head, values, who, _ = UNGROUPED[ui]
        xs = list(values)
        fs = [rng.randint(0, 9 if band == "P" else 15) for _ in xs]
        n = sum(fs)
        if not n or fs.count(max(fs)) != 1:
            continue
        if band != "P":
            mean = sum(x * f for x, f in zip(xs, fs)) / n
            if n % 2 == 0 or not _clean(mean):
                continue
        return {"band": band, "grouped": False, "kind": ui, "name": rng.choice(NAMES), "title": title, "head": head, "values": xs, "freqs": fs, "who": who}


def draw(p: dict):
    rows = ([f"{lo} < {p['var']} ≤ {hi}" for lo, hi in p["classes"]] if p["grouped"] else [str(x) for x in p["values"]])
    fig, ax = new_figure(4.4, 0.42 * len(rows) + 1.2)
    w0, w1, h = 2.2, 1.4, 0.42
    n = len(rows)
    for c, (text, w, x) in enumerate(((p["head"], w0, 0), ("Frequency", w1, w0))):
        ax.add_patch(Rectangle((x, n * h), w, h, facecolor=FILL_2, edgecolor=INK, linewidth=1))
        ax.text(x + w / 2, (n + 0.5) * h, text, ha="center", va="center", fontsize=10, fontweight="bold")
    for i, (label, f) in enumerate(zip(rows, p["freqs"])):
        y = (n - 1 - i) * h
        ax.add_patch(Rectangle((0, y), w0, h, facecolor="white", edgecolor=INK, linewidth=1))
        ax.add_patch(Rectangle((w0, y), w1, h, facecolor="white", edgecolor=INK, linewidth=1))
        ax.text(w0 / 2, y + h / 2, label, ha="center", va="center", fontsize=11)
        ax.text(w0 + w1 / 2, y + h / 2, str(f), ha="center", va="center", fontsize=11)
    ax.set_xlim(-0.05, w0 + w1 + 0.05)
    ax.set_ylim(-0.05, (n + 1) * h + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(f"The {p['title']}", fontsize=11)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    fs, who = p["freqs"], p["who"]
    n = sum(fs)
    if p["grouped"]:
        classes, var = p["classes"], p["var"]
        labels = [f"{lo} < {var} ≤ {hi}" for lo, hi in classes]
        best = fs.index(max(fs))
        mean = sum((lo + hi) / 2 * f for (lo, hi), f in zip(classes, fs)) / n
        return [
            mcq(f"The table shows the {p['title']} for {n} {who}. What is the modal class?", labels[best],
                [lab for i, lab in enumerate(labels) if i != best], rng),
            short(f"Use the mid-points of the classes to estimate the mean for the {n} {who}. Give your answer to 1 decimal place.",
                  f"{mean:.1f}"),
        ]
    xs = p["values"]
    mode = xs[fs.index(max(fs))]
    i = rng.randrange(len(xs))
    qs = [
        short(f"{p['name']} recorded the number of {p['title']}. What is the mode?", mode),
        count(f"How many {who} are in {p['name']}'s table?", n, who),
        count(UNGROUPED[p["kind"]][4].format(x=xs[i]), fs[i], UNGROUPED[p["kind"]][3]),
    ]
    if p["band"] != "P":
        data = sorted(x for x, f in zip(xs, fs) for _ in range(f))
        mean = sum(data) / n
        present = [x for x, f in zip(xs, fs) if f]
        qs += [
            short(f"Work out the mean number for the {n} {who}. Give your answer to 1 decimal place.", f"{mean:.1f}"),
            short(f"What is the median for the {n} {who}?", data[n // 2]),
            short(f"What is the range of the numbers for the {n} {who}?", max(present) - min(present)),
        ]
    return qs
