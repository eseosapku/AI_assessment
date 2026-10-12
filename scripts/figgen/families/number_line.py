"""Number line with an arrow at one tick. The tick values are exact decimals."""
from __future__ import annotations

import random
from decimal import Decimal

from ..core import new_figure, short

ID = "number_line"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("P", "LS")
# "Polynomials" shares "adding and subtracting integers" without being about number lines.
AVOID = r"polynomial"
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "number-line", "intervals-closed-line", "adding-subtracting-integers", "negative-numbers-problems", "integers",
))

# (step, how many ticks, lowest and highest start, in steps). Primary: whole numbers, tens and
# tenths from zero up. Lower Secondary: negative numbers and decimals either side of zero.
SCALES = {
    "P": [(Decimal(1), 10, 0, 20), (Decimal(2), 10, 0, 20), (Decimal(5), 10, 0, 20), (Decimal(10), 10, 0, 30),
          (Decimal("0.1"), 10, 0, 20), (Decimal("0.5"), 8, 0, 10)],
    "LS": [(Decimal(1), 10, -10, -2), (Decimal(2), 10, -10, -3), (Decimal("0.1"), 10, -10, 10),
           (Decimal("0.2"), 10, 0, 10), (Decimal("0.5"), 8, -6, 6)],
}


def _text(d: Decimal) -> str:
    s = format(d.normalize(), "f")
    return "0" if s == "-0" else s


def stages(p: dict) -> tuple[int, int] | None:
    """Numbers to 20 at Stages 1-2, to 100 at 2-3, beyond at 3-5; tenths and halves from Stage 4."""
    if p["band"] != "P":
        return None
    first, second = p["ticks"][0], p["ticks"][1]
    if "." in first or "." in second:
        return (4, 6)
    top = int(p["ticks"][-1])
    return (1, 2) if top <= 20 else (2, 3) if top <= 100 else (3, 5)


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    step, n, lo, hi = rng.choice(SCALES[band])
    start = step * rng.randint(lo, hi)
    ticks = [start + step * i for i in range(n + 1)]
    labelled = {0, n}  # only the two ends are labelled; the arrow is on an unlabelled tick
    target = rng.choice([i for i in range(1, n) if i not in labelled])
    return {"band": band, "ticks": [_text(t) for t in ticks], "target": target}


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


def _forms(value: str) -> list[str]:
    """The number as written, and without its leading zero (".4", "-.4")."""
    forms = [value]
    if value.startswith("0."):
        forms.append(value[1:])
    if value.startswith("-0."):
        forms.append("-" + value[2:])
    return forms


def questions(p: dict, rng: random.Random) -> list:
    ticks, t = p["ticks"], p["target"]
    n = len(ticks) - 1
    ends = f"from {ticks[0]} to {ticks[-1]}"
    # Counting on or back from the arrow, staying on the line.
    moves = [(k, d) for k in (1, 2, 3) for d in (1, -1) if 0 <= t + d * k <= n]
    k, d = rng.choice(moves)
    other = ticks[t + d * k]
    side = "right" if d == 1 else "left"
    return [
        short(f"The number line goes {ends}. What number is the arrow pointing to?", ticks[t], _forms(ticks[t])),
        short(f"On the number line {ends}, which number is {k} mark{'s' if k > 1 else ''} to the {side} of the arrow?",
              other, _forms(other)),
    ]
