"""Plant growth investigations (P): bean or maize plants grown under two or three conditions (watered every day, once
a week or not at all; with compost or without; in three soils A, B and C), their heights measured every few days.
A bar chart (lower level) or a line graph (upper level), every height on a gridline.

How tall a plant was on a day, how much a plant grew between two days, how much taller one plant was than another
(or, for the soils, in which soil the plant was tallest), on which day a plant reached a height (upper), and what
was changed in the investigation.

The heights behave as a teacher expects: no plant shrinks; every plant starts the same height; watered plants grow
more than dry ones, which soon stop; compost always helps. Which of three unnamed soils is best is only in the
figure. No two plants share a height after the start, and the final heights stand at least 2 cm apart.
"""
from __future__ import annotations

import random

from ..core import FILL, GRID, INK, NAMES, mcq, new_figure, short

ID = "plant_growth_p"
KIND = "graph.line"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.plant-nutrition-and-growth", "science.seed-germination", "science.plant-water-relations",
            "science.scientific-method")
# A topic whose sections the book lists is reached only if it names plant growth, germination or what plants need,
# or fair testing and observing over time.
NEEDS = (r"plant growth|growing plants|growing seeds|how seeds grow|plants? need|germination|plants and light"
         r"|fair test|observing over time")

LABELS = {"water": ["watered every day", "watered once a week", "not watered"], "compost": ["with compost", "without compost"],
          "soil": ["soil A", "soil B", "soil C"]}
PHRASE = {"watered every day": "the plant watered every day", "watered once a week": "the plant watered once a week",
          "not watered": "the plant that was not watered", "with compost": "the plant with compost",
          "without compost": "the plant without compost", "soil A": "the plant in soil A", "soil B": "the plant in soil B",
          "soil C": "the plant in soil C"}
# How fast each plant grows, in cm a day: (slowest, fastest). A young bean or maize plant grows a centimetre or so a day.
GROWTH = {"watered every day": (0.8, 1.5), "watered once a week": (0.3, 0.8), "with compost": (0.9, 1.5),
          "without compost": (0.4, 0.9)}
# The three soils grow plants at three different speeds, given to soils A, B and C at random.
SOIL_SPEEDS = [(0.4, 0.7), (0.8, 1.1), (1.2, 1.6)]
CHANGE = {"water": "how often the plant was watered", "compost": "whether compost was added to the soil",
          "soil": "the type of soil"}
# The days measured. Three weeks of growth (to day 20) reach 36 cm, on a scale numbered every 4 cm.
DAYS = {"line": [[0, 3, 6, 9, 12], [0, 2, 4, 6, 8], [0, 5, 10, 15, 20]], "bar": [[3, 6, 9, 12], [2, 4, 6, 8]]}
STYLES = [("-", "o"), ("--", "s"), (":", "^")]
BARS = [(FILL, ""), ("white", "///"), ("#d6dade", "..")]


def stages(p: dict) -> tuple[int, int] | None:
    """A line graph with three lines is for the older classes."""
    return (4, 6) if p["level"] == "upper" else None


