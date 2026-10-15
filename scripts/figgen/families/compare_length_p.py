"""Comparing lengths (P, Stage 1 to 2): three or four things measured in cubes, or on a line marked in metres from 0 to
10, as Cambridge Stage 1 "Measures" (length in cubes) and Rwanda P1 "Measuring lengths less than or equal to 10 m"
teach it.

- cubes: each thing lies over a row of cubes, every row starting at the same line, the thing exactly as long as its
  cubes. How many cubes long is a thing? Which is the longest (shortest)? How many cubes longer is one than another?
- metres: each thing is a bar from 0, ending on a metre line; the lines are numbered 0 to 10 along the bottom. How
  long is a thing? Which is the longest (shortest)? How many metres longer is one than another?

Every length is a whole number, and no two things are the same length, so "the longest" is one thing only.
"""
from __future__ import annotations

import random

from matplotlib.patches import FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, GRID, INK, NAMES, count, mcq, measure, new_figure, short

ID = "compare_length_p"
KIND = "maths.measure"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.length-measurement",)
# A topic whose sections the book lists is reached only if its name or a section names length or measuring.
NEEDS = r"length|measur|\b10 m\b"
AVOID = r"litre|liter|capacity|kilogram|\bmass\b|time|hour|money|currenc|francs?\b|angle|shape|lines and|relationship"

CUBE_THINGS = ["pencil", "crayon", "straw", "stick", "ribbon", "comb", "spoon", "brush"]
# A thing measured in metres, and the lengths it may fairly have.
METRE_THINGS = {"rope": (3, 10), "plank": (2, 5), "pipe": (2, 6), "bench": (2, 4), "ladder": (2, 6), "fence": (4, 10),
                "hose": (3, 10), "table": (1, 3), "carpet": (2, 5), "wall": (3, 9)}
LEADS = {
    "cubes": ["{n} measures some things with cubes.", "{n} lines up cubes under some things.",
              "{n} uses cubes to measure some things.", "{n} counts cubes to measure some things."],
    "metres": ["{n} measures some things at school in metres.", "{n} measures some things with a metre stick.",
               "{n} and a friend measure some things in metres.", "{n} measures some long things in metres."],
}


def stages(p: dict) -> tuple[int, int] | None:
    return (1, 2)


def sample(rng: random.Random) -> dict:
    mode = rng.choice(["cubes", "metres"])
    n = rng.choice([3, 4])
    if mode == "cubes":
        names = rng.sample(CUBE_THINGS, n)
        lengths = rng.sample(range(2, 11), n)
    else:
        while True:
            names = rng.sample(sorted(METRE_THINGS), n)
            lengths = [rng.randint(*METRE_THINGS[x]) for x in names]
            if len(set(lengths)) == n:
                break
    return {"band": "P", "mode": mode, "name": rng.choice(NAMES), "items": [[x, v] for x, v in zip(names, lengths)]}


# --- drawing ----------------------------------------------------------------------------------------

def _thing(ax, kind: str, x0: float, x1: float, y: float, h: float, gid: str) -> None:
    """A thing lying from x0 to x1, one outline (so its two ends are its length)."""
    if kind in ("pencil", "crayon"):
        tip = 0.5 if kind == "pencil" else 0.3
        ax.add_patch(Polygon([(x0, y - h / 2), (x1 - tip, y - h / 2), (x1, y), (x1 - tip, y + h / 2), (x0, y + h / 2)],
                             closed=True, facecolor=FILL if kind == "pencil" else FILL_2, edgecolor=INK, linewidth=1.4,
                             gid=gid))
        ax.plot([x1 - tip, x1 - tip], [y - h / 2, y + h / 2], color=INK, linewidth=1.0)
    else:
        face = {"ribbon": "#e8a0a8", "stick": "#c9a26b", "straw": "#f4f1d0"}.get(kind, FILL_2)
        ax.add_patch(FancyBboxPatch((x0, y - h / 2), x1 - x0, h, boxstyle="round,pad=0,rounding_size=0.1",
                                    facecolor=face, edgecolor=INK, linewidth=1.4, gid=gid))


def _cubes(p: dict):
    items = p["items"]
    n = len(items)
    fig, ax = new_figure(8.6, 1.4 * n + 0.6)
    for i, (name, v) in enumerate(items):
        base = (n - 1 - i) * 2.2
        _thing(ax, name, 0, v, base + 1.3, 0.5, f"thing:{name}")
        for k in range(v):
            ax.add_patch(Rectangle((k, base), 1, 1, facecolor="#cfe3f5", edgecolor=INK, linewidth=1.3, gid=f"cube:{name}:{k}"))
        ax.text(-0.3, base + 0.9, name, ha="right", va="center", fontsize=14, gid=f"name:{name}")
    ax.plot([0, 0], [-0.25, (n - 1) * 2.2 + 1.75], color=INK, linewidth=1.0, linestyle=(0, (4, 3)), gid="start")
    ax.set_xlim(-2.4, 10.3)
    ax.set_ylim(-0.4, (n - 1) * 2.2 + 1.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _metres(p: dict):
    items = p["items"]
    n = len(items)
    fig, ax = new_figure(8.6, 0.9 * n + 1.6)
    top = n * 1.0 + 0.1
    for k in range(11):
        ax.plot([k, k], [0, top], color=GRID if k else INK, linewidth=1.0 if k else 1.4, gid=f"metre:{k}", zorder=0)
        ax.text(k, -0.32, str(k), ha="center", va="center", fontsize=12, gid=f"tick:{k}")
    ax.plot([0, 10], [0, 0], color=INK, linewidth=1.4)
    ax.text(5, -0.85, "metres", ha="center", va="center", fontsize=12)
    for i, (name, v) in enumerate(items):
        y = top - 0.6 - i * 1.0
        ax.add_patch(Rectangle((0, y - 0.25), v, 0.5, facecolor=FILL_2 if i % 2 else "#c9a26b", edgecolor=INK,
                               linewidth=1.4, gid=f"bar:{name}", zorder=2))
        ax.text(-0.25, y, name, ha="right", va="center", fontsize=14, gid=f"name:{name}")
    ax.set_xlim(-2.2, 10.4)
    ax.set_ylim(-1.15, top + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _cubes(p) if p["mode"] == "cubes" else _metres(p)


# --- questions --------------------------------------------------------------------------------------

def questions(p: dict, rng: random.Random) -> list:
    items = {x: v for x, v in p["items"]}
    names = [x for x, _ in p["items"]]
    mode = p["mode"]
    lead = rng.choice(LEADS[mode]).format(n=p["name"])
    x = rng.choice(names)
    if mode == "cubes":
        q1 = count(f"{lead} How many cubes long is the {x}?", items[x], "cubes")
    else:
        q1 = short(f"{lead} How long is the {x}?", str(items[x]), measure(items[x], "m")[1:])
    most = rng.choice(["longest", "shortest"])
    order = sorted(names, key=items.get, reverse=most == "longest")
    q2 = mcq(f"Which is the {most}?", f"the {order[0]}", [f"the {o}" for o in order[1:]], rng)
    a, b = rng.sample(names, 2)
    if items[a] < items[b]:
        a, b = b, a
    d = items[a] - items[b]
    unit = "cubes" if mode == "cubes" else "metres"
    if mode == "cubes":
        q3 = count(f"How many cubes longer is the {a} than the {b}?", d, "cubes")
    else:
        q3 = short(f"How many {unit} longer is the {a} than the {b}?", str(d), measure(d, "m")[1:])
    return [q1, q2, q3]
