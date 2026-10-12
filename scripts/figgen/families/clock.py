"""An analogue clock at five-minute times: reading it, and working out when things end (Primary).

The hour hand sits where it really is -- part of the way to the next hour -- since a student
who reads the hour from it must learn that 7:50 has the hand almost at 8.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "clock"
KIND = "maths.measure"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "time-general", "time-hour-months-days", "time-intervals-duration", "addition-subtraction-time-problems",
    "time-unit-conversion",
))

WHEN = ["when she leaves for school", "when the bus arrives", "when the market opens", "when football practice starts",
        "when lunch is served", "when the film begins"]
ACTIVITIES = ["lesson", "football match", "bus journey", "piano practice", "walk to the market", "cooking class",
              "homework session", "visit to the health centre"]


def hand_angles(p: dict) -> tuple[float, float]:
    """Degrees clockwise from 12: the hour hand moves half a degree a minute."""
    return 30 * (p["hour"] % 12) + p["minute"] / 2, 6 * p["minute"]


def _t(h: int, m: int) -> str:
    return f"{h}:{m:02d}"


def _plus(h: int, m: int, d: int) -> tuple[int, int]:
    total = ((h % 12) * 60 + m + d) % 720
    return (total // 60) or 12, total % 60


def stages(p: dict) -> tuple[int, int] | None:
    """Telling the time and working out when things end: from Stage 3."""
    return (3, 6)


def sample(rng: random.Random) -> dict:
    hour = rng.randint(1, 12)
    # Early stages read o'clock, half past and quarter times; later ones any five minutes.
    minute = rng.choice([0, 15, 30, 45] * 2 + list(range(5, 60, 5)))
    return {"band": "P", "name": rng.choice(NAMES), "hour": hour, "minute": minute}


def draw(p: dict):
    fig, ax = new_figure(4.2, 4.2)
    ax.add_patch(Circle((0, 0), 1, fill=False, edgecolor=INK, linewidth=2.2))
    for i in range(60):
        a = math.radians(90 - 6 * i)
        r0 = 0.88 if i % 5 == 0 else 0.93
        ax.plot([r0 * math.cos(a), 0.98 * math.cos(a)], [r0 * math.sin(a), 0.98 * math.sin(a)], color=INK,
                linewidth=1.6 if i % 5 == 0 else 0.8)
    for n in range(1, 13):
        a = math.radians(90 - 30 * n)
        ax.text(0.76 * math.cos(a), 0.76 * math.sin(a), str(n), ha="center", va="center", fontsize=14)
    hour_angle, minute_angle = hand_angles(p)
    # Both hands stop short of the numbers, so no number is hidden; the minute hand is the longer.
    for angle, length, width in ((hour_angle, 0.42, 5.0), (minute_angle, 0.63, 2.6)):
        a = math.radians(90 - angle)
        ax.plot([0, length * math.cos(a)], [0, length * math.sin(a)], color=INK, linewidth=width, solid_capstyle="round")
    ax.add_patch(Circle((0, 0), 0.04, color=INK))
    ax.set_xlim(-1.08, 1.08)
    ax.set_ylim(-1.08, 1.08)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    h, m, name = p["hour"], p["minute"], p["name"]
    # Wrong readings: the hands swapped, the hour read from the hand as it nears the next hour,
    # the minute hand read as the number it points to.
    swapped = _t(m // 5 or 12, (h % 12) * 5)
    nxt = _t(h % 12 + 1, m)
    pointed = _t(h, m // 5) if m else _t(h, 12)
    back = _t((h - 2) % 12 + 1, m)
    shown = mcq(f"The clock shows the time {WHEN[rng.randrange(len(WHEN))].replace('she', name)}. What time does it show?",
                _t(h, m), [swapped, nxt, pointed, back], rng)
    d = rng.choice([15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90])
    eh, em = _plus(h, m, d)
    activity = ACTIVITIES[rng.randrange(len(ACTIVITIES))]
    ends = short(f"{name}'s {activity} starts at the time shown and lasts {d} minutes. At what time does it end?",
                 _t(eh, em), [f"{eh}.{em:02d}", f"{eh:02d}:{em:02d}", f"{eh:02d}.{em:02d}"])
    target = rng.choice([h % 12 + 1, (h + 1) % 12 + 1])
    gap = ((target % 12) * 60 - ((h % 12) * 60 + m)) % 720
    until = short(f"{name} must be home by {target} o'clock. How many minutes is it from the time shown until then?", gap,
                  [f"{gap} minutes", f"{gap} min", f"{gap} mins"])
    return [shown, ends, until]
