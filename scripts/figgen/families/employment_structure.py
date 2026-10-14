"""Employment structure (UP): a divided bar for each of three or four countries, lettered, split into its primary,
secondary and tertiary jobs as percentages on 10% gridlines. The percentage of a country's workers in a sector, for two
countries, and which country has the largest share of jobs in a sector.

Every key is the bars: each part is a whole number of tens, the parts add to 100, and one country plainly leads.
Countries are lettered, not named: invented data is never passed off as a real country's.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "employment_structure"
KIND = "table.data"
SUBJECT = "geography"
BANDS = ("UP",)
CONCEPTS = ("geography.development-indicators", "geography.industry-definition", "geography.statistical-presentation")
AVOID = r"exam-style|^introduction$|hiv|trade and commerce|transport and communication|geographic techniques"  # topics that teach none of it, read by name and section (P3m)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"employment|development|economic|industr|sector|production|statistic"
SECTORS = ["primary", "secondary", "tertiary"]
SHADES = ["#7fa86b", "#c9a46b", "#7d9bc1"]


def sample(rng: random.Random) -> dict:
    n = rng.randint(3, 4)
    splits = [(a, b, 100 - a - b) for a in range(10, 90, 10) for b in range(10, 90, 10) if 100 - a - b >= 10]
    while True:
        rows = dict(zip([f"Country {c}" for c in "ABCD"[:n]], (list(v) for v in rng.sample(splits, n))))
        s = rng.randrange(3)
        col = [v[s] for v in rows.values()]
        if col.count(max(col)) == 1:
            names = list(rows)
            c1, c2 = rng.sample(names, 2)
            return {"band": "UP", "countries": rows, "ask": [c1, rng.randrange(3), c2, rng.randrange(3)], "most": s}


def draw(p: dict):
    rows = p["countries"]
    n = len(rows)
    fig, ax = new_figure(7.4, 1.6 + 0.75 * n)
    for r, (name, v) in enumerate(rows.items()):
        y = n - 1 - r
        x = 0
        for k, part in enumerate(v):
            ax.add_patch(Rectangle((x, y + 0.15), part, 0.7, facecolor=SHADES[k], edgecolor=INK, linewidth=1.0, zorder=3))
            x += part
        ax.text(-2, y + 0.5, name, ha="right", va="center", fontsize=10.5, fontweight="bold")
    for v in range(0, 101, 10):
        ax.plot([v, v], [0, n], color=GRID, linewidth=0.7, zorder=1)
        ax.text(v, -0.15, str(v), ha="center", va="top", fontsize=8.5)
    ax.text(50, -0.75, "Percentage of workers (%)", ha="center", va="top", fontsize=9.5)
    for k, sector in enumerate(SECTORS):
        x = 104
        y = n - 0.4 - k * 0.55
        ax.add_patch(Rectangle((x, y - 0.18), 4, 0.36, facecolor=SHADES[k], edgecolor=INK, linewidth=0.8))
        ax.text(x + 5.5, y, sector, ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-24, 128)
    ax.set_ylim(-1.3, n + 0.2)
    ax.axis("off")
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "in a development project"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    rows = p["countries"]
    c1, s1, c2, s2 = p["ask"]
    s = SECTORS[p["most"]]
    top = max(rows, key=lambda k: rows[k][p["most"]])
    v1, v2 = rows[c1][s1], rows[c2][s2]
    return [short(f"{who} compares these countries' jobs {rng.choice(SETTINGS)}. What percentage of {c1}'s workers are in the "
                  f"{SECTORS[s1]} sector?", v1, [str(v1), f"{v1}%", f"{v1} %"]),
            short(f"What percentage of {c2}'s workers are in the {SECTORS[s2]} sector?", v2, [str(v2), f"{v2}%", f"{v2} %"]),
            mcq(f"{friend} looks at the bars. Which country has the largest {s} sector?", top, [k for k in rows if k != top], rng)]
