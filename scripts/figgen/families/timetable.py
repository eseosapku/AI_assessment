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


# A line printed under the timetable, its question, the answer and wrong answers that are not
# also true (the title already says the buses run Monday to Friday).
NOTES = [
    ("Tickets can be bought from the driver.", "Where can you buy a ticket?", "From the driver",
     ["At the ticket office", "At the market", "Online"]),
    ("Buses do not run on public holidays.", "When do the buses not run?", "On public holidays",
     ["On Mondays", "On Wednesdays", "In the morning"]),
    ("Children under 5 travel free.", "Who can travel without paying?", "Children under 5",
     ["Students", "Older people", "Teachers"]),
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
    return {"stops": stops, "gaps": gaps, "departures": departures, "note": rng.randrange(len(NOTES))}


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
    fig, ax = new_figure(6.4, 0.7 + 0.5 * len(cells))
    table = ax.table(cellText=cells, colLabels=["Stop"] + [f"Bus {i + 1}" for i in range(len(rows))],
                     loc="upper center", cellLoc="center", colWidths=[0.28] + [0.18] * len(rows))
    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1, 1.6)
    ax.axis("off")
    ax.set_title("Bus timetable (Monday to Friday)", fontsize=12, pad=4)
    fig.canvas.draw()  # the note goes just under the table, which is placed only once drawn
    box = table.get_window_extent(fig.canvas.get_renderer()).transformed(ax.transAxes.inverted())
    ax.text(box.x0, box.y0 - 0.05, f"Note: {NOTES[p['note']][0]}", transform=ax.transAxes, fontsize=11, va="top")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    """Questions answered by reading the timetable and its note, as in a reading paper; no sums."""
    rows = times(p)
    stops = p["stops"]
    b = rng.randrange(len(rows))
    s = rng.randrange(1, len(stops))
    wb = rng.randrange(len(rows))
    ws = rng.randrange(1, len(stops))
    # Catch the latest bus that still arrives at the last stop by a deadline.
    target = rng.randrange(len(rows))
    deadline = rows[target][-1] + rng.choice([0, 5])
    if target + 1 < len(rows):
        deadline = min(deadline, rows[target + 1][-1] - 5)
    best = max(i for i, r in enumerate(rows) if r[-1] <= deadline)
    _, ask, right, wrong = NOTES[p["note"]]
    at = _hm(rows[b][s])
    hh, mm = at.split(":")
    return [
        short(f"Bus {b + 1} leaves {stops[0]} at {_hm(rows[b][0])}. What time does it reach {stops[s]}?", at,
              [f"{int(hh)}:{mm}", f"{hh}.{mm}", f"{int(hh)}.{mm}"]),
        short(f"Which stop does Bus {wb + 1} reach at {_hm(rows[wb][ws])}?", stops[ws]),
        mcq(f"Jean must be at {stops[-1]} by {_hm(deadline)}. Which is the latest bus she can catch from {stops[0]}?",
            f"Bus {best + 1}", [f"Bus {i + 1}" for i in range(len(rows)) if i != best], rng),
        mcq(ask, right, wrong, rng),
    ]
