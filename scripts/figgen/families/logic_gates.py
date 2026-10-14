"""Logic gates (UP, AL): a circuit of two or three gates (AND, OR, XOR, NAND, NOR, NOT) in the standard symbols,
each named inside, inputs A, B and C on the left and output X on the right. The output for given inputs, how many
input combinations give X = 1, and the circuit's expression (four options, two gates each kept or swapped).

Every key is the circuit evaluated; the three wrong expressions each give a different output for some inputs.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, PathPatch, Polygon
from matplotlib.path import Path

from ..core import INK, NAMES, mcq, new_figure, short
from .logic import ev, inputs, sample_tree, text

ID = "logic_gates"
KIND = "cs.logic"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("logic-gates", "circuits-digital", "logic-expressions", "boolean-algebra"))
AVOID = r"spreadsheet|database|network|internet|security|graphic|document|presentation|email|python|html"
W, H = 1.3, 0.9  # a gate's body
FILL = "#eef1f3"


def sample(rng: random.Random) -> dict:
    tree, alts = sample_tree(rng)
    names = inputs(tree)
    case = {n: rng.randint(0, 1) for n in names}
    return {"band": rng.choice(BANDS), "circuit": tree, "alts": alts, "inputs": names, "case": case}


def _body(ax, op, x, y):
    """The gate's symbol with its back edge at x, centred on y; returns the output point."""
    base = op.replace("N", "", 1) if op in ("NAND", "NOR") else op
    h = H / 2
    if base == "AND":
        verts = [(x, y - h), (x + W / 2, y - h)] + [(x + W / 2 + h * math.cos(t), y + h * math.sin(t))
                                                    for t in [-math.pi / 2 + k * math.pi / 20 for k in range(21)]] + [(x, y + h), (x, y - h)]
        ax.add_patch(Polygon(verts, closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.4, zorder=3))
        tip = x + W / 2 + h
    elif base in ("OR", "XOR"):
        back = [(x + 0.18 * math.cos(t), y + h * math.sin(t)) for t in [math.pi / 2 - k * math.pi / 20 for k in range(21)]]
        lower = [(x + (W) * (k / 20) ** 1.0, y - h + h * (k / 20) ** 2) for k in range(21)]
        upper = [(x + W * (1 - k / 20), y + h - h * (1 - k / 20) ** 2) for k in range(21)]
        verts = back + lower + upper
        ax.add_patch(Polygon(verts, closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.4, zorder=3))
        if base == "XOR":
            ax.plot([x - 0.16 + 0.18 * math.cos(t) for t in [math.pi / 2 - k * math.pi / 20 for k in range(21)]],
                    [y + h * math.sin(t) for t in [math.pi / 2 - k * math.pi / 20 for k in range(21)]], color=INK, linewidth=1.4, zorder=3)
        tip = x + W
    else:  # NOT: a triangle
        ax.add_patch(Polygon([(x, y - h * 0.8), (x, y + h * 0.8), (x + W * 0.75, y)], closed=True, facecolor=FILL, edgecolor=INK,
                             linewidth=1.4, zorder=3))
        tip = x + W * 0.75
    if op in ("NAND", "NOR", "NOT"):
        ax.add_patch(Circle((tip + 0.09, y), 0.09, facecolor="white", edgecolor=INK, linewidth=1.3, zorder=4))
        tip += 0.18
    ax.text(x + (0.42 if base != "NOT" else 0.24) * W, y, op, ha="center", va="center", fontsize=7.5, fontweight="bold", zorder=5)
    return tip


def _layout(tree):
    """Each gate's column and row: leaves are input terminals stacked down the left, a gate sits level with the middle
    of its inputs, one column right of its deepest input."""
    places, leaves = {}, []

    def depth(n):
        return 0 if isinstance(n, str) else 1 + max(depth(c) for c in n["in"])

    def walk(n):
        if isinstance(n, str):
            leaves.append(n)
            y = -(len(leaves) - 1) * 1.15
            return ("leaf", len(leaves) - 1, n, 0, y)
        kids = [walk(c) for c in n["in"]]
        col = max(k[3] for k in kids) + 1
        y = sum(k[4] for k in kids) / len(kids)
        node = ("gate", id(n), n, col, y, kids)
        return node

    return walk(tree)


def draw(p: dict):
    root = _layout(p["circuit"])
    cols = root[3]
    fig, ax = new_figure(2.0 + 2.1 * cols, 3.6)
    span = 2.3  # one column to the next

    def place(node):
        """Draws the node; returns its output point."""
        if node[0] == "leaf":
            _, _, name, _, y = node
            ax.text(-0.35, y, name, ha="right", va="center", fontsize=13, fontweight="bold")
            ax.plot([-0.25, 0.0], [y, y], color=INK, linewidth=1.3)
            return (0.0, y)
        _, _, n, col, y, kids = node
        x = 0.6 + (col - 1) * span + 0.5
        outs = [place(k) for k in kids]
        pins = [y] if n["op"] == "NOT" else [y + H / 4, y - H / 4]
        for (ox, oy), py in zip(sorted(outs, key=lambda o: -o[1]), pins):
            mid = x - 0.35
            ax.plot([ox, mid, mid, x + (0.12 if n["op"] in ("OR", "XOR", "NOR") else 0)], [oy, oy, py, py], color=INK, linewidth=1.3,
                    zorder=2)
        tip = _body(ax, n["op"], x, y)
        return (tip, y)

    ox, oy = place(root)
    ax.plot([ox, ox + 0.5], [oy, oy], color=INK, linewidth=1.3)
    ax.text(ox + 0.6, oy, "X", ha="left", va="center", fontsize=13, fontweight="bold")
    ys = [k for k in _ys(root)]
    ax.set_xlim(-0.9, ox + 1.2)
    ax.set_ylim(min(ys) - 0.8, max(ys) + 0.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _ys(node):
    yield node[4] if node[0] == "gate" else node[4]
    if node[0] == "gate":
        for k in node[5]:
            yield from _ys(k)


SETTINGS = ["in a computer science lesson", "on a revision card", "for homework", "at the coding club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    tree, names, case = p["circuit"], p["inputs"], p["case"]
    when = ", ".join(f"{n} = {case[n]}" for n in names)
    out = ev(tree, case)
    import itertools
    ones = sum(ev(tree, dict(zip(names, bits))) for bits in itertools.product((0, 1), repeat=len(names)))
    key = f"X = {text(tree)}"
    return [short(f"{who} drew this logic circuit {rng.choice(SETTINGS)}. What is the output X when {when}?", out, [str(out)]),
            short(f"There are {2 ** len(names)} combinations of inputs. For how many of the {2 ** len(names)} combinations is X = 1?", ones,
                  [str(ones), f"{ones} combinations"]),
            mcq(f"{friend} wants the expression for X. Which expression matches the circuit?", key,
                [f"X = {text(t)}" for t in p["alts"] if text(t) != text(tree)], rng)]
