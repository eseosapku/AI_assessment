"""Sorting animals (P): a Carroll diagram (two columns by two rows) or a Venn diagram of two circles, with 6 to 9
animals pupils know in Rwanda placed in it by two things a Primary teacher agrees they have or do (legs, wings, a
backbone, laying eggs, eating other animals, being a farm animal). The boxes are lettered A to D, and one box
(two at the upper level) holds a "?" for an animal still to be placed.

Which animal belongs in the "?" box (from animals not yet placed: one belongs there, the others belong in other
boxes, and the likeliest slips, right on one of the two things, come first); how many animals are in a box, or (upper)
have one of the two things; and which box a new animal goes in.

Every place comes from HAS, the table below (Review Focus 4). An animal whose place could be argued is never sorted
by that thing: a fish is neither a farm animal nor not one (fish farms), a snake is never asked about laying eggs
(a puff adder gives birth to live young), a chicken never about eating other animals (it eats worms and grain).
Nothing is sorted by where it lives: a frog, a duck, a hippo and a crocodile live in water and on land.
"""
from __future__ import annotations

import random
import textwrap

from matplotlib.patches import Circle, Rectangle

from ..core import FILL_2, INK, NAMES, Question, article, count, mcq, new_figure

ID = "carroll_sort_p"
KIND = "bio.key"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("animal-classification", "organisms-classification", "identification-keys"))
# A topic whose sections the book lists is reached only if one names sorting or animals.
NEEDS = r"animal|living things|\bsort|classif|identif|vertebrate"
AVOID = r"\bcells?\b|science in context"

ANIMALS = ["cow", "goat", "fish", "frog", "snake", "chicken", "duck", "butterfly", "spider", "earthworm", "crocodile",
           "hippo"]
# What a Primary teacher agrees each animal has. None: arguable, so the animal is never sorted by it.
HAS = {
    "cow": dict(legs=True, wings=False, backbone=True, farm=True, eggs=False, meat=False),
    "goat": dict(legs=True, wings=False, backbone=True, farm=True, eggs=False, meat=False),
    "fish": dict(legs=False, wings=False, backbone=True, farm=None, eggs=True, meat=None),
    "frog": dict(legs=True, wings=False, backbone=True, farm=False, eggs=True, meat=True),
    "snake": dict(legs=False, wings=False, backbone=True, farm=False, eggs=None, meat=True),
    "chicken": dict(legs=True, wings=True, backbone=True, farm=True, eggs=True, meat=None),
    "duck": dict(legs=True, wings=True, backbone=True, farm=True, eggs=True, meat=None),
    "butterfly": dict(legs=True, wings=True, backbone=False, farm=False, eggs=True, meat=False),
    "spider": dict(legs=True, wings=False, backbone=False, farm=False, eggs=True, meat=True),
    "earthworm": dict(legs=False, wings=False, backbone=False, farm=None, eggs=None, meat=False),
    "crocodile": dict(legs=True, wings=False, backbone=True, farm=False, eggs=True, meat=True),
    "hippo": dict(legs=True, wings=False, backbone=True, farm=False, eggs=False, meat=False),
}
# Each thing: its heading for the animals that have it and for those that have not, and how a question names each.
THINGS = {
    "legs": ("Has legs", "No legs", "have legs", "have no legs"),
    "wings": ("Has wings", "No wings", "have wings", "have no wings"),
    "backbone": ("Has a backbone", "No backbone", "have a backbone", "have no backbone"),
    "farm": ("Farm animal", "Not a farm animal", "are farm animals", "are not farm animals"),
    "eggs": ("Lays eggs", "Does not lay eggs", "lay eggs", "do not lay eggs"),
    "meat": ("Eats other animals", "Does not eat other animals", "eat other animals", "do not eat other animals"),
}
# Pairs that give every box at least one animal to put in it.
PAIRS = [("backbone", "legs"), ("backbone", "wings"), ("farm", "wings"), ("meat", "legs"), ("farm", "eggs"),
         ("meat", "backbone")]


def _boxes(kind: str) -> dict:
    """Each letter's two values: whether its animals have the first thing, and the second. A Carroll diagram's
    columns are the first thing and its rows the second; a Venn diagram's left circle the first, its right the second."""
    if kind == "carroll":
        return {"A": [True, True], "B": [False, True], "C": [True, False], "D": [False, False]}
    return {"A": [True, False], "B": [True, True], "C": [False, True], "D": [False, False]}


def _eligible(a: str, b: str) -> list[str]:
    return [n for n in ANIMALS if HAS[n][a] is not None and HAS[n][b] is not None]


def _box_of(p: dict) -> dict:
    a, b = p["attrs"]
    return {n: next(k for k, v in p["boxes"].items() if v == [HAS[n][a], HAS[n][b]]) for n in _eligible(a, b)}


