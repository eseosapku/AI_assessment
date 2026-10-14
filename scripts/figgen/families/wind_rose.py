"""Wind roses (LS, UP): a month of wind readings at a school weather station, a bar along each of the 8 compass
directions as long as the days the wind blew from it, on rings one day apart, and the calm days in the centre. The
prevailing wind, the days the wind blew from a direction, and the calm days.

Every key is the readings: each bar ends on a ring, and one direction plainly has the most days.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Polygon

from ..core import FILL, INK, NAMES, new_figure, short

ID = "wind_rose"
KIND = "geo.climate"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = ("geography.winds", "geography.weather-data-collection")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"wind|weather(?!ing)|climat|instrument|station"
POINTS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
SHORT = {"north": "N", "north-east": "NE", "east": "E", "south-east": "SE", "south": "S", "south-west": "SW",
         "west": "W", "north-west": "NW"}
MONTHS = {"April": 30, "June": 30, "September": 30, "November": 30, "January": 31, "March": 31, "July": 31, "October": 31}
UNIT = 0.42  # one day along a bar, one ring


def sample(rng: random.Random) -> dict:
    month = rng.choice(sorted(MONTHS))
    total = MONTHS[month]
    while True:
        calm = rng.randint(1, 5)
        cuts = sorted(rng.sample(range(1, total - calm), 7))
        counts = [b - a for a, b in zip([0] + cuts, cuts + [total - calm])]
        if max(counts) <= 11 and counts.count(max(counts)) == 1 and max(counts) - sorted(counts)[-2] >= 2:
            return {"band": rng.choice(BANDS), "month": total, "name": month, "calm": calm,
                    "days": dict(zip(POINTS, counts)), "ask": rng.choice(POINTS)}


def draw(p: dict):
    """Bars from the centre, each ending on a numbered ring; the calm days in a box (P3o review: bars from a calm circle's
    edge left zero unclear, and unnumbered rings were miscounted)."""
    fig, ax = new_figure(6.0, 6.2)
    top = max(p["days"].values())
    a_lab = math.radians(90 - 22.5)  # ring numbers in the gap between north and north-east
    for d in range(1, top + 1):
        ax.add_patch(Circle((0, 0), d * UNIT, facecolor="none", edgecolor="#bbbbbb", linewidth=0.6, linestyle=(0, (2, 2))))
        ax.text(d * UNIT * math.cos(a_lab), d * UNIT * math.sin(a_lab), str(d), ha="center", va="center", fontsize=7,
                color="#555555", bbox=dict(boxstyle="square,pad=0.03", facecolor="white", edgecolor="none"), zorder=5)
    for k, name in enumerate(POINTS):
        a = math.radians(90 - 45 * k)
        n = p["days"][name]
        ux, uy, vx, vy = math.cos(a), math.sin(a), -math.sin(a) * 0.13, math.cos(a) * 0.13
        r0, r1 = 0.12, n * UNIT
        ax.add_patch(Polygon([(r0 * ux + vx, r0 * uy + vy), (r1 * ux + vx, r1 * uy + vy), (r1 * ux - vx, r1 * uy - vy),
                              (r0 * ux - vx, r0 * uy - vy)], closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.0, zorder=3))
        rl = (top + 1.3) * UNIT
        ax.text(rl * ux, rl * uy, SHORT[name], ha="center", va="center", fontsize=11, fontweight="bold")
    lim = (top + 2) * UNIT
    ax.text(-lim + 0.05, -lim + 0.1, f"Calm: {p['calm']} days", ha="left", va="bottom", fontsize=10, fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.25", facecolor="white", edgecolor=INK, linewidth=0.8))
    ax.text(lim - 0.05, -lim + 0.1, "1 ring = 1 day", ha="right", va="bottom", fontsize=9)
    ax.set_title(f"{p['name']}: days the wind blew from each direction", fontsize=10)
    ax.set_xlim(-lim, lim)
    ax.set_ylim(-lim, lim)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a geography lesson", "for homework", "for the school weather club", "for a class test", "in a weather project"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    days = p["days"]
    top = max(days, key=days.get)
    ask = p["ask"]
    return [short(f"{who} recorded the wind every day for a month {rng.choice(SETTINGS)}. What was the prevailing wind, the direction it "
                  "came from most often?", top, [top, top.replace("-", " "), top.replace("-", ""), SHORT[top], f"{top}erly",
                                                 f"from the {top}"]),
            short(f"{friend} reads the wind rose. On how many days did the wind blow from the {ask}?", days[ask],
                  [str(days[ask]), f"{days[ask]} days"]),
            short(f"How many days of {p['name']} were calm?", p["calm"], [str(p["calm"]), f"{p['calm']} days"])]
