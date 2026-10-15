"""Simple 2D shapes (P, Stage 1 to 3): squares, rectangles, triangles and circles, as Cambridge Stage 1 and 2
"Geometry" and Rwanda P1 "Right angle, square and rectangle" and P2 "Square, rectangle and triangle" teach them.

Two kinds of figure:
- row: four or five shapes in a row, lettered A to E, one of them a square and at least one a rectangle, every right
  angle marked with a small square. Which shape has 4 equal sides? How many corners (sides) does shape C have? How many
  right angles does shape B have? How many triangles (circles) are there?
- picture: a house, a rocket or a train made of shapes. How many triangles (circles, squares) are in the picture? The
  question always says "in the picture" and never names the house, rocket or train (a sun beside the house was left
  out of "the circles in the house"). Every outline stands clear of every other, so each edge is seen whole; a shape
  may sit inside a bigger polygon (a window in a wall) only with space all round; a circle never sits inside, holds
  or touches another shape, and is at least as wide as the smallest square (small portholes and wheels were
  miscounted in the P3z review).

Every key is counted from the shapes drawn, using this module's table of corners, sides and right angles. A rectangle
is always at least 1.8 times as long as it is wide, so it never passes for a square, and "how many rectangles" is
asked only of a picture with no square in it (a square is a rectangle too, and a careful child would count it).
"""
from __future__ import annotations

import random
from collections import Counter

from matplotlib.patches import Circle, Polygon

from ..core import FILL, FILL_2, INK, NAMES, count, mcq, new_figure

ID = "shapes_p"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.2d-shapes", "mathematics.shapes-square-rectangle-triangle")
# A topic whose sections the book lists is reached only if its name or a section names shapes, angles or the shapes.
NEEDS = r"shape|geometry|angle|circle|square|rectangle|triangle"
# Fractions of shapes, symmetry and patterns, position, and area teach none of this.
AVOID = r"fraction|symmetry|pattern|position|direction|grid|\barea\b|perimeter|3d|solid|net|algebra"  # and Checkpoint (Stage 6)

CORNERS = {"square": 4, "rectangle": 4, "triangle": 3, "right triangle": 3, "circle": 0}
SIDES = {"square": 4, "rectangle": 4, "triangle": 3, "right triangle": 3}
RIGHT = {"square": 4, "rectangle": 4, "triangle": 0, "right triangle": 1}
PLURAL = {"square": "squares", "rectangle": "rectangles", "triangle": "triangles", "circle": "circles"}
LEADS = ["{n} drew some shapes.", "{n} cut out some shapes.", "{n} made some shapes from paper.",
         "{n} found these shapes in a book.", "{n} sorts some shapes.", "{n} looks at some shapes."]
# The picture is never named in a question: "circles in the house" left out the sun beside the house (P3z review).
PICTURE_LEADS = ["{n} made this picture with shapes.", "{n} drew this picture with shapes.",
                 "{n} cut out shapes to make this picture.", "{n} made this picture from paper shapes.",
                 "{n} stuck paper shapes on a page to make this picture.", "{n} coloured in this picture of shapes."]


def stages(p: dict) -> tuple[int, int] | None:
    return (1, 3)  # naming and counting the simple shapes runs on into Stage 3 (Rwanda P3 adds the circle)


def _r(v: float) -> float:
    return round(v, 3)


def _rect(x: float, y: float, w: float, h: float, kind: str) -> dict:
    return {"kind": kind, "pts": [[_r(x), _r(y)], [_r(x + w), _r(y)], [_r(x + w), _r(y + h)], [_r(x), _r(y + h)]]}


def _circle(x: float, y: float, r: float) -> dict:
    return {"kind": "circle", "c": [_r(x), _r(y)], "r": _r(r)}


