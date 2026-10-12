"""A completed sample space diagram for two spinners or dice: probabilities by counting (LS, UP)."""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import count, FILL_2, INK, frac, new_figure, short

ID = "sample_space"
KIND = "maths.probability"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "die-toss-outcomes-representing", "chance-experiments", "calculating-probabilities", "combined-events",
    "probability-experimental-theoretical", "probability-independent-events-multiplication",
))

DEVICES = [("dice", [1, 2, 3, 4, 5, 6]), ("spinner", [1, 2, 3, 4]), ("spinner", [1, 2, 3, 4, 5]), ("spinner", [2, 4, 6, 8]),
           ("spinner", [0, 1, 2, 3]), ("spinner", [1, 3, 5, 7])]
SIGN = {"sum": "+", "product": "×", "difference": "−"}
FUN = {"sum": lambda x, y: x + y, "product": lambda x, y: x * y, "difference": lambda x, y: abs(x - y)}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    (na, a), (nb, b) = rng.sample(DEVICES, 2)
    op = rng.choice(["sum", "product"] if band == "LS" else ["sum", "product", "difference"])
    return {"band": band, "names": [na, nb], "a": a, "b": b, "op": op}


def draw(p: dict):
    a, b, f = p["a"], p["b"], FUN[p["op"]]
    fig, ax = new_figure(0.55 * len(b) + 1.6, 0.5 * len(a) + 1.3)
    w = h = 1.0
    ax.add_patch(Rectangle((0, len(a) * h), w, h, facecolor=FILL_2, edgecolor=INK, linewidth=1))
    ax.text(w / 2, (len(a) + 0.5) * h, SIGN[p["op"]], ha="center", va="center", fontsize=14, fontweight="bold")
    for j, y in enumerate(b):
        ax.add_patch(Rectangle(((j + 1) * w, len(a) * h), w, h, facecolor=FILL_2, edgecolor=INK, linewidth=1))
        ax.text((j + 1.5) * w, (len(a) + 0.5) * h, str(y), ha="center", va="center", fontsize=12, fontweight="bold")
    for i, x in enumerate(a):
        yy = (len(a) - 1 - i) * h
        ax.add_patch(Rectangle((0, yy), w, h, facecolor=FILL_2, edgecolor=INK, linewidth=1))
        ax.text(w / 2, yy + h / 2, str(x), ha="center", va="center", fontsize=12, fontweight="bold")
        for j, y in enumerate(b):
            ax.add_patch(Rectangle(((j + 1) * w, yy), w, h, facecolor="white", edgecolor=INK, linewidth=1))
            ax.text((j + 1.5) * w, yy + h / 2, str(f(x, y)), ha="center", va="center", fontsize=12)
    first, second = p["names"]
    ax.text(-0.25, len(a) * h / 2, f"First {first}", rotation=90, ha="right", va="center", fontsize=11)
    ax.text((len(b) + 2) * w / 2, (len(a) + 1) * h + 0.25, f"Second {second}", ha="center", va="bottom", fontsize=11)
    ax.set_xlim(-0.9, (len(b) + 1) * w + 0.1)
    ax.set_ylim(-0.1, (len(a) + 1) * h + 0.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _prob(count: int, total: int) -> tuple[str, list[str]]:
    v = Fraction(count, total)
    forms = [f"{count}/{total}"] if f"{count}/{total}" != frac(v) else []
    if (v * 1000).denominator == 1:
        forms.append(f"{float(v):g}")
    return frac(v), forms


def questions(p: dict, rng: random.Random) -> list:
    a, b, op = p["a"], p["b"], p["op"]
    outcomes = [FUN[op](x, y) for x in a for y in b]
    total = len(outcomes)
    first, second = p["names"]
    what = f"The first {first} and the second {second} are each used once, and the {op} of the two numbers is found."
    v = rng.choice(sorted(set(outcomes)))
    ans, forms = _prob(outcomes.count(v), total)
    t = rng.choice([o for o in sorted(set(outcomes))[:-1]])
    qs = [
        short(f"{what} What is the probability that the {op} is {v}?", ans, forms),
        count(f"How many of the {total} outcomes give a {op} greater than {t}?", sum(1 for o in outcomes if o > t), "outcomes"),
    ]
    if p["band"] == "UP":
        even = sum(1 for o in outcomes if o % 2 == 0)
        if 0 < even < total:
            ans, forms = _prob(even, total)
            qs.append(short(f"What is the probability that the {op} is an even number?", ans, forms))
    return qs
