"""Early numbers (P, Stage 1 to 2), as Cambridge Stage 1 "Numbers to 10" and "Numbers to 20", Rwanda P1 "Numbers from
1 up to 5", "Numbers from 0 up to 100" and "Number patterns" teach them: counting sets of objects, comparing two sets,
a number track with a missing number, odd and even by pairing, and tens and ones with bundles of sticks.

Five kinds of figure, every number small and every picture big:
- frames: one or two ten frames with counters. How many counters are there? How many empty squares?
- compare: a row of counters of one colour above a row of another colour, lined up one under another. Are there more
  red or more blue? How many more?
- track: a number track (a row of squares with numbers), one square empty; or counting on in 2s, 5s or 10s with the
  next square empty. What number goes in the empty square?
- pairs: beans set out in pairs, perhaps one left over. Is the number of beans odd or even? How many beans?
- bundles: bundles of ten sticks, each tied with a band, and loose sticks. How many sticks altogether? How many
  bundles of ten?
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Ellipse, Rectangle

from ..core import INK, NAMES, count, mcq, new_figure, short

ID = "early_numbers_p"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.say-read-write-numbers-10", "mathematics.working-with-numbers-to-10",
            "mathematics.counting-reading-writing-numbers", "mathematics.comparing-and-ordering-numbers",
            "mathematics.working-with-numbers-to-100", "mathematics.sequences-simple", "mathematics.investigating-patterns")
# A topic whose sections the book lists is reached only if its name or a section is about numbers and counting.
NEEDS = r"number|count|pattern"
AVOID = (r"time|\bday|week|month|hour|calendar|money|currenc|\bfrw\b|pictograph|addition|subtraction|multiplication|"
         r"division|working with numbers|operations|fraction|measur|kilogram|litre|liter|\bmass\b|capacity|position")

COLOURS = {"red": "#d9534f", "blue": "#4a7fd4", "green": "#4cae4c", "yellow": "#f0c419"}
BEAN = "#8d5a3b"
FRAME_LEADS = ["{n} puts counters in ten frames.", "{n} fills ten frames with counters.", "{n} places counters on ten frames.",
               "{n} shows a number with counters in ten frames."]
ONE_FRAME_LEADS = ["{n} puts counters in a ten frame.", "{n} fills a ten frame with counters.",
                   "{n} places counters on a ten frame.", "{n} shows a number with counters in a ten frame."]
COMPARE_LEADS = ["{n} lines up {a} and {b} counters.", "{n} puts {a} counters above {b} counters.",
                 "{n} makes two rows of counters.", "{n} sorts counters into a {a} row and a {b} row."]
TRACK_LEADS = ["{n} counts along a number track.", "{n} writes numbers on a number track.", "{n} fills in a number track.",
               "{n} says the numbers on a number track."]
SKIP_LEADS = ["{n} counts in {k}s on a number track.", "{n} jumps in {k}s along a number track.",
              "{n} counts on in {k}s.", "{n} makes a number pattern, counting in {k}s."]
PAIR_LEADS = ["{n} puts beans in pairs.", "{n} sets out beans two by two.", "{n} groups beans in twos.",
              "{n} makes pairs of beans."]
BUNDLE_LEADS = ["{n} ties sticks in bundles of ten.", "{n} counts sticks in bundles of ten.",
                "{n} groups sticks into bundles of ten.", "{n} makes bundles of ten sticks."]
WORDS = {2: "twos", 5: "fives", 10: "tens"}


def stages(p: dict) -> tuple[int, int]:
    return (1, 2)


def concepts_for(p: dict) -> tuple[str, ...]:
    """A number track counting on in steps is a number pattern; tens and ones go to 100; the rest count to 20."""
    if p["sub"] == "bundles":
        return ("mathematics.working-with-numbers-to-100", "mathematics.counting-reading-writing-numbers")
    if p["sub"] == "track" and p["step"] > 1:
        return ("mathematics.sequences-simple", "mathematics.investigating-patterns",
                "mathematics.counting-reading-writing-numbers")
    return ("mathematics.say-read-write-numbers-10", "mathematics.working-with-numbers-to-10",
            "mathematics.counting-reading-writing-numbers", "mathematics.comparing-and-ordering-numbers")


def avoid_for(p: dict) -> str:
    """Counting a set is not a number pattern; counting to 20 is not counting to 100."""
    extra = "" if p["sub"] == "track" and p["step"] > 1 else "|pattern"
    if p["sub"] != "bundles":
        extra += r"|\b100\b|\b50\b|200|1000|500"
    else:
        extra += r"|1000|500"  # tens and ones to 99: no figure for numbers to 500 or 1000
    return AVOID + extra


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["frames", "compare", "track", "pairs", "bundles"])
    p = {"band": "P", "sub": sub, "name": rng.choice(NAMES)}
    if sub == "frames":
        frames = rng.choice([1, 2])
        n = rng.randint(3, 9) if frames == 1 else rng.randint(11, 19)
        # counters fill a frame row by row, left to right, as children are taught to
        p.update(frames=frames, n=n, colour=rng.choice(sorted(COLOURS)))
        return p
    if sub == "compare":
        a, b = rng.sample(range(2, 11), 2) if rng.random() < 0.85 else [rng.randint(3, 9)] * 2
        p.update(colours=rng.sample(sorted(COLOURS), 2), counts=[a, b])
        return p
    if sub == "track":
        step = rng.choice([1, 1, 2, 5, 10])
        if step == 1:
            start = rng.randint(0, 11)
            nums = list(range(start, start + 10))
            gap = rng.randrange(1, 10)
        else:
            start = step * rng.randint(0 if step == 2 else 1, 3)
            nums = [start + step * i for i in range(6)]
            gap = rng.choice([5, rng.randrange(1, 5)])
        p.update(step=step, nums=nums, gap=gap)
        return p
    if sub == "pairs":
        p.update(n=rng.randint(4, 15))
        return p
    p.update(tens=rng.randint(1, 9), ones=rng.randint(0, 9))
    return p


# --- drawing ------------------------------------------------------------------------------------------------

def _frames(p: dict):
    fig, ax = new_figure(5.6 if p["frames"] == 1 else 9.0, 3.2)
    s = 0.8
    left = p["n"]
    for f in range(p["frames"]):
        ox = f * (5 * s + 0.6)
        for i in range(10):
            r, c = divmod(i, 5)
            x, y = ox + c * s, (1 - r) * s
            ax.add_patch(Rectangle((x, y), s, s, facecolor="white", edgecolor=INK, linewidth=2.0, gid=f"cell:{f}:{i}"))
            if left > 0:
                ax.add_patch(Circle((x + s / 2, y + s / 2), 0.3, facecolor=COLOURS[p["colour"]], edgecolor=INK, linewidth=1.2,
                                    gid=f"counter:{f}:{i}"))
                left -= 1
    width = p["frames"] * 5 * s + (p["frames"] - 1) * 0.6
    ax.set_xlim(-0.2, width + 0.2)
    ax.set_ylim(-0.2, 2 * s + 0.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _compare(p: dict):
    most = max(p["counts"])
    fig, ax = new_figure(max(5.0, 0.75 * most + 2.4), 2.8)
    for row, (word, n) in enumerate(zip(p["colours"], p["counts"])):
        colour = COLOURS[word]
        y = 1.3 - row * 1.0
        ax.text(-0.3, y, word, ha="right", va="center", fontsize=14, gid=f"row:{word}")
        for i in range(n):
            ax.add_patch(Circle((0.4 + 0.75 * i, y), 0.3, facecolor=colour, edgecolor=INK, linewidth=1.2,
                                gid=f"{word}:{i}"))
    ax.set_xlim(-1.5, 0.75 * most + 0.4)
    ax.set_ylim(-0.1, 1.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _track(p: dict):
    nums = p["nums"]
    s = 0.9
    fig, ax = new_figure(max(6.0, 0.95 * len(nums) + 0.6), 1.9)
    for i, v in enumerate(nums):
        ax.add_patch(Rectangle((i * s, 0), s, s, facecolor="#fdf1d6" if i != p["gap"] else "white", edgecolor=INK,
                               linewidth=2.0, gid=f"square:{i}"))
        if i != p["gap"]:
            ax.text(i * s + s / 2, s / 2, str(v), ha="center", va="center", fontsize=16, gid=f"num:{i}")
    ax.set_xlim(-0.15, len(nums) * s + 0.15)
    ax.set_ylim(-0.15, s + 0.15)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _pairs(p: dict):
    n = p["n"]
    cols = (n + 1) // 2
    fig, ax = new_figure(max(4.5, 0.9 * cols + 1.0), 2.8)
    from matplotlib.patches import FancyBboxPatch
    for c in range(n // 2):  # each pair ringed, so a bean left over stands alone
        ax.add_patch(FancyBboxPatch((0.5 + 0.9 * c - 0.36, 0.6 - 0.3), 0.72, 1.4, boxstyle="round,pad=0,rounding_size=0.3",
                                    facecolor="#f3ead9", edgecolor="#b9a27f", linewidth=1.2, zorder=0, gid=f"behind-pair:{c}"))
    for i in range(n):
        c, r = divmod(i, 2)
        ax.add_patch(Ellipse((0.5 + 0.9 * c, 1.4 - 0.8 * r), 0.55, 0.38, facecolor=BEAN, edgecolor=INK, linewidth=1.2,
                             gid=f"bean:{i}"))
    ax.set_xlim(-0.1, 0.9 * cols + 0.2)
    ax.set_ylim(0.6 - 0.35, 1.4 + 0.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _stick(ax, x: float, y0: float, gid: str) -> None:
    ax.plot([x, x], [y0, y0 + 1.6], color="#a0522d", linewidth=3.2, solid_capstyle="round", gid=gid)


def _bundles(p: dict):
    t, o = p["tens"], p["ones"]
    width = t * 1.25 + o * 0.32 + 0.8
    fig, ax = new_figure(max(5.0, 0.95 * width), 3.0)
    for b in range(t):
        ox = b * 1.25
        for k in range(10):
            _stick(ax, ox + 0.1 + 0.08 * k, 0.3, f"behind-stick:{b}:{k}")
        ax.add_patch(Rectangle((ox + 0.02, 0.95), 0.9, 0.28, facecolor="#e8c547", edgecolor=INK, linewidth=1.2,
                               zorder=4, gid=f"behind-band:{b}"))
    for k in range(o):
        _stick(ax, t * 1.25 + 0.4 + 0.32 * k, 0.3, f"behind-loose:{k}")
    ax.text(0.0, 2.25, "1 bundle = 10 sticks", ha="left", va="center", fontsize=12, gid="key")
    ax.set_xlim(-0.2, max(width, 4.2))
    ax.set_ylim(0.1, 2.55)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"frames": _frames, "compare": _compare, "track": _track, "pairs": _pairs, "bundles": _bundles}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def questions(p: dict, rng: random.Random) -> list:
    name, sub = p["name"], p["sub"]
    if sub == "frames":
        lead = rng.choice(FRAME_LEADS if p["frames"] == 2 else ONE_FRAME_LEADS).format(n=name)
        n = p["n"]
        empty = 10 * p["frames"] - n
        q1 = count(f"{lead} How many counters are there?", n, "counters")
        q2 = count(f"How many squares in the ten frame{'s' if p['frames'] == 2 else ''} are empty?", empty, "squares")
        return [q1, q2]
    if sub == "compare":
        (ca, cb), (r, b) = p["colours"], p["counts"]
        lead = rng.choice(COMPARE_LEADS).format(n=name, a=ca, b=cb)
        key = f"more {ca}" if r > b else f"more {cb}" if b > r else "the same number"
        q1 = mcq(f"{lead} Are there more {ca} or more {cb} counters?", key,
                 [o for o in (f"more {ca}", f"more {cb}", "the same number") if o != key], rng)
        if r == b:
            return [q1, count(f"How many {ca} counters are there?", r, "counters", f"{ca} counters")]
        big, small = (ca, cb) if r > b else (cb, ca)
        q2 = count(f"How many more {big} counters than {small} counters are there?", abs(r - b), "counters",
                   f"{big} counters")
        return [q1, q2]
    if sub == "track":
        v = p["nums"][p["gap"]]
        if p["step"] == 1:
            lead = rng.choice(TRACK_LEADS).format(n=name)
        else:
            lead = rng.choice(SKIP_LEADS).format(n=name, k=p["step"])
        where = "next" if p["gap"] == len(p["nums"]) - 1 else "in the empty square"
        stem = f"{lead} What number comes next?" if where == "next" else f"{lead} What number goes in the empty square?"
        return [short(stem, v)]
    if sub == "pairs":
        n = p["n"]
        lead = rng.choice(PAIR_LEADS).format(n=name)
        q1 = short(f"{lead} Is the number of beans odd or even?", "odd" if n % 2 else "even")
        q2 = count("How many beans are there?", n, "beans")
        return [q1, q2] if rng.random() < 0.5 else [short(f"{lead} How many beans are there?", n, [f"{n} beans"]),
                                                    short("Is the number of beans odd or even?", "odd" if n % 2 else "even")]
    t, o = p["tens"], p["ones"]
    lead = rng.choice(BUNDLE_LEADS).format(n=name)
    q1 = count(f"{lead} How many sticks are there altogether?", 10 * t + o, "sticks")
    q2 = count("How many bundles of ten are there?", t, "bundles")
    return [q1, q2]
