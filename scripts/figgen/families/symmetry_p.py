"""Lines of symmetry (P, Stage 2 to 6), as Cambridge Primary Stage 3 "Pattern and symmetry" (shape and symmetry,
pattern and symmetry) and Rwanda P6 "Regular Polygons and Bearings" (lines of symmetry of regular polygons) teach them.

Three kinds of figure, big and plain:
- line (Stage 2–4): three or four shapes lettered P to S, each with a dashed line drawn across it; exactly one dashed
  line is a line of symmetry (it folds the shape onto itself). Which shape has a line of symmetry drawn on it?
- count (Stage 4–6): one shape -- a regular polygon, a rectangle, a rhombus, a kite, an isosceles trapezium, a
  parallelogram, an isosceles triangle -- drawn alone. How many lines of symmetry does it have?
- complete (Stage 3–6): a squared grid with a dashed mirror line; some squares are shaded on both sides, and one shaded
  square has no partner. Four empty squares are lettered P to S on the other side. Which lettered square must be
  shaded to make the pattern symmetrical about the mirror line?
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon, Rectangle

from ..core import FILL, INK, NAMES, count, mcq, new_figure

ID = "symmetry_p"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.shape-symmetry", "mathematics.symmetry-polygons")
# A topic whose sections the book lists is reached only if its name or a section names symmetry or polygons.
NEEDS = r"symmetr|polygon"
AVOID = r"fraction|angle|position, direction|time|measur|3d|nets|square, rectangle"

SHADE = "#9cc9ec"
LETTERS = "PQRS"
LINE_LEADS = ["{n} draws a dashed line across each shape.", "{n} tries to fold each shape along the dashed line.",
              "{n} looks for lines of symmetry.", "{n} draws one dashed line on each shape."]
COUNT_LEADS = ["{n} draws a shape.", "{n} cuts out a shape.", "{n} folds a paper shape.", "{n} looks at a shape."]
COMPLETE_LEADS = ["{n} shades squares on both sides of a mirror line.", "{n} makes a pattern with a mirror line.",
                  "{n} colours squares to make a symmetrical pattern.", "{n} reflects a pattern in a mirror line."]
# Lines of symmetry: a teacher's table, checked in the tests by folding the drawn shape.
COUNT_SHAPES = {"equilateral triangle": 3, "square": 4, "regular pentagon": 5, "regular hexagon": 6, "regular octagon": 8,
                "rectangle": 2, "rhombus": 2, "kite": 1, "isosceles trapezium": 1, "parallelogram": 0,
                "isosceles triangle": 1}


def stages(p: dict) -> tuple[int, int]:
    return {"line": (2, 4), "count": (4, 6), "complete": (3, 6)}[p["sub"]]


def concepts_for(p: dict) -> tuple[str, ...]:
    return ("mathematics.symmetry-polygons", "mathematics.shape-symmetry") if p["sub"] == "count" else \
        ("mathematics.shape-symmetry",)


def outline(kind: str, s: float = 1.0) -> list[list[float]]:
    """A shape's corners, centred near (0, 0), about 2 units across."""
    if kind.startswith("regular") or kind in ("equilateral triangle", "square"):
        n = {"equilateral triangle": 3, "square": 4, "regular pentagon": 5, "regular hexagon": 6, "regular octagon": 8}[kind]
        start = 90 if n % 2 else 90 + 180 / n
        return [[round(s * math.cos(math.radians(start + 360 * i / n)), 6),
                 round(s * math.sin(math.radians(start + 360 * i / n)), 6)] for i in range(n)]
    return {"rectangle": [[-1.2, -0.7], [1.2, -0.7], [1.2, 0.7], [-1.2, 0.7]],
            "rhombus": [[0, -1.0], [0.65, 0], [0, 1.0], [-0.65, 0]],
            "kite": [[0, -1.1], [0.7, 0.35], [0, 0.85], [-0.7, 0.35]],
            "isosceles trapezium": [[-1.2, -0.65], [1.2, -0.65], [0.6, 0.65], [-0.6, 0.65]],
            "parallelogram": [[-1.2, -0.6], [0.6, -0.6], [1.2, 0.6], [-0.6, 0.6]],
            "isosceles triangle": [[-0.75, -0.8], [0.75, -0.8], [0, 1.0]],
            "right triangle": [[-0.9, -0.8], [0.9, -0.8], [-0.9, 0.9]],
            "scalene triangle": [[-1.0, -0.8], [1.1, -0.8], [-0.3, 0.9]],
            "L shape": [[-0.9, -0.9], [0.9, -0.9], [0.9, -0.2], [-0.2, -0.2], [-0.2, 0.9], [-0.9, 0.9]]}[kind]


