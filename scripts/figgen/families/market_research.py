"""Market research results (UP, AL): the answers to one survey question a Rwandan business asked (a juice maker's
favourite flavour, how shoppers heard of a new shop in Musanze, how workers in Kigali travel), with the question and
the sample size printed above the chart. Two sub-types: a bar chart of the number of respondents for each answer,
every bar ending on a gridline; or a pie chart with each answer's percentage printed in its sector.

How many respondents chose an answer (read off a bar; or the pie's percentage of the printed sample), the percentage
that chose another (bar: its count over the sample) or how many more chose one answer than another (pie), and the most
or the least popular answer. Every count and every percentage is a whole number, and no two answers tie.
"""
from __future__ import annotations

import random

from matplotlib.patches import Wedge

from ..core import GRID, INK, NAMES, count, mcq, new_figure, short

ID = "market_research"
KIND = "graph.bar"
SUBJECT = "business"
BANDS = ("UP", "AL")
CONCEPTS = ("business.market-research",)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"market research|survey|questionnaire|data interpretation"
# Listed without sections and sharing market research, but teaching the other parts of marketing.
AVOID = (r"product and pricing|digital marketing|e-commerce|^trade$|globalisation|what is marketing|marketing mix|"
         r"marketing planning")

# (who asked, the question, its answers, the people asked)
SURVEYS = [
    ("a juice maker in Rwamagana", "Which juice flavour do you like best?",
     ["Mango", "Passion", "Pineapple", "Orange", "Tamarillo", "Watermelon"], "shoppers"),
    ("a bakery in Huye", "Where do you usually buy your bread?",
     ["Bakery", "Supermarket", "Kiosk", "Market", "Hawker"], "customers"),
    ("a new shop in Musanze", "How did you first hear about our shop?",
     ["Radio", "Television", "Friends", "Posters", "Internet", "Newspaper"], "customers"),
    ("a snack stall in Kigali", "Which snack do you buy most often?",
     ["Samosas", "Chapati", "Doughnuts", "Biscuits", "Brochettes"], "students"),
    ("a transport company in Kigali", "How do you usually travel to work?",
     ["Bus", "Motorbike", "Taxi", "Bicycle", "Walking", "Car"], "workers"),
    ("a hotel in Rubavu", "What was the main reason for your visit?",
     ["Holiday", "Business", "Conference", "Wedding", "Family"], "guests"),
    ("a phone shop in Muhanga", "Which feature matters most to you in a phone?",
     ["Battery", "Camera", "Price", "Storage", "Screen"], "customers"),
    ("a dairy in Nyagatare", "Which dairy product do you buy most often?",
     ["Milk", "Yoghurt", "Cheese", "Butter", "Ghee"], "shoppers"),
]
# Bar charts: (sample size, gridline step), so every count is on a gridline and every share a whole percentage.
BAR_SIZES = [(50, 2), (100, 5), (200, 10), (250, 10), (400, 20), (500, 25)]
PIE_SIZES = [40, 60, 80, 120, 160, 200, 240, 300, 400]


