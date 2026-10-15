"""Position words (P, Stage 1 to 2): a picture grid of familiar things (a ball, a cup, a goat, a book ...), two or three
rows of three or four, each thing a simple picture with its name under it, as Cambridge Stage 1 "Position" and Rwanda
P1 "Directions, location of objects" and P2 "Grid" teach it.

- What is just to the left (right) of a thing? "Left" is the reader's left, and the stem says so. "Just to the left"
  is the next square along in the same row, touching it. The wrong options are the thing just to its right (a child's
  own left and right mixed up), and the things just above and below it.
- What is just above (below) a thing? The next square up (down) in the same column.
- What is between two things? Three squares in a line, touching, with the middle one asked.
- What is in row 2, column 3? Only where the rows and columns are numbered on the figure (row 1 at the top).
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, Polygon, Rectangle, Wedge

from ..core import FILL, FILL_2, GRID, INK, NAMES, mcq, new_figure

ID = "position_p"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.position", "mathematics.position-and-direction", "mathematics.position-direction-patterns",
            "mathematics.grid")
# A topic whose sections the book lists is reached only if its name or a section names position, direction or a grid.
NEEDS = r"position|direction|location|\bgrid\b"
# Shapes and angles, time and measures share the broad "position and direction" concept; they teach none of this.
AVOID = r"square|rectangle|triangle|angle|shape|geometry|\bday|week|time|measur|length|number|fraction|money"

THINGS = ["ball", "cup", "goat", "book", "hen", "drum", "chair", "hat", "banana", "fish", "car", "bag"]
LEADS = ["{n} looks at the picture.", "{n} drew these things in a grid.", "{n} plays a game with this picture.",
         "{n} talks about this picture with a friend.", "{n} puts these things in rows.", "{n} reads this picture."]


def stages(p: dict) -> tuple[int, int] | None:
    return (1, 2)


def sample(rng: random.Random) -> dict:
    rows, cols = rng.choice([(2, 3), (2, 4), (3, 3), (3, 4), (3, 4)])
    things = rng.sample(THINGS, rows * cols)
    grid = [things[r * cols:(r + 1) * cols] for r in range(rows)]
    return {"band": "P", "name": rng.choice(NAMES), "rows": rows, "cols": cols, "grid": grid,
            "labels": rng.random() < 0.5}


# --- drawing ----------------------------------------------------------------------------------------

def _icon(ax, kind: str, cx: float, cy: float) -> None:
    """A simple picture of a thing, about 0.56 wide, centred at (cx, cy)."""
    lw = 1.4
    if kind == "ball":
        ax.add_patch(Circle((cx, cy), 0.25, facecolor="white", edgecolor=INK, linewidth=lw))
        ax.add_patch(Wedge((cx, cy), 0.25, 30, 150, facecolor=FILL, edgecolor=INK, linewidth=lw))
        ax.add_patch(Wedge((cx, cy), 0.25, 210, 330, facecolor=FILL, edgecolor=INK, linewidth=lw))
    elif kind == "cup":  # the handle first, so the cup's side covers its ends and it joins the cup
        ax.add_patch(Wedge((cx + 0.1, cy + 0.02), 0.15, -70, 70, width=0.045, facecolor=INK, edgecolor=INK, linewidth=0.8))
        ax.add_patch(Polygon([(cx - 0.2, cy + 0.2), (cx + 0.16, cy + 0.2), (cx + 0.11, cy - 0.2), (cx - 0.15, cy - 0.2)],
                             closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=lw))
    elif kind == "goat":
        ax.add_patch(Ellipse((cx - 0.02, cy - 0.02), 0.4, 0.22, facecolor="white", edgecolor=INK, linewidth=lw))
        for dx in (-0.14, -0.06, 0.06, 0.12):
            ax.plot([cx + dx, cx + dx], [cy - 0.1, cy - 0.26], color=INK, linewidth=1.6)
        ax.add_patch(Ellipse((cx + 0.22, cy + 0.12), 0.15, 0.12, facecolor="white", edgecolor=INK, linewidth=lw))
        ax.plot([cx + 0.2, cx + 0.15, cx + 0.12], [cy + 0.17, cy + 0.25, cy + 0.27], color=INK, linewidth=1.4)
        ax.plot([cx - 0.22, cx - 0.28], [cy + 0.02, cy + 0.08], color=INK, linewidth=1.4)
    elif kind == "book":
        ax.add_patch(Polygon([(cx - 0.26, cy - 0.16), (cx, cy - 0.2), (cx, cy + 0.18), (cx - 0.26, cy + 0.22)],
                             closed=True, facecolor="white", edgecolor=INK, linewidth=lw))
        ax.add_patch(Polygon([(cx, cy - 0.2), (cx + 0.26, cy - 0.16), (cx + 0.26, cy + 0.22), (cx, cy + 0.18)],
                             closed=True, facecolor="white", edgecolor=INK, linewidth=lw))
        for k in (0.0, 0.08, -0.08):
            ax.plot([cx - 0.2, cx - 0.06], [cy + k, cy + k - 0.01], color=GRID, linewidth=1.0)
            ax.plot([cx + 0.06, cx + 0.2], [cy + k - 0.01, cy + k], color=GRID, linewidth=1.0)
    elif kind == "hen":
        ax.add_patch(Ellipse((cx - 0.02, cy - 0.04), 0.36, 0.28, facecolor="white", edgecolor=INK, linewidth=lw))
        ax.add_patch(Circle((cx + 0.16, cy + 0.14), 0.09, facecolor="white", edgecolor=INK, linewidth=lw))
        ax.add_patch(Polygon([(cx + 0.24, cy + 0.16), (cx + 0.32, cy + 0.12), (cx + 0.24, cy + 0.1)], closed=True,
                             facecolor=FILL, edgecolor=INK, linewidth=1.0))
        ax.add_patch(Polygon([(cx + 0.12, cy + 0.22), (cx + 0.16, cy + 0.28), (cx + 0.2, cy + 0.22)], closed=True,
                             facecolor="#d32f2f", edgecolor=INK, linewidth=0.8))
        for dx in (-0.06, 0.04):
            ax.plot([cx + dx, cx + dx], [cy - 0.17, cy - 0.27], color=INK, linewidth=1.4)
    elif kind == "drum":
        ax.add_patch(Rectangle((cx - 0.2, cy - 0.18), 0.4, 0.32, facecolor=FILL_2, edgecolor=INK, linewidth=lw))
        ax.add_patch(Ellipse((cx, cy + 0.14), 0.4, 0.12, facecolor="white", edgecolor=INK, linewidth=lw))
        ax.plot([cx - 0.2, cx - 0.07, cx + 0.07, cx + 0.2], [cy + 0.1, cy - 0.16, cy + 0.08, cy - 0.16], color=INK,
                linewidth=1.0)
    elif kind == "chair":
        ax.plot([cx - 0.14, cx - 0.14], [cy - 0.26, cy + 0.26], color=INK, linewidth=2.2)
        ax.plot([cx - 0.14, cx + 0.16], [cy - 0.02, cy - 0.02], color=INK, linewidth=2.6)
        ax.plot([cx + 0.16, cx + 0.16], [cy - 0.02, cy - 0.26], color=INK, linewidth=2.2)
    elif kind == "hat":
        ax.add_patch(Ellipse((cx, cy - 0.1), 0.56, 0.12, facecolor=FILL, edgecolor=INK, linewidth=lw))
        ax.add_patch(Polygon([(cx - 0.16, cy - 0.08), (cx - 0.13, cy + 0.18), (cx + 0.13, cy + 0.18), (cx + 0.16, cy - 0.08)],
                             closed=True, facecolor=FILL, edgecolor=INK, linewidth=lw))
    elif kind == "banana":
        ax.add_patch(Wedge((cx, cy + 0.22), 0.4, 225, 315, width=0.13, facecolor="#f2d64b", edgecolor=INK,
                           linewidth=lw))
    elif kind == "fish":
        ax.add_patch(Ellipse((cx - 0.04, cy), 0.4, 0.22, facecolor=FILL_2, edgecolor=INK, linewidth=lw))
        ax.add_patch(Polygon([(cx + 0.15, cy), (cx + 0.28, cy + 0.12), (cx + 0.28, cy - 0.12)], closed=True,
                             facecolor=FILL_2, edgecolor=INK, linewidth=lw))
        ax.add_patch(Circle((cx - 0.15, cy + 0.03), 0.025, color=INK))
    elif kind == "car":
        ax.add_patch(Polygon([(cx - 0.28, cy - 0.1), (cx + 0.28, cy - 0.1), (cx + 0.28, cy + 0.04), (cx + 0.14, cy + 0.06),
                              (cx + 0.08, cy + 0.18), (cx - 0.14, cy + 0.18), (cx - 0.2, cy + 0.06), (cx - 0.28, cy + 0.04)],
                             closed=True, facecolor=FILL, edgecolor=INK, linewidth=lw))
        for dx in (-0.16, 0.16):
            ax.add_patch(Circle((cx + dx, cy - 0.12), 0.07, facecolor="white", edgecolor=INK, linewidth=lw))
    else:  # a bag
        ax.add_patch(Rectangle((cx - 0.2, cy - 0.22), 0.4, 0.32, facecolor=FILL_2, edgecolor=INK, linewidth=lw))
        ax.add_patch(Wedge((cx, cy + 0.1), 0.12, 0, 180, width=0.035, facecolor=INK, edgecolor=INK, linewidth=0.8))


def draw(p: dict):
    rows, cols, grid = p["rows"], p["cols"], p["grid"]
    left = 1.05 if p["labels"] else 0.1
    top = 0.6 if p["labels"] else 0.1
    fig, ax = new_figure(1.55 * (cols + left) + 0.4, 1.55 * (rows + top) + 0.3)
    for r in range(rows):
        for c in range(cols):
            x0, y0 = c, rows - 1 - r
            ax.add_patch(Rectangle((x0, y0), 1, 1, facecolor="#fbfaf4", edgecolor=INK, linewidth=1.2))
            _icon(ax, grid[r][c], x0 + 0.5, y0 + 0.6)
            ax.text(x0 + 0.5, y0 + 0.15, grid[r][c], ha="center", va="center", fontsize=13, gid=f"object:{grid[r][c]}")
    if p["labels"]:
        for r in range(rows):
            ax.text(-0.12, rows - 1 - r + 0.5, f"row {r + 1}", ha="right", va="center", fontsize=12, fontweight="bold",
                    gid=f"row:{r + 1}")
        for c in range(cols):
            ax.text(c + 0.5, rows + 0.22, f"column {c + 1}", ha="center", va="center", fontsize=11, fontweight="bold",
                    gid=f"col:{c + 1}")
    ax.set_xlim(-left, cols + 0.05)
    ax.set_ylim(-0.05, rows + top)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

def _at(grid, r: int, c: int) -> str | None:
    if 0 <= r < len(grid) and 0 <= c < len(grid[0]):
        return grid[r][c]
    return None


def _opts(key: str, first: list, grid, rng: random.Random) -> list[str]:
    """The wrong options: the slips first (the other way, the next square the other way), then any other things."""
    seen = [x for x in first if x and x != key]
    rest = [x for row in grid for x in row if x != key and x not in seen]
    rng.shuffle(rest)
    out = []
    for x in seen + rest:
        if x not in out:
            out.append(x)
    return [f"the {x}" for x in out]


def questions(p: dict, rng: random.Random) -> list:
    grid, rows, cols = p["grid"], p["rows"], p["cols"]
    qs = []
    # 1. just to the left or right, as the reader looks: a thing with a square on each side
    way = rng.choice(["left", "right"])
    r, c = rng.randrange(rows), rng.randrange(1, cols - 1)
    step = -1 if way == "left" else 1
    key = grid[r][c + step]
    qs.append(mcq(f"{way.capitalize()} means your {way} as you look. What is just to the {way} of the {grid[r][c]}?",
                  f"the {key}", _opts(key, [_at(grid, r, c - step), _at(grid, r - 1, c), _at(grid, r + 1, c)], grid, rng),
                  rng))
    # 2. just above or below
    if rows == 3:
        r, way = 1, rng.choice(["above", "below"])
    else:
        way = rng.choice(["above", "below"])
        r = 1 if way == "above" else 0
    c = rng.randrange(cols)
    step = -1 if way == "above" else 1
    key = grid[r + step][c]
    qs.append(mcq(f"What is just {way} the {grid[r][c]}?", f"the {key}",
                  _opts(key, [_at(grid, r - step, c), _at(grid, r, c - 1), _at(grid, r, c + 1)], grid, rng), rng))
    # 3. between two things: three squares in a line
    lines = [((r, c), (r, c + 1), (r, c + 2)) for r in range(rows) for c in range(cols - 2)]
    if rows == 3:
        lines += [((0, c), (1, c), (2, c)) for c in range(cols)]
    a, (mr, mc), b = rng.choice(lines)
    if rng.random() < 0.5:
        a, b = b, a
    key = grid[mr][mc]
    across = a[0] == mr  # along a row: the slips are above and below the middle; down a column, beside it
    near = ([_at(grid, mr - 1, mc), _at(grid, mr + 1, mc)] if across else [_at(grid, mr, mc - 1), _at(grid, mr, mc + 1)])
    qs.append(mcq(f"What is between the {grid[a[0]][a[1]]} and the {grid[b[0]][b[1]]}?", f"the {key}",
                  _opts(key, near, grid, rng), rng))
    # 4. a numbered row and column, where the figure numbers them
    if p["labels"]:
        r, c = rng.randrange(rows), rng.randrange(cols)
        key = grid[r][c]
        swapped = _at(grid, c, r) if c < rows and r < cols else None
        qs.append(mcq(f"What is in row {r + 1}, column {c + 1}?", f"the {key}",
                      _opts(key, [swapped, _at(grid, r, c + 1), _at(grid, r + 1, c), _at(grid, r, c - 1)], grid, rng),
                      rng))
    rng.shuffle(qs)
    lead = rng.choice(LEADS).format(n=p["name"])
    qs[0].stem = f"{lead} {qs[0].stem}"
    return qs
