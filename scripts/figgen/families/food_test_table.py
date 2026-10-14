"""Food test tables (LS, UP): the results of four food tests on four lettered foods, as the colours seen: iodine
(blue-black for starch), Benedict's (brick-red for reducing sugar), biuret (purple for protein), and ethanol
then water (cloudy white for fat). Which food contains a nutrient, how many contain one, and which contains two.

Every colour is the true result of its test; a "which food" question has one right letter.
"""
from __future__ import annotations

import itertools
import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "food_test_table"
KIND = "table.data"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("food-components-identification", "biological-molecules", "proteins"))
AVOID = r"cell structure|genetic|inherit|immun|disease|reproduc|photosynth|hormone|ecolog|population|respiration|enzyme|autotroph|protein synthesis"
NUTRIENTS = ["starch", "reducing sugar", "protein", "fat"]
TESTS = ["Iodine solution", "Benedict's solution, heated", "Biuret solution", "Ethanol, then water"]
COLOURS = {"starch": ("blue-black", "orange-brown"), "reducing sugar": ("brick-red", "blue"), "protein": ("purple", "blue"),
           "fat": ("cloudy white", "clear")}


def result(nutrient: str, present: bool) -> str:
    return COLOURS[nutrient][0 if present else 1]


def sample(rng: random.Random) -> dict:
    letters = rng.choice(["WXYZ", "ABCD", "PQRS"])
    while True:
        foods = {k: {n: rng.random() < 0.45 for n in NUTRIENTS} for k in letters}
        only = [n for n in NUTRIENTS if sum(f[n] for f in foods.values()) == 1]
        pairs = [(a, b) for a, b in itertools.combinations(NUTRIENTS, 2) if sum(f[a] and f[b] for f in foods.values()) == 1]
        if only and pairs:
            break
    one = rng.choice(only)
    return {"band": rng.choice(BANDS), "foods": foods, "only": one, "pair": list(rng.choice(pairs)),
            "count": rng.choice([n for n in NUTRIENTS if n != one])}  # not the nutrient just asked: its count would be 1


def draw(p: dict):
    fig, ax = new_figure(8.2, 3.0)
    col0, col = 1.1, 2.0
    rows = list(p["foods"])
    for j, t in enumerate(TESTS):
        x = col0 + j * col
        ax.add_patch(Rectangle((x, 0), col, 0.62 * (len(rows) + 1), facecolor="none", edgecolor=INK, linewidth=1.0))
        words = t.split(", ")
        ax.text(x + col / 2, 0.62 * len(rows) + 0.31, "\n".join(words), ha="center", va="center", fontsize=8.5, fontweight="bold")
    for i, k in enumerate(rows):
        y = 0.62 * (len(rows) - 1 - i)
        ax.add_patch(Rectangle((0, y), col0, 0.62, facecolor="none", edgecolor=INK, linewidth=1.0))
        ax.text(col0 / 2, y + 0.31, f"food {k}", ha="center", va="center", fontsize=10, fontweight="bold")
        for j, n in enumerate(NUTRIENTS):
            x = col0 + j * col
            ax.add_patch(Rectangle((x, y), col, 0.62, facecolor="none", edgecolor=INK, linewidth=1.0))
            ax.text(x + col / 2, y + 0.31, result(n, p["foods"][k][n]), ha="center", va="center", fontsize=9.5)
    ax.add_patch(Rectangle((0, 0.62 * len(rows)), col0, 0.62, facecolor="none", edgecolor=INK, linewidth=1.0))
    ax.text(col0 / 2, 0.62 * len(rows) + 0.31, "Food", ha="center", va="center", fontsize=9.5, fontweight="bold")
    ax.set_xlim(-0.05, col0 + 4 * col + 0.05)
    ax.set_ylim(-0.05, 0.62 * (len(rows) + 1) + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a biology practical", "from the school kitchen", "for a class investigation", "at the science club"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    foods = p["foods"]
    letters = list(foods)
    n = p["only"]
    key = next(k for k, v in foods.items() if v[n])
    a, b = p["pair"]
    both = next(k for k, v in foods.items() if v[a] and v[b])
    c = p["count"]
    count = sum(v[c] for v in foods.values())
    return [mcq(f"{who} tested four foods {rng.choice(SETTINGS)} and recorded the colours. Which food contains {n}?", key,
                [k for k in letters if k != key], rng),
            short(f"How many of the foods contain {c}?", count, [str(count), f"{count} foods"] + (["none", "no foods"] if count == 0 else [])),
            mcq(f"{friend} wants a food with two nutrients. Which food contains both {a} and {b}?", both,
                [k for k in letters if k != both], rng)]
