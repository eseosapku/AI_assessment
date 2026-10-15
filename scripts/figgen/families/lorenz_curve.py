"""Lorenz curves (AL): two countries' Lorenz curves on one square grid, the cumulative percentage of the population
(poorest first) across and the cumulative percentage of income up, with the line of equality. Each curve joins its
points at the quintiles, every one on a gridline crossing (multiples of 5%), and is bowed below the line of equality:
each fifth of the people gets at least as large a share as the fifth below it.

The share of income of the poorest 20, 40 or 60%, read straight off a curve; the share of the richest 20 or 40%, one
hundred less the curve's reading at 80 or 60%; and which country has the more equal distribution, the curve nearer the
line of equality, which lies five points or more above the other at every quintile so the curves never cross.

Cambridge AS Level teaches it (chapter 14, "Measuring income and wealth inequality"); no Rwanda S5 or S6 topic names
it, so the figure is drawn at AS & A Level only.
"""
from __future__ import annotations

import itertools
import random

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "lorenz_curve"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("AL",)
CONCEPTS = ("economics.income-wealth-inequality", "economics.income-distribution", "economics.income-and-wealth")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"inequality|lorenz|gini|income distribution"

# Each fifth's share of income, in fives: never falling from the poorest fifth to the richest, never all equal.
SHARES = [s for s in itertools.combinations_with_replacement(range(5, 66, 5), 5) if sum(s) == 100 and s[0] < 20]
COUNTRIES = ["Country A", "Country B"]


def _cum(shares) -> list[int]:
    out = [0]
    for s in shares:
        out.append(out[-1] + s)
    return out


def sample(rng: random.Random) -> dict:
    while True:
        a, b = (_cum(s) for s in rng.sample(SHARES, 2))
        if all(x >= y + 5 for x, y in zip(a[1:5], b[1:5])):
            more, less = a, b
        elif all(y >= x + 5 for x, y in zip(a[1:5], b[1:5])):
            more, less = b, a
        else:
            continue  # the curves cross, or come within five points: no plain answer
        cum = [more, less] if rng.random() < 0.5 else [less, more]
        return {"band": "AL", "countries": list(COUNTRIES), "cum": cum, "poor": rng.choice([1, 2, 2, 3]),
                "rich": rng.choice([1, 1, 2]), "ask": [rng.randrange(2), rng.randrange(2)]}


STYLES = [{"linestyle": "-", "marker": "o"}, {"linestyle": "--", "marker": "s"}]


def draw(p: dict):
    fig, ax = new_figure(5.6, 5.6)
    xs = [0, 20, 40, 60, 80, 100]
    ax.plot([0, 100], [0, 100], color=INK, linewidth=1.2)
    ax.text(46, 48.5, "Line of equality", rotation=45, rotation_mode="anchor", ha="center", va="bottom", fontsize=9.5)
    for name, ys, style in zip(p["countries"], p["cum"], STYLES):
        ax.plot(xs, ys, color=INK, linewidth=1.9, markersize=5, **style)
    # a key in the empty triangle above the line of equality
    for i, (name, style) in enumerate(zip(p["countries"], STYLES)):
        y = 93 - 8 * i
        ax.plot([4, 14], [y, y], color=INK, linewidth=1.9, markersize=5, markevery=[1], **style)
        ax.text(17, y, name, ha="left", va="center", fontsize=10)
    ax.set_xticks(xs)
    ax.set_xticks(range(0, 101, 10), minor=True)
    ax.set_yticks(range(0, 101, 10))
    ax.set_yticks(range(0, 101, 5), minor=True)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.set_aspect("equal")
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=8.5)
    ax.tick_params(which="minor", length=0)
    ax.set_xlabel("Cumulative % of population (poorest first)")
    ax.set_ylabel("Cumulative % of income")
    ax.set_title("Lorenz curves for two countries", fontsize=11.5)
    return fig


VERBS = ["studies", "is given", "draws", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]


def _pct(v: int) -> list[str]:
    return [str(v), f"{v}%", f"{v} %", f"{v} per cent", f"{v} percent"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    names, cum = p["countries"], p["cum"]
    k, r = p["poor"], p["rich"]
    c1, c2 = (names[i] for i in p["ask"])
    poor = cum[p["ask"][0]][k]
    rich = 100 - cum[p["ask"][1]][5 - r]
    more = names[0] if all(x > y for x, y in zip(cum[0][1:5], cum[1][1:5])) else names[1]
    return [
        short(f"{who} {rng.choice(VERBS)} these Lorenz curves {rng.choice(SETTINGS)}. What percentage of total income goes to "
              f"the poorest {20 * k}% of the population in {c1}?", poor, _pct(poor)),
        short(f"What percentage of total income goes to the richest {20 * r}% of the population in {c2}?", rich, _pct(rich)),
        mcq("Which country has the more equal distribution of income?", more,
            [*names, "Neither: the distributions are the same"], rng),
    ]
