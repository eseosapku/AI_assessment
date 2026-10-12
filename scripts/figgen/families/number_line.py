"""Number line with an arrow at one tick. The tick values are exact decimals."""
from __future__ import annotations

import random
from decimal import Decimal

from ..core import new_figure, short

ID = "number_line"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("P", "LS")

# (step, how many ticks, lowest start) — whole numbers, tens, decimals, negatives
SCALES = [
    (Decimal(1), 10, 0), (Decimal(2), 10, 0), (Decimal(5), 10, 0), (Decimal(10), 10, 0),
    (Decimal("0.1"), 10, 0), (Decimal("0.5"), 8, 0), (Decimal(1), 10, -8), (Decimal("0.2"), 10, 1),
]


def _text(d: Decimal) -> str:
    s = format(d.normalize(), "f")
    return s


def sample(rng: random.Random) -> dict:
    step, n, low = rng.choice(SCALES)
    start = Decimal(low) + step * rng.randint(0, 4)
    ticks = [start + step * i for i in range(n + 1)]
    labelled = {0, n}  # only the two ends are labelled; the arrow is on an unlabelled tick
    target = rng.choice([i for i in range(1, n) if i not in labelled])
    return {"ticks": [_text(t) for t in ticks], "target": target}


def draw(p: dict):
    ticks = [Decimal(t) for t in p["ticks"]]
    n = len(ticks) - 1
    fig, ax = new_figure(6.8, 1.8)
    ax.plot([0, n], [0, 0], color="#111111")
    for i in range(n + 1):
        h = 0.18 if i in (0, n) else 0.12
        ax.plot([i, i], [-h, h], color="#111111")
    ax.text(0, -0.45, p["ticks"][0], ha="center", fontsize=12)
    ax.text(n, -0.45, p["ticks"][n], ha="center", fontsize=12)
    ax.annotate("", xy=(p["target"], 0.15), xytext=(p["target"], 0.9),
                arrowprops={"arrowstyle": "->", "color": "#111111", "linewidth": 1.6})
    ax.set_xlim(-0.6, n + 0.6)
    ax.set_ylim(-0.8, 1.0)
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    value = p["ticks"][p["target"]]
    forms = [value]
    if value.startswith("0."):
        forms.append(value[1:])
    if value.startswith("-0."):
        forms.append("-" + value[2:])
    return [short("What number is the arrow pointing to?", value, forms)]