# (shape, dashed line as two points, is it a line of symmetry?)
LINES = [("rectangle", [[0, -1.0], [0, 1.0]], True), ("rectangle", [[-1.45, 0], [1.45, 0]], True),
         ("rectangle", [[-1.2, -0.7], [1.2, 0.7]], False), ("square", [[-0.95, -0.95], [0.95, 0.95]], True),
         ("isosceles triangle", [[0, -1.05], [0, 1.2]], True), ("isosceles triangle", [[-1.0, 0.1], [1.0, 0.1]], False),
         ("kite", [[0, -1.3], [0, 1.05]], True), ("kite", [[-0.95, 0.35], [0.95, 0.35]], False),
         ("parallelogram", [[0, -0.85], [0, 0.85]], False), ("parallelogram", [[-1.45, 0], [1.45, 0]], False),
         ("right triangle", [[-1.1, -1.0], [0.4, 1.0]], False), ("rhombus", [[-0.9, 0], [0.9, 0]], True),
         ("isosceles trapezium", [[0, -0.9], [0, 0.9]], True), ("isosceles trapezium", [[-1.45, 0], [1.45, 0]], False),
         ("scalene triangle", [[0.05, -1.0], [0.05, 1.1]], False), ("L shape", [[-1.1, -1.1], [1.1, 1.1]], True),
         ("L shape", [[0, -1.1], [0, 1.1]], False)]


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["line", "count", "complete"])
    p = {"band": "P", "sub": sub, "name": rng.choice(NAMES)}
    if sub == "line":
        k = rng.choice([3, 4])
        good = [i for i, (_, _, ok) in enumerate(LINES) if ok]
        bad = [i for i, (_, _, ok) in enumerate(LINES) if not ok]
        while True:
            key = rng.choice(good)
            rest = rng.sample(bad, k - 1)
            if LINES[key][0] not in {LINES[i][0] for i in rest}:
                break
        order = rest[:]
        order.insert(rng.randrange(k), key)
        p.update(lines=order)
        return p
    if sub == "count":
        p.update(shape=rng.choice(sorted(COUNT_SHAPES)), turn=rng.choice([0, 0, 15, 30]))
        return p
    while True:
        cols, rows = rng.choice([(3, 4), (4, 4), (3, 5), (4, 5)])  # columns on each side of the mirror
        cells = [[c, r] for c in range(cols) for r in range(rows)]
        left = rng.sample(cells, rng.randint(3, 5))
        missing = rng.choice(left)
        right_empty = [[c, r] for c, r in cells if [c, r] not in left]  # mirror images that stay white
        if len(right_empty) < 3:
            continue
        others = rng.sample(right_empty, 3)
        p.update(cols=cols, rows=rows, left=sorted(left), missing=missing, others=others,
                 letters=rng.sample(LETTERS, 4), side=rng.choice(["left", "right"]))
        return p


# --- drawing ------------------------------------------------------------------------------------------------

def _rotate(pts, deg):
    a = math.radians(deg)
    return [[round(x * math.cos(a) - y * math.sin(a), 6), round(x * math.sin(a) + y * math.cos(a), 6)] for x, y in pts]


