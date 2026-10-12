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
    fig, ax = new_figure(7.4, 3.4)
    ax.plot([lo, hi], [0, 0], color="#111111", linewidth=2)
    for y in range((lo // 5) * 5, hi + 1, 5):
        if lo <= y <= hi:
            ax.plot([y, y], [-0.06, 0.06], color="#111111")
            ax.text(y, -0.22, str(y), ha="center", fontsize=9)
    # Four label heights in turn, so events a few years apart never overlap.
    for i, (name, year) in enumerate(events):
        h = [0.8, -0.4, 0.35, -0.95][i % 4]  # lower labels sit below the year numbers at -0.22
        up = h > 0
        ax.plot([year, year], [0, h * 0.8], color="#111111", linewidth=0.8)
        ax.plot(year, 0, marker="o", color="#111111")
        ax.text(year, h, f"{name}\n({year})", ha="center", va="bottom" if up else "top", fontsize=9)
    ax.set_xlim(lo - 1, hi + 1)
    ax.set_ylim(-1.4, 1.35)
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
