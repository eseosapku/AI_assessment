"""Binary searches (UP, AL): a sorted list of 9 to 15 different numbers in boxes, each index printed above its box
from 0, the item searched for, and the midpoint rule, mid = (low + high) DIV 2, starting from low = 0 and high =
the last index. The first index checked, how many items are checked, and the values checked in order.

Every key is the search run with that rule; most searches find their item, some end without it.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "binary_search"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("algorithms", "data-structures-introduction"))
AVOID = r"spreadsheet|database|network|internet|security|graphic|document|presentation|email|python|html|logic gate|boolean"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"search|algorithm|sort"
FILL = "#eef1f3"


def checked(p: dict) -> list[int]:
    """The indices checked, in order, until the item is found or low passes high."""
    xs, target = p["list"], p["target"]
    low, high, out = 0, len(xs) - 1, []
    while low <= high:
        mid = (low + high) // 2
        out.append(mid)
        if xs[mid] == target:
            break
        if xs[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return out


def sample(rng: random.Random) -> dict:
    while True:
        n = rng.randint(9, 15)
        xs = sorted(rng.sample(range(2, 100), n))
        if rng.random() < 0.8:
            target = rng.choice(xs)
        else:
            target = rng.choice([v for v in range(xs[0] + 1, xs[-1]) if v not in xs])
        p = {"band": rng.choice(BANDS), "list": xs, "target": target}
        if len(checked(p)) >= 2:  # never found at the first check, so the order asked for has more than one item
            return p


def draw(p: dict):
    xs = p["list"]
    n = len(xs)
    fig, ax = new_figure(8.4, 2.6)
    w = 0.62
    for i, v in enumerate(xs):
        ax.add_patch(Rectangle((i * w, 0.9), w, 0.7, facecolor=FILL, edgecolor=INK, linewidth=1.2))
        ax.text(i * w + w / 2, 1.25, str(v), ha="center", va="center", fontsize=12, fontweight="bold")
        ax.text(i * w + w / 2, 1.82, str(i), ha="center", va="center", fontsize=9, color="#444444")
    ax.text(-0.12, 1.82, "index", ha="right", va="center", fontsize=9, color="#444444")
    ax.text(-0.12, 1.25, "item", ha="right", va="center", fontsize=9)
    mid = n * w / 2
    ax.text(mid, 2.4, f"Binary search for {p['target']}", ha="center", va="center", fontsize=12, fontweight="bold")
    ax.text(mid, 0.55, f"Start with low = 0 and high = {n - 1}.", ha="center", va="center", fontsize=9.5)
    ax.text(mid, 0.15, "mid = (low + high) DIV 2", ha="center", va="center", fontsize=10, family="monospace")
    ax.text(mid, -0.25, "If the item at mid is too small, low = mid + 1.\nIf it is too big, high = mid − 1.", ha="center",
            va="top", fontsize=9.5, linespacing=1.4)
    ax.set_xlim(-1.1, n * w + 0.3)
    ax.set_ylim(-1.15, 2.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    order = checked(p)
    values = [p["list"][i] for i in order]
    t = p["target"]
    seq = ", ".join(map(str, values))
    return [short(f"{who} runs this binary search for {t} {rng.choice(SETTINGS)}. Which index is checked first?",
                  order[0], [str(order[0]), f"index {order[0]}"]),
            short(f"How many items are checked in this binary search for {t}, up to and including the last one?",
                  len(order), [str(len(order)), f"{len(order)} items"]),
            short(f"{friend} lists the items looked at in the search for {t}. Write their values in the order they are checked.",
                  seq, [seq, ",".join(map(str, values)), " ".join(map(str, values))])]
