"""Crop calendars (LS, UP): a Gantt-style cropping calendar for a Rwandan farm over the agricultural year, September to
August, with Rwanda's seasons marked above the months (Season A, September to January; Season B, February to June;
the dry season, July and August) and one bar per crop (maize, beans, sorghum, Irish potato, soya beans, groundnuts)
from planting to harvest.

How many months a crop is in the field, which crop is harvested first, the one month two crops are both in the
field, and the month a crop is harvested. Every key is read off the bars: each bar starts at the start of its
planting month and ends at the end of its harvest month, one crop alone is harvested first, and the two crops asked
about share exactly one month.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL, GRID, INK, NAMES, count, mcq, new_figure, short

ID = "crop_calendar"
KIND = "timeline"
SUBJECT = "agriculture"
BANDS = ("UP", "LS")
CONCEPTS = ("agriculture.crop-production", "agriculture.cereals-production", "agriculture.legumes-production")
# A topic whose sections the book lists is reached only if it is the cereals or legumes unit, or names seasons.
NEEDS = r"cereal|legume|calendar|season"
# Topics listed without sections that share crop production but teach no calendar.
AVOID = r"soil|econom|management|mechani|record"
MONTHS = ["September", "October", "November", "December", "January", "February", "March", "April", "May", "June",
          "July", "August"]
SEASONS = [("Season A", 0, 4), ("Season B", 5, 9), ("Dry season", 10, 11)]
# crop: {season: (planting months, months in the field)}
CROPS = {
    "Maize": {"A": ([0, 1], [4, 5]), "B": ([5, 6], [4, 5])},
    "Beans": {"A": ([0, 1], [3, 4]), "B": ([5, 6], [3, 4])},
    "Sorghum": {"A": ([0, 1], [5, 6]), "B": ([5], [5, 6])},
    "Irish potato": {"A": ([0, 1], [3, 4]), "B": ([5, 6], [3, 4])},
    "Soya beans": {"A": ([0, 1], [4]), "B": ([5, 6], [4])},
    "Groundnuts": {"A": ([0, 1], [3, 4]), "B": ([5, 6], [3, 4])},
}
PLACES = ["Huye", "Musanze", "Nyagatare", "Kayonza", "Muhanga", "Rwamagana", "Ruhango", "Gicumbi", "Nyanza", "Kirehe"]


def _bar(rng: random.Random, crop: str, season: str) -> list:
    starts, lengths = CROPS[crop][season]
    a = rng.choice(starts)
    return [crop, a, a + rng.choice(lengths) - 1]


def sample(rng: random.Random) -> dict:
    while True:
        n = rng.randint(4, 5)
        names = rng.sample(sorted(CROPS), n)
        # one long Season A crop still in the field when a Season B crop goes in: they share one month
        long_a = next((c for c in names if c in ("Sorghum", "Maize")), None)
        if long_a is None:
            continue
        bars = [_bar(rng, c, rng.choice("AB")) for c in names]
        i = names.index(long_a)
        bars[i] = _bar(rng, long_a, "A")
        b_crops = [k for k, c in enumerate(names) if k != i]
        k = rng.choice(b_crops)
        end = bars[i][2]
        if end not in (5, 6) or end not in CROPS[names[k]]["B"][0]:
            continue
        bars[k] = [names[k], end, end + rng.choice(CROPS[names[k]]["B"][1]) - 1]
        months = [set(range(a, b + 1)) for _, a, b in bars]
        pairs = [(x, y) for x in range(n) for y in range(x + 1, n) if len(months[x] & months[y]) == 1]
        ends = sorted(b for _, _, b in bars)
        if not pairs or ends[0] == ends[1]:
            continue
        x, y = rng.choice(pairs)
        if rng.random() < 0.5:
            x, y = y, x
        long, harvest = rng.sample(names, 2)
        return {"band": rng.choice(BANDS), "place": rng.choice(PLACES), "crops": bars,
                "ask": {"long": long, "harvest": harvest, "both": [names[x], names[y]]}}


def draw(p: dict):
    bars = p["crops"]
    n = len(bars)
    fig, ax = new_figure(9.4, 2.2 + 0.62 * n)
    top = n + 0.5  # rows at n, n-1, ... 1
    for name, a, b in SEASONS:
        ax.add_patch(Rectangle((a, top + 0.75), b - a + 1, 0.75, facecolor="#e7efdc" if name != "Dry season" else "#f3ead7",
                               edgecolor=INK, linewidth=0.9))
        ax.text((a + b + 1) / 2, top + 1.125, name, ha="center", va="center", fontsize=9.5, fontweight="bold")
    for m, month in enumerate(MONTHS):
        ax.add_patch(Rectangle((m, top), 1, 0.75, facecolor="#d9dee3", edgecolor=INK, linewidth=0.8))
        ax.text(m + 0.5, top + 0.375, month[:3], ha="center", va="center", fontsize=9.5, fontweight="bold")
    for m in range(13):
        ax.plot([m, m], [0.5, top], color=GRID, linewidth=0.8, zorder=1)
    for r in range(n + 1):
        ax.plot([0, 12], [r + 0.5] * 2, color=GRID, linewidth=0.8, zorder=1)
    for r, (crop, a, b) in enumerate(bars):
        y = n - r
        ax.add_patch(Rectangle((a, y - 0.27), b - a + 1, 0.54, facecolor=FILL, edgecolor=INK, linewidth=1.2, zorder=2,
                               gid=f"bar:{crop}"))
        ax.text(-0.2, y, crop, ha="right", va="center", fontsize=10.5)
    ax.text(6, -0.05, "Each bar runs from planting (start of its first month) to harvest (end of its last month).",
            ha="center", va="center", fontsize=9, color="#333333")
    ax.set_title(f"Cropping calendar for a farm in {p['place']}", fontsize=12, pad=8)
    ax.set_xlim(-2.4, 12.1)
    ax.set_ylim(-0.4, top + 1.6)
    ax.axis("off")
    return fig


SETTINGS = ["in an agriculture lesson", "for the cooperative meeting", "to plan the year's work", "for the farm notice board",
            "before Season A begins", "for a school project"]
VERBS = ["draws", "pins up", "copies out", "shares", "uses"]


def said(crop: str) -> str:
    """A crop as a sentence names it: "beans", "Irish potato"."""
    return crop if crop.startswith("Irish") else crop.lower()


def be(crop: str) -> str:
    return "are" if crop.endswith("s") else "is"


def _month_forms(m: str) -> list[str]:
    return [m, m.lower(), m[:3], m[:3].lower(), m[:3] + "."]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    crops = {c: (a, b) for c, a, b in p["crops"]}
    ask = p["ask"]
    a, b = crops[ask["long"]]
    first = min(crops, key=lambda c: crops[c][1])
    planted_first = min(crops, key=lambda c: (crops[c][0], crops[c][1]))
    others = [c for c in crops if c not in (first, planted_first)]
    rng.shuffle(others)
    c1, c2 = ask["both"]
    (a1, b1), (a2, b2) = crops[c1], crops[c2]
    common = sorted(set(range(a1, b1 + 1)) & set(range(a2, b2 + 1)))[0]
    near = [m for m in (common - 1, common + 1, common - 2, common + 2) if 0 <= m <= 11]
    hc = ask["harvest"]
    return [
        count(f"{who} {rng.choice(VERBS)} this cropping calendar for a farm in {p['place']} {rng.choice(SETTINGS)}. "
              f"How many months {be(ask['long'])} {said(ask['long'])} in the field, from planting to harvest?", b - a + 1, "months"),
        mcq("In the year shown, September to August, which crop is harvested first?", first, [planted_first] + others, rng),
        mcq(f"In which month are both {said(c1)} and {said(c2)} in the field?", MONTHS[common], [MONTHS[m] for m in near], rng),
        short(f"In which month {be(hc)} {said(hc)} harvested?", MONTHS[crops[hc][1]], _month_forms(MONTHS[crops[hc][1]])),
    ]
