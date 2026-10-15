"""Telling the time to the hour and half hour (P, Stage 1 to 2): o'clock and half past only, as Cambridge Stage 1 and
Rwanda P2 ("Hour, months of the year and days") teach it.

Two kinds of figure:
- one big clock face, every number large, a minute mark for each minute: the time shown, and the time 1 hour or half
  an hour later;
- four smaller clocks lettered A to D: which clock shows a stated time, and what time a lettered clock shows.

The hour hand sits where it really is: at half past 4 it is half way from 4 to 5. Both hands stop short of the
numbers, and the hour hand is short and thick, the minute hand long and thin.

Every MCQ offers the four times made of two hours and both of "o'clock" and "half past" (4 o'clock, half past 4, 5
o'clock, half past 5): the wrong options are the slips a child makes (reading the next number, mixing up o'clock and
half past, reading the minute hand as the hour), and no option is the odd one out.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle

from ..core import INK, NAMES, mcq, new_figure

ID = "clock_early_p"
KIND = "maths.measure"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.time-general", "mathematics.time-hour-months-days", "mathematics.time-intervals-duration")
# A topic whose sections the book lists is reached only if its name or a section names time, a clock or the hour.
NEEDS = r"\btime\b|clock|hour"
# The days of the week and the calendar are the calendar's (calendar_p); money shares "everyday life" concepts.
AVOID = r"parts of the day|days of the week|calendar|money|currenc|francs?\b|timetable"

# What a child does, said two ways ("eats lunch", "eat lunch"), and the hours it is done at.
EVENTS = [
    ("wakes up", "wake up", (5, 6, 7)),
    ("eats breakfast", "eat breakfast", (6, 7, 8)),
    ("goes to school", "go to school", (7, 8)),
    ("eats lunch", "eat lunch", (12, 1)),
    ("plays football", "play football", (3, 4, 5)),
    ("feeds the hens", "feed the hens", (4, 5, 6, 7)),
    ("reads a story", "read a story", (2, 3, 7, 8)),
    ("visits Grandma", "visit Grandma", (2, 3, 9, 10, 11)),
    ("goes to the market", "go to the market", (8, 9, 10, 11)),
    ("does homework", "do homework", (4, 5, 6)),
    ("waters the garden", "water the garden", (5, 6)),
    ("eats supper", "eat supper", (6, 7)),
    ("goes to bed", "go to bed", (8, 9)),
    ("goes to church", "go to church", (9, 10)),
    ("helps at the shop", "help at the shop", (10, 11, 12, 1, 2)),
]
LETTERS = "ABCD"


def stages(p: dict) -> tuple[int, int] | None:
    return (1, 2)  # o'clock and half past: Stage 1 and 2, Rwanda P1 and P2


def _wrap(h: int) -> int:
    return (h - 1) % 12 + 1


def label(h: int, m: int) -> str:
    return f"{h} o'clock" if m == 0 else f"half past {h}"


def sample(rng: random.Random) -> dict:
    mode = rng.choice(["one", "four"])
    h, m = rng.randint(1, 12), rng.choice([0, 30])
    event = rng.choice([i for i, e in enumerate(EVENTS) if h in e[2]])
    p = {"band": "P", "mode": mode, "name": rng.choice(NAMES), "event": event}
    if mode == "one":
        p.update(clocks=[[h, m]], target=0)
        return p
    near = []
    for c in ((h - 1, m), (h + 1, m), (h, 30 - m), (h + 1, 30 - m), (h - 1, 30 - m)):
        c = (_wrap(c[0]), c[1])
        if c != (h, m) and c not in near:
            near.append(c)
    clocks = [(h, m)] + rng.sample(near, 3)
    rng.shuffle(clocks)
    target = clocks.index((h, m))
    p.update(clocks=[list(c) for c in clocks], target=target, ask=rng.choice([i for i in range(4) if i != target]))
    return p


# --- drawing ----------------------------------------------------------------------------------------

def _clock(ax, cx: float, cy: float, h: int, m: int, letter: str, big: bool) -> None:
    ax.add_patch(Circle((cx, cy), 1, facecolor="white", edgecolor=INK, linewidth=2.6 if big else 2.2, gid=f"face:{letter}"))
    for i in range(60 if big else 12):
        step = 6 if big else 30
        a = math.radians(90 - step * i)
        five = big and i % 5 == 0 or not big
        r0 = 0.89 if five else 0.94
        ax.plot([cx + r0 * math.cos(a), cx + 0.98 * math.cos(a)], [cy + r0 * math.sin(a), cy + 0.98 * math.sin(a)],
                color=INK, linewidth=1.6 if five else 0.8)
    rn = 0.73 if big else 0.72
    for n in range(1, 13):
        a = math.radians(90 - 30 * n)
        ax.text(cx + rn * math.cos(a), cy + rn * math.sin(a), str(n), ha="center", va="center",
                fontsize=15 if big else 12, gid=f"num:{letter}:{n}")
    hour_angle, minute_angle = 30 * (h % 12) + m / 2, 6 * m
    lengths = (0.4, 0.6) if big else (0.36, 0.56)
    for angle, length, width, kind in ((hour_angle, lengths[0], 6.5 if big else 5.5, "hour"),
                                       (minute_angle, lengths[1], 3.0 if big else 2.4, "minute")):
        a = math.radians(90 - angle)
        ax.plot([cx, cx + length * math.cos(a)], [cy, cy + length * math.sin(a)], color=INK, linewidth=width,
                solid_capstyle="round", gid=f"{kind}:{letter}")
    ax.add_patch(Circle((cx, cy), 0.05, color=INK, zorder=4))


def draw(p: dict):
    if p["mode"] == "one":
        fig, ax = new_figure(4.6, 4.6)
        h, m = p["clocks"][0]
        _clock(ax, 0, 0, h, m, "A", True)
        ax.set_xlim(-1.08, 1.08)
        ax.set_ylim(-1.08, 1.08)
    else:
        fig, ax = new_figure(6.4, 6.9)
        for i, (h, m) in enumerate(p["clocks"]):
            cx, cy = (i % 2) * 2.7, -(i // 2) * 3.0
            _clock(ax, cx, cy, h, m, LETTERS[i], False)
            ax.text(cx, cy - 1.32, LETTERS[i], ha="center", va="center", fontsize=16, fontweight="bold",
                    gid=f"letter:{LETTERS[i]}")
        ax.set_xlim(-1.1, 3.8)
        ax.set_ylim(-4.6, 1.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

def _grid(h: int) -> list[str]:
    """The four times made of two hours and both halves: no option is the odd one out."""
    return [label(x, mm) for x in (h, _wrap(h + 1)) for mm in (0, 30)]


def questions(p: dict, rng: random.Random) -> list:
    name = p["name"]
    third, base, _ = EVENTS[p["event"]]
    clocks = [tuple(c) for c in p["clocks"]]
    if p["mode"] == "one":
        h, m = clocks[0]
        hand = 12 if m == 0 else 6  # the number the minute hand points to, read as the hour
        if hand != h and rng.random() < 0.5:
            opts = [label(x, mm) for x in (h, hand) for mm in (0, 30)]
        else:
            opts = _grid(h)
        key = label(h, m)
        shown = mcq(f"{name} {third} at the time on the clock. What time does {name} {base}?", key,
                    [o for o in opts if o != key], rng)
        later = rng.choice(["1 hour", "half an hour"])
        total = (h % 12) * 60 + m + (60 if later == "1 hour" else 30)
        kh, km = (total // 60) % 12 or 12, total % 60
        key = label(kh, km)
        after = mcq(f"What time is it {later} after the time on the clock?", key, [o for o in _grid(h) if o != key], rng)
        return [shown, after]
    h, m = clocks[p["target"]]
    when = label(h, m)
    which = mcq(f"{name} {third} at {when}. Which clock shows {when}?", f"Clock {LETTERS[p['target']]}",
                [f"Clock {LETTERS[i]}" for i in range(4) if i != p["target"]], rng)
    ah, am = clocks[p["ask"]]
    key = label(ah, am)
    read = mcq(f"What time does clock {LETTERS[p['ask']]} show?", key, [o for o in _grid(ah) if o != key], rng)
    return [which, read]
