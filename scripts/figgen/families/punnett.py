"""Punnett square for a single gene with complete dominance, one cell left blank."""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import mcq, new_figure, short

ID = "punnett"
KIND = "bio.genetics"
SUBJECT = "biology"
BANDS = ("UP",)

# Pea plant traits Mendel studied: (gene letter, dominant, recessive, what it is)
TRAITS = [
    ("T", "tall", "short", "height of pea plants"),
    ("R", "round seeds", "wrinkled seeds", "seed shape in peas"),
    ("Y", "yellow seeds", "green seeds", "seed colour in peas"),
    ("P", "purple flowers", "white flowers", "flower colour in peas"),
]
CROSSES = [("Aa", "Aa"), ("Aa", "aa"), ("AA", "aa"), ("AA", "Aa"), ("aa", "Aa"), ("Aa", "AA")]


def _genotype(a: str, b: str) -> str:
    return "".join(sorted([a, b], key=lambda c: (c.islower(), c)))  # dominant allele first: Tt, not tT


def sample(rng: random.Random) -> dict:
    letter, dom, rec, what = rng.choice(TRAITS)
    p1, p2 = rng.choice(CROSSES)
    p1 = p1.replace("A", letter).replace("a", letter.lower())
    p2 = p2.replace("A", letter).replace("a", letter.lower())
    blank = [rng.randrange(2), rng.randrange(2)]
    return {"letter": letter, "dom": dom, "rec": rec, "what": what, "p1": p1, "p2": p2, "blank": blank}


def offspring(p: dict) -> list[list[str]]:
    return [[_genotype(a, b) for b in p["p2"]] for a in p["p1"]]


def draw(p: dict):
    cells = offspring(p)
    fig, ax = new_figure(4.6, 4.2)
    for r in range(2):
        for c in range(2):
            ax.add_patch(Rectangle((c + 1, 1 - r), 1, 1, fill=False, edgecolor="#111111", linewidth=1.6))
            text = "?" if [r, c] == p["blank"] else cells[r][c]
            ax.text(c + 1.5, 1.5 - r, text, ha="center", va="center", fontsize=18)
    for c, g in enumerate(p["p2"]):
        ax.text(c + 1.5, 2.25, g, ha="center", va="center", fontsize=16, fontweight="bold")
    for r, g in enumerate(p["p1"]):
        ax.text(0.7, 1.5 - r, g, ha="center", va="center", fontsize=16, fontweight="bold")
    ax.text(2, 2.65, f"Parent 2: {p['p2']}", ha="center", fontsize=11)
    ax.text(0.2, 1.0, f"Parent 1: {p['p1']}", ha="center", va="center", rotation=90, fontsize=11)
    ax.set_xlim(-0.1, 3.2)
    ax.set_ylim(-0.2, 2.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    cells = offspring(p)
    r, c = p["blank"]
    flat = [g for row in cells for g in row]
    recessive = sum(1 for g in flat if g == p["letter"].lower() * 2)
    pct = f"{recessive * 25}%"
    allele = p["letter"]
    # "tall" and "short" describe the plant; the other traits name a part ("wrinkled seeds").
    plain = " " not in p["rec"]
    dom, rec = (f"{p['dom']} plants", f"{p['rec']} plants") if plain else (p["dom"], p["rec"])
    note = f"{allele} is the allele for {dom}; {allele.lower()} is the allele for {rec}."
    shows = f"be {p['rec']}" if plain else f"have {p['rec']}"
    return [
        # Chosen, not typed: the app's marker ignores letter case, so TT, Tt and tt would mark the same.
        mcq(f"{note} Which genotype goes in the box marked ?", cells[r][c],
            [g for g in (allele * 2, allele + allele.lower(), allele.lower() * 2) if g != cells[r][c]], rng),
        mcq(f"{note} What percentage of the offspring are expected to {shows}?", pct,
            rng.sample([x for x in ["0%", "25%", "50%", "75%", "100%"] if x != pct], 3), rng),
    ]
