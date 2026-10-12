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


def _looks(shape: str, t: list[int]) -> bool:
    """Whether the bar totals still show the shape they were drawn as, so the shape question has one answer."""
    if shape == "expanding":
        return all(a >= b for a, b in zip(t, t[1:])) and t[0] >= 2 * t[3]
    if shape == "stable":
        return t[0] >= max(t[1:]) and all(abs(a - b) <= 4 for a, b in zip(t, t[1:])) and 2 * t[-1] >= t[0]
    return max(t[2:6]) >= t[0] + 4


def sample(rng: random.Random) -> dict:
    shape = rng.choice(sorted(SHAPES))
    base = SHAPES[shape]
    while True:
        p = _noisy(rng, shape, base)
        if _looks(shape, [m + f for m, f in zip(p["male"], p["female"])]):
            return p


def _noisy(rng: random.Random, shape: str, base: list[int]) -> dict:
    male = [max(1, v + rng.choice([-1, 0, 0, 1])) for v in base]
    female = [max(1, v + rng.choice([-1, 0, 0, 1])) for v in base]
    # One population's percentages add to 100: take the noise's drift back out, a bar at a time.
    sides = (male, female)
    while (total := sum(male) + sum(female)) != 100:
        side, i = rng.randrange(2), rng.randrange(len(base))
        step = 1 if total < 100 else -1
        if sides[side][i] + step >= 1:
            sides[side][i] += step
    return {"shape": shape, "male": male, "female": female}


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
