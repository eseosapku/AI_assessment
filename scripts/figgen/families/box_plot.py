"""Box plot drawn on a labelled scale. The five values sit on whole-number ticks."""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import GRID, new_figure, short

ID = "box_plot"
KIND = "graph.stats"
SUBJECT = "mathematics"
BANDS = ("UP",)
# One variable: a shared word like "dispersion" is no reason to sit in a two-variable chapter.
AVOID = r"bivariate|scatter|correlation|regression|random variable"
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "quartiles", "dispersion-measures", "averages-types",
))

DATA = [
    ("Times to run 100 m (seconds)", 10, 30),
    ("Marks in a mathematics test", 20, 60),
    ("Heights of seedlings (cm)", 2, 22),
    ("Minutes spent on homework", 10, 50),
]
NOUNS = {"Times to run 100 m (seconds)": "times", "Marks in a mathematics test": "marks",
         "Heights of seedlings (cm)": "heights", "Minutes spent on homework": "homework times"}


def sample(rng: random.Random) -> dict:
    title, lo, hi = rng.choice(DATA)
    five = sorted(rng.sample(range(lo, hi + 1), 5))
    return {"title": title, "lo": lo, "hi": hi, "five": five}


def draw(p: dict):
    mn, q1, md, q3, mx = p["five"]
    fig, ax = new_figure(6.6, 2.6)
    ax.plot([mn, q1], [0, 0], color="#111111")
    ax.plot([q3, mx], [0, 0], color="#111111")
    ax.add_patch(Rectangle((q1, -0.25), q3 - q1, 0.5, fill=False, edgecolor="#111111", linewidth=1.6))
    for x, h in ((mn, 0.15), (md, 0.25), (mx, 0.15)):
        ax.plot([x, x], [-h, h], color="#111111")
    # Numbers every 5, a gridline on every mark: values are whole marks and read exactly.
    ax.set_xticks([v for v in range(p["lo"] - 2, p["hi"] + 3) if v % 5 == 0])
    ax.set_xticks(range(p["lo"] - 2, p["hi"] + 3), minor=True)
    ax.set_xlim(p["lo"] - 2, p["hi"] + 2)
    ax.tick_params(axis="x", labelsize=9)
    ax.xaxis.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_yticks([])
    ax.spines["left"].set_visible(False)
    ax.set_ylim(-0.6, 0.6)
    ax.set_title(p["title"])
    return fig


def questions(p: dict, rng: random.Random) -> list:
    mn, q1, md, q3, mx = p["five"]
    return [
        short("What is the median?", md),
        short("What is the interquartile range?", q3 - q1),
        short("What is the range?", mx - mn),
        # A quarter of the data lies beyond each quartile: asked of this plot's own quartiles.
        short(f"About what percentage of the {NOUNS[p['title']]} are more than {q3}?", 25, ["25%"]),
        short(f"About what percentage of the {NOUNS[p['title']]} are less than {q1}?", 25, ["25%"]),
    ]
