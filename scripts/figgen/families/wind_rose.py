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
R0, UNIT = 0.6, 0.48  # the calm circle, and one day along a bar or between rings


def sample(rng: random.Random) -> dict:
    month = rng.choice(sorted(MONTHS))
    total = MONTHS[month]
    while True:
        calm = rng.randint(1, 5)
        cuts = sorted(rng.sample(range(1, total - calm), 7))
        counts = [b - a for a, b in zip([0] + cuts, cuts + [total - calm])]
        if min(counts) >= 2 and max(counts) <= 11 and counts.count(max(counts)) == 1 and max(counts) - sorted(counts)[-2] >= 2:
            return {"band": rng.choice(BANDS), "month": total, "name": month, "calm": calm,
                    "days": dict(zip(POINTS, counts)), "ask": rng.choice(POINTS)}


def draw(p: dict):
    """The classic rose: a calm circle at the centre, a bar out from its edge for each direction, rings one day apart
    counted from that edge, and a numbered scale from 0 in the gap between N and NE (P3o reviews: bars from the
    centre crowded it, and bars from an unmarked circle hid where 0 was)."""
    fig, ax = new_figure(6.0, 6.2)
    top = max(p["days"].values())
    for d in range(1, top + 1):
        ax.add_patch(Circle((0, 0), R0 + d * UNIT, facecolor="none", edgecolor="#bbbbbb", linewidth=0.6, linestyle=(0, (2, 2))))
    a_lab = math.radians(90 - 22.5)
    ux0, uy0 = math.cos(a_lab), math.sin(a_lab)
    ax.plot([R0 * ux0, (R0 + top * UNIT) * ux0], [R0 * uy0, (R0 + top * UNIT) * uy0], color="#555555", linewidth=0.9)
    for d in range(0, top + 1):
        r = R0 + d * UNIT
        ax.text(r * ux0 + 0.16 * uy0, r * uy0 - 0.16 * ux0, str(d), ha="center", va="center", fontsize=7.5, color="#333333",
                bbox=dict(boxstyle="square,pad=0.03", facecolor="white", edgecolor="none"), zorder=5)
    for k, name in enumerate(POINTS):
        a = math.radians(90 - 45 * k)
        n = p["days"][name]
        ux, uy, vx, vy = math.cos(a), math.sin(a), -math.sin(a) * 0.12, math.cos(a) * 0.12
        r1 = R0 + n * UNIT
        ax.add_patch(Polygon([(R0 * ux + vx, R0 * uy + vy), (r1 * ux + vx, r1 * uy + vy), (r1 * ux - vx, r1 * uy - vy),
                              (R0 * ux - vx, R0 * uy - vy)], closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.0, zorder=3))
        rl = R0 + (top + 1.3) * UNIT
        ax.text(rl * ux, rl * uy, SHORT[name], ha="center", va="center", fontsize=11, fontweight="bold")
    ax.add_patch(Circle((0, 0), R0, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=4))
    lim = R0 + (top + 2) * UNIT
    day = "day" if p["calm"] == 1 else "days"
    ax.text(-lim + 0.05, -lim + 0.1, f"Calm: {p['calm']} {day}", ha="left", va="bottom", fontsize=10, fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.25", facecolor="white", edgecolor=INK, linewidth=0.8))
    ax.text(lim - 0.05, -lim + 0.1, "Rings: 1 day each,\ncounted from the circle", ha="right", va="bottom", fontsize=8.5)
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
