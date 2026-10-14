"""Sort traces (UP, AL): a list of six to eight different whole numbers in boxes, with the sort named, bubble or
insertion, and its rule for one pass printed. The list after a pass, the swaps in a bubble sort's first pass, and
the pass after which the list is first in order.

Every key is the sort run: a bubble pass compares each neighbouring pair from left to right and swaps a pair whose
left number is larger; insertion pass k takes item k + 1 into the sorted part on its left.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, article, new_figure, short

ID = "sort_trace"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("algorithms", "data-structures-introduction"))
AVOID = r"spreadsheet|database|network|internet|security|graphic|document|presentation|email|python|html|logic gate|boolean|monitoring and control|expert system|modelling|systems life cycle|animation|expert system|monitoring and control|modelling|mail merge|data, information, knowledge|data processing and information|project management|scheduling"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"sort|bubble|insertion|algorithm|searching"
RULES = {"bubble": "One pass: compare each pair of neighbours from left to right,\nand swap them if the left number is larger.",
         "insertion": "Pass 1 inserts the 2nd number into the sorted part on its left,\npass 2 inserts the 3rd, and so on."}
FILL = "#eef1f3"


def bubble_pass(xs: list[int]) -> tuple[list[int], int]:
    xs, swaps = list(xs), 0
    for i in range(len(xs) - 1):
        if xs[i] > xs[i + 1]:
            xs[i], xs[i + 1] = xs[i + 1], xs[i]
            swaps += 1
    return xs, swaps


def insertion_pass(xs: list[int], k: int) -> list[int]:
    xs = list(xs)
    v, j = xs[k], k - 1
    while j >= 0 and xs[j] > v:
        xs[j + 1] = xs[j]
        j -= 1
    xs[j + 1] = v
    return xs


def states(p: dict) -> list[list[int]]:
    """The list before any pass, then after each pass: a bubble sort until in order, an insertion sort every pass."""
    xs = p["list"]
    out = [list(xs)]
    if p["algorithm"] == "bubble":
        while out[-1] != sorted(xs):
            out.append(bubble_pass(out[-1])[0])
    else:
        for k in range(1, len(xs)):
            out.append(insertion_pass(out[-1], k))
    return out


def first_in_order(p: dict) -> int:
    return next(k for k, st in enumerate(states(p)) if st == sorted(p["list"]))


def sample(rng: random.Random) -> dict:
    algorithm = rng.choice(["bubble", "insertion"])
    while True:
        xs = rng.sample(range(1, 100), rng.randint(6, 8))
        p = {"band": rng.choice(BANDS), "algorithm": algorithm, "list": xs}
        if first_in_order(p) < 3:  # in order only after a few passes, so "after pass 2" is never the sorted list
            continue
        st = states(p)
        moving = [k for k in (1, 2, 3) if st[k] != st[k - 1]]  # a pass that moves nothing is answered by copying (P3k review)
        if moving:
            p["pass"] = rng.choice(moving)
            return p


def draw(p: dict):
    xs = p["list"]
    n = len(xs)
    fig, ax = new_figure(7.4, 2.6)
    w = 0.9
    x0 = (8 * w - n * w) / 2
    ax.text(4 * w, 2.25, f"{p['algorithm'].capitalize()} sort into ascending order", ha="center", va="center",
            fontsize=12, fontweight="bold")
    for i, v in enumerate(xs):
        ax.add_patch(Rectangle((x0 + i * w, 0.9), w, 0.8, facecolor=FILL, edgecolor=INK, linewidth=1.3))
        ax.text(x0 + i * w + w / 2, 1.3, str(v), ha="center", va="center", fontsize=14, fontweight="bold")
    ax.text(4 * w, 0.4, RULES[p["algorithm"]], ha="center", va="center", fontsize=9.5, linespacing=1.4)
    ax.set_xlim(-0.6, 8 * w + 0.6)
    ax.set_ylim(-0.05, 2.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def _forms(xs: list[int]) -> list[str]:
    return [", ".join(map(str, xs)), ",".join(map(str, xs)), " ".join(map(str, xs)), "[" + ", ".join(map(str, xs)) + "]"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    st = states(p)
    k = p["pass"]
    after = st[k]
    name = p["algorithm"]
    done = first_in_order(p)
    qs = [short(f"{who} sorts the list in the figure {rng.choice(SETTINGS)} with {article(name)} {name} sort. Write the list after pass {k}.",
                ", ".join(map(str, after)), _forms(after))]
    if name == "bubble":
        swaps = bubble_pass(p["list"])[1]
        qs.append(short("How many swaps does the first pass of this bubble sort make on the list in the figure?",
                        swaps, [str(swaps), f"{swaps} swaps"]))
    qs.append(short(f"{friend} keeps going with the {name} sort of the list in the figure. After which pass is the list first in order?",
                    done, [str(done), f"pass {done}", f"after pass {done}"]))
    return qs
