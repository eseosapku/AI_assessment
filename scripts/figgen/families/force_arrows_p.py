"""Force arrows (Primary): a box, a cart or a football with two forces acting along one line, drawn as arrows and
lettered P and Q. A push is an arrow whose head presses on the object; a pull starts on the object (at a dot,
where the rope is tied) and points away. A football is only pushed.

Lower level (P1 to P3): the arrows lie on a squared grid, each as many squares long as its force, so the bigger
force is the longer arrow and its length can be counted. Upper level (P4 to P6): each arrow's size is printed in
newtons and it is drawn to scale; sometimes the second force is friction, along the ground under the object, and
then it is never bigger than the push or pull (the object starts still).

Which way the object moves (it starts still), whether the forces are balanced, whether a lettered force is a
push or a pull, and (lower) how many squares long an arrow is or (upper) the size of the overall force: the
difference of the two. Unbalanced forces differ by at least 2, so the bigger one is plain.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Rectangle

from ..core import FILL, FILL_2, GRID, INK, NAMES, count, mcq, measure, new_figure, short

ID = "force_arrows_p"
KIND = "physics.force"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.push-and-pull", "science.forces-and-motion", "science.friction")
# A topic whose sections the book lists is reached only if one names pushes, pulls, forces or friction.
NEEDS = r"push|pull|force|friction"

SCALE = {"lower": 1.0, "upper": 0.4}  # drawing units per square, or per newton
# Each object's left and right edges, the height its forces act at (or two, when both arrows are on one side).
# On the grid each arrow runs along a gridline or the middle of a row of squares.
SHAPES = {"box": (-1.0, 1.0, 1.0, (1.5, 0.5)), "cart": (-2.0, 2.0, 2.0, (2.5, 1.5)), "ball": (-1.0, 1.0, 1.0, (1.0, 1.0))}


def concepts_for(p: dict) -> tuple[str, ...]:
    """Friction only where the figure draws it."""
    has = any(f["kind"] == "friction" for f in p["forces"])
    return tuple(c for c in CONCEPTS if c != "science.friction" or has)


def stages(p: dict) -> tuple[int, int] | None:
    """Forces in newtons, from a forcemeter: from Stage 3."""
    return (3, 6) if p["level"] == "upper" else None


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    obj = rng.choice(["box", "cart", "ball"])
    friction = level == "upper" and obj != "ball" and rng.random() < 0.35
    lo, hi = (2, 7) if level == "lower" else (2, 12)
    balanced = rng.random() < 0.25
    while True:
        a, b = rng.randint(lo, hi), rng.randint(lo, hi)
        if friction:
            a, b = max(a, b), min(a, b)  # friction never wins from rest
        if (a == b) == balanced and (a == b or abs(a - b) >= 2):
            break
    d = rng.choice([1, -1])
    if obj == "ball":
        kinds = ["push", "push"]
    elif friction:
        kinds = [rng.choice(["push", "pull"]), "friction"]
    else:
        kinds = [rng.choice(["push", "pull"]), rng.choice(["push", "pull"])]
    forces = [{"letter": "P", "dir": d, "kind": kinds[0], "size": a}, {"letter": "Q", "dir": -d, "kind": kinds[1], "size": b}]
    return {"band": "P", "level": level, "object": obj, "forces": forces}


# --- drawing ---------------------------------------------------------------------------------------------

def _arrows(p: dict) -> list[tuple[dict, tuple, tuple]]:
    """Each force with its tail and head, in drawing units."""
    xl, xr, y0, pair = SHAPES[p["object"]]
    k = SCALE[p["level"]]
    out = []
    sides = []
    for f in p["forces"]:
        if f["kind"] == "friction":
            sides.append(None)
        elif f["kind"] == "push":
            sides.append(-f["dir"])  # pushed from the side it moves away from
        else:
            sides.append(f["dir"])  # pulled from the side it moves towards
    same = sides[0] is not None and sides[0] == sides[1]
    for i, (f, side) in enumerate(zip(p["forces"], sides)):
        n = f["size"] * k
        if side is None:  # friction, along the ground under the object, from its middle
            tail, head = (0.0, -0.32), (f["dir"] * n, -0.32)
        else:
            y = pair[i] if same else y0
            edge = xr if side > 0 else xl
            if f["kind"] == "push":
                tail, head = (edge - f["dir"] * n, y), (edge, y)
            else:
                tail, head = (edge, y), (edge + f["dir"] * n, y)
        out.append((f, tail, head))
    return out


def _object(ax, obj):
    if obj == "box":
        ax.add_patch(Rectangle((-1, 0), 2, 2, facecolor="#e4dccb", edgecolor=INK, linewidth=2.0, gid="object", zorder=3))
        ax.plot([-1, 1], [1.55, 1.55], color=INK, linewidth=1.0, zorder=4)  # the lid
    elif obj == "cart":
        ax.add_patch(Rectangle((-2, 0.8), 4, 2.2, facecolor="#e4dccb", edgecolor=INK, linewidth=2.0, gid="object", zorder=3))
        for x in (-1.2, 1.2):
            ax.add_patch(Circle((x, 0.4), 0.4, facecolor=FILL, edgecolor=INK, linewidth=1.8, zorder=4))
            ax.add_patch(Circle((x, 0.4), 0.08, facecolor=INK, edgecolor=INK, zorder=5))
    else:
        ax.add_patch(Circle((0, 1), 1, facecolor="white", edgecolor=INK, linewidth=2.0, gid="object", zorder=3))
        ax.add_patch(Circle((0, 1), 0.3, facecolor=FILL_2, edgecolor=INK, linewidth=1.2, zorder=4))


def draw(p: dict):
    arrows = _arrows(p)
    xs = [x for _, (tx, _), (hx, _) in arrows for x in (tx, hx)] + [SHAPES[p["object"]][0], SHAPES[p["object"]][1]]
    x0, x1 = math.floor(min(xs) - 0.9), math.ceil(max(xs) + 0.9)
    fr = any(f["kind"] == "friction" for f, _, _ in arrows)
    y0, y1 = (-1.0 if fr else -0.5), (4.0 if p["object"] == "cart" else 3.0)
    fig, ax = new_figure(0.5 * (x1 - x0), 0.5 * (y1 - y0))
    if p["level"] == "lower":
        for x in range(x0, x1 + 1):
            ax.plot([x, x], [0, y1], color=GRID, linewidth=0.8, zorder=0)
        for y in range(0, int(y1) + 1):
            ax.plot([x0, x1], [y, y], color=GRID, linewidth=0.8, zorder=0)
    ax.plot([x0, x1], [0, 0], color=INK, linewidth=1.8, zorder=1)
    _object(ax, p["object"])
    for f, tail, head in arrows:
        ax.annotate("", xy=head, xytext=tail, gid=f"force-{f['letter']}",
                    arrowprops=dict(arrowstyle="-|>", color=INK, lw=2.6, shrinkA=0, shrinkB=0, mutation_scale=20), zorder=6)
        if f["kind"] == "pull":
            ax.add_patch(Circle(tail, 0.09, facecolor=INK, edgecolor=INK, zorder=7))  # where the rope is tied
        outer = tail if f["kind"] == "push" else head
        mid_x = (tail[0] + head[0]) / 2
        out = 1 if outer[0] > 0 else -1
        if f["kind"] == "friction":
            outer = head
            out = 1 if head[0] > 0 else -1
            ax.text(mid_x, -0.72, f"friction {f['size']} N", ha="center", va="center", fontsize=10.5)
        elif p["level"] == "upper":
            ax.text(mid_x, outer[1] + 0.3, f"{f['size']} N", ha="center", va="center", fontsize=11,
                    bbox=dict(facecolor="white", edgecolor="none", pad=0.5))
        ax.text(outer[0] + out * 0.4, outer[1], f["letter"], ha="center", va="center", fontsize=14, fontweight="bold",
                bbox=dict(facecolor="white", edgecolor="none", pad=0.5))
    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -------------------------------------------------------------------------------------------

THINGS = {"box": ("a box of books", "box", ["in a classroom in Huye", "at a school in Nyanza", "in the library in Kigali"]),
          "cart": ("a cart of bananas", "cart", ["at the market in Musanze", "on a road in Rubavu", "at a farm in Kayonza"]),
          "ball": ("a football", "ball", ["on a football field in Kigali", "at a school in Huye", "in a game in Nyagatare"])}
VERBS = ["draws", "looks at", "marks", "shows", "studies"]


def questions(p: dict, rng: random.Random) -> list:
    fs = p["forces"]
    phrase, noun, places = THINGS[p["object"]]
    name = rng.choice(NAMES)
    net = sum(f["dir"] * f["size"] for f in fs)
    move = "It will not move" if net == 0 else ("To the right" if net > 0 else "To the left")
    qs = [mcq(f"{name} {rng.choice(VERBS)} the forces on {phrase} {rng.choice(places)}. The {noun} is still at the start. "
              "Which way will it move?", move, [v for v in ("To the left", "To the right", "It will not move") if v != move], rng)]

    def named(f):
        return "the friction" if f["kind"] == "friction" else f"force {f['letter']}"

    yes = "Yes: the forces are the same size"
    if net == 0:
        key = yes
    else:
        key = f"No: {named(max(fs, key=lambda f: f['size']))} is bigger"
    qs.append(mcq(f"Are the forces on the {noun} balanced?", key, [yes] + [f"No: {named(f)} is bigger" for f in fs], rng))
    f = rng.choice([f for f in fs if f["kind"] != "friction"])
    qs.append(mcq(f"Is force {f['letter']} a push or a pull?", "A push" if f["kind"] == "push" else "A pull",
                  ["A pull" if f["kind"] == "push" else "A push", "A twist"], rng))
    if p["level"] == "lower":
        g = rng.choice(fs)
        qs.append(count(f"How many squares long is arrow {g['letter']}?", g["size"], "squares"))
    elif net:
        qs.append(short(f"What is the size of the overall force on the {noun}, in newtons?", abs(net), measure(abs(net), "N")))
    return qs