def _row_shape(rng: random.Random, kind: str, cx: float) -> dict:
    """A shape standing on the line y = 0, centred on cx, about 1.6 across."""
    if kind == "square":
        s = rng.choice([1.2, 1.3, 1.4, 1.5])
        return _rect(cx - s / 2, 0, s, s, "square")
    if kind == "rectangle":
        if rng.random() < 0.5:
            w, h = rng.choice([1.8, 1.9]), rng.choice([0.8, 0.9, 1.0])
        else:
            w, h = rng.choice([0.8, 0.9]), rng.choice([1.6, 1.7, 1.8])
        return _rect(cx - w / 2, 0, w, h, "rectangle")
    if kind == "triangle":
        b, h = rng.choice([1.5, 1.6, 1.7]), rng.choice([1.3, 1.4, 1.5])
        return {"kind": "triangle", "pts": [[_r(cx - b / 2), 0], [_r(cx + b / 2), 0], [_r(cx), _r(h)]]}
    if kind == "right triangle":
        b, h = rng.choice([1.3, 1.4, 1.5]), rng.choice([1.3, 1.4, 1.5])
        if rng.random() < 0.5:  # the square corner on the left
            pts = [[_r(cx - b / 2), 0], [_r(cx + b / 2), 0], [_r(cx - b / 2), _r(h)]]
        else:
            pts = [[_r(cx - b / 2), 0], [_r(cx + b / 2), 0], [_r(cx + b / 2), _r(h)]]
        return {"kind": "right triangle", "pts": pts}
    r = rng.choice([0.75, 0.8])  # as wide as the biggest square at least: a small circle was miscounted
    return _circle(cx, r, r)


# Clear space between any two outlines in a picture, so every edge is seen whole: a square train cab whose edges the
# wheels and the front covered measured 152 by 150 px in the P3z review, and its squares were miscounted.
G = 0.12


def _house(rng: random.Random) -> list[dict]:
    shapes = [_rect(0, 0, 3, 3, "square"),
              {"kind": "triangle", "pts": [[-0.3, 3 + G], [3.3, 3 + G], [1.5, 4.8]]},
              _rect(1.1, 0.15, 0.8, 1.5, "rectangle")]  # the door, inside the wall with space all round
    for x in rng.choice([[0.3], [2.0], [0.3, 2.0]]):
        shapes.append(_rect(x, 1.9, 0.7, 0.7, "square"))  # windows
    if rng.random() < 0.6:
        shapes.append(_circle(5.4, 4.3, 0.55))  # the sun
    for x in rng.sample([4.4, 6.2], rng.choice([0, 1, 2])):  # trees: a trunk, and a round top clear of it
        shapes.append(_rect(x - 0.18, 0, 0.36, 1.2, "rectangle"))
        shapes.append(_circle(x, 1.2 + G + 0.65, 0.65))
    return shapes


def _rocket(rng: random.Random) -> list[dict]:
    shapes = [_rect(0, 0, 1.4, 3.6, "rectangle"),
              {"kind": "triangle", "pts": [[0, 3.6 + G], [1.4, 3.6 + G], [0.7, 5.0]]},
              {"kind": "right triangle", "pts": [[-G, 0], [-G, 1.2], [-0.8 - G, 0]]},
              {"kind": "right triangle", "pts": [[1.4 + G, 0], [1.4 + G, 1.2], [2.2 + G, 0]]}]
    for y in rng.choice([[2.5], [0.6], [2.5, 0.6]]):
        shapes.append(_rect(0.35, y, 0.7, 0.7, "square"))  # windows (square: a round porthole inside was missed)
    if rng.random() < 0.5:
        shapes.append({"kind": "triangle", "pts": [[0.25, -G], [1.15, -G], [0.7, -1.0]]})  # the flame
    for x, y in rng.sample([(3.4, 4.2), (-2.2, 3.9), (3.5, 1.9), (-2.1, 1.7)], rng.choice([1, 2, 3])):
        shapes.append(_circle(x, y, 0.45))  # planets, out in space
    return shapes