def _draw_line(p: dict):
    k = len(p["lines"])
    fig, ax = new_figure(2.9 * k, 3.6)
    for i, j in enumerate(p["lines"]):
        kind, seg, _ = LINES[j]
        cx = 3.2 * i
        pts = [[x + cx, y] for x, y in outline(kind)]
        ax.add_patch(Polygon(pts, closed=True, facecolor=SHADE, edgecolor=INK, linewidth=2.2, gid=f"behind-shape:{i}"))
        ax.plot([seg[0][0] + cx, seg[1][0] + cx], [seg[0][1], seg[1][1]], color="#c0392b", linewidth=2.0,
                linestyle=(0, (5, 3)), gid=f"behind-line:{i}")
        ax.text(cx, -1.75, LETTERS[i], ha="center", va="center", fontsize=16, fontweight="bold", gid=f"letter:{LETTERS[i]}")
    ax.set_xlim(-1.7, 3.2 * (k - 1) + 1.7)
    ax.set_ylim(-2.1, 1.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_count(p: dict):
    fig, ax = new_figure(4.0, 3.6)
    pts = _rotate(outline(p["shape"], 1.2), p["turn"])
    ax.add_patch(Polygon(pts, closed=True, facecolor=SHADE, edgecolor=INK, linewidth=2.4, gid="behind-shape"))
    ax.set_xlim(-1.75, 1.75)
    ax.set_ylim(-1.55, 1.55)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def complete_cells(p: dict):
    """The shaded squares and the lettered squares as (column, row) on the whole grid, the mirror after column `cols`."""
    cols = p["cols"]
    near = (lambda c: cols - 1 - c) if p["side"] == "left" else (lambda c: cols + c)
    far = (lambda c: cols + c) if p["side"] == "left" else (lambda c: cols - 1 - c)
    shaded = [[near(c), r] for c, r in p["left"]]
    shaded += [[far(c), r] for c, r in p["left"] if [c, r] != p["missing"]]
    lettered = [[far(c), r] for c, r in [p["missing"]] + p["others"]]
    return shaded, dict(zip(p["letters"], lettered))


def _draw_complete(p: dict):
    cols, rows = p["cols"], p["rows"]
    fig, ax = new_figure(0.75 * 2 * cols + 1.0, 0.75 * rows + 1.0)
    shaded, lettered = complete_cells(p)
    for c in range(2 * cols):
        for r in range(rows):
            on = [c, r] in shaded
            ax.add_patch(Rectangle((c, r), 1, 1, facecolor=FILL if on else "white", edgecolor="#777777", linewidth=1.0,
                                   gid=f"behind-cell:{c}:{r}:{'on' if on else 'off'}"))
    for letter, (c, r) in lettered.items():
        ax.text(c + 0.5, r + 0.5, letter, ha="center", va="center", fontsize=14, fontweight="bold", gid=f"letter:{letter}")
    ax.plot([cols, cols], [-0.3, rows + 0.3], color="#c0392b", linewidth=2.4, linestyle=(0, (6, 3)), gid="behind-mirror")
    ax.text(cols, rows + 0.55, "mirror line", ha="center", va="center", fontsize=11, gid="mirror")
    ax.set_xlim(-0.3, 2 * cols + 0.3)
    ax.set_ylim(-0.4, rows + 0.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"line": _draw_line, "count": _draw_count, "complete": _draw_complete}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def questions(p: dict, rng: random.Random) -> list:
    sub, name = p["sub"], p["name"]
    if sub == "line":
        letters = LETTERS[:len(p["lines"])]
        key = next(L for L, j in zip(letters, p["lines"]) if LINES[j][2])
        lead = rng.choice(LINE_LEADS).format(n=name)
        return [mcq(f"{lead} Which shape has a line of symmetry drawn on it?", f"Shape {key}",
                    [f"Shape {L}" for L in letters if L != key], rng)]
    if sub == "count":
        lead = rng.choice(COUNT_LEADS).format(n=name)
        n = COUNT_SHAPES[p["shape"]]
        return [count(f"{lead} How many lines of symmetry does the shape have?", n, "lines", "lines of symmetry")]
    lead = rng.choice(COMPLETE_LEADS).format(n=name)
    key = p["letters"][0]
    return [mcq(f"{lead} Which lettered square must be shaded to make the pattern symmetrical?", key,
                [L for L in p["letters"] if L != key], rng)]
