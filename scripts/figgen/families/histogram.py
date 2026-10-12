"""A histogram: equal class widths with frequency (LS), or unequal widths with frequency density
(UP), where a frequency is the density times the width.

Densities sit on half-unit gridlines and every frequency is a whole number.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import count, FILL, GRID, INK, NAMES, mcq, new_figure, short

ID = "histogram"
KIND = "graph.bar"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("histogram", "frequency-polygons", "grouped-data-definition", "class-boundaries",
                                             "calculating-statistics-grouped-data"))

# The axis names one value, as exam papers do: "Age (a years)".
AXIS = {"heights": "Height", "times": "Time", "masses": "Mass", "ages": "Age"}

# what, variable, unit, who, equal-width classes, unequal-width classes, how to say "in a class", and
# how to say "above a boundary"
CONTEXTS = [
    ("heights of seedlings", "h", "cm", "seedlings", [(0, 10), (10, 20), (20, 30), (30, 40), (40, 50)],
     [(0, 10), (10, 20), (20, 30), (30, 50), (50, 80)], "are between {lo} and {hi} cm tall", "are more than {b} cm tall"),
    ("times taken to walk to school", "t", "minutes", "students", [(0, 5), (5, 10), (10, 15), (15, 20), (20, 25), (25, 30)],
     [(0, 4), (4, 10), (10, 20), (20, 30), (30, 50)], "took between {lo} and {hi} minutes", "took more than {b} minutes"),
    ("masses of bags of rice", "m", "kg", "bags", [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10)],
     [(0, 2), (2, 4), (4, 8), (8, 12), (12, 20)], "weigh between {lo} and {hi} kg", "weigh more than {b} kg"),
    ("ages of people at a clinic", "a", "years", "people", [(0, 10), (10, 20), (20, 30), (30, 40), (40, 50), (50, 60)],
     [(0, 10), (10, 20), (20, 40), (40, 60), (60, 90)], "are between {lo} and {hi} years old", "are more than {b} years old"),
]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    ci = rng.randrange(len(CONTEXTS))
    classes = CONTEXTS[ci][4] if band == "LS" else CONTEXTS[ci][5]
    while True:
        if band == "LS":
            fs = [rng.randint(2, 20) for _ in classes]
        else:
            # Density k/2 per unit: a whole frequency whenever k times the width is even.
            fs = []
            for lo, hi in classes:
                w = hi - lo
                ks = [k for k in range(1, 13) if (k * w) % 2 == 0]
                fs.append(rng.choice(ks) * w // 2)
        if fs.count(max(fs)) == 1:
            return {"band": band, "context": ci, "classes": [list(c) for c in classes], "freqs": fs, "name": rng.choice(NAMES)}


def minor_step(p: dict) -> float:
    """The small gridlines: every whole frequency at Lower Secondary, every half unit of density at Upper."""
    return 1 if p["band"] == "LS" else 0.5


def draw(p: dict):
    what, var, unit, who, *_ = CONTEXTS[p["context"]]
    classes, fs = p["classes"], p["freqs"]
    heights = fs if p["band"] == "LS" else [f / (hi - lo) for (lo, hi), f in zip(classes, fs)]
    top = max(heights)
    fig, ax = new_figure(6.4, 4.4)
    for (lo, hi), h in zip(classes, heights):
        ax.add_patch(Rectangle((lo, 0), hi - lo, h, facecolor=FILL, edgecolor=INK, linewidth=1.2))
    minor = minor_step(p)
    ticks = [i * minor for i in range(int(top / minor) + 2)]
    ax.set_yticks(ticks[::2] if (p["band"] == "UP" or top > 12) else ticks)  # numbers every whole or every two
    ax.set_yticks(ticks, minor=True)
    ax.grid(True, axis="y", which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xticks(sorted({c for cls in classes for c in cls}))
    ax.set_xlim(classes[0][0], classes[-1][1])
    ax.set_ylim(0, ticks[-1])
    ax.set_xlabel(f"{AXIS[what.split(' ')[0]]} ({var} {unit})")
    ax.set_ylabel("Frequency" if p["band"] == "LS" else "Frequency density")
    ax.set_title(f"The {what}", fontsize=11)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    what, var, unit, who, *_ = CONTEXTS[p["context"]]
    classes, fs = p["classes"], p["freqs"]
    i = rng.randrange(len(classes))
    lo, hi = classes[i]
    labels = [f"{a} < {var} ≤ {b}" for a, b in classes]
    best = fs.index(max(fs))
    k = rng.randrange(1, len(classes))
    return [
        count(f"{p['name']} drew this histogram of the {what}. How many of the {who} {CONTEXTS[p['context']][6].format(lo=lo, hi=hi)}?",
              fs[i], who),
        count(f"How many {who} does {p['name']}'s histogram show altogether?", sum(fs), who),
        mcq(f"In {p['name']}'s histogram, which class has the most {who}?", labels[best], [lab for j, lab in enumerate(labels) if j != best], rng),
        # Adding classes: everything above one of the class boundaries.
        count(f"How many of the {who} in {p['name']}'s histogram {CONTEXTS[p['context']][7].format(b=classes[k][0])}?", sum(fs[k:]), who),
    ]
