"""Changes of state of water (P): an ice cube, a glass of water and a kettle's steam in a row from left to right,
labelled solid, liquid and gas, as a textbook draws them: the heating arrows above, pointing right towards the gas,
the cooling arrows below, pointing left towards the solid. The four arrows are lettered A to D at random, and each says
"heating" or "cooling"; the names of the changes (melting, freezing, boiling or evaporating, condensing) are never
printed. (A thermometer beside the row was dropped after the blind review: at review size it was a few pixels per
10 °C, and readings on a numbered mark were read between marks. Reading a scale is scale_reading's.)

(The blind review read a figure drawn steam-first, its cooling arrows pointing right, as steam forming: the order is
now fixed, so left to right is always warmer.)

Which arrow shows a change, and what the change at a lettered arrow is called. Each arrow runs from the state it starts in to the state it ends in, so
the drawing and its heating or cooling decide each key.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Polygon, Rectangle

from ..core import INK, NAMES, mcq, new_figure

ID = "state_changes_p"
KIND = "process.flow"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.changes-of-state", "science.states-of-matter")
# A topic whose sections the book lists is reached only if it names states or a change of state.
NEEDS = r"state|melt|freez|boil|evaporat|condens|heating and cooling|solids?, liquids?|changes to materials"

STATES = ["solid", "liquid", "gas"]
LABEL = {"solid": "ice (solid)", "liquid": "water (liquid)", "gas": "steam (gas)"}
# Each change: the state it starts in and the state it ends in.
CHANGE = {"melting": ["solid", "liquid"], "freezing": ["liquid", "solid"], "condensing": ["gas", "liquid"]}
WARMER = {"solid": 0, "liquid": 1, "gas": 2}


def stages(p: dict) -> tuple[int, int] | None:
    """A thermometer's divisions are read from Stage 4."""
    return (4, 6) if p["level"] == "upper" else None


def _changes(p: dict) -> dict:
    return {**CHANGE, p["gas_word"]: ["liquid", "gas"]}


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    moves = [["solid", "liquid"], ["liquid", "solid"], ["liquid", "gas"], ["gas", "liquid"]]
    letters = rng.sample("ABCD", 4)
    arrows = {k: mv for k, mv in sorted(zip(letters, moves))}
    gas_word = rng.choice(["boiling", "evaporating"])
    names = ["melting", "freezing", gas_word, "condensing"]
    one, two, three = rng.sample(names, 3)
    changes = {**CHANGE, gas_word: ["liquid", "gas"]}
    named = next(k for k, mv in arrows.items() if mv == changes[three])
    return {"band": "P", "level": level, "arrows": arrows,
            "gas_word": gas_word,
            "ask": {"which": [one, two], "name": named}}


def _ice(ax, cx: float, cy: float) -> None:
    s, d = 1.05, 0.32
    x0, y0 = cx - (s + d) / 2, cy - (s + d) / 2
    face = dict(edgecolor=INK, linewidth=1.5)
    ax.add_patch(Polygon([(x0, y0), (x0 + s, y0), (x0 + s, y0 + s), (x0, y0 + s)], closed=True, facecolor="#e4eef3", **face))
    ax.add_patch(Polygon([(x0, y0 + s), (x0 + s, y0 + s), (x0 + s + d, y0 + s + d), (x0 + d, y0 + s + d)], closed=True,
                         facecolor="#f4f8fa", **face))
    ax.add_patch(Polygon([(x0 + s, y0), (x0 + s + d, y0 + d), (x0 + s + d, y0 + s + d), (x0 + s, y0 + s)], closed=True,
                         facecolor="#cbdbe3", **face))
    ax.plot([x0 + 0.18, x0 + 0.18, x0 + 0.36], [y0 + 0.5, y0 + 0.82, y0 + 0.82], color="#8aa4b2", linewidth=1.4)


def _glass(ax, cx: float, cy: float) -> None:
    bottom, top, h = 0.42, 0.62, 1.5
    y0, y1 = cy - h / 2, cy + h / 2
    level = y0 + 0.62 * h
    w = bottom + (top - bottom) * 0.62
    ax.add_patch(Polygon([(cx - bottom, y0), (cx + bottom, y0), (cx + w, level), (cx - w, level)], closed=True,
                         facecolor="#b9cbd6", edgecolor="none"))
    ax.plot([cx - w, cx + w], [level, level], color="#3d5260", linewidth=1.4)
    ax.plot([cx - top, cx - bottom, cx + bottom, cx + top], [y1, y0, y0, y1], color=INK, linewidth=1.8)