def _grow(rng: random.Random, speed, gaps: list[int], grid: int, start: int) -> list[int]:
    """The heights on each day measured, growing from `start` at `speed` (cm a day, slowest and fastest) over the
    gaps in days between measurements, each rise a whole number of gridlines; no speed: the plant not watered."""
    if speed is None:  # the water in the soil runs out: a little growth, then none
        rise = [grid * rng.randint(0, 1)] + [0] * (len(gaps) - 1)
    else:
        lo, hi = speed
        rise = []
        for gap in gaps:
            fewest = round(lo * gap / grid)
            rise.append(grid * rng.randint(fewest, max(fewest, round(hi * gap / grid))))
    out, h = [], start
    for r in rise:
        h += r
        out.append(h)
    return out


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    cond = rng.choice(sorted(LABELS))
    chart = "bar" if level == "lower" else "line"
    plant = rng.choice(["bean", "maize"])
    if cond == "water":
        labels = ["watered every day", "not watered"] if level == "lower" or rng.random() < 0.4 else LABELS["water"][:]
    elif cond == "compost":
        labels = LABELS["compost"][:]
        rng.shuffle(labels)
    else:
        labels = LABELS["soil"][:]
    while True:  # a scale and days; then plants that fit them, or another scale
        days = rng.choice(DAYS[chart])
        grid, label = (2, 2) if level == "lower" else (2, 4) if days[-1] == 20 else rng.choice([(1, 2), (2, 4)])
        gaps = [b - a for a, b in zip([0] + days, days) if b > a]
        speeds = rng.sample(SOIL_SPEEDS, 3) if cond == "soil" else [GROWTH.get(lb) for lb in labels]
        for _ in range(300):
            heights = _plants(rng, labels, speeds, days, gaps, grid, cond)
            if heights:
                top = -(-(max(map(max, heights)) + grid) // label) * label
                return {"band": "P", "level": level, "plant": plant, "cond": cond, "labels": labels, "days": days,
                        "heights": heights, "chart": chart, "grid": grid, "label": label, "top": top,
                        "ask": _asks(rng, labels, days, heights, cond, level)}


def _plants(rng, labels, speeds, days, gaps, grid, cond) -> list | None:
    """The heights of each plant on each day, or None where they break a rule: no two plants the same height after
    the first day measured, the final heights 2 cm apart, watered and composted plants always ahead."""
    start = grid * rng.randint(1, 2)
    heights = [_grow(rng, sp, gaps, grid, start) for sp in speeds]
    if days[0] == 0:
        heights = [[start] + row for row in heights]
    cols = [[row[j] for row in heights] for j in range(1, len(days))]
    if any(len(set(c)) < len(c) for c in cols):
        return None
    final = sorted((row[-1] for row in heights), reverse=True)
    if any(a - b < 2 for a, b in zip(final, final[1:])):
        return None
    if cond != "soil":  # watered every day, then once a week, then not at all; with compost, then without
        rank = [labels.index(lb) for lb in LABELS[cond] if lb in labels]
        if any(c[a] <= c[b] for c in cols for a, b in zip(rank, rank[1:])):
            return None
    return heights


def _asks(rng, labels, days, heights, cond, level) -> dict:
    n, m = len(labels), len(days)
    read = [rng.randrange(n), rng.randrange(1, m)]
    grew = [(k, a, b) for k in range(n) for a in range(m) for b in range(a + 1, m) if heights[k][b] > heights[k][a]]
    k, a, b = rng.choice(grew)
    ask = {"read": read, "grow": [k, a, b], "day": rng.randrange(1, m)}
    j = ask["day"]
    pair = sorted(rng.sample(range(n), 2), key=lambda i: -heights[i][j])
    ask["taller"] = pair
    if level == "upper":
        once = [(i, jj) for i in range(n) for jj in range(1 if days[0] == 0 else 0, m) if heights[i].count(heights[i][jj]) == 1]
        ask["when"] = list(rng.choice(once))
    return ask


def draw(p: dict):
    fig, ax = new_figure(6.4, 4.4)
    labels, days, h = p["labels"], p["days"], p["heights"]
    if p["chart"] == "line":
        for k, (lb, row) in enumerate(zip(labels, h)):
            ls, mk = STYLES[k]
            ax.plot(days, row, linestyle=ls, marker=mk, color=INK, linewidth=1.8, markersize=6.5, label=lb, gid=f"plant-{k}",
                    clip_on=False, zorder=3)
        ax.set_xticks(days)
        ax.set_xlim(days[0], days[-1] + (days[1] - days[0]) * 0.25)
        ax.set_xlabel("Time (days)", fontsize=11)
    else:
        n = len(labels)
        bw = 0.8 / n
        for k, (lb, row) in enumerate(zip(labels, h)):
            colour, hatch = BARS[k]
            bars = ax.bar([j + (k - (n - 1) / 2) * bw for j in range(len(days))], row, width=bw, color=colour, hatch=hatch,
                          edgecolor=INK, linewidth=1.0, label=lb, zorder=3)
            for j, bar in enumerate(bars):
                bar.set_gid(f"bar-{k}-{j}")
        ax.set_xticks(range(len(days)), [f"Day {d}" for d in days])
        ax.set_xlim(-0.6, len(days) - 0.4)
    ax.set_yticks(range(0, p["top"] + 1, p["label"]))
    ax.set_yticks(range(0, p["top"] + 1, p["grid"]), minor=True)
    ax.grid(True, which="both", axis="y", color=GRID, linewidth=0.8)
    if p["chart"] == "line":
        ax.xaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_ylim(0, p["top"])
    ax.tick_params(labelsize=10.5)
    ax.tick_params(axis="y", which="minor", length=0)
    ax.set_ylabel("Height (cm)", fontsize=11)
    # beside the graph, where it can never cover a line or a bar
    ax.legend(loc="upper left", bbox_to_anchor=(1.02, 1.0), fontsize=10.5, frameon=True, edgecolor="#999999",
              title="Key", title_fontsize=10.5)
    ax.set_title(f"Height of {p['plant']} plants", fontsize=12.5)
    return fig


VERBS = ["grows", "plants and measures", "looks after", "measures"]
SETTINGS = ["in the school garden in Huye", "in pots on the classroom window", "for a science investigation",
            "at the science club", "in the school garden", "at home in Musanze"]
OTHER = ["the height of the plants", "the type of seed"]


def _cm(n: int) -> list[str]:
    return [f"{n} cm", f"{n}cm", f"{n} centimetres"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    labels, days, h, ask = p["labels"], p["days"], p["heights"], p["ask"]
    k, j = ask["read"]
    v = h[k][j]
    out = [short(f"{who} {rng.choice(VERBS)} {p['plant']} plants {rng.choice(SETTINGS)}. "
                 f"How tall was {PHRASE[labels[k]]} on day {days[j]}?", v, _cm(v))]
    k, a, b = ask["grow"]
    g = h[k][b] - h[k][a]
    out.append(short(f"How much did {PHRASE[labels[k]]} grow from day {days[a]} to day {days[b]}?", g, _cm(g)))
    j = ask["day"]
    if p["cond"] == "soil":
        col = [row[j] for row in h]
        key = labels[col.index(max(col))].replace("soil ", "Soil ")
        out.append(mcq(f"In which soil was the plant tallest on day {days[j]}?", key,
                       [lb.replace("soil ", "Soil ") for lb in labels], rng))
    else:
        x, y = ask["taller"]
        d = h[x][j] - h[y][j]
        out.append(short(f"On day {days[j]}, how much taller was {PHRASE[labels[x]]} than {PHRASE[labels[y]]}?", d, _cm(d)))
    if p["level"] == "upper":
        k, jj = ask["when"]
        out.append(mcq(f"On which day was {PHRASE[labels[k]]} {h[k][jj]} cm tall?", f"Day {days[jj]}",
                       [f"Day {d}" for d in days], rng))
    changed = CHANGE[p["cond"]]
    out.append(mcq(f"What did {who} change in this investigation?", changed,
                   OTHER + [c for c in CHANGE.values() if c != changed][:1], rng))
    return out
