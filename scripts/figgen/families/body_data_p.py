"""Data about ourselves (P): three kinds of class data a Primary science book collects about the pupils themselves.

- pulse: a bar chart of four or five pupils' pulse rates before and after exercise, every bar ending on a gridline
  (gridlines every 10 beats a minute at the lower level, every 5 at the upper);
- height: a class table of five or six pupils' heights in cm;
- span: a tally chart of the pupils' hand spans in cm, the fifth stroke of each five drawn across the other four.

A reading; the rise in one pupil's pulse, or how much taller one pupil is than another; who went up most or is
tallest, or which hand span is most common (one plainly: the biggest rise is 10 beats a minute clear of the next, the
tallest pupil 2 cm clear); how many are above a value that no pupil has exactly; and the class total of a tally.
"""
from __future__ import annotations

import random

from ..core import FILL, FILL_2, GRID, INK, NAMES, count, mcq, new_figure, short

ID = "body_data_p"
KIND = "graph.bar"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("growth-and-development", "blood-and-circulation", "scientific-method",
                                          "body-movement"))
# A topic whose sections the book lists is reached only if one names ourselves, the body, exercise or the heart.
NEEDS = r"ourselves|human body|our bodies|we are (?:similar|different)|exercise|circulat|pulse|heart|sorting humans|pattern seeking"
AVOID = r"\bcells?\b|plants and animals|living and non-living|science in context|machine"

ACTIVITIES = ["skipping for two minutes", "running round the football pitch", "dancing to a song", "doing star jumps",
              "running up and down the steps"]
CLASSES = {"lower": ["P2", "P3"], "upper": ["P5", "P6"]}
TOWNS = ["Musanze", "Huye", "Rubavu", "Kigali", "Nyagatare", "Rusizi", "Muhanga"]


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["kind"] == "pulse":
        return ("science.blood-and-circulation", "science.body-movement", "science.scientific-method")
    return ("science.growth-and-development", "science.scientific-method")


def _pulse(rng: random.Random, level: str) -> dict:
    n, step = (4, 10) if level == "lower" else (5, 5)
    while True:
        before = [rng.randrange(70, 101, step) for _ in range(n)]
        rise = [rng.randrange(20, 61, step) for _ in range(n)]
        top = sorted(rise, reverse=True)
        after = [b + r for b, r in zip(before, rise)]
        gaps = [g for g in range(step, max(after), step) if min(after) < g < max(after) and g not in after]
        if top[0] - top[1] >= 10 and gaps:
            return {"pupils": rng.sample(NAMES, n), "before": before, "after": after, "step": step,
                    "activity": rng.choice(ACTIVITIES)}


def _height(rng: random.Random, level: str) -> dict:
    n, lo, hi = (5, 110, 135) if level == "lower" else (6, 125, 155)
    while True:
        heights = rng.sample(range(lo, hi + 1), n)
        tall = sorted(heights, reverse=True)
        marks = [x for x in range(lo - lo % 5, hi + 1, 5) if x not in heights and 0 < sum(h > x for h in heights) < n]
        if tall[0] - tall[1] >= 2 and marks:
            return {"pupils": rng.sample(NAMES, n), "heights": heights, "class": rng.choice(CLASSES[level]),
                    "town": rng.choice(TOWNS)}


def _span(rng: random.Random, level: str) -> dict:
    n, most = (4, 7) if level == "lower" else (5, 10)
    first = rng.randint(12, 18 - n)
    while True:
        counts = [rng.randint(1, most) for _ in range(n)]
        top = sorted(counts, reverse=True)
        if top[0] > top[1]:
            return {"spans": list(range(first, first + n)), "counts": counts, "class": rng.choice(CLASSES[level])}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["pulse", "height", "span"])
    level = rng.choice(["lower", "upper"])
    make = {"pulse": _pulse, "height": _height, "span": _span}[kind]
    return {"band": "P", "level": level, "kind": kind, **make(rng, level)}


# --- drawing ----------------------------------------------------------------------------------------

