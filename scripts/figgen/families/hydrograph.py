"""Storm hydrographs (UP): a storm's rainfall as hourly bars and a river's discharge as a line over two days, the
peak rainfall and peak discharge each at a whole hour, every value on a gridline (rain 1 mm, discharge 5 m³/s).
The lag time, the peak discharge, and the rise in discharge from the base flow.

Every key is the drawn values: the discharge starts at base flow, rises to its peak after the rain's peak, and falls
back more slowly.
"""
from __future__ import annotations

import random

from ..core import FILL, GRID, INK, NAMES, new_figure, short

ID = "hydrograph"
KIND = "graph.line"
SUBJECT = "geography"
BANDS = ("UP",)
CONCEPTS = tuple(f"geography.{c}" for c in ("river-system", "flooding", "drainage-systems", "river-processes"))
AVOID = r"internal landform"  # topics that teach none of it, read by name and section (P3m)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"river|drainage|flood|hydrograph|discharge|catchment|basin"
RIVERS = ["Nyabarongo", "Akagera", "Mukungwa", "Sebeya", "Akanyaru", "Mwogo"]
HOURS = 48


def sample(rng: random.Random) -> dict:
    while True:
        start, peak_rain = rng.randint(2, 6), rng.randint(8, 14)
        tr = start + rng.randint(1, 3)
        length = rng.randint(4, 7)
        rain = [0] * (HOURS + 1)
        for h in range(start, start + length):
            rain[h] = max(1, peak_rain - 3 * abs(h - tr) - rng.randint(0, 2))
        rain[tr] = peak_rain
        if rain.count(peak_rain) != 1:
            continue
        base = rng.choice([10, 15, 20])
        peak = base + rng.choice(range(30, 95, 5))
        tp = tr + rng.randint(6, 16)
        flow = []
        for h in range(HOURS + 1):
            if h <= tr:
                q = base
            elif h <= tp:  # the rising limb, steep
                q = base + (peak - base) * ((h - tr) / (tp - tr)) ** 1.6
            else:  # the falling limb, slower
                q = base + (peak - base) * max(0.0, 1 - (h - tp) / (2.2 * (tp - tr))) ** 1.4
            flow.append(int(round(q)))
        flow[tp] = peak
        if flow.count(peak) == 1:
            return {"band": "UP", "river": rng.choice(RIVERS), "rain": rain, "flow": flow}


def draw(p: dict):
    fig, ax = new_figure(7.6, 4.6)
    hours = list(range(HOURS + 1))
    top_q = (max(p["flow"]) // 10 + 2) * 10
    ax.plot(hours, p["flow"], color=INK, linewidth=2.0, zorder=4)
    ax.set_xlim(-0.5, HOURS + 0.5)
    ax.set_ylim(0, top_q)
    ax.set_yticks(range(0, top_q + 1, 10))
    ax.set_yticks(range(0, top_q + 1, 5), minor=True)
    ax.set_xticks(range(0, HOURS + 1, 6))
    ax.set_xticks(range(0, HOURS + 1, 1), minor=True)
    ax.grid(True, which="major", color=GRID, linewidth=0.7)
    ax.grid(True, which="minor", color=GRID, linewidth=0.3)
    ax.set_xlabel("Time from the start of the storm (hours)")
    ax.set_ylabel("Discharge (m³/s)")
    ax.tick_params(labelsize=8.5)
    ax2 = ax.twinx()
    ax2.bar(hours, p["rain"], width=0.8, color=FILL, edgecolor=INK, linewidth=0.6, zorder=2)
    top_r = 2 * max(p["rain"]) + 2
    ax2.set_ylim(top_r, 0)  # rain hangs from the top, as on a hydrograph
    ax2.set_yticks(range(0, top_r + 1, 2))
    ax2.set_yticks(range(0, top_r + 1, 1), minor=True)
    ax2.set_ylabel("Rainfall (mm per hour)")
    ax2.tick_params(labelsize=8.5)
    ax.set_title(f"Storm hydrograph for the River {p['river']}", fontsize=11)
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "in a rivers project"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    tr, tp = p["rain"].index(max(p["rain"])), p["flow"].index(max(p["flow"]))
    peak, base = max(p["flow"]), p["flow"][0]
    return [short(f"{who} reads this storm hydrograph of the River {p['river']} {rng.choice(SETTINGS)}. What is the lag time, from the peak of the rain to "
                  "the peak of the discharge, in hours?", tp - tr, [str(tp - tr), f"{tp - tr} hours", f"{tp - tr} h"]),
            short(f"What is the peak discharge of the River {p['river']} in this storm, in m³/s?", peak,
                  [str(peak), f"{peak} m³/s", f"{peak} m3/s", f"{peak} cumecs"]),
            short(f"{friend} compares the peak with the base flow before the storm. By how much does the discharge rise above the "
                  "base flow, in m³/s?", peak - base, [str(peak - base), f"{peak - base} m³/s", f"{peak - base} m3/s", f"{peak - base} cumecs"])]
