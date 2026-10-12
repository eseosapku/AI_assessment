"""Pie chart with each sector's angle printed. Counts are whole numbers by construction."""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import frac, mcq, new_figure, short

ID = "pie_chart"
KIND = "graph.pie"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")

SURVEYS = [
    ("Favourite subject", ["Maths", "Science", "English", "History", "Art"], "students"),
    ("Main crop grown", ["Maize", "Beans", "Cassava", "Coffee", "Bananas"], "farmers"),
    ("How families cook", ["Charcoal", "Firewood", "Gas", "Electricity"], "families"),
]
SHADES = ["#9aa4ad", "#d6dade", "#5f6b75", "#ffffff", "#b9c1c8"]


def sample(rng: random.Random) -> dict:
    title, cats, unit = rng.choice(SURVEYS)
    # At most four sectors: four different sizes of twelfths need 1+2+3+4 = 10 <= 12; five would need 15.
    k = rng.randint(3, min(4, len(cats)))
    while True:
        cuts = sorted(rng.sample(range(1, 12), k - 1))
        parts = [b - a for a, b in zip([0, *cuts], [*cuts, 12])]
        if len(set(parts)) == k:  # distinct sizes, so "the largest" is unique
            break
    angles = [30 * x for x in parts]
    total = rng.choice([24, 36, 48, 60, 72, 120])  # a multiple of 12, so every count is whole
    return {"title": title, "cats": rng.sample(cats, k), "angles": angles, "total": total, "unit": unit}


def draw(p: dict):
    fig, ax = new_figure(5.6, 4.6)
    labels = [f"{c}\n{a}°" for c, a in zip(p["cats"], p["angles"])]
    ax.pie(p["angles"], labels=labels, colors=SHADES[: len(p["angles"])], startangle=90, counterclock=False,
           wedgeprops={"edgecolor": "#111111", "linewidth": 1})
    ax.set_title(f"{p['title']} ({p['total']} {p['unit']})", pad=30)  # clear of a label at the top
    ax.axis("equal")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    i = rng.randrange(len(p["cats"]))
    count = p["angles"][i] * p["total"] // 360
    j = max(range(len(p["cats"])), key=lambda n: p["angles"][n])
    f = Fraction(p["angles"][j], 360)
    x, y = sorted(rng.sample(range(len(p["cats"])), 2), key=lambda n: -p["angles"][n])
    more = (p["angles"][x] - p["angles"][y]) * p["total"] // 360
    wrong = [frac(Fraction(p["angles"][n], 360)) for n in range(len(p["cats"])) if n != j] + [f"{p['angles'][j]}/100"]
    return [
        short(f"{p['total']} {p['unit']} were asked. How many chose {p['cats'][i]}?", count),
        mcq(f"What fraction of the {p['unit']} chose {p['cats'][j]}?", frac(f), wrong, rng),
        short(f"How many more {p['unit']} chose {p['cats'][x]} than chose {p['cats'][y]}?", more),
    ]