def _draw_pulse(p: dict):
    fig, ax = new_figure(6.8, 4.9)
    n, w = len(p["pupils"]), 0.36
    top = -(-(max(p["after"]) + 40) // 10) * 10  # room above the bars for the key
    for i in range(n):
        for dx, v, colour, when in ((-w / 2, p["before"][i], FILL_2, "before"), (w / 2, p["after"][i], FILL, "after")):
            bar = ax.bar(i + dx, v, w, color=colour, edgecolor=INK, linewidth=1.0,
                         label=f"{when.capitalize()} exercise" if i == 0 else None)
            bar[0].set_gid(f"bar:{when}:{i}")
    ax.set_xticks(range(n))
    ax.set_xticklabels(p["pupils"], fontsize=11)
    ax.set_yticks(range(0, top + 1, 10))
    ax.set_yticks(range(0, top + 1, p["step"]), minor=True)
    ax.tick_params(axis="y", labelsize=10)
    ax.tick_params(axis="y", which="minor", length=0)
    ax.set_ylim(0, top)
    ax.set_xlim(-0.6, n - 0.4)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    ax.set_ylabel("Pulse (beats per minute)", fontsize=11)
    ax.legend(loc="upper center", ncol=2, fontsize=10.5, frameon=False)
    ax.set_title(f"Pulse before and after {p['activity']}", fontsize=12)
    return fig


def _draw_table(title: str, heads: tuple[str, str], rows: list[tuple[str, str]], width: float = 2.6):
    n = len(rows)
    fig, ax = new_figure(4.4, 0.42 * (n + 1) + 0.6)
    for r in range(n + 1):
        y = n - r
        ax.plot([0, 2 * width], [y, y], color=INK, linewidth=1.0)
    ax.fill_between([0, 2 * width], n, n + 1, color=FILL_2, linewidth=0)
    ax.plot([0, 2 * width, 2 * width, 0, 0], [0, 0, n + 1, n + 1, 0], color=INK, linewidth=1.4)
    ax.plot([width, width], [0, n + 1], color=INK, linewidth=1.0)
    ax.text(width / 2, n + 0.5, heads[0], ha="center", va="center", fontsize=12, fontweight="bold")
    ax.text(1.5 * width, n + 0.5, heads[1], ha="center", va="center", fontsize=12, fontweight="bold")
    for r, (a, b) in enumerate(rows):
        y = n - r - 0.5
        ax.text(width / 2, y, a, ha="center", va="center", fontsize=12)
        ax.text(1.5 * width, y, b, ha="center", va="center", fontsize=12)
    ax.set_xlim(-0.05, 2 * width + 0.05)
    ax.set_ylim(-0.05, n + 1.05)
    ax.axis("off")
    ax.set_title(title, fontsize=12)
    return fig, ax


def _draw_height(p: dict):
    rows = [(name, str(h)) for name, h in zip(p["pupils"], p["heights"])]
    fig, _ = _draw_table(f"Heights of pupils in {p['class']}", ("Name", "Height in cm"), rows)
    return fig


def _draw_span(p: dict):
    n = len(p["spans"])
    fig, ax = new_figure(5.6, 0.5 * (n + 1) + 0.6)
    left, mid, right = 0.0, 2.4, 6.4
    for r in range(n + 1):
        ax.plot([left, right], [n - r, n - r], color=INK, linewidth=1.0)
    ax.fill_between([left, right], n, n + 1, color=FILL_2, linewidth=0)
    ax.plot([left, right, right, left, left], [0, 0, n + 1, n + 1, 0], color=INK, linewidth=1.4)
    ax.plot([mid, mid], [0, n + 1], color=INK, linewidth=1.0)
    ax.text(mid / 2, n + 0.5, "Hand span", ha="center", va="center", fontsize=12, fontweight="bold")
    ax.text((mid + right) / 2, n + 0.5, "Tally", ha="center", va="center", fontsize=12, fontweight="bold")
    for r, (span, c) in enumerate(zip(p["spans"], p["counts"])):
        y = n - r - 0.5
        ax.text(mid / 2, y, f"{span} cm", ha="center", va="center", fontsize=12)
        x = mid + 0.4
        for k in range(c):
            if k % 5 == 4:  # the fifth stroke goes across the four before it
                g0 = x - 4 * 0.2 - 0.06
                ax.plot([g0, g0 + 0.72], [y - 0.24, y + 0.24], color=INK, linewidth=1.6, gid=f"tally:{span}:{k}:gate")
                x += 0.22
            else:
                ax.plot([x, x], [y - 0.3, y + 0.3], color=INK, linewidth=1.6, gid=f"tally:{span}:{k}")
                x += 0.2
    ax.set_xlim(left - 0.05, right + 0.05)
    ax.set_ylim(-0.05, n + 1.05)
    ax.axis("off")
    ax.set_title(f"Hand spans of pupils in {p['class']}", fontsize=12)
    return fig


def draw(p: dict):
    return {"pulse": _draw_pulse, "height": _draw_height, "span": _draw_span}[p["kind"]](p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a science lesson", "at break time", "during PE", "for a class project", "at the science club"]


def _pulse_qs(p: dict, rng: random.Random, who: str) -> list:
    names, before, after = p["pupils"], p["before"], p["after"]
    rise = [a - b for a, b in zip(after, before)]
    i, j = rng.sample(range(len(names)), 2)
    best = rise.index(max(rise))
    # Wrong answers: the tallest bar after exercise, the tallest before, then the rest.
    slips = [names[after.index(max(after))], names[before.index(max(before))]] + names
    gaps = [g for g in range(p["step"], max(after), p["step"]) if min(after) < g < max(after) and g not in after]
    x = rng.choice(gaps)
    bpm = lambda v: [f"{v} beats per minute", f"{v} bpm", f"{v} beats"]  # noqa: E731
    return [
        short(f"{who} measured the pulse of {len(names)} friends before and after {p['activity']} {rng.choice(SETTINGS)}. "
              f"What was {names[i]}'s pulse after exercise, in beats per minute?", after[i], bpm(after[i])),
        short(f"By how many beats per minute did {names[j]}'s pulse go up?", rise[j], bpm(rise[j])),
        mcq("Whose pulse went up the most?", names[best], slips, rng),
        count(f"How many of the pupils had a pulse higher than {x} beats per minute after exercise?",
              sum(1 for a in after if a > x), "pupils"),
    ]


def _height_qs(p: dict, rng: random.Random, who: str) -> list:
    names, heights = p["pupils"], p["heights"]
    n = len(names)
    order = sorted(range(n), key=lambda k: -heights[k])
    i = rng.randrange(n)
    a, b = rng.sample(range(n), 2)
    a, b = (a, b) if heights[a] > heights[b] else (b, a)
    lo = min(heights)
    marks = [x for x in range(lo - lo % 5, max(heights) + 1, 5) if x not in heights and 0 < sum(h > x for h in heights) < n]
    x = rng.choice(marks)
    cm = lambda v: [f"{v} cm", f"{v}cm", f"{v} centimetres"]  # noqa: E731
    return [
        short(f"{who} measured the heights of some pupils in {p['class']} at a school in {p['town']}. "
              f"How tall is {names[i]}, in cm?", heights[i], cm(heights[i])),
        mcq("Who is the tallest pupil in the table?", names[order[0]],
            [names[order[-1]], names[order[1]], names[-1], names[0]] + names, rng),
        count(f"How many pupils are taller than {x} cm?", sum(1 for h in heights if h > x), "pupils"),
        short(f"How much taller is {names[a]} than {names[b]}, in cm?", heights[a] - heights[b],
              cm(heights[a] - heights[b])),
    ]


def _span_qs(p: dict, rng: random.Random, who: str) -> list:
    spans, counts = p["spans"], p["counts"]
    s = rng.choice(spans)
    best = spans[counts.index(max(counts))]
    second = sorted(spans, key=lambda sp: -counts[spans.index(sp)])[1]
    x = rng.choice(spans[:-1])
    return [
        count(f"{who} measured the hand spans of pupils in {p['class']} and made this tally chart. "
              f"How many pupils have a hand span of {s} cm?", counts[spans.index(s)], "pupils"),
        mcq("Which hand span is the most common?", f"{best} cm",
            [f"{spans[-1]} cm", f"{second} cm"] + [f"{sp} cm" for sp in spans], rng),
        count("How many pupils were measured altogether?", sum(counts), "pupils"),
        count(f"How many pupils have a hand span longer than {x} cm?",
              sum(c for sp, c in zip(spans, counts) if sp > x), "pupils"),
    ]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice([n for n in NAMES if n not in p.get("pupils", [])])
    return {"pulse": _pulse_qs, "height": _height_qs, "span": _span_qs}[p["kind"]](p, rng, who)
