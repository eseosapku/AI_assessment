"""A bar, grid or circle in equal parts, some shaded: fractions to read, complete and convert.

The correct option is always in lowest terms, and no two options are equal as fractions, so a
student who reads 6/8 as 3/4 never meets two right answers.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Rectangle, Wedge

from ..core import count, FILL, INK, NAMES, frac, mcq, new_figure, short

ID = "fraction_model"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("P", "LS")
# A plain strip of four parts compresses to about 1.2 KB of PNG; a blank render is about 300 bytes.
MIN_PNG_BYTES = 900
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "fractions", "fractions-equivalent-shading", "fractions-exploring-models", "fractions-denominator",
    "ordering-comparing-fractions", "decimal-fractions-illustration", "fractions-percentages",
))

WORDS = {"bar": "strip", "grid": "rectangle", "circle": "circle"}
# (shape, rows, columns): a strip of parts, a grid of parts, or a circle in sectors.
SHAPES = {
    "P": [("bar", 1, n) for n in (2, 3, 4, 5, 6, 8, 10)] + [("grid", 2, 3), ("grid", 2, 4), ("grid", 3, 4), ("grid", 2, 5)]
         + [("circle", 1, n) for n in (2, 3, 4, 6, 8)],
    "LS": [("bar", 1, n) for n in (5, 8, 10, 12)] + [("grid", 3, 4), ("grid", 4, 5), ("grid", 2, 10), ("grid", 4, 4)]
          + [("circle", 1, n) for n in (6, 8, 10, 12)],
}


def stages(p: dict) -> tuple[int, int] | None:
    """Halves and quarters from Stage 1; thirds, fifths and eighths from Stage 3; more parts from Stage 4."""
    if p["band"] != "P":
        return None
    return (1, 4) if p["n"] in (2, 4) else (3, 6) if p["n"] <= 8 else (4, 6)


def concepts_for(p: dict) -> frozenset:
    """Percentages are asked at Lower Secondary only, so a Primary model does not reach them."""
    return frozenset(c for c in CONCEPTS if p["band"] != "P" or not c.endswith("fractions-percentages"))


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    shape, rows, cols = rng.choice(SHAPES[band])
    n = rows * cols
    k = rng.randint(1, n - 1)
    # A strip and a grid shade parts anywhere; a circle shades neighbouring sectors.
    shaded = sorted(rng.sample(range(n), k)) if shape != "circle" else list(range(k))
    return {"band": band, "name": rng.choice(NAMES), "shape": shape, "rows": rows, "cols": cols, "n": n, "shaded": shaded}


def draw(p: dict):
    fig, ax = new_figure(5.0, 3.6)
    n, on = p["n"], set(p["shaded"])
    if p["shape"] == "circle":
        for i in range(n):
            a0, a1 = 90 - 360 * (i + 1) / n, 90 - 360 * i / n
            ax.add_patch(Wedge((0, 0), 1, a0, a1, facecolor=FILL if i in on else "white", edgecolor=INK, linewidth=1.4))
        ax.set_xlim(-1.15, 1.15)
        ax.set_ylim(-1.15, 1.15)
    else:
        rows, cols = p["rows"], p["cols"]
        w, h = 4.0 / cols, (0.9 if rows == 1 else 2.4 / rows)
        for i in range(n):
            r, c = divmod(i, cols)
            ax.add_patch(Rectangle((c * w, -(r + 1) * h), w, h, facecolor=FILL if i in on else "white", edgecolor=INK, linewidth=1.4))
        ax.set_xlim(-0.1, 4.1)
        ax.set_ylim(-rows * h - 0.1, 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _options(k: int, n: int) -> tuple[str, list[str]]:
    """The shaded fraction in lowest terms, and wrong readings, none equal to it or to each other."""
    right = Fraction(k, n)
    seen = {right}
    wrong = []
    for cand in (Fraction(n - k, n), Fraction(k, n - k) if n - k else None, Fraction(1, k) if k > 1 else Fraction(1, n + 1),
                 Fraction(k, n + k), Fraction(k + 1, n), Fraction(max(1, k - 1), n)):
        if cand is not None and 0 < cand and cand not in seen:
            seen.add(cand)
            wrong.append(frac(cand))
    return frac(right), wrong


def questions(p: dict, rng: random.Random) -> list:
    n, k, name, word = p["n"], len(p["shaded"]), p["name"], WORDS[p["shape"]]
    right, wrong = _options(k, n)
    qs = [mcq(f"{name} shaded part of this {word}. What fraction of the {word} is shaded?", right, wrong, rng)]
    # A target fraction the shape can show exactly and that needs more shading.
    targets = sorted({Fraction(t, n) for t in range(k + 1, n + 1)} - {Fraction(1)}, key=lambda f: (f.denominator, f))
    target = rng.choice([t for t in targets if t.denominator < n] or targets) if targets else Fraction(1)
    if target == Fraction(1):
        qs.append(count(f"How many more parts must {name} shade so that the whole {word} is shaded?", n - k, "parts"))
    else:
        qs.append(count(f"How many more parts must {name} shade so that {frac(target)} of the {word} is shaded?",
                        int(target * n) - k, "parts"))
    if p["band"] == "LS":
        left = Fraction(n - k, n)
        if (left * 100).denominator == 1:
            v = int(left * 100)
            qs.append(short(f"What percentage of {name}'s {word} is not shaded?", v, [f"{v}%", f"{v} %"]))
        else:
            qs.append(short(f"What fraction of {name}'s {word} is not shaded? Give your answer in its simplest form.", frac(left)))
    return qs
