"""Population pyramid by ten-year age group. Bars end on whole percentages. The percentage of one sex and age group,
the percentage aged under 20, the percentage aged under 20 or 60 and over, and whether more males or females are aged
60 and over. The shape is not asked: the blind review disputed it (P3b), and the profiles below only keep it plain.
"""
from __future__ import annotations

import random
from functools import lru_cache
from itertools import combinations, product

from ..core import FILL, FILL_2, GRID, NAMES as PEOPLE, new_figure, short

ID = "population_pyramid"
KIND = "geo.climate"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = ("geography.population-structure", "geography.population-growth")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"population|pyramid|age.sex|demograph|dependen"

GROUPS = ["0–9", "10–19", "20–29", "30–39", "40–49", "50–59", "60–69", "70+"]
SHAPES = {"expanding": None, "stable": None, "contracting": None}  # profiles: _sides(shape)
NAMES = {"expanding": "Expanding (a young population)", "stable": "Stable", "contracting": "Contracting (an ageing population)"}


@lru_cache(maxsize=None)
def _sides(shape: str) -> tuple:
    """Every one-sided profile, young to old, in % of the whole population and adding to 50,
    that plainly shows the shape on its own. Noise on each bar left most pyramids between two
    shapes, so the shape question had two defensible answers; these profiles never do."""
    out = []
    if shape == "expanding":  # narrows steadily from a wide base
        for young in combinations(range(16, 1, -1), 6):
            for old in ((2, 1), (1, 1), (2, 2)):
                side = (*young, *old)
                if sum(side) == 50 and young[-1] >= old[0] and side[0] >= 3 * side[4] and side[0] >= 2 * side[3]:
                    out.append(side)
    elif shape == "stable":  # straight sides to 40, then a gentle taper
        for rest in product(range(2, 8), repeat=4):
            side = (7, 7, 7, 7, *rest)
            if sum(side) == 50 and all(0 <= a - b <= 2 for a, b in zip(side[3:], side[4:])) and 2 * side[-1] >= 7:
                out.append(side)
    else:  # contracting: narrower towards the base, widest in middle age
        for young in combinations(range(3, 12), 5):
            for old in product(range(4, 12), repeat=3):
                side = (*young, *old)
                if (sum(side) == 50 and side[0] <= side[4] - 3
                        and side[4] >= old[0] >= old[1] >= old[2]):
                    out.append(side)
    return tuple(out)


def sample(rng: random.Random) -> dict:
    # Only shapes a reader cannot dispute: the blind review judged 8 of 8 "stable" pyramids
    # also contracting or expanding. "Stable" stays in the question as a wrong option.
    shape = rng.choice(["contracting", "expanding"])
    sides = _sides(shape)
    while True:
        male, female = list(rng.choice(sides)), list(rng.choice(sides))
        if sum(male[6:]) != sum(female[6:]):  # one sex plainly has more people aged 60 and over
            return {"band": rng.choice(BANDS), "shape": shape, "male": male, "female": female,
                    "group": rng.randrange(len(GROUPS)), "side": rng.choice(["males", "females"])}


def draw(p: dict):
    fig, ax = new_figure(6.4, 4.6)
    y = range(len(GROUPS))
    ax.barh(y, [-m for m in p["male"]], color=FILL, edgecolor="#111111", height=0.8)
    ax.barh(y, p["female"], color=FILL_2, edgecolor="#111111", height=0.8)
    top = max(max(p["male"]), max(p["female"])) + 1
    # Numbers every 2 on a wide scale so they never crowd; a gridline on every whole percent.
    every = 2 if top > 10 else 1
    ticks = [t for t in range(-top, top + 1) if t % every == 0]
    ax.set_xticks(ticks, [str(abs(t)) for t in ticks])
    ax.set_xticks(range(-top, top + 1), minor=True)
    ax.set_xlim(-top - 0.5, top + 0.5)
    ax.tick_params(axis="x", labelsize=8)
    ax.xaxis.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_yticks(list(y), GROUPS)
    ax.axvline(0, color="#111111", linewidth=1)
    ax.set_xlabel("Percentage of population (%)")
    ax.set_ylabel("Age group (years)")
    ax.set_ylim(-0.6, len(GROUPS) + 0.4)  # room above the top bar for the headings
    ax.text(-top / 2, len(GROUPS) - 0.15, "Male", ha="center", va="center", fontweight="bold")
    ax.text(top / 2, len(GROUPS) - 0.15, "Female", ha="center", va="center", fontweight="bold")
    ax.set_title("Population pyramid for a country", pad=10)
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "in a census project"]


def _pct(v: int) -> list[str]:
    return [str(v), f"{v}%", f"{v} %"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(PEOPLE, 2)
    i, side = p["group"], p["side"]
    v = (p["male"] if side == "males" else p["female"])[i]
    young = sum(p["male"][:2]) + sum(p["female"][:2])
    old_m, old_f = sum(p["male"][6:]), sum(p["female"][6:])
    dependent = young + old_m + old_f
    more = "Males" if old_m > old_f else "Females"
    return [
        short(f"{who} reads this population pyramid {rng.choice(SETTINGS)}. What percentage of the population are {side} aged {GROUPS[i]}?",
              v, _pct(v)),
        short(f"{friend} adds males and females together. What percentage of the population is aged under 20?", young, _pct(young)),
        short(f"What percentage of the population in this pyramid is aged under 20 or 60 and over, males and females together?", dependent,
              _pct(dependent)),
        short("Are there more males or more females aged 60 and over in this pyramid?", more,
              [more, more.lower(), f"more {more.lower()}"]),
    ]
