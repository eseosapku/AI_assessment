"""Place value chart with counters: a number to read, change and take apart (Primary).

The number is never written on the figure or in a question; the counters are the number, so
every question needs the chart.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Rectangle

from ..core import FILL, INK, NAMES, mcq, new_figure, short

ID = "place_value"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "place-value", "numbers-forming-reading", "reading-numbers-up-to-2000", "whole-numbers-beyond-1000000",
    "counting-reading-writing-numbers", "number-and-numeration", "comparing-and-ordering-numbers",
))
AVOID = r"^introduction$|addition and subtraction \(1\)|measur|time|hour|day|kilogram|litre|capacity|length|mass|prime factori|powers, indices"  # topics that teach none of it, read section by section

COLUMNS = ["ones", "tens", "hundreds", "thousands", "ten thousands", "hundred thousands", "millions"]
HEADS = ["O", "T", "H", "Th", "TTh", "HTh", "M"]


def fmt(n: int) -> str:
    return f"{n:,}"


def _forms(n: int) -> list[str]:
    """As a student may write it: 4,072, 4072 or 4 072."""
    return list(dict.fromkeys([fmt(n), str(n), fmt(n).replace(",", " ")]))


def stages(p: dict) -> tuple[int, int] | None:
    """A 2-digit chart for the first years, up to millions in Stage 6."""
    if int("".join(map(str, p["digits"]))) <= 20:
        return (1, 2)  # Stage 1 counts to 20
    return {2: (2, 3), 3: (2, 4), 4: (3, 5), 5: (4, 6), 6: (5, 6), 7: (6, 6)}[len(p["digits"])]


def sample(rng: random.Random) -> dict:
    size = rng.choice([2, 2, 3, 4, 4, 5, 5, 6, 7])  # tens and ones in the first years up to millions at Stage 6
    while True:
        first = rng.choice([1, 1, 2, *range(3, 10)]) if size == 2 else rng.randint(1, 9)  # teens for the first year
        digits = [first] + [rng.choice([0, 0, *range(1, 9)]) for _ in range(size - 1)]
        if any(d < 9 for d in digits) and any(d > 0 for d in digits[1:]):
            break
    return {"band": "P", "name": rng.choice(NAMES), "digits": digits}


def draw(p: dict):
    digits = p["digits"]
    n = len(digits)
    fig, ax = new_figure(1.25 * n + 0.6, 2.6)
    for i, d in enumerate(digits):
        col = n - 1 - i
        ax.add_patch(Rectangle((i, 0.35), 1, 1.85, fill=False, edgecolor=INK, linewidth=1.2))
        ax.plot([i, i + 1], [1.8, 1.8], color=INK, linewidth=1.2)
        ax.text(i + 0.5, 2.0, HEADS[col], ha="center", va="center", fontsize=12, fontweight="bold")
        # Up to nine counters in a 3 x 3 block, filled row by row from the top.
        for c in range(d):
            r, k = divmod(c, 3)
            ax.add_patch(Circle((i + 0.22 + 0.28 * k, 1.5 - 0.42 * r), 0.11, facecolor=FILL, edgecolor=INK, linewidth=1))
    ax.set_xlim(-0.1, n + 0.1)
    ax.set_ylim(0.25, 2.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    digits, name = p["digits"], p["name"]
    n = len(digits)
    number = int("".join(map(str, digits)))
    s = str(number)
    # Wrong readings: the columns read right to left, a zero column missed, one counter miscounted.
    wrong = [int(s[::-1].lstrip("0") or "0"), int(s.replace("0", "") or "0"), number + 10 ** rng.randrange(n),
             number - 10 ** min(i for i in range(n) if digits[n - 1 - i] > 0)]
    shown = mcq(f"{name} made this number with counters on a place value chart. What is the number?", fmt(number),
                [fmt(w) for w in wrong if w > 0 and w != number], rng)
    # A few more counters in a column that has room for them: no exchanging at this stage.
    col, k = rng.choice([(c, k) for c in range(n) for k in (1, 2, 3) if digits[n - 1 - c] + k <= 9])
    after = number + k * 10 ** col
    added = short(f"{name} adds {k} more counter{'s' if k > 1 else ''} to the {COLUMNS[col]} column. What number is shown now?",
                  fmt(after), _forms(after))
    filled = [c for c in range(n) if digits[n - 1 - c] > 0]
    c = rng.choice(filled)
    value = digits[n - 1 - c] * 10 ** c
    worth = short(f"In {name}'s number, what is the value of the counters in the {COLUMNS[c]} column?", fmt(value), _forms(value))
    return [shown, added, worth]
