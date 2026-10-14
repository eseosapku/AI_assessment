"""Variation charts (LS, UP): two charts from one class of students, lettered P and Q: a histogram of a feature
that varies continuously (height, hand span, mass), its bars touching, and a bar chart of one that varies
discontinuously (blood group, tongue rolling, earlobes), its bars apart. Which chart shows continuous
variation, how many students are in a group, and the modal class.

Every bar ends on a gridline; the histogram has one tallest bar.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "variation_chart"
KIND = "graph.bar"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("continuous-discontinuous-variation", "variation-causes"))
AVOID = r"cell|enzyme|immun|disease|reproduc|excretion|digest|photosynth|respiration|hormone|ecolog|population|mitosis|meiosis|mutation"
CONTINUOUS = [("height", "cm", 140, 5), ("hand span", "cm", 16, 2), ("mass", "kg", 40, 5)]  # feature, unit, first class, width
DISCRETE = [("blood group", ["A", "B", "AB", "O"]), ("tongue rolling", ["can roll", "cannot roll"]),
            ("earlobes", ["free", "attached"])]


def sample(rng: random.Random) -> dict:
    feature, unit, start, width = rng.choice(CONTINUOUS)
    k = rng.choice([5, 6, 7])
    classes = [f"{start + i * width}–{start + (i + 1) * width - 1}" for i in range(k)]
    peak = rng.randrange(1, k - 1)
    freq = [max(1, 9 - 3 * abs(i - peak) + rng.randint(-1, 1)) for i in range(k)]
    freq[peak] = max(freq) + rng.randint(1, 2)  # one modal class
    name, cats = rng.choice(DISCRETE)
    dfreq = rng.sample(range(2, 14), len(cats))
    left = rng.choice(["continuous", "discrete"])
    letters = {"continuous": "P" if left == "continuous" else "Q", "discrete": "Q" if left == "continuous" else "P"}
    return {"band": rng.choice(BANDS), "continuous": {"letter": letters["continuous"], "feature": feature, "unit": unit,
                                                      "classes": classes, "freq": freq},
            "discrete": {"letter": letters["discrete"], "feature": name, "categories": cats, "freq": dfreq},
            "left": left, "ask": rng.choice(cats)}


def _axes(ax, top):
    ax.set_yticks(range(0, top + 1, 2))
    ax.set_yticks(range(0, top + 1), minor=True)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_ylim(0, top)
    ax.set_ylabel("Number of students")
    ax.tick_params(labelsize=8)


def draw(p: dict):
    import matplotlib.pyplot as plt
    fig = plt.figure(figsize=(8.6, 3.8))
    c, d = p["continuous"], p["discrete"]
    top = max(max(c["freq"]), max(d["freq"])) + 2
    order = [c, d] if p["left"] == "continuous" else [d, c]
    for i, chart in enumerate(order):
        ax = fig.add_subplot(1, 2, i + 1)
        _axes(ax, top)
        if chart is c:
            xs = list(range(len(c["classes"])))
            ax.bar(xs, c["freq"], width=1.0, color="#cfd8dc", edgecolor=INK, linewidth=1.0)  # touching: a continuous scale
            ax.set_xticks(xs)
            ax.set_xticklabels(c["classes"], rotation=0, fontsize=7)
            ax.set_xlim(-0.5, len(xs) - 0.5)
            ax.set_xlabel(f"{c['feature'].capitalize()} ({c['unit']})")
        else:
            xs = list(range(len(d["categories"])))
            ax.bar(xs, d["freq"], width=0.55, color="#cfd8dc", edgecolor=INK, linewidth=1.0)
            ax.set_xticks(xs)
            ax.set_xticklabels(d["categories"], fontsize=9)
            ax.set_xlim(-0.6, len(xs) - 0.4)
            ax.set_xlabel(d["feature"].capitalize())
        ax.set_title(f"Chart {chart['letter']}", fontsize=12, fontweight="bold")
    fig.tight_layout()
    return fig


SETTINGS = ["in a biology lesson", "for a class survey", "for a science project", "at the science club"]


def _how_many(feature: str, cat: str) -> str:
    if feature == "blood group":
        return f"How many students have blood group {cat}?"
    if feature == "tongue rolling":
        return "How many students can roll their tongue?" if cat == "can roll" else "How many students cannot roll their tongue?"
    return f"How many students have {cat} earlobes?"


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    c, d = p["continuous"], p["discrete"]
    n = d["freq"][d["categories"].index(p["ask"])]
    i = c["freq"].index(max(c["freq"]))
    mode = c["classes"][i]
    plain = mode.replace("–", "-")
    qs = [mcq(f"{who} surveyed a class {rng.choice(SETTINGS)} and drew these two charts. Which chart shows continuous variation?",
              f"chart {c['letter']}", [f"chart {d['letter']}", "both charts", "neither chart"], rng),
          short(_how_many(d["feature"], p["ask"]), n, [str(n), f"{n} students"]),
          short(f"{friend} looks at chart {c['letter']}. What is the modal class of {c['feature']}?", mode,
                [mode, plain, plain.replace("-", " to "), plain.replace("-", " - "), mode.replace("–", " – "), f"{mode} {c['unit']}",
                 f"{plain} {c['unit']}"])]
    return qs
