"""A distance-time graph of a trip from home and back, with a stop (LS, UP).

Every corner is at a quarter hour and a whole kilometre, and every speed is a whole number of
km/h, so readings are exact and speeds work out.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, new_figure, short

ID = "travel_graph"
KIND = "graph.line"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("kinematic-graphs", "speed-distance-time"))

PLACES = ["market", "health centre", "lake", "farm", "football ground", "town centre", "library", "bus station"]


def _clock(start: int, minutes: int) -> str:
    total = start * 60 + minutes
    return f"{total // 60:02d}:{total % 60:02d}"


def minutes(clock: str, start: int) -> int:
    h, m = map(int, clock.split(":"))
    return h * 60 + m - start * 60


def sample(rng: random.Random) -> dict:
    while True:
        v1, k1 = rng.choice([8, 12, 16, 20]), rng.choice([2, 3, 4])  # km/h, quarter hours
        d = v1 * k1 // 4
        stop = rng.choice([1, 2, 3, 4])
        pts = [(0, 0), (15 * k1, d), (15 * (k1 + stop), d)]
        if rng.random() < 0.5:  # a second leg further on before turning back
            v2, k2 = rng.choice([4, 8, 12]), rng.choice([1, 2])
            d2 = d + v2 * k2 // 4
            t = pts[-1][0] + 15 * k2
            pts += [(t, d2), (t + 15 * rng.choice([1, 2]), d2)]
        far, t_turn = pts[-1][1], pts[-1][0]
        backs = [k for k in range(1, 9) if (4 * far) % k == 0 and 6 <= 4 * far // k <= 24]
        if not backs:
            continue
        k3 = rng.choice(backs)
        pts.append((t_turn + 15 * k3, 0))
        if pts[-1][0] <= 300 and far <= 20:
            return {"band": rng.choice(BANDS), "name": rng.choice(NAMES), "place": rng.choice(PLACES),
                    "start": rng.choice([7, 8, 9, 13, 14]), "points": [list(q) for q in pts]}


def draw(p: dict):
    pts = p["points"]
    end, far = pts[-1][0], max(d for _, d in pts)
    fig, ax = new_figure(6.6, 4.4)
    ax.plot([t for t, _ in pts], [d for _, d in pts], color=INK, linewidth=1.8)
    # The place named over the stop there, the furthest from home: a trip may stop on the way too.
    a, b = next((a, b) for a, b in zip(pts, pts[1:]) if a[1] == b[1] == far)
    ax.text((a[0] + b[0]) / 2, far + 0.15 * (1 if far <= 10 else 2), p["place"].capitalize(), ha="center", va="bottom", fontsize=10)
    ax.set_xticks(range(0, end + 1, 30), [_clock(p["start"], t) for t in range(0, end + 1, 30)])
    ax.set_xticks(range(0, end + 1, 15), minor=True)
    step = 1 if far <= 10 else 2
    ax.set_yticks(range(0, far + step + 1, step))
    ax.set_yticks(range(0, far + step + 1), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(0, end + 15)
    ax.set_ylim(0, far + step)
    ax.tick_params(axis="x", labelsize=8, rotation=0)
    ax.set_xlabel("Time")
    ax.set_ylabel("Distance from home (km)")
    ax.set_title(f"{p['name']}'s trip to the {p['place']}")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    pts, name, place = p["points"], p["name"], p["place"]
    t, d = rng.choice(pts[1:-1])
    # The stop at the place itself: the furthest from home (a trip may stop on the way too).
    far = max(d for _, d in pts)
    stop = next(b[0] - a[0] for a, b in zip(pts, pts[1:]) if a[1] == b[1] == far)
    (t0, d0), (t1, _) = pts[-2], pts[-1]
    speed = d0 * 60 // (t1 - t0)
    return [
        short(f"How far from home was {name} at {_clock(p['start'], t)}?", d, [f"{d} km", f"{d}km"]),
        short(f"How long did {name} stop at the {place}, in minutes?", stop, [f"{stop} minutes", f"{stop} min"]),
        short(f"What was {name}'s speed on the way home, in km/h?", speed, [f"{speed} km/h", f"{speed}km/h"]),
    ]
