"""Vectors drawn as arrows on a grid: column vectors, sums, moving a point, and magnitude (LS, UP).

Column vectors are written (3, -2) in the text: across, then up.
"""
from __future__ import annotations

import math
import random

from ..core import GRID, INK, mcq, new_figure, short

ID = "vectors_grid"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "column-vector-definition", "vectors", "vectors-column-addition-subtraction", "vector-magnitude", "vectors-equivalent",
    "vector-scalar-multiplication",
))

NAMES = [("a", "b", "c"), ("p", "q", "r"), ("u", "v", "w"), ("d", "e", "f"), ("m", "n", "k")]
W, H = 14, 10  # grid size


def _vec(v) -> str:
    return f"({v[0]}, {v[1]})"


def _forms(v) -> list[str]:
    return [f"({v[0]},{v[1]})", f"{v[0]}, {v[1]}", f"{v[0]},{v[1]}"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    names = rng.choice(NAMES)
    while True:
        vecs, starts, ok = {}, {}, True
        for i, n in enumerate(names):
            v = (rng.choice([x for x in range(-5, 6) if x]), rng.randint(-5, 5))
            if v in vecs.values() or (-v[0], -v[1]) in vecs.values():
                ok = False
                break
            # Each arrow in its own third of the grid, so arrows never cross.
            x0 = rng.randint(4 * i + max(0, -v[0]), 4 * i + 4 - max(0, v[0])) if abs(v[0]) <= 4 else None
            y0 = rng.randint(max(0, -v[1]), H - max(0, v[1]))
            if x0 is None or x0 < 0 or x0 + v[0] > W:
                ok = False
                break
            vecs[n], starts[n] = list(v), [x0, y0]
        if ok:
            return {"band": band, "names": list(names), "vectors": vecs, "starts": starts}


def draw(p: dict):
    fig, ax = new_figure(6.4, 4.8)
    ax.set_xticks(range(0, W + 1))
    ax.set_yticks(range(0, H + 1))
    ax.grid(True, color=GRID, linewidth=0.7)
    ax.tick_params(left=False, bottom=False, labelleft=False, labelbottom=False)
    for s in ax.spines.values():
        s.set_visible(False)
    for n in p["names"]:
        (x0, y0), (dx, dy) = p["starts"][n], p["vectors"][n]
        ax.annotate("", xy=(x0 + dx, y0 + dy), xytext=(x0, y0),
                    arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.8, "mutation_scale": 16})
        # The name beside the arrow's middle, off to its left.
        L = math.hypot(dx, dy)
        ax.text(x0 + dx / 2 - 0.45 * dy / L, y0 + dy / 2 + 0.45 * dx / L, n, fontsize=14, fontweight="bold", style="italic",
                ha="center", va="center")
    ax.set_xlim(-0.5, W + 0.5)
    ax.set_ylim(-0.5, H + 0.5)
    ax.set_aspect("equal")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    names, vec = p["names"], {n: tuple(v) for n, v in p["vectors"].items()}
    n = rng.choice(names)
    x, y = vec[n]
    which = mcq(f"Which column vector is {n}?", _vec((x, y)), [_vec(w) for w in ((y, x), (-x, -y), (x, -y), (-x, y))], rng)
    u, w = rng.sample(names, 2)
    k = rng.choice([1, 1, 2]) if p["band"] == "UP" else 1
    op = rng.choice(["+", "-"])
    s = 1 if op == "+" else -1
    total = (k * vec[u][0] + s * vec[w][0], k * vec[u][1] + s * vec[w][1])
    combo = short(f"What is {k if k > 1 else ''}{u} {op} {w}? Give it as a column vector.", _vec(total), _forms(total))
    m = rng.choice(names)
    sx, sy = rng.randint(-4, 6), rng.randint(-4, 6)
    end = (sx + vec[m][0], sy + vec[m][1])
    move = short(f"Start at the point ({sx}, {sy}) and move by the vector {m}. Where do you end?", _vec(end), _forms(end))
    qs = [which, combo, move]
    if p["band"] == "UP":
        n = rng.choice(names)
        mag = math.hypot(*vec[n])
        qs.append(short(f"What is the magnitude of {n}? Give your answer to 1 decimal place.", f"{mag:.1f}",
                        [str(int(mag))] if mag.is_integer() else []))
    return qs
