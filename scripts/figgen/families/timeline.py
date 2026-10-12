"""A timeline of real events with their real years. Only events whose dates are settled."""
from __future__ import annotations

import random

from ..core import mcq, new_figure, short

ID = "timeline"
KIND = "timeline"
SUBJECT = "history"
BANDS = ("LS", "UP")

# Each year checked against standard references; nothing contested is included.
SETS = {
    "The Cold War": [
        ("Truman Doctrine announced", 1947), ("Berlin Blockade begins", 1948), ("NATO is formed", 1949),
        ("Korean War begins", 1950), ("Warsaw Pact is formed", 1955), ("Hungarian Uprising", 1956),
        ("Sputnik 1 is launched", 1957), ("Berlin Wall is built", 1961), ("Cuban Missile Crisis", 1962),
        ("Prague Spring", 1968), ("Fall of Saigon", 1975),
    ],
    "Independence in Africa": [
        ("Ghana becomes independent", 1957), ("Guinea becomes independent", 1958), ("Nigeria becomes independent", 1960),
        ("Tanganyika becomes independent", 1961), ("Rwanda becomes independent", 1962),
        ("Kenya becomes independent", 1963), ("Zambia becomes independent", 1964),
        ("Botswana becomes independent", 1966), ("Mozambique becomes independent", 1975),
        ("Zimbabwe becomes independent", 1980), ("Namibia becomes independent", 1990),
    ],
}


def sample(rng: random.Random) -> dict:
    title = rng.choice(sorted(SETS))
    events = sorted(rng.sample(SETS[title], 5), key=lambda e: e[1])
    return {"title": title, "events": [list(e) for e in events]}


def draw(p: dict):
    events = p["events"]
    first, last = events[0][1], events[-1][1]
    lo, hi = first - 2, last + 2
    fig, ax = new_figure(6.6, 5.2)
    ax.plot([0, 0], [lo, hi], color="#111111", linewidth=2)
    for y in range(lo, hi + 1):  # a small tick for every year, so each dot's year can be checked by eye
        ax.plot([-0.06, 0.06], [y, y], color="#111111", linewidth=0.8)
    step = 5 if hi - lo <= 40 else 10
    for y in range(-(-lo // step) * step, hi + 1, step):
        ax.plot([-0.12, 0.12], [y, y], color="#111111", linewidth=1)
        ax.text(-0.25, y, str(y), ha="right", va="center", fontsize=10)
    # Each label sits at its year, or lower when the one above is too close: labels keep
    # the events' order down the page, so none overlaps another and no leader crosses one.
    gap = (hi - lo) * 0.085
    pos: list[float] = []
    for _, year in events:
        pos.append(max(year, pos[-1] + gap) if pos else max(year, lo + gap / 2))
    if pos[-1] > hi - gap / 2:
        pos[-1] = hi - gap / 2
        for i in range(len(pos) - 2, -1, -1):
            pos[i] = min(pos[i], pos[i + 1] - gap)
    for i, ((name, year), y) in enumerate(zip(events, pos)):
        ax.plot([0, 0.6, 0.9], [year, year, y], color="#111111", linewidth=0.8, gid=f"leader-{i}")
        ax.plot(0, year, marker="o", color="#111111")
        ax.text(1.0, y, f"{name} ({year})", ha="left", va="center", fontsize=10, gid=f"label-{i}")
    ax.set_xlim(-1.2, 7.5)
    ax.set_ylim(hi + 1, lo - 1)  # earliest at the top
    ax.axis("off")
    ax.set_title(p["title"])
    return fig


def questions(p: dict, rng: random.Random) -> list:
    events = p["events"]
    i, j = sorted(rng.sample(range(len(events)), 2))
    gap = events[j][1] - events[i][1]
    names = [e[0] for e in events]
    return [
        mcq("Which of these events happened first?", names[0], rng.sample(names[1:], 3), rng),
        short(f"How many years after \"{names[i]}\" did \"{names[j]}\" happen?", gap, [f"{gap} years"]),
    ]