def _train(rng: random.Random) -> list[dict]:
    y0 = 0.8 + G  # the bodies stand clear of the wheels
    shapes = [_rect(0, y0, 1.6, 1.6, "square"), _rect(1.6 + G, y0, 2.0, 1.0, "rectangle"),
              _rect(3.0, y0 + 1.0 + G, 0.4, 0.8, "rectangle"), _rect(0.45, y0 + 0.7, 0.7, 0.7, "square")]
    wheels = [0.8, 2.9]
    for k in range(rng.choice([1, 2])):
        x = 4.0 + 3.0 * k
        shapes.append(_rect(x, y0, 2.5, 1.2, "rectangle"))
        for wx in rng.choice([[x + 0.95], [x + 0.35, x + 1.55]]):
            shapes.append(_rect(wx, y0 + 0.3, 0.6, 0.6, "square"))  # windows
        wheels += [x + 0.6, x + 1.9]
    for wx in wheels:
        shapes.append(_circle(wx, 0.4, 0.4))
    for k in range(rng.choice([0, 1, 2])):
        shapes.append(_circle(3.75 + 0.85 * k, 3.45 + 0.55 * k, 0.4))  # smoke
    if rng.random() < 0.5:
        shapes.append({"kind": "right triangle", "pts": [[-0.7 - G, y0], [-G, y0], [-G, y0 + 0.7]]})  # the front
    return shapes


PICTURES = {"house": _house, "rocket": _rocket, "train": _train}


def sample(rng: random.Random) -> dict:
    p = {"band": "P", "name": rng.choice(NAMES), "mode": rng.choice(["row", "picture"])}
    if p["mode"] == "row":
        n = rng.choice([4, 5])
        kinds = ["square", "rectangle"] + [rng.choice(["rectangle", "triangle", "right triangle", "circle", "circle",
                                                        "triangle"]) for _ in range(n - 2)]
        rng.shuffle(kinds)
        shapes = []
        for i, kind in enumerate(kinds):
            sh = _row_shape(rng, kind, 1.0 + 2.3 * i)
            sh["letter"] = "ABCDE"[i]
            shapes.append(sh)
        p["shapes"] = shapes
    else:
        p["picture"] = rng.choice(sorted(PICTURES))
        p["shapes"] = PICTURES[p["picture"]](rng)
    return p


# --- drawing ----------------------------------------------------------------------------------------

def _mark(ax, pts, k: int, gid: str, z: float) -> None:
    """A small square in the corner at pts[k], where the two sides meet at a right angle."""
    (x, y), (ax_, ay), (bx, by) = pts[k], pts[k - 1], pts[(k + 1) % len(pts)]
    ux, uy = ax_ - x, ay - y
    vx, vy = bx - x, by - y
    lu, lv = (ux * ux + uy * uy) ** 0.5, (vx * vx + vy * vy) ** 0.5
    s = 0.2
    ux, uy, vx, vy = s * ux / lu, s * uy / lu, s * vx / lv, s * vy / lv
    ax.plot([x + ux, x + ux + vx, x + vx], [y + uy, y + uy + vy, y + vy], color=INK, linewidth=1.1, gid=gid, zorder=z)


def _right_corners(pts) -> list[int]:
    out = []
    for k in range(len(pts)):
        (x, y), (ax_, ay), (bx, by) = pts[k], pts[k - 1], pts[(k + 1) % len(pts)]
        if abs((ax_ - x) * (bx - x) + (ay - y) * (by - y)) < 1e-9:
            out.append(k)
    return out


FACE = {"square": "#cfe3f5", "rectangle": FILL_2, "triangle": "#f6d7a7", "right triangle": "#f6d7a7", "circle": "#d8ecc9"}