def _groups(p: dict) -> dict:
    """The groups a count may ask about, (thing, has it) to its letters: a Venn diagram's circles, a Carroll
    diagram's columns and rows."""
    out = {}
    for i, thing in enumerate(p["attrs"]):
        for v in ((True,) if p["kind"] == "venn" else (True, False)):
            out[(thing, v)] = [k for k, val in p["boxes"].items() if val[i] == v]
    return out


def stages(p: dict) -> tuple[int, int] | None:
    return (3, 6) if p["level"] == "upper" else None


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["carroll", "venn"])
    level = rng.choice(["lower", "upper"])
    a, b = rng.choice(PAIRS)
    if rng.random() < 0.5:
        a, b = b, a
    eligible = _eligible(a, b)
    p = {"band": "P", "level": level, "kind": kind, "attrs": [a, b], "boxes": _boxes(kind)}
    box_of = _box_of(p)
    while True:
        names = rng.sample(eligible, rng.randint(6, min(9, len(eligible) - 3)))
        marks = sorted(rng.sample("ABCD", 1 if level == "lower" else 2))
        left = [n for n in eligible if n not in names]
        per = {k: [n for n in names if box_of[n] == k] for k in "ABCD"}
        if any(len(per[k]) + (k in marks) > 4 for k in "ABCD"):  # four entries a box at most
            continue
        # a "?" stands for an animal still to place, and two more belong elsewhere, for the question's wrong answers
        if any(not any(box_of[n] == k for n in left) or sum(1 for n in left if box_of[n] != k) < 2 for k in marks):
            continue
        p.update(placed={k: per[k] for k in "ABCD"}, marks=marks)
        if level == "lower":
            free = [k for k in "ABCD" if k not in marks and per[k]]
        else:
            free = [g for g, ls in _groups(p).items() if not set(ls) & set(marks)]
        if free:
            return p


# --- drawing ----------------------------------------------------------------------------------------

def _entries(p: dict, letter: str) -> list[str]:
    return p["placed"][letter] + (["?"] if letter in p["marks"] else [])


def _put(ax, x: float, y: float, letter: str, entry: str, size: float) -> None:
    if entry == "?":
        ax.text(x, y, "?", ha="center", va="center", fontsize=size + 2, fontweight="bold", gid=f"mark:{letter}",
                bbox=dict(boxstyle="round,pad=0.25", facecolor="white", edgecolor=INK, linestyle="--", linewidth=1.1))
    else:
        ax.text(x, y, entry, ha="center", va="center", fontsize=size, gid=f"animal:{letter}:{entry}")


def _letter(ax, x: float, y: float, letter: str) -> None:
    ax.text(x, y, letter, ha="center", va="center", fontsize=12, fontweight="bold", gid=f"letter:{letter}",
            bbox=dict(boxstyle="square,pad=0.22", facecolor=FILL_2, edgecolor=INK, linewidth=1.0))


def _carroll(p: dict):
    fig, ax = new_figure(7.4, 5.3)
    a, b = p["attrs"]
    left, mid, right, top, row, head = 2.6, 6.3, 10.0, 6.0, 3.0, 7.3
    for x0, x1, y0, y1 in ((left, mid, top, head), (mid, right, top, head), (0, left, row, top), (0, left, 0, row)):
        ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, facecolor=FILL_2, edgecolor=INK, linewidth=1.2))
    ax.add_patch(Rectangle((left, 0), right - left, top, fill=False, edgecolor=INK, linewidth=1.8))
    ax.plot([mid, mid], [0, top], color=INK, linewidth=1.4)
    ax.plot([left, right], [row, row], color=INK, linewidth=1.4)
    for i, (x0, x1) in enumerate(((left, mid), (mid, right))):
        ax.text((x0 + x1) / 2, (top + head) / 2, textwrap.fill(THINGS[a][i], 16), ha="center", va="center",
                fontsize=12, fontweight="bold", gid=f"col:{i}")
    for i, (y0, y1) in enumerate(((row, top), (0, row))):
        ax.text(left / 2, (y0 + y1) / 2, textwrap.fill(THINGS[b][i], 12), ha="center", va="center", fontsize=12,
                fontweight="bold", gid=f"row:{i}")
    cells = {"A": (left, row), "B": (mid, row), "C": (left, 0), "D": (mid, 0)}
    for letter, (x0, y0) in cells.items():
        _letter(ax, x0 + 0.38, y0 + row - 0.38, letter)
        entries = _entries(p, letter)
        for j, entry in enumerate(entries):
            _put(ax, x0 + (mid - left) / 2 + 0.25, y0 + row / 2 + (len(entries) - 1) * 0.31 - 0.62 * j, letter,
                 entry, 12)
    ax.set_xlim(-0.05, right + 0.05)
    ax.set_ylim(-0.05, head + 0.05)
    ax.axis("off")
    ax.set_title("Animals sorted in a Carroll diagram", fontsize=12)
    return fig


