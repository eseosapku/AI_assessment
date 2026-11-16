"""A fair test (LS): one classic Lower Secondary investigation, as its results table or as four plans for it.

Results: the independent variable's five values down the first column, three trials of the dependent variable and
their mean across; one reading is anomalous (far from the other two in its row), and two means are left as "?" (the
anomalous row's and one other). Asks the mean of a row, which result is anomalous, the anomalous row's mean leaving
the anomaly out, and the difference between two printed means.

Plans: four pupils' plans for the same question, each variable marked "changed" or "kept the same". Asks which plan
is a fair test of the question, which plan tests a named control variable instead, and how many plans change more
than one variable.

The investigations: an electromagnet (turns of wire, paper clips picked up), sugar dissolving (water temperature,
time), a pendulum (string length, time for 10 swings), pondweed (lamp distance, bubbles a minute), and insulation
(layers of cloth, fall in temperature). Each reading is whole (the pendulum's to 0.1 s), every printed mean exact.
"""
from __future__ import annotations

import math
import random
import textwrap

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, count, mcq, measure, new_figure, short

ID = "fair_test"
KIND = "table.data"
SUBJECT = "science"
BANDS = ("LS",)
CONCEPTS = tuple(f"science.{c}" for c in ("scientific-method", "electromagnets", "magnetism", "dissolving-and-solubility"))
# The book's chapters on investigating, and the skills strands (listed without sections, judged by concepts).
NEEDS = r"investigat|fair test|scientific method|science skills|working scientifically|variables|practical|experiment|planning"
# Strands that share the method concept but teach something else; the sexual-health and glossary chapters.
AVOID = (r"science in context|glossary|cells and reproduction|environmental science|earth and space|elements and compounds|"
         r"motion and energy|^biology$|sexual|pregnan|hiv|reproduction system|social factors")

# iv: what is changed; dv: what is measured; heads: the table's column heads; unit: the stem's unit after a level;
# answer: the unit a dv answer carries (None: a count); controls: what a fair test keeps the same.
INVESTIGATIONS = {
    "electromagnet": {"iv": "number of turns of wire", "dv": "number of paper clips picked up",
                      "iv_head": "Number of turns of wire", "dv_head": "Number of paper clips picked up",
                      "levels": [10, 20, 30, 40, 50], "unit": "turns", "dv_short": "number of paper clips",
                      "answer": None, "noun": "paper clips", "places": 0,
                      "controls": ["current from the battery", "size of the iron nail", "type of paper clip"]},
    "dissolving": {"iv": "temperature of the water", "dv": "time for the sugar to dissolve",
                   "iv_head": "Temperature of water / °C", "dv_head": "Time for the sugar to dissolve / s",
                   "levels": [20, 30, 40, 50, 60], "unit": "°C", "dv_short": "time to dissolve", "answer": "s",
                   "noun": None, "places": 0,
                   "controls": ["volume of water", "mass of sugar", "speed of stirring"]},
    "pendulum": {"iv": "length of the string", "dv": "time for 10 swings",
                 "iv_head": "Length of string / cm", "dv_head": "Time for 10 swings / s",
                 "levels": [20, 40, 60, 80, 100], "unit": "cm", "dv_short": "time for 10 swings", "answer": "s",
                 "noun": None, "places": 1,
                 "controls": ["mass of the bob", "angle the bob is let go from", "type of string"]},
    "pondweed": {"iv": "distance of the lamp from the pondweed", "dv": "number of bubbles given off in one minute",
                 "iv_head": "Distance of lamp from pondweed / cm", "dv_head": "Number of bubbles in one minute",
                 "levels": [10, 20, 30, 40, 50], "unit": "cm", "dv_short": "number of bubbles in one minute",
                 "answer": None, "noun": "bubbles", "places": 0,
                 "controls": ["temperature of the water", "length of the pondweed", "type of lamp"]},
    "insulation": {"iv": "number of layers of cloth around the beaker", "dv": "fall in temperature in 20 minutes",
                   "iv_head": "Number of layers of cloth", "dv_head": "Fall in temperature in 20 minutes / °C",
                   "levels": [0, 1, 2, 3, 4], "unit": "layers", "dv_short": "fall in temperature", "answer": "°C",
                   "noun": None, "places": 0,
                   "controls": ["volume of hot water", "starting temperature of the water", "type of cloth"]},
}
ORDER = list(INVESTIGATIONS)


