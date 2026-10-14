"""Binary search trees (AL): seven to ten different numbers inserted in turn into a binary search tree, drawn with
each node placed left to right in order and level by level. A traversal (in-, pre- or post-order), how many levels
the tree has (the root is level 1), and which node becomes the parent of a new value added.

Every key is the tree walked: smaller values go left, larger go right.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle

from ..core import INK, NAMES, new_figure, short

ID = "binary_tree"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("AL",)
CONCEPTS = tuple(f"computing.{c}" for c in ("data-structures-introduction", "algorithms"))
AVOID = r"spreadsheet|database|network|internet|security|graphic|presentation|email|html|logic gate|boolean|animation|expert system|monitoring and control|modelling|mail merge|data, information, knowledge|data processing and information|project management|declarative|algorithms and flowcharts"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"tree|data structure|abstract data type|\badt|travers|binary search|linked list|recursion"
FILL = "#eef1f3"
HOW = {"in": "in-order", "pre": "pre-order", "post": "post-order"}


def build(values: list[int]) -> tuple[dict, dict]:
    """{value: [left, right]} and each value's parent, by inserting the values in turn."""
    kids, parent = {values[0]: [None, None]}, {}
    for v in values[1:]:
        node = values[0]
        while True:
            side = 0 if v < node else 1
            if kids[node][side] is None:
                kids[node][side], kids[v], parent[v] = v, [None, None], node
                break
            node = kids[node][side]
    return kids, parent


def walk(kids: dict, node, how: str) -> list[int]:
    if node is None:
        return []
    left, right = (walk(kids, k, how) for k in kids[node])
    return {"in": left + [node] + right, "pre": [node] + left + right, "post": left + right + [node]}[how]


def depth(kids: dict, node) -> int:
    return 0 if node is None else 1 + max(depth(kids, k) for k in kids[node])


def sample(rng: random.Random) -> dict:
    while True:
        values = rng.sample(range(1, 100), rng.randint(7, 10))
        kids, _ = build(values)
        if not 3 <= depth(kids, values[0]) <= 5:
            continue
        new = rng.choice([v for v in range(1, 100) if v not in values])
        return {"band": "AL", "values": values, "how": rng.choice(list(HOW)), "new": new}


def draw(p: dict):
    values = p["values"]
    kids, _ = build(values)
    root = values[0]
    xs = {v: i for i, v in enumerate(walk(kids, root, "in"))}
    level = {}

    def mark(node, d):
        if node is not None:
            level[node] = d
            for k in kids[node]:
                mark(k, d + 1)
    mark(root, 0)
    n, h = len(values), max(level.values()) + 1
    fig, ax = new_figure(7.2, 1.2 + 1.05 * h)
    sx, sy, r = 1.0, 1.3, 0.36
    pos = {v: (xs[v] * sx, -level[v] * sy) for v in values}
    for v in values:
        for k in kids[v]:
            if k is not None:
                ax.plot([pos[v][0], pos[k][0]], [pos[v][1], pos[k][1]], color=INK, linewidth=1.3, zorder=2)
    for v, (x, y) in pos.items():
        ax.add_patch(Circle((x, y), r, facecolor=FILL, edgecolor=INK, linewidth=1.3, zorder=3))
        ax.text(x, y, str(v), ha="center", va="center", fontsize=12, fontweight="bold", zorder=4)
    ax.set_xlim(-0.6, (n - 1) * sx + 0.6)
    ax.set_ylim(-(h - 1) * sy - 0.6, 0.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    values = p["values"]
    kids, _ = build(values)
    seq = walk(kids, values[0], p["how"])
    text = ", ".join(map(str, seq))
    h = depth(kids, values[0])
    _, parent = build(values + [p["new"]])
    up = parent[p["new"]]
    return [short(f"{who} built this binary search tree {rng.choice(SETTINGS)}. Write the {HOW[p['how']]} traversal of the tree.", text,
                  [text, ",".join(map(str, seq)), " ".join(map(str, seq))]),
            short(f"How many levels does {friend}'s binary search tree have? The root is on level 1.", h, [str(h), f"{h} levels"]),
            short(f"The value {p['new']} is added to this binary search tree. Which value will be its parent?", up, [str(up)])]