def _kettle(ax, cx: float, cy: float, side: int) -> None:
    """A kettle with steam rising from its spout; side is +1 for a spout on the right, -1 on the left."""
    y0, y1 = cy - 0.85, cy + 0.05
    ax.add_patch(Polygon([(cx - 0.62, y0), (cx + 0.62, y0), (cx + 0.45, y1), (cx - 0.45, y1)], closed=True,
                         facecolor="#d6dade", edgecolor=INK, linewidth=1.5))
    ax.add_patch(Rectangle((cx - 0.3, y1), 0.6, 0.1, facecolor="#d6dade", edgecolor=INK, linewidth=1.3))
    ax.add_patch(Rectangle((cx - 0.06, y1 + 0.1), 0.12, 0.08, facecolor=INK, edgecolor=INK, linewidth=1.0))
    ax.add_patch(Arc((cx - side * 0.5, y0 + 0.5), 0.5, 0.75, theta1=90 if side > 0 else -90, theta2=270 if side > 0 else 90,
                     edgecolor=INK, linewidth=1.8))
    tip = (cx + side * 0.92, y1 + 0.1)
    ax.add_patch(Polygon([(cx + side * 0.56, y0 + 0.3), (cx + side * 0.5, y0 + 0.5), tip], closed=True, facecolor="#d6dade",
                         edgecolor=INK, linewidth=1.3))
    for k in range(3):  # the steam: three wavy lines rising from the spout
        x = tip[0] + side * (0.05 + 0.2 * (k - 1))
        ys = [tip[1] + 0.15 + 0.75 * t / 40 for t in range(41)]
        ax.plot([x + 0.06 * math.sin(4 * math.pi * t / 40) for t in range(41)], ys, color="#7d8a94", linewidth=1.5)


def draw(p: dict):
    fig, ax = new_figure(8.8, 3.6)
    centre = {st: (5.0 * i, 0.0) for i, st in enumerate(STATES)}  # ice, water, steam from left to right
    for st, (cx, cy) in centre.items():
        if st == "solid":
            _ice(ax, cx, cy)
        elif st == "liquid":
            _glass(ax, cx, cy)
        else:
            _kettle(ax, cx, cy, 1)
        ax.plot([cx], [cy], linestyle="none", marker="none", gid=f"centre-{st}")
        ax.text(cx, -1.55, LABEL[st], ha="center", va="center", fontsize=12, fontweight="bold")
    for k, (a, b) in p["arrows"].items():
        (xa, _), (xb, _) = centre[a], centre[b]
        heating = WARMER[b] > WARMER[a]
        y = 0.55 if heating else -0.55  # heating above, pointing right; cooling below, pointing left
        step = 1.0 if xb > xa else -1.0
        start, end = (xa + 1.25 * step, y), (xb - 1.25 * step, y)
        ax.annotate("", xy=end, xytext=start, gid=f"arrow-{k}",
                    arrowprops=dict(arrowstyle="-|>", color=INK, linewidth=2.0, mutation_scale=26, shrinkA=0, shrinkB=0))
        mid = (xa + xb) / 2
        ax.text(mid, y, k, ha="center", va="center", fontsize=12, fontweight="bold", gid=f"letter-{k}",
                bbox=dict(boxstyle="circle,pad=0.25", facecolor="white", edgecolor=INK, linewidth=1.3))
        ax.text(mid, y + (0.52 if y > 0 else -0.52), "heating" if heating else "cooling", ha="center", va="center",
                fontsize=11.5, style="italic", gid=f"word-{k}")
    ax.set_xlim(-1.7, 11.7)
    ax.set_ylim(-1.95, 1.75)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Water as a solid, a liquid and a gas", fontsize=12.5)
    return fig


VERBS = ["draws", "is learning", "studies", "makes a poster about", "writes notes on"]
SETTINGS = ["in a science lesson", "for homework", "at the science club", "with a friend", "in class",
            "before a test"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    changes = _changes(p)
    arrows = p["arrows"]
    names = ["melting", "freezing", p["gas_word"], "condensing"]

    def arrow_for(change: str) -> str:
        return "Arrow " + next(k for k, mv in arrows.items() if mv == changes[change])

    letters = [f"Arrow {k}" for k in sorted(arrows)]
    one, two = p["ask"]["which"]
    k = p["ask"]["name"]
    what = next(c for c in names if changes[c] == arrows[k])
    out = [mcq(f"{who} {rng.choice(VERBS)} how water changes {rng.choice(SETTINGS)}. Which arrow shows {one}?",
               arrow_for(one), letters, rng),
           mcq(f"What is the change at arrow {k} called?", what, names, rng),
           mcq(f"Which arrow shows {two}?", arrow_for(two), letters, rng)]
    return out
