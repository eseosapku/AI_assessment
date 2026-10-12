"""A continuous random variable's probability density function, drawn as straight lines with its
greatest height marked k: k, P(X < c), E(X), and for a uniform distribution the median (AL).

Four shapes on [lo, hi]: uniform; a ramp rising from 0 to k; a ramp falling from k to 0; a symmetric
tent. The area is 1, c is a whole number inside the range, and every answer is an exact fraction.
"""
from __future__ import annotations

import random
from decimal import Decimal
from fractions import Fraction

from ..core import GRID, INK, NAMES, frac, new_figure, short

ID = "pdf_graph"
KIND = "graph.line"
SUBJECT = "mathematics"
BANDS = ("AL",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("continuous-random-variables", "probability-density-function-transformation", "calculating-e-gx-continuous"))


KINDS = ("uniform", "ramp", "fall", "tent")


def sample(rng: random.Random) -> dict:
    kind = rng.choice(KINDS)
    w = rng.choice([2, 4, 6, 8, 10] if kind == "tent" else [2, 3, 4, 5, 6, 8, 10])
    lo = rng.randint(0, 12 - w) if kind == "uniform" else rng.randint(0, 4)
    return {"band": "AL", "kind": kind, "lo": lo, "hi": lo + w, "name": rng.choice(NAMES)}


def support(p: dict) -> tuple[int, int]:
    return p["lo"], p["hi"]


def height(p: dict) -> Fraction:
    w = p["hi"] - p["lo"]
    return {"uniform": Fraction(1, w), "ramp": Fraction(2, w), "fall": Fraction(2, w), "tent": Fraction(2, w)}[p["kind"]]


def outline(p: dict) -> list[tuple[float, float]]:
    lo, hi = support(p)
    k = float(height(p))
    return {"uniform": [(lo, k), (hi, k)], "ramp": [(lo, 0), (hi, k)], "fall": [(lo, k), (hi, 0)],
            "tent": [(lo, 0), ((lo + hi) / 2, k), (hi, 0)]}[p["kind"]]


def draw(p: dict):
    lo, hi = support(p)
    k = float(height(p))
    fig, ax = new_figure(6.0, 4.0)
    pts = outline(p)
    ax.plot([x for x, _ in pts], [y for _, y in pts], color=INK, linewidth=2.0)
    for x, y in pts:  # the drop to the axis at an end where f jumps
        if y > 0:
            ax.plot([x, x], [0, y], color=INK, linewidth=1.1, linestyle=(0, (4, 3)))
    peak = max(pts, key=lambda q: q[1])
    ax.plot([lo - 1 if lo > 0 else 0, peak[0]], [k, k], color=INK, linewidth=0.9, linestyle=(0, (2, 3)))
    ax.set_xticks(range(max(lo - 1, 0), hi + 2))
    ax.xaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_yticks([0, k])
    ax.set_yticklabels(["0", "k"])
    ax.set_xlim(max(lo - 1, 0), hi + 1)
    ax.set_ylim(0, k * 1.35)
    ax.set_xlabel("x")
    ax.set_ylabel("f(x)")
    ax.tick_params(labelsize=9)
    return fig


def _short(stem: str, f: Fraction):
    """The fraction in lowest terms, with its exact decimal where it ends (0.125 for 1/8) or the usual
    roundings where it does not (4/3: 1.33 and 1.333)."""
    d = f.denominator
    while d % 2 == 0:
        d //= 2
    while d % 5 == 0:
        d //= 5
    if d == 1:
        exact = format(Decimal(f.numerator) / Decimal(f.denominator), "f")
        forms = [frac(f)] + ([exact] if exact != frac(f) else [])
    else:
        forms = [frac(f), f"{float(f):.2f}", f"{float(f):.3f}"]
    return short(stem, forms[0], forms)


def questions(p: dict, rng: random.Random) -> list:
    lo, hi = support(p)
    k = height(p)
    find_k = _short(f"{p['name']} drew the probability density function of X, which is zero outside {lo} ≤ x ≤ {hi}. Its greatest "
                    "value is k. Find k.", k)
    c = rng.choice([v for v in range(lo + 1, hi)])
    w = hi - lo
    if p["kind"] == "uniform":
        below, mean = Fraction(c - lo, w), Fraction(lo + hi, 2)
    elif p["kind"] == "ramp":
        below, mean = Fraction(c - lo, w) ** 2, lo + Fraction(2 * w, 3)
    elif p["kind"] == "fall":
        below, mean = 1 - Fraction(hi - c, w) ** 2, lo + Fraction(w, 3)
    else:
        m, u = Fraction(w, 2), c - lo
        below = u * u / (2 * m * m) if u <= m else 1 - (w - u) ** 2 / (2 * m * m)
        mean = lo + m
    qs = [find_k, _short(f"Use {p['name']}'s graph to find P(X < {c}).", below), _short("Find E(X).", mean)]
    if p["kind"] == "uniform":
        qs.append(_short("Find the median of X.", Fraction(lo + hi, 2)))
    return qs