def concepts_for(p: dict) -> tuple:
    extra = {"electromagnet": ("electromagnets", "magnetism"), "dissolving": ("dissolving-and-solubility",)}.get(p["inv"], ())
    return tuple(f"science.{c}" for c in ("scientific-method", *extra))


# --- sampling ----------------------------------------------------------------------------------------------

def _true_values(inv: str, rng: random.Random) -> list[float]:
    levels = INVESTIGATIONS[inv]["levels"]
    if inv == "electromagnet":
        k = rng.choice([0.5, 0.6, 0.7, 0.8])
        return [k * x for x in levels]
    if inv == "dissolving":
        c = rng.randrange(3000, 4501, 100)
        return [c / (x + 10) for x in levels]
    if inv == "pendulum":
        g = rng.choice([9.78, 9.81, 9.83])
        return [10 * 2 * math.pi * math.sqrt(x / 100 / g) for x in levels]
    if inv == "pondweed":
        a = rng.randrange(50, 71)
        return [a * math.exp(-0.03 * x) for x in levels]
    b = rng.randrange(36, 49)
    return [b * 0.78 ** x for x in levels]


def _results(inv: str, rng: random.Random) -> dict:
    places = INVESTIGATIONS[inv]["places"]
    scale = 10 ** places
    while True:
        true = [round(v * scale) for v in _true_values(inv, rng)]  # in tenths for the pendulum
        n = len(true)
        ai, aj = rng.randrange(n), rng.randrange(3)
        rows = []
        ok = True
        for i, t in enumerate(true):
            # how far a trial strays: a few per cent, so the anomaly stands out
            a = max(1, int(0.015 * t)) if places else max(int(0.04 * t), 1 if t >= 25 else 0)
            for _ in range(200):
                row = [t + rng.randint(-a, a) for _ in range(3)]
                if i == ai:
                    normal = [v for j, v in enumerate(row) if j != aj]
                    if sum(normal) % 2 == 0:
                        break
                elif sum(row) % 3 == 0:
                    break
            else:
                ok = False
                break
            rows.append(row)
        if not ok:
            continue
        normal = [v for j, v in enumerate(rows[ai]) if j != aj]
        med = sorted(normal)[0] if rng.random() < 0.5 else sorted(normal)[1]
        f = rng.uniform(0.42, 0.6) * rng.choice([-1, 1])
        rows[ai][aj] = round(med * (1 + f))
        if rows[ai][aj] <= 0:
            continue
        # The anomaly is the one reading far from its row; every other reading lies close to its row's median.
        devs = sorted(((abs(v - sorted(r)[1]) / sorted(r)[1], i, j) for i, r in enumerate(rows) for j, v in enumerate(r)),
                      reverse=True)
        if devs[0][1:] != (ai, aj) or devs[0][0] < 0.25 or devs[0][0] < 4 * devs[1][0]:
            continue
        blank = rng.choice([i for i in range(n) if i != ai])
        rest = [i for i in range(n) if i not in (ai, blank)]
        compare = sorted(rng.sample(rest, 2))
        trials = [[v / scale if places else v for v in r] for r in rows]
        return {"trials": trials, "anomaly": [ai, aj], "blank": blank, "compare": compare}


def _plans(rng: random.Random) -> dict:
    k = rng.randint(1, 3)
    fair = [True, False, False, False]
    other = [False] * 4
    other[k] = True
    pool = []
    for c in (1, 2, 3):
        row = [True, False, False, False]
        row[c] = True
        pool.append(row)
    for c in (1, 2, 3):
        row = [True, True, True, True]
        row[c] = False
        pool.append(row)
    for c in (1, 2, 3):
        if c != k:
            row = [False] * 4
            row[c] = True
            pool.append(row)
    pool.append([False, True, True, True])
    extras = rng.sample(pool, 2)
    rows = [fair, other, *extras]
    rng.shuffle(rows)
    return {"plans": dict(zip("ABCD", rows)), "ask_control": k}