def draw(p: dict):
    shapes = p["shapes"]
    row = p["mode"] == "row"
    xs = [v[0] for sh in shapes for v in sh.get("pts", [])] + [sh["c"][0] + s * sh["r"] for sh in shapes if "c" in sh
                                                               for s in (-1, 1)]
    ys = [v[1] for sh in shapes for v in sh.get("pts", [])] + [sh["c"][1] + s * sh["r"] for sh in shapes if "c" in sh
                                                               for s in (-1, 1)]
    x0, x1, y0, y1 = min(xs) - 0.3, max(xs) + 0.3, min(ys) - (0.9 if row else 0.3), max(ys) + 0.3
    scale = 0.85 if row else 0.75
    fig, ax = new_figure(scale * (x1 - x0) + 0.6, scale * (y1 - y0) + 0.6)
    # Big shapes first, so the windows and doors sit on top of the walls.
    order = sorted(range(len(shapes)), key=lambda i: -_size(shapes[i]))
    for z, i in enumerate(order):
        sh = shapes[i]
        face = FACE[sh["kind"]] if row or not _inside_another(shapes, i) else "white"
        if sh["kind"] == "circle":
            ax.add_patch(Circle(tuple(sh["c"]), sh["r"], facecolor=face, edgecolor=INK, linewidth=1.8, gid=f"shape:{i}",
                                zorder=2 + z))
        else:
            ax.add_patch(Polygon([tuple(v) for v in sh["pts"]], closed=True, facecolor=face, edgecolor=INK,
                                 linewidth=1.8, joinstyle="miter", gid=f"shape:{i}", zorder=2 + z))
            if row:
                pts = [tuple(v) for v in sh["pts"]]
                for k in _right_corners(pts):
                    _mark(ax, pts, k, f"right:{i}", 2.5 + z)  # above its own shape, so it shows
    if row:
        for sh in shapes:
            cx = (sum(v[0] for v in sh["pts"]) / len(sh["pts"])) if "pts" in sh else sh["c"][0]
            ax.text(cx, -0.5, sh["letter"], ha="center", va="center", fontsize=16, fontweight="bold",
                    gid=f"letter:{sh['letter']}")
    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _size(sh: dict) -> float:
    if sh["kind"] == "circle":
        return 3.14 * sh["r"] ** 2
    pts = sh["pts"]
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))) / 2


def _inside_another(shapes: list, i: int) -> bool:
    """Whether a shape lies inside a bigger one (a window in a wall): drawn white, so it stands out."""
    from matplotlib.path import Path
    sh = shapes[i]
    pts = sh["pts"] if "pts" in sh else [[sh["c"][0], sh["c"][1]]]
    for j, other in enumerate(shapes):
        if j == i or "pts" not in other or _size(other) <= _size(sh):
            continue
        path = Path(other["pts"])
        if all(path.contains_point(v, radius=-1e-6) or path.contains_point(v, radius=1e-6) for v in pts):
            return True
    return False


# --- questions --------------------------------------------------------------------------------------

def _kinds(shapes) -> Counter:
    return Counter("triangle" if sh["kind"] == "right triangle" else sh["kind"] for sh in shapes)


def questions(p: dict, rng: random.Random) -> list:
    shapes = p["shapes"]
    have = _kinds(shapes)
    if p["mode"] == "picture":
        lead = rng.choice(PICTURE_LEADS).format(n=p["name"])
        kinds = [k for k in ("triangle", "circle", "square", "rectangle") if have[k]
                 and not (k == "rectangle" and have["square"])]
        asked = rng.sample(kinds, min(3, len(kinds)))
        qs = []
        for j, k in enumerate(asked):
            stem = f"How many {PLURAL[k]} are in the picture?"
            qs.append(count(f"{lead} {stem}" if j == 0 else stem, have[k], PLURAL[k]))
        return qs
    lead = rng.choice(LEADS).format(n=p["name"])
    letters = {sh["letter"]: sh for sh in shapes}
    square = next(sh["letter"] for sh in shapes if sh["kind"] == "square")
    rects = [sh["letter"] for sh in shapes if sh["kind"] == "rectangle"]
    others = [sh["letter"] for sh in shapes if sh["kind"] not in ("square", "rectangle")]
    rng.shuffle(rects)
    rng.shuffle(others)
    qs = [mcq(f"{lead} Which shape has 4 equal sides?", f"Shape {square}", [f"Shape {L}" for L in rects[:1] + others + rects[1:]],
              rng)]
    L = rng.choice(sorted(letters))
    kind = letters[L]["kind"]
    if kind != "circle" and rng.random() < 0.5:
        qs.append(count(f"How many sides does shape {L} have?", SIDES[kind], "sides"))
    else:
        qs.append(count(f"How many corners does shape {L} have?", CORNERS[kind], "corners"))
    L = rng.choice(sorted(x for x, sh in letters.items() if sh["kind"] != "circle"))
    qs.append(count(f"A right angle is a square corner. How many right angles does shape {L} have?",
                    RIGHT[letters[L]["kind"]], "right angles"))
    kinds = [k for k in ("triangle", "circle") if have[k]]
    if kinds:
        k = rng.choice(kinds)
        qs.append(count(f"How many {PLURAL[k]} are there?", have[k], PLURAL[k]))
    return qs
