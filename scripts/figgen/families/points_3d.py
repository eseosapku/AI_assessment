"""A cuboid OABCDEFG on x, y and z axes: the coordinates of a vertex, the length of the diagonal
OF, the midpoint of OF, and which vertex has given coordinates (UP, AL).

O is the origin and the edges OA, OC and OD run along the x, y and z axes; their lengths are printed.
Half the cuboids have a whole-number diagonal; the others ask it to 1 decimal place, the surd
accepted.
"""
from __future__ import annotations

import math
import random

from ..core import INK, NAMES, mcq, new_figure, num, short

ID = "points_3d"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("three-dimensional-case", "point-location-space", "distance-two-points", "position-line-plane-3d"))
# Coordinates in 3D: not mechanics, nor matrices.
AVOID = r"circular motion|equilibrium|matrices"
# Whole-number diagonals with every edge at least 2, so no two corners crowd together.
WHOLE = [(2, 3, 6), (4, 4, 7), (2, 4, 4), (6, 6, 7), (2, 6, 9), (4, 8, 8), (3, 6, 6)]
DEPTH, SLANT = 0.7, math.radians(35)


def corners(P: int, Q: int, R: int) -> dict:
    return {"O": (0, 0, 0), "A": (P, 0, 0), "B": (P, Q, 0), "C": (0, Q, 0),
            "D": (0, 0, R), "E": (P, 0, R), "F": (P, Q, R), "G": (0, Q, R)}


def screen(x: float, y: float, z: float) -> tuple[float, float]:
    """x runs toward the viewer, down and to the left; y to the right; z up."""
    return y - DEPTH * x * math.cos(SLANT), z - DEPTH * x * math.sin(SLANT)


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.5:
        size = list(rng.choice(WHOLE))
        rng.shuffle(size)
    else:
        size = [rng.randint(2, 6) for _ in range(3)]
    return {"band": rng.choice(BANDS), "size": size, "name": rng.choice(NAMES)}


EDGES = ["OA", "AB", "BC", "CO", "DE", "EF", "FG", "GD", "OD", "AE", "BF", "CG"]


def draw(p: dict):
    P, Q, R = p["size"]
    pts = {k: screen(*v) for k, v in corners(P, Q, R).items()}
    ends = {"x": screen(P + 2, 0, 0), "y": screen(0, Q + 2, 0), "z": screen(0, 0, R + 2)}
    fig, ax = new_figure(6.0, 5.4)
    # Each axis runs on from the cuboid's far corner; inside the cuboid it is the hidden edge.
    starts = {"x": pts["A"], "y": pts["C"], "z": pts["D"]}
    for axis, (ex, ey) in ends.items():
        ax.annotate("", xy=(ex, ey), xytext=starts[axis], arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.0,
                                                                      "shrinkA": 0, "shrinkB": 0})
        ax.text(ex + (0.25 if axis == "y" else -0.3 if axis == "x" else 0), ey + (0.3 if axis == "z" else -0.3 if axis == "x" else 0),
                axis, fontsize=12, style="italic", ha="center", va="center")
    for e in EDGES:
        (ax_, ay), (bx, by) = pts[e[0]], pts[e[1]]
        # O is the back corner, out of sight: its three edges are hidden, so dashed.
        ax.plot([ax_, bx], [ay, by], color=INK, linewidth=1.3 if "O" in e else 1.8, linestyle=(0, (5, 4)) if "O" in e else "-")
    for name, (x, y) in pts.items():
        # Away from the corner's three edges: against the sum of the unit vectors along them.
        sx = sy = 0.0
        for e in EDGES:
            if name in e:
                (u, v) = pts[e[1] if e[0] == name else e[0]]
                n = max(math.hypot(u - x, v - y), 1e-9)
                sx, sy = sx + (u - x) / n, sy + (v - y) / n
        n = max(math.hypot(sx, sy), 1e-9)
        ax.text(x - 0.45 * sx / n, y - 0.45 * sy / n, name, fontsize=12, fontweight="bold", ha="center", va="center")
    xs = [x for x, _ in list(pts.values()) + list(ends.values())]
    ys = [y for _, y in list(pts.values()) + list(ends.values())]
    ax.set_xlim(min(xs) - 1, max(xs) + 1)
    ax.set_ylim(min(ys) - 1.6, max(ys) + 1)
    # The edge lengths in the empty corner below the y-axis, clear of every label.
    ax.text(max(xs) + 0.9, min(ys) - 1.4, f"OA = {P}, OC = {Q}, OD = {R}", fontsize=11, ha="right", va="bottom")
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    P, Q, R = p["size"]
    at = corners(P, Q, R)
    v = rng.choice(["B", "E", "F", "G"])
    x, y, z = at[v]
    coords = short(f"{p['name']} drew the cuboid OABCDEFG with O at the origin. What are the coordinates of {v}?",
                   f"({x}, {y}, {z})", [f"({x},{y},{z})", f"{x}, {y}, {z}"])
    n = P * P + Q * Q + R * R
    d = math.sqrt(n)
    if d == int(d):
        length = short("What is the length of the diagonal OF?", int(d), [f"{int(d)} units"])
    else:
        length = short("What is the length of the diagonal OF? Give your answer to 1 decimal place.", f"{d:.1f}",
                       [f"√{n}", f"sqrt({n})", f"{d:.2f}"])
    mx, my, mz = (num(P / 2), num(Q / 2), num(R / 2))
    middle = short("What are the coordinates of the midpoint of OF?", f"({mx}, {my}, {mz})", [f"({mx},{my},{mz})", f"{mx}, {my}, {mz}"])
    w = rng.choice([k for k in ("A", "C", "D", "E", "G") if k != v])
    others = [k for k in ("A", "B", "C", "D", "E", "F", "G") if k != w]
    rng.shuffle(others)
    vertex = mcq(f"Which vertex of {p['name']}'s cuboid has coordinates ({', '.join(str(c) for c in at[w])})?", w, others, rng)
    return [coords, length, middle, vertex]
