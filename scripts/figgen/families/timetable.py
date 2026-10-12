"""A bus timetable to read. Every bus takes the same time between stops."""
from __future__ import annotations

import random

from ..core import mcq, new_figure, short

ID = "timetable"
KIND = "text.notice"
SUBJECT = "english"
BANDS = ("P", "LS", "UP")

ROUTES = [
    ["Bus Park", "Market", "Hospital", "University", "Stadium"],
    ["Town Centre", "Post Office", "School", "Clinic", "Airport"],
    ["Main Station", "Library", "Bank", "Museum", "Lake"],
]


def _hm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def sample(rng: random.Random) -> dict:
    stops = rng.choice(ROUTES)
    k = rng.randint(4, 5)
    stops = stops[:k]
    gaps = [rng.choice([5, 10, 15, 20]) for _ in range(k - 1)]
    first = rng.choice([6 * 60, 6 * 60 + 30, 7 * 60, 7 * 60 + 15])
    every = rng.choice([30, 45, 60])
    departures = [first + every * i for i in range(4)]
    return {"stops": stops, "gaps": gaps, "departures": departures}


def times(p: dict) -> list[list[int]]:
    rows = []
    for dep in p["departures"]:
        t = [dep]
        for g in p["gaps"]:
            t.append(t[-1] + g)
        rows.append(t)
    return rows


def draw(p: dict):
    rows = times(p)
    cells = [[p["stops"][s]] + [_hm(r[s]) for r in rows] for s in range(len(p["stops"]))]
    fig, ax = new_figure(6.0, 0.6 + 0.5 * len(cells))
    table = ax.table(cellText=cells, colLabels=["Stop"] + [f"Bus {i + 1}" for i in range(len(rows))],
                     loc="center", cellLoc="center")
    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1, 1.6)
    ax.axis("off")
    ax.set_title("Bus timetable (Monday to Friday)", fontsize=12, pad=4)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    rows = times(p)
    stops = p["stops"]
    b = rng.randrange(len(rows))
    s = rng.randrange(1, len(stops))
    journey = rows[0][-1] - rows[0][0]
    # Catch the latest bus that still arrives at the last stop by a deadline.
    target = rng.randrange(len(rows))
    deadline = rows[target][-1] + rng.choice([0, 5])
    if target + 1 < len(rows):
        deadline = min(deadline, rows[target + 1][-1] - 5)
    ok = [i for i, r in enumerate(rows) if r[-1] <= deadline]
    best = max(ok)
    return [
        short(f"Bus {b + 1} leaves {stops[0]} at {_hm(rows[b][0])}. What time does it reach {stops[s]}?", _hm(rows[b][s]),
              [_hm(rows[b][s]).lstrip("0"), _hm(rows[b][s]).replace(":", ".")]),
        short(f"How many minutes does the journey from {stops[0]} to {stops[-1]} take?", journey, [f"{journey} minutes"]),
        mcq(f"Jean must be at {stops[-1]} by {_hm(deadline)}. Which is the latest bus she can catch from {stops[0]}?",
            f"Bus {best + 1}", [f"Bus {i + 1}" for i in range(len(rows)) if i != best], rng),
    ]
