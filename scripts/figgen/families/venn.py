"""A Venn diagram of two sets with a count in each region and outside (P, LS, UP).

Primary reads counts; Lower Secondary turns them into a probability; Upper Secondary adds
"given that" (conditional) probability.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle, Rectangle

from ..core import INK, frac, new_figure, short

ID = "venn"
KIND = "maths.probability"
SUBJECT = "mathematics"
BANDS = ("P", "LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "venn-carroll-diagrams", "intersection-sets", "complement-of-set", "set-notation", "sets-problems", "combined-events",
    "conditional-probability",
))

# who; the two sets' labels; doing A, doing B, not doing B; both; one of them; doing A (he/she does)
CONTEXTS = [
    ("students", ("Football", "Netball"), "play football", "play netball", "do not play netball", "play both sports", "student", "plays football"),
    ("children", ("Mangoes", "Avocados"), "like mangoes", "like avocados", "do not like avocados", "like both fruits", "child", "likes mangoes"),
    ("students", ("French", "Kiswahili"), "study French", "study Kiswahili", "do not study Kiswahili", "study both languages", "student",
     "studies French"),
    ("families", ("Cows", "Goats"), "keep cows", "keep goats", "do not keep goats", "keep both", "family", "keeps cows"),
    ("people", ("Bus", "Moto"), "use the bus", "use a moto", "do not use a moto", "use both", "person", "uses the bus"),
    ("farmers", ("Maize", "Beans"), "grow maize", "grow beans", "do not grow beans", "grow both crops", "farmer", "grows maize"),
]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    top = 15 if band == "P" else 30
    regions = [rng.randint(1, top), rng.randint(1, top), rng.randint(1, top), rng.randint(0, top)]
    return {"band": band, "context": rng.randrange(len(CONTEXTS)), "regions": regions}


def draw(p: dict):
    who, (la, lb), *_ = CONTEXTS[p["context"]]
    a, b, c, d = p["regions"]
    fig, ax = new_figure(6.0, 4.0)
    ax.add_patch(Rectangle((-3.0, -1.9), 6.0, 3.8, fill=False, edgecolor=INK, linewidth=1.4))
    for x in (-0.8, 0.8):
        ax.add_patch(Circle((x, -0.1), 1.45, fill=False, edgecolor=INK, linewidth=1.6))
    ax.text(-2.85, 1.65, "ξ", fontsize=13, va="top")
    ax.text(-1.9, 1.45, la, ha="center", fontsize=12, fontweight="bold")
    ax.text(1.9, 1.45, lb, ha="center", fontsize=12, fontweight="bold")
    for x, v in ((-1.45, a), (0.0, b), (1.45, c)):
        ax.text(x, -0.1, str(v), ha="center", va="center", fontsize=14)
    ax.text(2.55, -1.55, str(d), ha="center", va="center", fontsize=14)
    ax.set_xlim(-3.1, 3.1)
    ax.set_ylim(-2.0, 2.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _prob(v: Fraction, top: int, raw: int) -> tuple[str, list[str]]:
    forms = [f"{raw}/{top}"] if f"{raw}/{top}" != frac(v) else []
    if (v * 1000).denominator == 1:
        forms.append(f"{float(v):g}")
    return frac(v), forms


def questions(p: dict, rng: random.Random) -> list:
    who, _, doA, doB, notB, both, one, doesA = CONTEXTS[p["context"]]
    a, b, c, d = p["regions"]
    total = a + b + c + d
    qs = [
        short(f"The Venn diagram shows {total} {who}. How many {doA} but {notB}?", a),
        short(f"How many of the {who} {doB}?", b + c),
    ]
    if p["band"] == "P":
        qs.append(short(f"How many of the {who} {both}?", b))
    else:
        ans, forms = _prob(Fraction(b, total), total, b)
        qs.append(short(f"One of the {total} {who} is chosen at random. What is the probability that they {both}? "
                        "Give your answer as a fraction.", ans, forms))
    if p["band"] == "UP":
        ans, forms = _prob(Fraction(b, a + b), a + b, b)
        qs.append(short(f"A {one} who {doesA} is chosen at random. What is the probability that they also {doB}? "
                        "Give your answer as a fraction.", ans, forms))
    return qs
