"""Probability tree for two picks with replacement. Answers are exact fractions."""
from __future__ import annotations

import random
from fractions import Fraction
from math import gcd

from ..core import frac, mcq, new_figure, short

ID = "tree_diagram"
KIND = "maths.probability"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "tree-diagram", "combined-events", "probability-independent-events-multiplication", "conditional-probability",
))

# Each setup: its words, the two outcomes on the branches, how to say both picks give each
# outcome, and how to say exactly one does.
SETUPS = [
    {"text": "A bag holds {a} red and {b} blue counters. A counter is taken, put back, and a second is taken.",
     "names": ("Red", "Blue"), "both": ("both counters are red", "both counters are blue"), "mixed": "one counter is red and one is blue"},
    {"text": "A spinner lands on green with probability {a}/{n}, otherwise white. It is spun twice.",
     "names": ("Green", "White"), "both": ("both spins land on green", "both spins land on white"), "mixed": "exactly one spin lands on green"},
    {"text": "The probability that it rains on any day is {a}/{n}. Two days are chosen.",
     "names": ("Rain", "Dry"), "both": ("it rains on both days", "both days are dry"), "mixed": "it rains on exactly one of the days"},
    {"text": "A biased coin lands on heads with probability {a}/{n}. It is thrown twice.",
     "names": ("Heads", "Tails"), "both": ("both throws land on heads", "both throws land on tails"), "mixed": "exactly one throw lands on heads"},
    {"text": "A bean seed grows with probability {a}/{n}. Two seeds are planted.",
     "names": ("Grows", "Fails"), "both": ("both seeds grow", "neither seed grows"), "mixed": "exactly one seed grows"},
    {"text": "The bus to Huye is late with probability {a}/{n} on any day. Two days are chosen.",
     "names": ("Late", "On time"), "both": ("the bus is late on both days", "the bus is on time on both days"),
     "mixed": "the bus is late on exactly one of the days"},
    {"text": "Aline scores from a penalty with probability {a}/{n}. She takes two penalties.",
     "names": ("Goal", "Miss"), "both": ("she scores both penalties", "she misses both penalties"), "mixed": "she scores exactly one penalty"},
    {"text": "A box holds {a} ripe and {b} unripe mangoes. A mango is taken, put back, and a second is taken.",
     "names": ("Ripe", "Unripe"), "both": ("both mangoes are ripe", "both mangoes are unripe"), "mixed": "exactly one mango is ripe"},
]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    setup = rng.randrange(len(SETUPS))
    text = SETUPS[setup]["text"]
    n = rng.choice([4, 5, 6, 7, 8, 9, 10, 11, 12])
    # Not an even split: then several wrong answers equal the right one. A probability the
    # question states is in lowest terms; counts of counters need not be.
    a = rng.choice([v for v in range(1, n) if 2 * v != n and ("{a}/{n}" not in text or gcd(v, n) == 1)])
    return {"band": band, "setup": setup, "text": text, "names": list(SETUPS[setup]["names"]), "a": a, "n": n}


def _prob(ax, x0: float, y0: float, x1: float, y1: float, text: str, size: int) -> None:
    """A branch's probability beside its middle, on the outer side, so the branch never runs through it."""
    up = y1 > y0
    ax.annotate(text, ((x0 + x1) / 2, (y0 + y1) / 2), xytext=(-3, 4 if up else -4), textcoords="offset points",
                ha="right", va="bottom" if up else "top", fontsize=size)


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
        _prob(ax, -0.25, 0.5, x - 0.04, y, prob, 11)
        ax.text(x, y, name, va="center", fontsize=11)
        # The second branches start past the first label, however long ("On time", "Unripe").
        start = x + 0.05 + 0.022 * len(name)
        for (dy, name2, prob2) in ((0.12, x1, pa), (-0.12, y1, pb)):
            ex, ey = 0.72, y + dy
            ax.plot([start, ex - 0.02], [y, ey], color="#111111")
            _prob(ax, start, y, ex - 0.02, ey, prob2, 10)
            ax.text(ex, ey, name2, va="center", fontsize=11)
    ax.set_xlim(-0.3, 0.95)
    ax.set_ylim(0, 1.1)
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    a, n = p["a"], p["n"]
    pa = Fraction(a, n)
    pb = 1 - pa
    one_each = 2 * pa * pb
    setup = SETUPS[p["setup"]]
    stem = p["text"].format(a=a, b=n - a, n=n)
    # Both picks the same: of the first outcome or the second, so figures with the same setup
    # and numbers can still ask different things.
    named = rng.randrange(2)
    count = a if named == 0 else n - a
    both = Fraction(count, n) ** 2
    unsimplified = f"{count * count}/{n * n}"
    both_forms = [frac(both)] + ([unsimplified] if unsimplified != frac(both) else [])
    return [
        short(f"{stem} What is the probability that {setup['both'][named]}? Give your answer as a fraction.",
              frac(both), both_forms),
        # Wrong answers: forgetting the two orders, the chance of a matching pair, a single pick.
        mcq(f"{stem} What is the probability that {setup['mixed']}?",
            frac(one_each), [frac(pa * pb), frac(pa * pa + pb * pb), frac(pa), frac(pb)], rng),
    ]
