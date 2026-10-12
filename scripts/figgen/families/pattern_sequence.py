"""The first three patterns of a growing sequence: matchsticks, dots or chairs round tables.

`pieces(p, n)` lists what pattern n puts down -- each matchstick as its two ends, each dot or
chair as its place -- and the drawing draws exactly those, so the rule an + c is checked
against the geometry, not just asserted.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Rectangle

from ..core import count, FILL, INK, NAMES, mcq, new_figure, short

ID = "pattern_sequence"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("P", "LS")
# Eleven kinds of pattern, three sizes to start from, two levels: 66 different figures in all.
MIN_VARIETY = 30
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "sequences-simple", "investigating-patterns", "sequences-arithmetic-general-term", "expressions-sequences-equivalent",
    "sequences-functions", "numbers-and-sequences", "sequences-whole-numbers-fractions-decimals",
))

# kind: (what is counted, pieces per unit a, pieces in a pattern of size 0)
KINDS = {"squares": ("matchsticks", 3, 1), "triangles": ("matchsticks", 2, 1), "houses": ("matchsticks", 5, 1),
         "hexagons": ("matchsticks", 5, 1), "two_rows": ("matchsticks", 5, 2),
         "dots_L": ("dots", 2, 1), "dots_T": ("dots", 3, 1), "dots_cross": ("dots", 4, 1), "dots_rect": ("dots", 2, 2),
         "dots_square": ("dots", 4, 0), "tables": ("chairs", 2, 2)}
W3 = 3 ** 0.5  # the width of a hexagon of side 1, flat side to flat side
H = 0.866  # height of an equilateral triangle of side 1


def expression(a: int, c: int) -> str:
    return f"{a}n" if c == 0 else f"{a}n + {c}" if c > 0 else f"{a}n - {-c}"


def stages(p: dict) -> tuple[int, int] | None:
    """Growing patterns to a far term: Stage 3 on."""
    return (3, 6) if p["band"] == "P" else None


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = rng.choice(sorted(KINDS))
    start = rng.choice([1, 1, 2, 3])  # pattern 1 has this many units
    items, a, c0 = KINDS[kind]
    return {"band": band, "name": rng.choice(NAMES), "kind": kind, "start": start, "items": items,
            "a": a, "c": a * (start - 1) + c0}


def _seg(p0, p1) -> tuple:
    return tuple(sorted((tuple(round(v, 3) for v in p0), tuple(round(v, 3) for v in p1))))


def pieces(p: dict, n: int) -> list:
    """Every matchstick (as its two ends) or dot (as its place) in pattern n, shared ones once each time drawn."""
    m = n + p["start"] - 1
    k = p["kind"]
    out = []
    if k in ("squares", "houses"):
        for i in range(m):
            out += [_seg((i, 0), (i + 1, 0)), _seg((i, 1), (i + 1, 1))]
            if k == "houses":
                out += [_seg((i, 1), (i + 0.5, 1.6)), _seg((i + 0.5, 1.6), (i + 1, 1))]
        out += [_seg((x, 0), (x, 1)) for x in range(m + 1)]
    elif k == "hexagons":
        # A row of hexagons, pointed at top and bottom, each sharing an upright side with the next.
        for i in range(m):
            cx = i * W3
            corners = [(cx + 0.5 * W3 * dx, dy) for dx, dy in ((-1, -0.5), (0, -1), (1, -0.5), (1, 0.5), (0, 1), (-1, 0.5))]
            out += [_seg(corners[j], corners[(j + 1) % 6]) for j in range(6)]
    elif k == "two_rows":
        # Two rows of m squares.
        for i in range(m):
            out += [_seg((i, y), (i + 1, y)) for y in (0, 1, 2)]
        out += [_seg((x, y), (x, y + 1)) for x in range(m + 1) for y in (0, 1)]
    elif k == "triangles":
        for i in range(m):
            j = i // 2
            tri = [(j, 0), (j + 1, 0), (j + 0.5, H)] if i % 2 == 0 else [(j + 0.5, H), (j + 1.5, H), (j + 1, 0)]
            out += [_seg(tri[0], tri[1]), _seg(tri[1], tri[2]), _seg(tri[2], tri[0])]
    elif k == "dots_L":
        out = [(0, y) for y in range(m + 1)] + [(x, 0) for x in range(1, m + 1)]
    elif k == "dots_T":
        out = [(x, m) for x in range(-m, m + 1)] + [(0, y) for y in range(m)]
    elif k == "dots_rect":
        out = [(x, y) for x in range(m + 1) for y in (0, 1)]
    elif k == "dots_square":
        out = [(x, y) for x in range(m + 1) for y in range(m + 1) if x in (0, m) or y in (0, m)]
    elif k == "dots_cross":
        out = [(0, 0)] + [(d * s, 0) for s in range(1, m + 1) for d in (-1, 1)] + [(0, d * s) for s in range(1, m + 1) for d in (-1, 1)]
    elif k == "tables":
        out = [("chair", i + 0.5, y) for i in range(m) for y in (-0.55, 1.55)] + [("chair", -0.55, 0.5), ("chair", m + 0.55, 0.5)]
    return out


def _extent(p: dict, n: int) -> tuple[float, float, float, float]:
    m = n + p["start"] - 1
    k = p["kind"]
    if k == "dots_T":
        return -m, m, 0, m
    if k == "dots_cross":
        return -m, m, -m, m
    if k == "tables":
        return -0.8, m + 0.8, -0.8, 1.8
    if k == "hexagons":
        return -0.5 * W3, (m - 0.5) * W3, -1, 1
    if k == "two_rows":
        return 0, m, 0, 2
    if k == "dots_rect":
        return 0, m, 0, 1
    if k in ("dots_square", "dots_L"):  # the L stands as tall as it is long
        return 0, m, 0, m
    if k == "triangles":
        return 0, (m + 1) / 2, 0, H
    return 0, m, 0, 1.6 if k == "houses" else 1


def draw(p: dict):
    spans = [_extent(p, n) for n in (1, 2, 3)]
    # Well apart, so no dot or stick could be read as part of the next pattern.
    gap = 2.6 if p["items"] == "dots" else 1.8
    width = sum(x1 - x0 for x0, x1, _, _ in spans) + gap * 2
    top = max(y1 for *_, y1 in spans)
    bottom = min(y0 for _, _, y0, _ in spans)
    fig, ax = new_figure(min(9.5, 1.6 + 0.7 * width), 1.4 + 0.6 * (top - bottom))
    x = 0.0
    for n, (x0, x1, y0, y1) in zip((1, 2, 3), spans):
        dx = x - x0
        for piece in pieces(p, n):
            if p["kind"] == "tables" and piece[0] == "chair":
                ax.add_patch(Circle((piece[1] + dx, piece[2]), 0.2, facecolor=FILL, edgecolor=INK, linewidth=1))
            elif isinstance(piece[0], tuple):
                (ax0, ay0), (ax1, ay1) = piece
                ax.plot([ax0 + dx, ax1 + dx], [ay0, ay1], color=INK, linewidth=2.2, solid_capstyle="round")
            else:
                ax.add_patch(Circle((piece[0] + dx, piece[1]), 0.16, facecolor=INK, edgecolor=INK))
        if p["kind"] == "tables":
            m = n + p["start"] - 1
            for i in range(m):
                ax.add_patch(Rectangle((i + dx, 0), 1, 1, facecolor="white", edgecolor=INK, linewidth=1.4))
        ax.text((x0 + x1) / 2 + dx, bottom - 0.7, f"Pattern {n}", ha="center", va="top", fontsize=11)
        x += (x1 - x0) + gap
    ax.set_xlim(-0.6, x - gap + 0.6)
    ax.set_ylim(bottom - 1.3, top + 0.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    a, c, name, items = p["a"], p["c"], p["name"], p["items"]
    near = rng.choice([4, 5, 6])
    far = rng.choice([10, 12, 15, 20] if p["band"] == "P" else [20, 25, 50, 100])
    qs = [
        count(f"{name} makes these patterns with {items}. How many {items} are in pattern {near}?", a * near + c, items),
        count(f"{name} keeps going. How many {items} are in pattern {far}?", a * far + c, items),
    ]
    if p["band"] == "LS":
        # Wrong rules: the difference as the constant, the first pattern times n, one out at the start.
        wrong = [f"n + {a}", f"{a + c}n", expression(a, c + a), expression(a, c - 1)]
        qs.append(mcq(f"Which expression gives the number of {items} in pattern n of {name}'s sequence?", expression(a, c), wrong, rng))
    return qs
