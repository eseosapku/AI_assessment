"""Temperature through a day. Every point sits on a gridline crossing."""
from __future__ import annotations

import random

from ..core import GRID, mcq, new_figure, short

ID = "line_graph"
KIND = "graph.line"
SUBJECT = "mathematics"
BANDS = ("P", "LS", "UP")

HOURS = [6, 8, 10, 12, 14, 16, 18]
# The coolest and hottest a day's readings can plausibly be in each place, in °C.
CLIMATE = {"Kigali": (14, 30), "Huye": (12, 28), "Musanze": (10, 26), "Lagos": (22, 34), "Nairobi": (10, 28),
           "Kampala": (16, 30)}


def _clock(h: int) -> str:
    return f"{h:02d}:00"


def sample(rng: random.Random) -> dict:
    place = rng.choice(sorted(CLIMATE))
    lo, hi = CLIMATE[place]
    while True:
        # A day warms to one peak at 12:00, 14:00 or 16:00 and cools after it.
        peak = rng.choice([3, 4, 5])
        temps = [rng.randrange(lo, lo + 5, 2)]
        for i in range(1, len(HOURS)):
            step = rng.choice([0, 2, 2, 4])
            temps.append(temps[-1] + (step if i <= peak else -step))
        top = max(temps)
        if temps.count(top) == 1 and temps.index(top) == peak and top <= hi and min(temps) >= lo:
            return {"place": place, "temps": temps}


def draw(p: dict):
    fig, ax = new_figure()
    ax.plot(HOURS, p["temps"], marker="o", color="#111111")
    ax.set_xticks(HOURS, [_clock(h) for h in HOURS])
    low = (min(p["temps"]) - 2) // 2 * 2
    high = max(p["temps"]) + 2
    ax.set_yticks(range(low, high + 1, 2))
    ax.set_ylim(low, high)
    ax.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_xlabel("Time of day")
    ax.set_ylabel("Temperature (°C)")
    ax.set_title(f"Temperature in {p['place']} during one day")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    t = p["temps"]
    i = rng.randrange(len(HOURS))
    a, b = sorted(rng.sample(range(len(HOURS)), 2))
    hottest = HOURS[t.index(max(t))]
    others = [_clock(h) for h in HOURS if h != hottest]
    return [
        short(f"What was the temperature at {_clock(HOURS[i])}, in °C?", t[i], [f"{t[i]}°C", f"{t[i]} °C"]),
        mcq("At what time was the temperature highest?", _clock(hottest), rng.sample(others, 3), rng),
        short(f"By how many degrees did the temperature change between {_clock(HOURS[a])} and {_clock(HOURS[b])}?",
              abs(t[b] - t[a])),
    ]
