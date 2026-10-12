"""Population pyramid by ten-year age group. Bars end on whole percentages."""
from __future__ import annotations

import random

from ..core import FILL, FILL_2, GRID, mcq, new_figure, short

ID = "population_pyramid"
KIND = "geo.climate"
SUBJECT = "geography"
BANDS = ("LS", "UP")

GROUPS = ["0–9", "10–19", "20–29", "30–39", "40–49", "50–59", "60–69", "70+"]
SHAPES = {
    "expanding": [15, 13, 9, 6, 3, 2, 1, 1],
    "stable": [7, 7, 7, 7, 6, 6, 5, 5],
    "contracting": [5, 5, 6, 7, 8, 7, 6, 6],
}
NAMES = {"expanding": "Expanding (a young population)", "stable": "Stable", "contracting": "Contracting (an ageing population)"}


def sample(rng: random.Random) -> dict:
    shape = rng.choice(sorted(SHAPES))
    base = SHAPES[shape]
    male = [max(1, v + rng.choice([-1, 0, 0, 1])) for v in base]
    female = [max(1, v + rng.choice([-1, 0, 0, 1])) for v in base]
    return {"shape": shape, "male": male, "female": female}


def draw(p: dict):
    fig, ax = new_figure(6.4, 4.6)
    y = range(len(GROUPS))
    ax.barh(y, [-m for m in p["male"]], color=FILL, edgecolor="#111111", height=0.8)
    ax.barh(y, p["female"], color=FILL_2, edgecolor="#111111", height=0.8)
    top = max(max(p["male"]), max(p["female"])) + 1
    ticks = list(range(-top, top + 1))
    ax.set_xticks(ticks, [str(abs(t)) for t in ticks])
    ax.set_xlim(-top - 0.5, top + 0.5)
    ax.tick_params(axis="x", labelsize=8)
    ax.xaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_yticks(list(y), GROUPS)
    ax.axvline(0, color="#111111", linewidth=1)
    ax.set_xlabel("Percentage of population (%)")
    ax.set_ylabel("Age group (years)")
    ax.text(-top / 2, len(GROUPS) - 0.2, "Male", ha="center", fontweight="bold")
    ax.text(top / 2, len(GROUPS) - 0.2, "Female", ha="center", fontweight="bold")
    ax.set_title("Population pyramid for a country")
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
