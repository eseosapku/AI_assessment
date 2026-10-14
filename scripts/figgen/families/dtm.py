"""The demographic transition model (UP): birth rate and death rate, per 1000 people a year, across stages 1 to 5,
each rate a straight line between the stage boundaries, every boundary value on a 5-per-1000 gridline. The birth rate
at the end of a stage, the death rate at the end of a stage, and the natural increase (births minus deaths) there.

Every key is read at a stage boundary: stage 1 both rates high, stage 2 deaths fall, stage 3 births fall, stage 4
both low, stage 5 births below deaths.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, new_figure, short

ID = "dtm"
KIND = "graph.line"
SUBJECT = "geography"
BANDS = ("UP",)
CONCEPTS = ("geography.population-growth", "geography.population-structure")
AVOID = r"relief|hiv"  # topics that teach none of it, read by name and section (P3m)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"population|demograph|birth|death|growth|transition"


def sample(rng: random.Random) -> dict:
    while True:
        b = rng.choice([35, 40, 45])
        birth = [b, b, b, rng.choice([20, 25]), rng.choice([10, 15]), 10]
        d0 = rng.choice([30, 35, 40])
        death = [d0, d0, rng.choice([15, 20]), rng.choice([10, 15]), 10, 15]
        if d0 <= b and all(dd <= bb for dd, bb in zip(death[2:5], birth[2:5])) and birth[4] >= birth[5]:
            ks = rng.sample(range(1, 6), 3)
            return {"band": "UP", "birth": birth, "death": death, "ask": ks}


def draw(p: dict):
    fig, ax = new_figure(7.4, 4.6)
    xs = list(range(6))
    ax.plot(xs, p["birth"], color=INK, linewidth=2.2, marker="o", markersize=4, label="Birth rate")
    ax.plot(xs, p["death"], color="#c0392b", linewidth=2.2, linestyle="--", marker="s", markersize=4, label="Death rate")
    for k in range(1, 5):
        ax.axvline(k, color="#777777", linewidth=1.0, linestyle=":")
    for k in range(5):
        ax.text(k + 0.5, 52, f"Stage {k + 1}", ha="center", va="center", fontsize=10, fontweight="bold")
    ax.set_xlim(0, 5)
    ax.set_ylim(0, 55)
    ax.set_yticks(range(0, 51, 10))
    ax.set_yticks(range(0, 51, 5), minor=True)
    ax.grid(True, axis="y", which="both", color=GRID, linewidth=0.6)
    ax.set_xticks([])
    ax.set_ylabel("Rate per 1000 people per year")
    ax.set_xlabel("Time")
    ax.legend(loc="lower left", fontsize=9, frameon=True)
    ax.set_title("The demographic transition model", fontsize=11, pad=8)
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "in a population project"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    a, b, c = p["ask"]
    birth, death = p["birth"], p["death"]
    unit = "per 1000 people per year"
    return [short(f"{who} studies the demographic transition model {rng.choice(SETTINGS)}. What is the birth rate at the end of stage {a}, {unit}?",
                  birth[a], [str(birth[a]), f"{birth[a]} per 1000"]),
            short(f"What is the death rate at the end of stage {b}, {unit}?", death[b], [str(death[b]), f"{death[b]} per 1000"]),
            short(f"{friend} subtracts the death rate from the birth rate. What is the natural increase at the end of stage {c}, {unit}?",
                  birth[c] - death[c], [str(birth[c] - death[c]), f"{birth[c] - death[c]} per 1000"])]
