"""A cuboid in oblique projection: built of centimetre cubes to count (Primary), or with its
edges labelled for volume and surface area (Lower Secondary)."""
from __future__ import annotations

import random

from matplotlib.patches import Polygon

from ..core import FILL, FILL_2, INK, NAMES, new_figure, short

ID = "cuboid"
KIND = "maths.solid"
SUBJECT = "mathematics"
BANDS = ("P", "LS")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "volume-cubes-cuboids", "cubes-cuboids", "cuboid-dimension", "surface-area-cubes-cuboids", "prism-volume", "3d-shapes",
    "solids-properties",
))

P_THINGS = ["stack of building blocks", "box of sugar cubes", "model made of cubes", "pile of wooden blocks", "tower of cubes"]
LS_THINGS = [("box", "cm"), ("water tank", "m"), ("brick", "cm"), ("classroom", "m"), ("fish tank", "cm"), ("matchbox", "cm"),
             ("shipping container", "m"), ("block of soap", "cm")]
DEPTH = (0.5, 0.38)  # the receding edges, per unit of width


def stages(p: dict) -> tuple[int, int] | None:
    """Counting cubes for volume: Stage 4 on."""
    return (4, 6) if p["band"] == "P" else None


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    name = rng.choice(NAMES)
    if band == "P":
        return {"band": "P", "name": name, "thing": rng.choice(P_THINGS), "unit": "cm",
                "l": rng.randint(2, 5), "w": rng.randint(2, 4), "h": rng.randint(2, 4)}
    thing, unit = rng.choice(LS_THINGS)
    return {"band": "LS", "name": name, "thing": thing, "unit": unit,
            "l": rng.randint(3, 12), "w": rng.randint(2, 10), "h": rng.randint(2, 10)}


def draw(p: dict):
    l, w, h, u = p["l"], p["w"], p["h"], p["unit"]
    k = 4.0 / max(l + w * DEPTH[0], h + w * DEPTH[1])  # the same size on the page whatever the edges
    L, W, H = l * k, w * k, h * k
    dx, dy = W * DEPTH[0], W * DEPTH[1]
    fig, ax = new_figure(5.6, 4.6)
    front = [(0, 0), (L, 0), (L, H), (0, H)]
    top = [(0, H), (L, H), (L + dx, H + dy), (dx, H + dy)]
    side = [(L, 0), (L + dx, dy), (L + dx, H + dy), (L, H)]
    for face, shade in ((front, FILL_2), (top, "white"), (side, FILL)):
        ax.add_patch(Polygon(face, closed=True, facecolor=shade, edgecolor=INK, linewidth=1.6))
    if p["band"] == "P":
        # The cubes: a line at every centimetre across each visible face.
        for i in range(1, l):
            ax.plot([i * k, i * k], [0, H], color=INK, linewidth=0.8)
            ax.plot([i * k, i * k + dx], [H, H + dy], color=INK, linewidth=0.8)
        for j in range(1, h):
            ax.plot([0, L], [j * k, j * k], color=INK, linewidth=0.8)
            ax.plot([L, L + dx], [j * k, j * k + dy], color=INK, linewidth=0.8)
        for m in range(1, w):
            fx, fy = m * k * DEPTH[0], m * k * DEPTH[1]
            ax.plot([fx, L + fx], [H + fy, H + fy], color=INK, linewidth=0.8)
            ax.plot([L + fx, L + fx], [fy, H + fy], color=INK, linewidth=0.8)
    else:
        # The hidden edges, dashed, and each edge's length.
        for (x0, y0), (x1, y1) in (((dx, dy), (L + dx, dy)), ((dx, dy), (dx, H + dy)), ((0, 0), (dx, dy))):
            ax.plot([x0, x1], [y0, y1], color=INK, linewidth=0.9, linestyle=(0, (4, 3)))
        ax.text(L / 2, -0.25, f"{l} {u}", ha="center", va="top", fontsize=11)
        ax.text(-0.2, H / 2, f"{h} {u}", ha="right", va="center", fontsize=11)
        ax.text(L + dx / 2 + 0.15, dy / 2 - 0.1, f"{w} {u}", ha="left", va="top", fontsize=11)
    ax.set_xlim(-1.4, L + dx + 1.4)
    ax.set_ylim(-0.8, H + dy + 0.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _forms(v: int, u: str, power: str) -> list[str]:
    sup = {"2": "²", "3": "³"}[power]
    return [str(v), f"{v} {u}{sup}", f"{v} {u}{power}", f"{v} {u}^{power}", f"{v}{u}{sup}", f"{v}{u}{power}"]


def questions(p: dict, rng: random.Random) -> list:
    l, w, h, u, name, thing = p["l"], p["w"], p["h"], p["unit"], p["name"], p["thing"]
    vol = l * w * h
    if p["band"] == "P":
        return [
            short(f"{name}'s {thing} is made of 1 cm cubes. What is its volume?", vol, _forms(vol, u, "3")),
            short(f"How many 1 cm cubes are in {name}'s {thing}?", vol),
        ]
    sa = 2 * (l * w + l * h + w * h)
    face = rng.choice([("top", l * w), ("front", l * h)])
    return [
        short(f"{name}'s {thing} is a cuboid. What is its volume?", vol, _forms(vol, u, "3")),
        short(f"What is the total surface area of {name}'s {thing}?", sa, _forms(sa, u, "2")),
        short(f"What is the area of the {face[0]} face of {name}'s {thing}?", face[1], _forms(face[1], u, "2")),
    ]
