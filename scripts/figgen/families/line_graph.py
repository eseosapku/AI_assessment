"""Temperature through a day. Every point sits on a gridline crossing."""
from __future__ import annotations

import random

from ..core import NAMES, GRID, mcq, new_figure, short

ID = "line_graph"
KIND = "graph.line"
SUBJECT = "mathematics"
# Reading a day's temperatures is Primary and Lower Secondary work, below Upper Secondary.
BANDS = ("P", "LS")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "line-graphs-interpreting", "time-series-graphs", "statistical-graphs-presentation-reading",
))

HOURS = [6, 8, 10, 12, 14, 16, 18]
# The coolest and hottest a day's readings can plausibly be in each place, in °C.
# Schools, not real towns: no real place is given invented readings. Lows even, so readings
# start on the 2 °C gridlines.
CLIMATE = {"school on a hill": (10, 26), "school by a lake": (16, 30), "school in a valley": (14, 32),
           "school on the plains": (16, 32), "school in the mountains": (8, 24)}


def _clock(h: int) -> str:
    return f"{h:02d}:00"


def stages(p: dict) -> tuple[int, int] | None:
    """Line graphs of a day's temperature: Stage 4 on."""
    return (4, 6) if p["band"] == "P" else None


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = rng.choice(sorted(CLIMATE))
    lo, hi = CLIMATE[kind]
    place = f"{rng.choice(NAMES)}'s {kind}"
    while True:
        # A day warms to one peak at 12:00, 14:00 or 16:00 and cools after it.
        peak = rng.choice([3, 4, 5])
        temps = [rng.randrange(lo, lo + 5, 2)]
        for i in range(1, len(HOURS)):
            step = rng.choice([0, 2, 2, 4])
            temps.append(temps[-1] + (step if i <= peak else -step))
        top = max(temps)
        if temps.count(top) == 1 and temps.index(top) == peak and top <= hi and min(temps) >= lo:
            return {"band": band, "kind": kind, "place": place, "temps": temps}


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
    ax.set_title(f"Temperature at {p['place']} during one day", pad=14)  # clear of the top number
    return fig


def questions(p: dict, rng: random.Random) -> list:
    t = p["temps"]
    i = rng.randrange(len(HOURS))
    a, b = rng.choice([(a, b) for a in range(len(HOURS)) for b in range(a + 1, len(HOURS)) if t[a] != t[b]])
    hottest = HOURS[t.index(max(t))]
    others = [_clock(h) for h in HOURS if h != hottest]
    return [
        short(f"What was the temperature at {p['place']} at {_clock(HOURS[i])}, in °C?", t[i], [f"{t[i]}°C", f"{t[i]} °C"]),
        mcq(f"At what time was the temperature at {p['place']} highest?", _clock(hottest), rng.sample(others, 3), rng),
        short(f"What is the difference between the temperatures at {p['place']} at {_clock(HOURS[a])} and {_clock(HOURS[b])}, in \u00b0C?",
              abs(t[b] - t[a]), [f"{abs(t[b] - t[a])}\u00b0C", f"{abs(t[b] - t[a])} \u00b0C"]),
    ]
