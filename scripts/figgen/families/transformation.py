"""Shape A and its image B on a grid: describe the single transformation (LS, UP).

The shapes have no symmetry, so only one description fits; every wrong option is applied to A
and kept only if it does not land on B.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon

from ..core import FILL, FILL_2, GRID, INK, label_spot, mcq, new_figure, short

ID = "transformation"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "reflection-definition", "rotation-angle-centre", "rotation-introduction", "translation-definition", "enlargement-definition",
    "enlargement-locating-scale-factor", "isometries-introduction", "position-transformation",
))

LIM = (-7, 7)
# The two shapes' letters, object then image: a different pair from figure to figure.
LABELS = [("A", "B"), ("P", "Q"), ("S", "T"), ("F", "G"), ("M", "N"), ("C", "D")]
SHAPES = [
    [(0, 0), (2, 0), (2, 1), (1, 1), (1, 3), (0, 3)],
    [(0, 0), (3, 0), (1, 2)],
    [(0, 0), (2, 0), (3, 2), (0, 1)],
    [(0, 0), (3, 0), (3, 1), (1, 1), (1, 2), (0, 2)],
    [(0, 0), (3, 0), (3, 1), (2, 1), (2, 2), (0, 2)],
]  # none has any symmetry, or two descriptions could fit (the test checks)


def apply(t: dict, pt: tuple[int, int]) -> tuple[int, int]:
    x, y = pt
    k = t["kind"]
    if k == "reflect_x":
        return (2 * t["k"] - x, y)
    if k == "reflect_y":
        return (x, 2 * t["k"] - y)
    if k == "reflect_yx":
        return (y, x)
    if k == "reflect_ynx":
        return (-y, -x)
    if k == "rotate":
        a, b = t["c"]
        dx, dy = x - a, y - b
        if t["deg"] == 180:
            return (a - dx, b - dy)
        return (a + dy, b - dx) if t["dir"] == "clockwise" else (a - dy, b + dx)
    if k == "translate":
        return (x + t["v"][0], y + t["v"][1])
    a, b = t["c"]
    return (a + t["sf"] * (x - a), b + t["sf"] * (y - b))


def describe(t: dict) -> str:
    k = t["kind"]
    if k == "reflect_x":
        return f"Reflection in the line x = {t['k']}"
    if k == "reflect_y":
        return f"Reflection in the line y = {t['k']}"
    if k == "reflect_yx":
        return "Reflection in the line y = x"
    if k == "reflect_ynx":
        return "Reflection in the line y = -x"
    if k == "rotate":
        a, b = t["c"]
        return f"Rotation 180° about ({a}, {b})" if t["deg"] == 180 else f"Rotation 90° {t['dir']} about ({a}, {b})"
    if k == "translate":
        return f"Translation by the vector ({t['v'][0]}, {t['v'][1]})"
    return f"Enlargement, scale factor {t['sf']}, centre ({t['c'][0]}, {t['c'][1]})"


def _random_t(rng: random.Random, band: str) -> dict:
    kinds = ["reflect_x", "reflect_y", "rotate", "rotate", "translate", "enlarge"] + (["reflect_yx", "reflect_ynx"] if band == "UP" else [])
    k = rng.choice(kinds)
    if k in ("reflect_x", "reflect_y"):
        return {"kind": k, "k": rng.randint(-3, 3)}
    if k in ("reflect_yx", "reflect_ynx"):
        return {"kind": k}
    if k == "rotate":
        return {"kind": k, "deg": rng.choice([90, 90, 180]), "dir": rng.choice(["clockwise", "anticlockwise"]),
                "c": [rng.randint(-2, 2), rng.randint(-2, 2)]}  # lists, not tuples: the spec is saved as JSON
    if k == "translate":
        return {"kind": k, "v": [rng.choice([v for v in range(-6, 7) if v]), rng.randint(-5, 5)]}
    return {"kind": k, "sf": 2 if band == "LS" else rng.choice([2, 3]), "c": [rng.randint(-5, 0), rng.randint(-5, 0)]}


def _cells(pts) -> set:
    """The grid squares a shape covers (by their centres)."""
    from matplotlib.path import Path
    path = Path(pts)
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    return {(x, y) for x in range(min(xs), max(xs)) for y in range(min(ys), max(ys)) if path.contains_point((x + 0.5, y + 0.5))}


def _inside(pts) -> bool:
    return all(LIM[0] <= c <= LIM[1] for pt in pts for c in pt)


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        base = rng.choice(SHAPES)
        dx, dy = rng.randint(-6, 4), rng.randint(-6, 4)
        A = [(x + dx, y + dy) for x, y in base]
        t = _random_t(rng, band)
        B = [apply(t, v) for v in A]
        # Each shape needs a square clear of the axis numbers for its letter, and the two
        # shapes must not overlap, so neither hides the other.
        clear = all(min(abs(c) for c in label_spot(pts)) >= 1 for pts in (A, B))
        if _inside(A) and _inside(B) and set(A) != set(B) and clear and not (_cells(A) & _cells(B)):
            return {"band": band, "A": [list(v) for v in A], "B": [list(v) for v in B], "t": t, "lim": list(LIM),
                    "labels": list(rng.choice(LABELS))}


def _distractors(p: dict, rng: random.Random) -> list[str]:
    t, A, B = p["t"], [tuple(v) for v in p["A"]], {tuple(v) for v in p["B"]}
    near = []
    k = t["kind"]
    if k in ("reflect_x", "reflect_y"):
        other = "reflect_y" if k == "reflect_x" else "reflect_x"
        near += [{"kind": k, "k": t["k"] + 1}, {"kind": other, "k": t["k"]}, {"kind": k, "k": -t["k"]}]
    if k == "rotate":
        flip = "anticlockwise" if t["dir"] == "clockwise" else "clockwise"
        near += [{**t, "dir": flip, "deg": 90}, {**t, "deg": 180 if t["deg"] == 90 else 90}, {**t, "c": (t["c"][0] + 1, t["c"][1])}]
    if k == "translate":
        vx, vy = t["v"]
        near += [{"kind": k, "v": (vy, vx)}, {"kind": k, "v": (-vx, -vy)}, {"kind": k, "v": (vx, -vy)}]
    if k == "enlarge":
        near += [{**t, "sf": t["sf"] + 1}, {**t, "c": (0, 0) if tuple(t["c"]) != (0, 0) else (1, 1)}, {**t, "sf": 2 if t["sf"] == 3 else 3}]
    if k in ("reflect_yx", "reflect_ynx"):
        near += [{"kind": "reflect_ynx" if k == "reflect_yx" else "reflect_yx"}, {"kind": "reflect_x", "k": 0},
                 {"kind": "rotate", "deg": 90, "dir": "clockwise", "c": (0, 0)}]
    for _ in range(20):
        near.append(_random_t(rng, p["band"]))
    out = []
    for d in near:
        text = describe(d)
        if {apply(d, v) for v in A} != B and text not in out and text != describe(t):
            out.append(text)
    return out


def draw(p: dict):
    fig, ax = new_figure(5.4, 5.4)
    ax.set_xticks(range(LIM[0], LIM[1] + 1))
    ax.set_yticks(range(LIM[0], LIM[1] + 1))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    for s in ("left", "bottom"):
        ax.spines[s].set_position("zero")
    for pts, shade, name in ((p["A"], FILL_2, p["labels"][0]), (p["B"], FILL, p["labels"][1])):
        ax.add_patch(Polygon(pts, closed=True, facecolor=shade, edgecolor=INK, linewidth=1.6, alpha=0.9))
        cx, cy = label_spot([tuple(q) for q in pts])
        ax.text(cx, cy, name, ha="center", va="center", fontsize=12, fontweight="bold")
    ax.set_xlim(LIM[0] - 0.5, LIM[1] + 0.5)
    ax.set_ylim(LIM[0] - 0.5, LIM[1] + 0.5)
    ax.tick_params(labelsize=8)
    ax.set_aspect("equal")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    wrong = _distractors(p, rng)
    a, b = p["labels"]
    which = mcq(f"Describe the single transformation that maps shape {a} onto shape {b}.", describe(p["t"]), wrong[:3], rng)
    # A corner that moves: one on a mirror line or at the centre of turn would ask nothing.
    i = rng.choice([j for j in range(len(p["A"])) if p["A"][j] != p["B"][j]])
    (x, y), (u, v) = p["A"][i], p["B"][i]
    image = short(f"Shape {a} has a corner at ({x}, {y}). What are the coordinates of this corner on shape {b}?", f"({u}, {v})",
                  [f"({u},{v})", f"{u}, {v}", f"{u},{v}"])
    return [which, image]
