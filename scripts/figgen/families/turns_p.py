"""Turns and directions (P, Stage 2 to 4), as Cambridge Primary Stage 3 "Angles and movement" (angles, direction,
position and movement) teaches them: quarter, half and three-quarter turns, clockwise and anticlockwise, the four
compass directions, and a right angle as a quarter turn.

Three kinds of figure, big and plain, a robot drawn as a thick arrow at the centre of a compass (N, E, S and W
printed):
- face: the arrow shows which way the robot faces. After a turn named in the question, which way does it face?
- which: two compasses, "before" and "after". Which turn did the robot make (a quarter turn clockwise, a quarter turn
  anticlockwise, a half turn)?
- angles: "before" and "after", and a curved arrow showing the way it turned. How many right angles did it turn
  through?
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, FancyArrowPatch

from ..core import INK, NAMES, count, mcq, new_figure

ID = "turns_p"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.position-and-direction", "mathematics.lines-angles-real-objects", "mathematics.constructing-angles")
# A topic whose sections the book lists is reached only if its name or a section names angles, turns or movement.
NEEDS = r"angle|turn|direction|movement"
AVOID = r"symmetr|fraction|time|clock|measur|triangle|polygon|construct|parallel|grid|coordinate|shapes in the plane|" \
        r"square|rectangle|location|types of lines|lines and angles"

DIRS = ["north", "east", "south", "west"]
TURNS = {"a quarter turn clockwise": 1, "a half turn": 2, "a three-quarter turn clockwise": 3,
         "a quarter turn anticlockwise": -1, "a three-quarter turn anticlockwise": -3}
COLOURS = {"orange": "#e67e22", "green": "#4cae4c", "purple": "#9b59b6", "red": "#d9534f"}
FACE_LEADS = ["{n}'s robot faces the way the arrow points.", "{n} has a toy robot facing the way of the arrow.",
              "{n} stands like the arrow, facing that way.", "{n}'s toy car points the way of the arrow."]
WHICH_LEADS = ["{n}'s robot turns on the spot.", "{n} turns a toy robot.", "{n} watches a robot turn on the spot.",
               "{n} makes a robot turn."]


def stages(p: dict) -> tuple[int, int]:
    return (2, 4)


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["face", "which", "angles"])
    p = {"band": "P", "sub": sub, "name": rng.choice(NAMES), "start": rng.randrange(4), "colour": rng.choice(sorted(COLOURS))}
    if sub == "face":
        p["turn"] = rng.choice(sorted(TURNS))
    elif sub == "which":
        p["steps"] = rng.choice([1, 2, -1])
    else:
        p["steps"] = rng.choice([1, 2, 3, -1, -2, -3])
    return p


# --- drawing ------------------------------------------------------------------------------------------------

def _compass(ax, cx: float, cy: float, facing: int, gid: str, title: str | None = None, colour: str = "orange") -> None:
    R = 1.25
    ax.add_patch(Circle((cx, cy), R, fill=False, edgecolor="#888888", linewidth=1.4, gid=f"behind-ring:{gid}"))
    for k, d in enumerate(DIRS):
        a = math.radians(90 - 90 * k)
        ax.plot([cx + 0.9 * R * math.cos(a), cx + R * math.cos(a)], [cy + 0.9 * R * math.sin(a), cy + R * math.sin(a)],
                color="#888888", linewidth=1.4, gid=f"behind-tick:{gid}")
        ax.text(cx + (R + 0.3) * math.cos(a), cy + (R + 0.3) * math.sin(a), d[0].upper(), ha="center", va="center",
                fontsize=15, fontweight="bold", gid=f"dir:{gid}:{d}")
    a = math.radians(90 - 90 * facing)
    ax.add_patch(FancyArrowPatch((cx - 0.25 * math.cos(a), cy - 0.25 * math.sin(a)),
                                 (cx + 0.95 * math.cos(a), cy + 0.95 * math.sin(a)), arrowstyle="simple,head_width=0.9,head_length=0.8",
                                 mutation_scale=22, facecolor=COLOURS[colour], edgecolor=INK, linewidth=1.2, gid=f"robot:{gid}:{facing}"))
    ax.plot([cx - 0.25 * math.cos(a), cx + 0.95 * math.cos(a)], [cy - 0.25 * math.sin(a), cy + 0.95 * math.sin(a)],
            alpha=0, gid=f"behind-ends:{gid}")
    if title:
        ax.text(cx, cy - R - 0.85, title, ha="center", va="center", fontsize=14, gid=f"title:{gid}")


def _curved(ax, cx: float, cy: float, start: int, steps: int) -> None:
    """A curved arrow round the compass from the start direction, the way and the amount of the turn."""
    a0 = 90 - 90 * start
    a1 = a0 - 90 * steps
    r = 1.75
    pts = [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * t / 40)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * t / 40)))
           for t in range(41)]
    ax.plot([x for x, _ in pts[:-3]], [y for _, y in pts[:-3]], color="#2e86c1", linewidth=2.2, gid="behind-turn")
    ax.annotate("", xy=pts[-1], xytext=pts[-4], arrowprops={"arrowstyle": "-|>", "color": "#2e86c1", "lw": 2.2,
                                                           "mutation_scale": 18})


def draw(p: dict):
    if p["sub"] == "face":
        fig, ax = new_figure(4.2, 4.2)
        _compass(ax, 0, 0, p["start"], "c", colour=p["colour"])
        ax.set_xlim(-2.0, 2.0)
        ax.set_ylim(-2.0, 2.0)
    else:
        fig, ax = new_figure(8.0, 4.4)
        end = (p["start"] + p["steps"]) % 4
        _compass(ax, 0, 0, p["start"], "before", "before", p["colour"])
        _compass(ax, 4.6, 0, end, "after", "after", p["colour"])
        if p["sub"] == "angles":
            _curved(ax, 0, 0, p["start"], p["steps"])
        ax.set_xlim(-2.2, 6.6)
        ax.set_ylim(-2.4, 2.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ----------------------------------------------------------------------------------------------

def questions(p: dict, rng: random.Random) -> list:
    name, sub = p["name"], p["sub"]
    if sub == "face":
        end = DIRS[(p["start"] + TURNS[p["turn"]]) % 4]
        lead = rng.choice(FACE_LEADS).format(n=name)
        verb = "turns" if "stands" not in lead else "makes"
        return [mcq(f"{lead} It makes {p['turn']}. Which way does it face now?" if verb == "turns"
                    else f"{lead} {name} makes {p['turn']}. Which way does {name} face now?", end,
                    [d for d in DIRS if d != end], rng)]
    if sub == "which":
        key = {1: "a quarter turn clockwise", 2: "a half turn", -1: "a quarter turn anticlockwise"}[p["steps"]]
        lead = rng.choice(WHICH_LEADS).format(n=name)
        opts = ["a quarter turn clockwise", "a quarter turn anticlockwise", "a half turn"]
        return [mcq(f"{lead} Which turn takes it from before to after?", key, [o for o in opts if o != key], rng)]
    lead = rng.choice(WHICH_LEADS).format(n=name)
    way = "clockwise" if p["steps"] > 0 else "anticlockwise"
    return [count(f"{lead} It turns {way}, as the blue arrow shows. How many right angles does it turn through?",
                  abs(p["steps"]), "right angles")]
