"""Halves and quarters (P, Stage 1 to 2), as Cambridge Stage 1 "Fractions" ("Halves"), Rwanda P1 "Fractions", P2
"Fractions 1/2, 1/4 and 1/8" and NERDC Primary 1 "Fractions and decimals" teach them: a shape cut into equal parts,
one part coloured; half or a quarter of a set of things.

Three kinds of figure, big and plain:
- shapes: three or four shapes lettered P to S, each cut into two or four parts, one or more coloured; exactly one
  shows one half (or one quarter) coloured, the others unequal parts or another fraction. Which shape has one half
  coloured? How many shapes are cut into equal parts?
- one: one shape cut into 2, 4 or 8 equal parts (8 from Stage 2), 1 part (or 3 of 4) coloured. What fraction is
  coloured, in words: one half, one quarter, three quarters, one eighth.
- set: a set of mangoes, eggs or oranges. Half (or a quarter) of them are given away: how many is that? How many are
  there?
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, Polygon

from ..core import FILL, INK, NAMES, count, mcq, new_figure, short

ID = "halves_p"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.fractions", "mathematics.fractions-of-numbers", "mathematics.doubling-halving",
            "mathematics.fractions-exploring-models", "mathematics.fractions-denominator",
            "mathematics.fractions-equivalent-shading")
# A topic whose sections the book lists is reached only if its name or a section is about fractions.
NEEDS = r"fraction|half|halves|quarter"
AVOID = r"multiplication|division|money|currenc|time|measure|percent"

SHADE = "#f0a04b"
LETTERS = "PQRS"
# (outline, number of parts, cut, equal?)
EQUAL_2 = [("rect", 2, "v"), ("rect", 2, "h"), ("square", 2, "v"), ("square", 2, "d"), ("circle", 2, "d")]
EQUAL_4 = [("square", 4, "cross"), ("rect", 4, "strips"), ("circle", 4, "cross"), ("square", 4, "diag")]
UNEQUAL_2 = [("rect", 2, "off"), ("square", 2, "off"), ("circle", 2, "chord")]
UNEQUAL_4 = [("rect", 4, "uneven"), ("square", 4, "offcross")]
EQUAL_8 = [("rect", 8, "strips"), ("circle", 8, "cross"), ("square", 8, "grid")]
THINGS = {"mangoes": ("#f6b26b", "circle"), "eggs": ("#f7f0dc", "egg"), "oranges": ("#f39c12", "circle"),
          "tomatoes": ("#e74c3c", "circle")}
WORDS = {(1, 2): "one half", (1, 4): "one quarter", (3, 4): "three quarters", (1, 8): "one eighth"}
SHAPE_LEADS = ["{n} colours part of each shape.", "{n} cuts some shapes and colours part of each.",
               "{n} colours a part of each shape.", "{n} draws some shapes and colours part of each one."]
ONE_LEADS = ["{n} cuts a shape into equal parts and colours some.", "{n} colours part of a shape.",
             "{n} folds a shape into equal parts and colours some of them.", "{n} shades part of a shape."]
SET_LEADS = ["{n} has some {t}.", "{n} buys some {t}.", "{n} picks some {t}.", "{n} has a basket of {t}."]


def stages(p: dict) -> tuple[int, int]:
    """Eighths come in Stage 2 (Rwanda P2); halves and quarters from Stage 1."""
    return (2, 2) if p["sub"] == "one" and p["n"] == 8 else (1, 2)


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["sub"] == "set":
        return ("mathematics.fractions", "mathematics.fractions-of-numbers", "mathematics.doubling-halving")
    return ("mathematics.fractions", "mathematics.fractions-exploring-models", "mathematics.fractions-denominator",
            "mathematics.fractions-equivalent-shading")


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["shapes", "shapes", "one", "set"])
    p = {"band": "P", "sub": sub, "name": rng.choice(NAMES)}
    if sub == "shapes":
        ask = rng.choice(["half", "quarter"])
        k = rng.choice([3, 4])
        if ask == "half":
            key = [*rng.choice(EQUAL_2), 1]
            pool = [[*s, 1] for s in UNEQUAL_2 + EQUAL_4 + UNEQUAL_4] + [[*s, 3] for s in EQUAL_4]
        else:
            key = [*rng.choice(EQUAL_4), 1]
            pool = [[*s, 1] for s in UNEQUAL_4 + EQUAL_2 + UNEQUAL_2] + [[*s, 3] for s in EQUAL_4] + \
                   [[*s, 2] for s in EQUAL_4]
        rest = rng.sample(pool, k - 1)
        shapes = rest[:]
        shapes.insert(rng.randrange(k), key)
        p.update(ask=ask, shapes=shapes)
        return p
    if sub == "one":
        n = rng.choice([2, 4, 4, 8])
        shape = rng.choice({2: EQUAL_2, 4: EQUAL_4, 8: EQUAL_8}[n])
        k = 3 if n == 4 and rng.random() < 0.4 else 1
        start = rng.randrange(n)
        p.update(shape=list(shape), n=n, k=k, start=start)
        return p
    part = rng.choice([2, 2, 4])
    total = part * rng.randint(1 if part == 4 else 2, 5 if part == 4 else 9)
    p.update(thing=rng.choice(sorted(THINGS)), part=part, total=total)
    return p


# --- the parts of a shape -----------------------------------------------------------------------------------

def _circle_pts(cx, cy, r, a0, a1, n=60):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + 1)]


def parts(outline: str, n: int, cut: str, cx: float, cy: float, s: float = 1.0) -> list[list[tuple[float, float]]]:
    """The parts of a shape centred at (cx, cy), each a polygon. A square has side 2s, a rectangle 2.8s by 1.6s, a
    circle radius s."""
    if outline == "circle":
        if cut == "chord":  # a cut off the middle: two plainly unequal parts
            d = 0.42 * s
            a = math.degrees(math.acos(d / s))
            small = _circle_pts(cx, cy, s, -a, a)
            big = _circle_pts(cx, cy, s, a, 360 - a)
            return [small, big]
        step = 360 / n
        off = 90 if n == 2 else 45 if n == 4 else 0
        return [[(cx, cy)] + _circle_pts(cx, cy, s, off + i * step, off + (i + 1) * step) for i in range(n)]
    w, h = (2.0 * s, 2.0 * s) if outline == "square" else (2.8 * s, 1.6 * s)
    x0, y0 = cx - w / 2, cy - h / 2

    def strips(fracs, vertical=True):
        out, at = [], 0.0
        for f in fracs:
            if vertical:
                out.append([(x0 + at * w, y0), (x0 + (at + f) * w, y0), (x0 + (at + f) * w, y0 + h), (x0 + at * w, y0 + h)])
            else:
                out.append([(x0, y0 + at * h), (x0 + w, y0 + at * h), (x0 + w, y0 + (at + f) * h), (x0, y0 + (at + f) * h)])
            at += f
        return out

    def cross(fx, fy):
        xm, ym = x0 + fx * w, y0 + fy * h
        return [[(x0, ym), (xm, ym), (xm, y0 + h), (x0, y0 + h)], [(xm, ym), (x0 + w, ym), (x0 + w, y0 + h), (xm, y0 + h)],
                [(xm, y0), (x0 + w, y0), (x0 + w, ym), (xm, ym)], [(x0, y0), (xm, y0), (xm, ym), (x0, ym)]]

    if n == 2:
        if cut == "v":
            return strips([0.5, 0.5])
        if cut == "h":
            return strips([0.5, 0.5], vertical=False)
        if cut == "d":
            return [[(x0, y0), (x0 + w, y0), (x0 + w, y0 + h)], [(x0, y0), (x0 + w, y0 + h), (x0, y0 + h)]]
        return strips([0.28, 0.72])  # "off"
    if n == 4:
        if cut == "cross":
            return cross(0.5, 0.5)
        if cut == "strips":
            return strips([0.25] * 4)
        if cut == "diag":
            c = (cx, cy)
            return [[(x0, y0), (x0 + w, y0), c], [(x0 + w, y0), (x0 + w, y0 + h), c], [(x0 + w, y0 + h), (x0, y0 + h), c],
                    [(x0, y0 + h), (x0, y0), c]]
        if cut == "uneven":
            return strips([0.12, 0.2, 0.3, 0.38])
        return cross(0.3, 0.68)  # "offcross"
    if cut == "grid":  # two rows of four
        return [[(x0 + c * w / 4, y0 + r * h / 2), (x0 + (c + 1) * w / 4, y0 + r * h / 2),
                 (x0 + (c + 1) * w / 4, y0 + (r + 1) * h / 2), (x0 + c * w / 4, y0 + (r + 1) * h / 2)]
                for r in (0, 1) for c in range(4)]
    return strips([0.125] * 8)


def equal(shape) -> bool:
    return shape[2] not in ("off", "chord", "uneven", "offcross")


# --- drawing ------------------------------------------------------------------------------------------------

def _shape(ax, shape, shaded: set, cx: float, cy: float, gid: str) -> None:
    for i, poly in enumerate(parts(shape[0], shape[1], shape[2], cx, cy)):
        ax.add_patch(Polygon(poly, closed=True, facecolor=SHADE if i in shaded else "white", edgecolor=INK,
                             linewidth=2.2, joinstyle="round", gid=f"{gid}:part:{i}:{'on' if i in shaded else 'off'}"))


def _draw_shapes(p: dict):
    k = len(p["shapes"])
    fig, ax = new_figure(3.0 * k, 3.4)
    for i, (outline, n, cut, on) in enumerate(p["shapes"]):
        cx = 3.4 * i
        shaded = set(range(on)) if cut not in ("chord", "off") else {0}
        _shape(ax, (outline, n, cut), shaded, cx, 0.0, f"shape:{LETTERS[i]}")
        ax.text(cx, -1.55, LETTERS[i], ha="center", va="center", fontsize=16, fontweight="bold", gid=f"letter:{LETTERS[i]}")
    ax.set_xlim(-1.7, 3.4 * (k - 1) + 1.7)
    ax.set_ylim(-1.95, 1.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_one(p: dict):
    fig, ax = new_figure(4.0, 3.2)
    outline, n, cut = p["shape"]
    shaded = {(p["start"] + j) % n for j in range(p["k"])}
    _shape(ax, (outline, n, cut), shaded, 0.0, 0.0, "shape")
    ax.set_xlim(-1.6, 1.6)
    ax.set_ylim(-1.15, 1.15)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _thing(ax, kind: str, x: float, y: float, gid: str) -> None:
    face, form = THINGS[kind]
    if form == "egg":
        ax.add_patch(Ellipse((x, y), 0.48, 0.62, facecolor=face, edgecolor=INK, linewidth=1.4, gid=gid))
        return
    ax.add_patch(Circle((x, y), 0.29, facecolor=face, edgecolor=INK, linewidth=1.4, gid=gid))
    if kind == "mangoes":
        ax.add_patch(Ellipse((x + 0.1, y + 0.32), 0.22, 0.1, angle=25, facecolor="#5a9e4b", edgecolor=INK, linewidth=0.8,
                             gid=gid + ":leaf"))
    elif kind == "tomatoes":
        ax.plot([x - 0.08, x, x + 0.08], [y + 0.3, y + 0.24, y + 0.3], color="#2e7d32", linewidth=2, gid=gid + ":stalk")


def _draw_set(p: dict):
    t = p["total"]
    cols = min(t, 5 if t <= 10 else 6 if t <= 12 else 9)
    rows = math.ceil(t / cols)
    fig, ax = new_figure(max(3.6, 0.8 * cols + 0.8), 0.8 * rows + 1.0)
    for i in range(t):
        r, c = divmod(i, cols)
        _thing(ax, p["thing"], 0.4 + 0.8 * c, -0.8 * r, f"thing:{i}")
    ax.set_xlim(-0.1, 0.8 * cols)
    ax.set_ylim(-0.8 * (rows - 1) - 0.5, 0.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"shapes": _draw_shapes, "one": _draw_one, "set": _draw_set}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def shows(shape) -> tuple[int, int] | None:
    """The fraction a lettered shape shows coloured, or None when its parts are not equal."""
    outline, n, cut, on = shape
    if not equal(shape):
        return None
    g = math.gcd(on, n)
    return on // g, n // g


def questions(p: dict, rng: random.Random) -> list:
    name, sub = p["name"], p["sub"]
    if sub == "shapes":
        want = (1, 2) if p["ask"] == "half" else (1, 4)
        letters = LETTERS[:len(p["shapes"])]
        key = next(L for L, s in zip(letters, p["shapes"]) if equal(s) and s[3] == want[0] and s[1] == want[1])
        lead = rng.choice(SHAPE_LEADS).format(n=name)
        q1 = mcq(f"{lead} Which shape has one {p['ask']} coloured?", f"Shape {key}",
                 [f"Shape {L}" for L in letters if L != key], rng)
        n_equal = sum(1 for s in p["shapes"] if equal(s))
        q2 = count("How many of the shapes are cut into equal parts?", n_equal, "shapes")
        return [q1, q2]
    if sub == "one":
        n, k = p["n"], p["k"]
        key = WORDS[(k, n)]
        lead = rng.choice(ONE_LEADS).format(n=name)
        opts = ["one half", "one quarter", "three quarters"] + (["one eighth"] if n == 8 else [])
        q1 = mcq(f"{lead} What fraction of the shape is coloured?", key, [o for o in opts if o != key], rng)
        q2 = count("How many equal parts is the shape cut into?", n, "parts")
        return [q1, q2]
    t, part, thing = p["total"], p["part"], p["thing"]
    lead = rng.choice(SET_LEADS).format(n=name, t=thing)
    word = "half" if part == 2 else "a quarter"
    q1 = count(f"{lead} {name} gives {word} of them to a friend. How many {thing} does the friend get?", t // part, thing)
    q2 = count(f"How many {thing} are there?", t, thing)
    return [q1, q2]