def sample(rng: random.Random) -> dict:
    inv = rng.choice(ORDER)
    layout = rng.choice(["results", "plans"])
    p = {"band": "LS", "inv": inv, "layout": layout, "name": rng.choice(NAMES), "levels": INVESTIGATIONS[inv]["levels"]}
    p.update(_results(inv, rng) if layout == "results" else _plans(rng))
    return p


# --- drawing -----------------------------------------------------------------------------------------------

def _fmt(v, places: int) -> str:
    return f"{float(v):.1f}" if places else str(int(round(float(v))))


def _cell(ax, x, y, w, h, text="", size=10.0, bold=False, fill="white"):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=fill, edgecolor=INK, linewidth=1.0))
    if text:
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=size, fontweight="bold" if bold else "normal")


def _draw_results(p: dict):
    inv = INVESTIGATIONS[p["inv"]]
    places = inv["places"]
    trials, levels = p["trials"], p["levels"]
    ai, _ = p["anomaly"]
    fig, ax = new_figure(8.6, 4.6)
    w0, w, h = 2.9, 1.25, 0.52
    n = len(levels)
    top = (n + 2) * h  # two header rows
    # header: the independent variable over both header rows, the dependent variable over its four columns
    words, _, unit = inv["iv_head"].partition(" / ")
    head = textwrap.fill(words, 20) + (f"\n/ {unit}" if unit else "")  # the unit stays whole on its own line
    _cell(ax, 0, n * h, w0, 2 * h, head, 9.5, True, "#eeeeee")
    _cell(ax, w0, (n + 1) * h, 4 * w, h, inv["dv_head"], 9.5, True, "#eeeeee")
    for j, head in enumerate(["Trial 1", "Trial 2", "Trial 3", "Mean"]):
        _cell(ax, w0 + j * w, n * h, w, h, head, 9.5, True, "#eeeeee")
    for i, (lv, row) in enumerate(zip(levels, trials)):
        y = (n - 1 - i) * h
        _cell(ax, 0, y, w0, h, str(lv), 10.5)
        for j, v in enumerate(row):
            _cell(ax, w0 + j * w, y, w, h, _fmt(v, places), 10.5)
        mean = "?" if i in (ai, p["blank"]) else _fmt(sum(row) / 3, places)
        _cell(ax, w0 + 3 * w, y, w, h, mean, 10.5, mean == "?")
    ax.text(0, top + 0.62, f"{p['name']}'s results", ha="left", va="center", fontsize=12, fontweight="bold")
    ax.text(0, top + 0.25, f"Question: how does the {inv['iv']} affect the {inv['dv']}?", ha="left", va="center",
            fontsize=10)
    ax.set_xlim(-0.05, w0 + 4 * w + 0.05)
    ax.set_ylim(-0.05, top + 0.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_plans(p: dict):
    inv = INVESTIGATIONS[p["inv"]]
    names = [inv["iv"], *inv["controls"]]
    fig, ax = new_figure(8.8, 4.2)
    w0, w, h, hh = 1.0, 2.0, 0.5, 1.0
    rows = list(p["plans"].items())
    n = len(rows)
    _cell(ax, 0, n * h, w0, hh, "Plan", 10, True, "#eeeeee")
    for j, name in enumerate(names):
        _cell(ax, w0 + j * w, n * h, w, hh, textwrap.fill(name[0].upper() + name[1:], 17), 9.5, True, "#eeeeee")
    for i, (letter, changes) in enumerate(rows):
        y = (n - 1 - i) * h
        _cell(ax, 0, y, w0, h, letter, 11, True)
        for j, changed in enumerate(changes):
            _cell(ax, w0 + j * w, y, w, h, "changed" if changed else "kept the same", 10, changed,
                  "#e2e2e2" if changed else "white")
    top = n * h + hh
    ax.text(0, top + 0.62, f"{p['name']}'s class: four plans", ha="left", va="center", fontsize=12, fontweight="bold")
    ax.text(0, top + 0.25, f"Question: how does the {inv['iv']} affect the {inv['dv']}?", ha="left", va="center",
            fontsize=10)
    ax.set_xlim(-0.05, w0 + 4 * w + 0.05)
    ax.set_ylim(-0.05, top + 0.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_results(p) if p["layout"] == "results" else _draw_plans(p)


# --- questions ---------------------------------------------------------------------------------------------

VERBS = ["recorded", "wrote down", "collected", "measured"]
SETTINGS = ["in a science lesson", "in the school laboratory", "for a science fair", "at the science club", "for homework"]


def _level(inv: dict, v: int) -> str:
    if inv["unit"] == "°C":
        return f"{v} °C"
    if inv["unit"] == "layers" and v == 1:
        return "1 layer"
    return f"{v} {inv['unit']}"


def _answer(stem: str, value: float, inv: dict, places: int):
    """Every answer is exact at the table's precision: whole numbers, or tenths of a second for the pendulum
    (written "12.0" as the table prints it, "12" accepted too)."""
    text = f"{value:.1f}" if places else str(int(round(value)))
    if inv["answer"]:
        unit = inv["answer"]
        return short(stem, text, [f"{text} {unit}", f"{text}{unit}", *measure(float(text), unit)])
    return short(stem, text, [f"{text} {inv['noun']}"])


def questions(p: dict, rng: random.Random) -> list:
    inv = INVESTIGATIONS[p["inv"]]
    name = p["name"]
    if p["layout"] == "plans":
        plans = p["plans"]
        fair = next(k for k, v in plans.items() if v == [True, False, False, False])
        k = p["ask_control"]
        only = next(L for L, v in plans.items() if v[k] and sum(v) == 1)
        many = sum(1 for v in plans.values() if sum(v) >= 2)
        letters = [f"Plan {L}" for L in plans]
        return [mcq(f"{name}'s class {rng.choice(['wrote', 'made', 'shared'])} four plans {rng.choice(SETTINGS)}. "
                    f"Which plan is a fair test of how the {inv['iv']} affects the {inv['dv']}?",
                    f"Plan {fair}", [x for x in letters if x != f"Plan {fair}"], rng),
                mcq(f"Which plan in the table would test how the {inv['controls'][k - 1]} affects the {inv['dv']}?",
                    f"Plan {only}", [x for x in letters if x != f"Plan {only}"], rng),
                count("How many of the four plans change more than one variable?", many, "plans")]
    places = inv["places"]
    trials, levels = p["trials"], p["levels"]
    ai, aj = p["anomaly"]
    blank = p["blank"]
    mean = sum(trials[blank]) / 3
    q1 = _answer(f"{name} {rng.choice(VERBS)} these results {rng.choice(SETTINGS)}. What is the mean "
                 f"{inv['dv_short']} at {_level(inv, levels[blank])}?", round(mean, 3), inv, places)
    cells = [(i, j) for i in range(len(levels)) for j in range(3)]
    label = lambda c: f"{_level(inv, levels[c[0]])}, trial {c[1] + 1}"  # noqa: E731
    others = rng.sample([c for c in cells if c != (ai, aj)], 3)
    q2 = mcq("Which result in this table is anomalous (does not fit the pattern of the others)?", label((ai, aj)),
             [label(c) for c in others], rng)
    rest = [v for j, v in enumerate(trials[ai]) if j != aj]
    q3 = _answer(f"Calculate the mean {inv['dv_short']} at {_level(inv, levels[ai])}, leaving out the anomalous result.",
                 round(sum(rest) / 2, 3), inv, places)
    a, b = p["compare"]
    if rng.random() < 0.5:
        a, b = b, a
    diff = abs(sum(trials[a]) / 3 - sum(trials[b]) / 3)
    q4 = _answer(f"What is the difference between the mean {inv['dv_short']} at {_level(inv, levels[a])} and at "
                 f"{_level(inv, levels[b])}?", round(diff, 3), inv, places)
    return [q1, q2, q3, q4]
