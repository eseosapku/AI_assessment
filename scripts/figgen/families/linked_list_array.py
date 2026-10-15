"""Linked lists in an array (AL): the 9618 picture of a linked list, an array of eight to ten nodes with Index, Data
and Pointer columns beside StartPointer and FreeListPointer. Five to seven nodes hold the list (the stops on a Kigali
bus route, or the sectors on a Musanze delivery round) in an order the table's rows do not follow;
the rest are the free list, chained in index order. -1 is the null pointer.

The order the items are read in, the item at a given place in the list, a pointer after an item is inserted straight
after another (the new node taken from the free list, as the 9618 algorithm does), and StartPointer after the first
item is deleted.

Every key is the pointers followed: the list's order never matches the rows', and the item asked for is never the one
in the row of the same number, so reading the table down does not give the answer.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "linked_list_array"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("AL",)
CONCEPTS = tuple(f"computing.{c}" for c in ("linked-lists", "one-dimensional-arrays", "records-data-structure"))
# A topic whose sections the book lists is reached only if one names linked lists, ADTs, data structures or arrays.
NEEDS = r"linked list|abstract data type|\badt|data structure|array|pointer"
AVOID = r"database|network|internet|security|spreadsheet|graphic|\bpresentation|e-?mail|html|logic gate|boolean|python|java|c\+\+"
CONTEXTS = {
    "route": ("the stops on a Kigali bus route", ["Nyabugogo", "Kimironko", "Remera", "Kicukiro", "Kacyiru", "Gikondo",
                                                  "Kanombe", "Kabuga", "Gisozi", "Kinamba", "Sonatubes", "Giporoso",
                                                  "Kibagabaga", "Nyamirambo"]),
    "round": ("the sectors on a Musanze delivery round", ["Kinigi", "Nyange", "Busogo", "Gataraga",
                                                                         "Shingiro", "Muhoza", "Cyuve", "Gacaca",
                                                                         "Kimonyi", "Muko", "Rwaza", "Nkotsi", "Gashaki"]),
}
ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"]
LIGHT = "#d9dee3"


def traverse(data: list, pointer: list, start: int) -> list[str]:
    out, i = [], start
    while i != -1:
        out.append(data[i])
        i = pointer[i]
    return out


def _orders(p: dict) -> list[str]:
    """The key and the plausible slips: rows read top to bottom, the list backwards, the items in alphabetical order."""
    items = traverse(p["data"], p["pointer"], p["start"])
    return [", ".join(items), ", ".join(d for d in p["data"] if d), ", ".join(reversed(items)), ", ".join(sorted(items))]


def sample(rng: random.Random) -> dict:
    ctx = rng.choice(sorted(CONTEXTS))
    pool = CONTEXTS[ctx][1]
    while True:
        k, spare = rng.randint(5, 7), rng.randint(2, 3)
        size = k + spare
        if not 8 <= size <= 10:
            continue
        words = rng.sample(pool, k + 1)
        items, new = words[:k], words[k]
        slots = rng.sample(range(size), size)
        used, free = slots[:k], sorted(slots[k:])
        data, pointer = [""] * size, [-1] * size
        for j, i in enumerate(used):
            data[i], pointer[i] = items[j], used[j + 1] if j + 1 < k else -1
        for j, i in enumerate(free):
            pointer[i] = free[j + 1] if j + 1 < len(free) else -1
        p = {"band": "AL", "context": ctx, "data": data, "pointer": pointer, "start": used[0], "free": free[0], "new": new}
        orders = _orders(p)
        places = [j for j in range(1, k) if data[j] != items[j]]
        if orders[1] == orders[0] or len(set(orders)) < 3 or not places:
            continue
        p.update({"pos": rng.choice(places) + 1, "after": rng.choice(items), "target": rng.choice(["after", "new", "free"])})
        return p


def draw(p: dict):
    data, pointer = p["data"], p["pointer"]
    n = len(data)
    widths, rh = [1.2, 2.6, 1.5], 0.5
    x0 = 3.3
    top = rh * (n + 1)
    width = x0 + sum(widths)
    k = 0.66
    fig, ax = new_figure((width + 0.4) * k, (top + 2.0) * k)
    ax.set_position([0, 0, 1, 1])
    ax.text(width / 2, top + 1.05, f"A linked list of {CONTEXTS[p['context']][0]}", ha="center", va="center",
            fontsize=11.5, fontweight="bold")
    for y, label, value, gid in ((top - 1.0, "StartPointer", p["start"], "start"), (top - 2.6, "FreeListPointer", p["free"], "free")):
        ax.text(0.1, y, label, ha="left", va="center", fontsize=10.5, fontweight="bold", family="monospace")
        ax.add_patch(Rectangle((0.6, y - 1.05), 1.0, 0.6, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.text(1.1, y - 0.75, str(value), ha="center", va="center", fontsize=12, family="monospace", gid=gid)
    x = x0
    for c, (h, w) in enumerate(zip(["Index", "Data", "Pointer"], widths)):
        ax.add_patch(Rectangle((x, top - rh), w, rh, facecolor=LIGHT, edgecolor=INK, linewidth=1.0))
        ax.text(x + w / 2, top - rh / 2, h, ha="center", va="center", fontsize=10.5, fontweight="bold")
        for i in range(n):
            y = top - rh * (i + 2)
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            text, gid = ((str(i), f"index:{i}") if c == 0 else (data[i], f"data:{i}") if c == 1 else (str(pointer[i]), f"ptr:{i}"))
            style = {} if c == 1 else {"family": "monospace"}
            ax.text(x + (0.15 if c == 1 else w / 2), y + rh / 2, text, ha="left" if c == 1 else "center", va="center",
                    fontsize=10.5, gid=gid, color="#555555" if c == 0 else INK, **style)
        x += w
    ax.text(x0, -0.35, "A pointer of -1 is the null pointer: it ends a list.", ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-0.1, width + 0.2)
    ax.set_ylim(-0.75, top + 1.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["follows the pointers from StartPointer", "traces the list from StartPointer", "reads the list, starting at StartPointer",
         "works through the pointers from StartPointer"]
SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "at the coding club", "for a class test",
            "during revision", "in a data structures lesson"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    data, pointer = p["data"], p["pointer"]
    items = traverse(data, pointer, p["start"])
    orders = _orders(p)
    k = p["pos"]
    # The insertion, as 9618 does it: the new node is the first free one, and the free list moves on.
    node, prev, new, after = p["free"], data.index(p["after"]), p["new"], p["after"]
    values = {"after": node, "new": pointer[prev], "free": pointer[node]}
    phrase = {"after": f"the Pointer of the node holding {after}", "new": f"the Pointer of the node holding {new}",
              "free": "FreeListPointer"}[p["target"]]
    key = values[p["target"]]
    slips = [v for v in (pointer[prev], node, pointer[node], -1, prev, p["start"]) if v != key]
    slips += [v for v in rng.sample(range(len(data)), len(data)) if v != key]
    return [mcq(f"{who} {rng.choice(VERBS)} {rng.choice(SETTINGS)}. In what order are the items read?", orders[0], orders[1:], rng),
            short(f"Which item is {ORDINALS[k - 1]} in the linked list?", items[k - 1], [items[k - 1].lower()]),
            mcq(f"A new item, {new}, is added straight after {after}, in the node that FreeListPointer points to. "
                f"What is {phrase} now?", str(key), [str(v) for v in dict.fromkeys(slips)], rng),
            short(f"{friend} deletes the first item in the list. What is StartPointer then?", pointer[p["start"]],
                  [str(pointer[p["start"]])])]
