"""Population pyramid by ten-year age group. Bars end on whole percentages."""
from __future__ import annotations

import random
from functools import lru_cache
from itertools import combinations, product

from ..core import FILL, FILL_2, GRID, mcq, new_figure, short

ID = "population_pyramid"
KIND = "geo.climate"
SUBJECT = "geography"
BANDS = ("LS", "UP")

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
    shape = rng.choice(sorted(SHAPES))
    sides = _sides(shape)
    return {"shape": shape, "male": list(rng.choice(sides)), "female": list(rng.choice(sides))}


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


def questions(p: dict, rng: random.Random) -> list:
    i = rng.randrange(len(GROUPS))
    young = sum(p["male"][:2]) + sum(p["female"][:2])
    return [
        mcq("Which best describes the shape of this population pyramid?", NAMES[p["shape"]],
            [v for k, v in NAMES.items() if k != p["shape"]], rng),
        short(f"What percentage of the population are males aged {GROUPS[i]}?", p["male"][i],
              [f"{p['male'][i]}%", f"{p['male'][i]} %"]),
        short("What percentage of the population is aged under 20 (males and females together)?", young,
              [f"{young}%", f"{young} %"]),
    ]