def _split(rng: random.Random, total: int, k: int, unit: int, least: int) -> list[int] | None:
    """`total` split into k different parts, each a multiple of `unit` and at least `least`."""
    cuts = sorted(rng.sample(range(1, total // unit), k - 1))
    parts = [(b - a) * unit for a, b in zip([0] + cuts, cuts + [total // unit])]
    if min(parts) < least or len(set(parts)) < k:
        return None
    return parts


def sample(rng: random.Random) -> dict:
    firm, question, answers, people = rng.choice(SURVEYS)
    chart = rng.choice(["bar", "pie"])
    while True:
        k = rng.randint(4, 5)
        if chart == "bar":
            n, step = rng.choice(BAR_SIZES)
            parts = _split(rng, n, k, step, step)
            if not parts or max(parts) // step > 16:
                continue
            counts = parts
        else:
            n, step = rng.choice(PIE_SIZES), 0
            parts = _split(rng, 100, k, 5, 10)  # percentages, every sector big enough to print in
            if not parts:
                continue
            counts = [pc * n // 100 for pc in parts]
        labels = rng.sample(answers, k)
        options = [[lab, c] for lab, c in zip(labels, counts)]
        order = sorted(counts)
        if order[-1] == order[-2] or order[0] == order[1]:
            continue
        return {"band": rng.choice(BANDS), "firm": firm, "question": question, "people": people, "chart": chart,
                "n": n, "step": step, "options": options}


def _bar(ax, p: dict) -> None:
    labels = [o[0] for o in p["options"]]
    counts = [o[1] for o in p["options"]]
    step = p["step"]
    top = max(counts) + 2 * step
    ax.bar(range(len(counts)), counts, width=0.6, color="#9aa4ad", edgecolor=INK, linewidth=1.0, zorder=3)
    ax.set_xticks(range(len(counts)))
    ax.set_xticklabels(labels, fontsize=9.5)
    every = 1 if top // step <= 12 else 2
    ax.set_yticks(range(0, top + 1, step * every))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.tick_params(which="minor", length=0)
    ax.tick_params(axis="y", labelsize=8.5)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    ax.set_xlim(-0.6, len(counts) - 0.4)
    ax.set_ylim(0, top)
    ax.set_ylabel("Number of respondents")


def _pie(ax, p: dict) -> None:
    import math
    n = p["n"]
    angle = 90.0
    shades = ["#7f8c99", "#b9c2cb", "#dde2e7", "#a3aeb9", "#ced5dc"]
    for i, (label, c) in enumerate(p["options"]):
        pct = c * 100 // n
        sweep = 3.6 * pct
        ax.add_patch(Wedge((0, 0), 1.0, angle - sweep, angle, facecolor=shades[i % len(shades)], edgecolor=INK,
                           linewidth=1.0))
        mid = math.radians(angle - sweep / 2)
        ax.text(0.62 * math.cos(mid), 0.62 * math.sin(mid), f"{pct}%", ha="center", va="center", fontsize=10,
                fontweight="bold")
        x, y = 1.12 * math.cos(mid), 1.12 * math.sin(mid)
        ax.text(x, y, label, ha="left" if x >= 0 else "right", va="center", fontsize=10)
        angle -= sweep
    ax.set_xlim(-1.75, 1.75)
    ax.set_ylim(-1.2, 1.2)
    ax.set_aspect("equal")
    ax.axis("off")


def draw(p: dict):
    if p["chart"] == "bar":
        fig, ax = new_figure(6.4, 4.4)
        _bar(ax, p)
    else:
        fig, ax = new_figure(6.4, 4.4)
        _pie(ax, p)
    ax.set_title(f"Survey for {p['firm']}: “{p['question']}”\nSample size: {p['n']} {p['people']}",
                 fontsize=10.5, pad=12)
    return fig


VERBS = ["carried out", "ran", "organised", "conducted", "analysed"]
SETTINGS = ["before launching a new product", "for a marketing plan", "to plan next year's stock", "for a project",
            "for the owner", "in the town centre"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    counts = {lab: c for lab, c in p["options"]}
    labels = list(counts)
    x, y = rng.sample(labels, 2)
    if p["chart"] == "bar":
        pct = counts[y] * 100 // p["n"]
        second = short(f"What percentage of the respondents chose {y}?", pct, [f"{pct}%", f"{pct} %", f"{pct} percent"])
    else:
        a, b = sorted((x, y), key=counts.get, reverse=True)
        second = count(f"How many more respondents chose {a} than {b}?", counts[a] - counts[b], p["people"], "people",
                       "respondents")
    most = rng.random() < 0.6
    key = max(counts, key=counts.get) if most else min(counts, key=counts.get)
    return [
        count(f"{who} {rng.choice(VERBS)} this survey of {p['people']} for {p['firm']} {rng.choice(SETTINGS)}. "
              f"How many of the respondents chose {x}?", counts[x], p["people"], "people", "respondents"),
        second,
        mcq(f"In the survey for {p['firm']}, which answer was the {'most' if most else 'least'} popular?", key,
            [lab for lab in labels if lab != key], rng),
    ]
