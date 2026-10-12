"""Probability tree for two picks with replacement. Answers are exact fractions."""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import frac, mcq, new_figure, short

ID = "tree_diagram"
KIND = "maths.probability"
SUBJECT = "mathematics"
BANDS = ("UP",)

SETUPS = [
    ("A bag holds {a} red and {b} blue counters. A counter is taken, put back, and a second is taken.", "Red", "Blue"),
    ("A spinner lands on green with probability {a}/{n}, otherwise white. It is spun twice.", "Green", "White"),
    ("The probability that it rains on any day is {a}/{n}. Two days are chosen.", "Rain", "Dry"),
    ("A biased coin lands on heads with probability {a}/{n}. It is thrown twice.", "Heads", "Tails"),
]


def sample(rng: random.Random) -> dict:
    text, first, second = rng.choice(SETUPS)
    n = rng.choice([4, 5, 6, 7, 8, 9, 10, 11, 12])
    # Not an even split: then several wrong answers equal the right one.
    a = rng.choice([v for v in range(1, n) if 2 * v != n])
    return {"text": text, "names": [first, second], "a": a, "n": n}


def draw(p: dict):
    a, n = p["a"], p["n"]
    pa, pb = f"{a}/{n}", f"{n - a}/{n}"
    x1, y1 = p["names"]
    fig, ax = new_figure(6.4, 4.4)
    ax.text(0.0, 1.03, "First", ha="center", fontsize=11, fontweight="bold")
    ax.text(0.5, 1.03, "Second", ha="center", fontsize=11, fontweight="bold")
    firsts = [(0.3, 0.78, x1, pa), (0.3, 0.22, y1, pb)]
    for (x, y, name, prob) in firsts:
        ax.plot([-0.25, x - 0.04], [0.5, y], color="#111111")
        ax.text((-0.25 + x) / 2 - 0.04, (0.5 + y) / 2 + (0.04 if y > 0.5 else -0.07), prob, fontsize=11)
        ax.text(x, y, name, va="center", fontsize=11)
        for (dy, name2, prob2) in ((0.12, x1, pa), (-0.12, y1, pb)):
            ex, ey = 0.72, y + dy
            ax.plot([x + 0.12, ex - 0.02], [y, ey], color="#111111")
            ax.text((x + 0.12 + ex) / 2 - 0.02, (y + ey) / 2 + (0.02 if dy > 0 else -0.05), prob2, fontsize=10)
            ax.text(ex, ey, name2, va="center", fontsize=11)
    ax.set_xlim(-0.3, 0.95)
    ax.set_ylim(0, 1.1)
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    a, n = p["a"], p["n"]
    pa = Fraction(a, n)
    pb = 1 - pa
    both = pa * pa
    one_each = 2 * pa * pb
    x1, y1 = p["names"]
    stem = p["text"].format(a=a, b=n - a, n=n)
    unsimplified = f"{a * a}/{n * n}"
    both_forms = [frac(both)] + ([unsimplified] if unsimplified != frac(both) else [])
    return [
        short(f"{stem} What is the probability that both are {x1.lower()}? Give your answer as a fraction.",
              frac(both), both_forms),
        # Wrong answers: forgetting the two orders, the chance of a matching pair, a single pick.
        mcq(f"{stem} What is the probability of one {x1.lower()} and one {y1.lower()}, in either order?",
            frac(one_each), [frac(pa * pb), frac(pa * pa + pb * pb), frac(pa), frac(pb)], rng),
    ]