# The Venn diagram: two circles in a box; names stacked in each part, the outside part's along the bottom.
CA, CB, CY, R = 3.7, 6.3, 4.25, 2.35


def _venn(p: dict):
    fig, ax = new_figure(7.4, 5.7)
    a, b = p["attrs"]
    ax.add_patch(Rectangle((0, 0), 10, 7.4, fill=False, edgecolor=INK, linewidth=1.6))
    for cx, thing in ((CA, a), (CB, b)):
        ax.add_patch(Circle((cx, CY), R, fill=False, edgecolor=INK, linewidth=1.8, gid=f"set:{THINGS[thing][0]}"))
    ax.text(2.55, 6.95, THINGS[a][0], ha="center", va="center", fontsize=12, fontweight="bold")
    ax.text(7.45, 6.95, THINGS[b][0], ha="center", va="center", fontsize=12, fontweight="bold")
    spots = {"A": (2.45, 2.4, 5.65), "B": (5.0, 5.0, 5.75), "C": (7.55, 7.6, 5.65)}
    for letter, (x, lx, ly) in spots.items():
        _letter(ax, lx, ly, letter)
        entries = _entries(p, letter)
        for j, entry in enumerate(entries):
            _put(ax, x, 3.95 + (len(entries) - 1) * 0.275 - 0.55 * j, letter, entry, 11)
    _letter(ax, 0.42, 0.42, "D")
    entries = _entries(p, "D")
    xs = {1: [5.0], 2: [3.5, 6.5], 3: [2.4, 5.0, 7.6], 4: [1.9, 4.0, 6.0, 8.1]}[len(entries)] if entries else []
    for x, entry in zip(xs, entries):
        _put(ax, x, 0.95, "D", entry, 11)
    ax.set_xlim(-0.1, 10.1)
    ax.set_ylim(-0.1, 7.5)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Animals sorted in a Venn diagram", fontsize=12)
    return fig


def draw(p: dict):
    return _carroll(p) if p["kind"] == "carroll" else _venn(p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["after a visit to a farm in Musanze", "after a trip to Akagera National Park", "in a science lesson in Huye",
            "for a class display in Kigali", "after a walk by Lake Kivu", "at the science club in Rubavu",
            "for homework in Nyagatare"]
VERBS = ["sorted", "put", "grouped"]


def questions(p: dict, rng: random.Random) -> list:
    a, b = p["attrs"]
    box_of = _box_of(p)
    placed = {n for names in p["placed"].values() for n in names}
    left = [n for n in box_of if n not in placed]
    word, diagram = ("box", "Carroll diagram") if p["kind"] == "carroll" else ("part", "Venn diagram")
    ask = rng.choice(p["marks"])
    answer = rng.choice([n for n in left if box_of[n] == ask])
    # Wrong answers: animals still to place that belong elsewhere, those right on one of the two things first.
    want = p["boxes"][ask]
    others = [n for n in left if box_of[n] != ask]
    near = {n: sum(x == y for x, y in zip(p["boxes"][box_of[n]], want)) for n in others}
    ties = {n: rng.random() for n in others}
    others.sort(key=lambda n: (-near[n], ties[n]))
    qs = [mcq(f"{rng.choice(NAMES)} {rng.choice(VERBS)} some animals into this {diagram} {rng.choice(SETTINGS)}. "
              f"One animal is missing from {word} {ask}, where the ? is. Which animal belongs there?", answer, others, rng)]
    if p["level"] == "lower":
        free = [k for k in "ABCD" if k not in p["marks"] and p["placed"][k]]
        k = rng.choice([k for k in free if len(p["placed"][k]) >= 2] or free)
        qs.append(count(f"How many animals are in {word} {k}?", len(p["placed"][k]), "animals"))
    else:
        free = sorted(g for g, ls in _groups(p).items() if not set(ls) & set(p["marks"]))
        thing, has = rng.choice(free)
        n = sum(1 for name in placed if HAS[name][thing] == has)
        qs.append(count(f"How many animals in the diagram {THINGS[thing][2 if has else 3]}?", n, "animals"))
    new = rng.choice([n for n in left if n != answer])
    letters = ["A", "B", "C", "D"]
    qs.append(Question("mcq", f"{article(new).capitalize()} {new} is added to the diagram. Which letter shows where it goes?",
                       str(letters.index(box_of[new])), letters))
    return qs
