"""A two-way table with totals and some cells left blank: complete it, then use it (LS, UP).

The blank cells are chosen so each can be worked out from a row or column total, one after
another, and the one asked about is always among them.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, frac, mcq, new_figure, short  # noqa: F401

ID = "two_way_table"
KIND = "table.data"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "frequency-distribution-table", "calculating-probabilities", "conditional-probability", "statistical-data-interpretation",
    "data-examining",
))

# title, columns, how to say a row's people do a column ("walk to school"), and of one person ("walks")
CONTEXTS = [
    ("How students travel to school", ["Walk", "Bus", "Bicycle"], ["walk to school", "come by bus", "cycle to school"],
     ["walks to school", "comes by bus", "cycles to school"]),
    ("What students chose for lunch", ["Rice", "Ugali", "Beans"], ["chose rice", "chose ugali", "chose beans"],
     ["chose rice", "chose ugali", "chose beans"]),
    ("Which club students joined", ["Music", "Football", "Drama"], ["joined the music club", "joined the football club",
                                                                     "joined the drama club"],
     ["joined the music club", "joined the football club", "joined the drama club"]),
]
ROWS = ["Boys", "Girls"]
ONE = {"Boys": "boy", "Girls": "girl"}


def _determined(table, blanks) -> bool:
    left = set(map(tuple, blanks))
    rows, cols = len(table), len(table[0])
    while left:
        for r, c in sorted(left):
            if sum(1 for cc in range(cols) if (r, cc) in left) == 1 or sum(1 for rr in range(rows) if (rr, c) in left) == 1:
                left.discard((r, c))
                break
        else:
            return False
    return True


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    ci = rng.randrange(len(CONTEXTS))
    body = [[rng.randint(3, 30) for _ in range(3)] for _ in ROWS]
    table = [row + [sum(row)] for row in body]
    table.append([sum(table[r][c] for r in range(len(ROWS))) for c in range(4)])
    cells = [(r, c) for r in range(3) for c in range(4) if (r, c) != (2, 3)]
    while True:
        blanks = rng.sample(cells, rng.randint(2, 4))
        if _determined(table, blanks) and any(r < 2 and c < 3 for r, c in blanks):
            break
    asked = rng.choice([[r, c] for r, c in blanks if r < 2 and c < 3])
    fraction_cell = [rng.randrange(2), rng.randrange(3)]
    given_cell = [rng.randrange(2), rng.randrange(3)]
    return {"band": band, "context": ci, "table": table, "blanks": [list(b) for b in blanks], "asked": asked,
            "fraction_cell": fraction_cell, "given_cell": given_cell}


def draw(p: dict):
    title, cols, *_ = CONTEXTS[p["context"]]
    t, blanks = p["table"], {tuple(b) for b in p["blanks"]}
    heads = [""] + cols + ["Total"]
    names = ROWS + ["Total"]
    fig, ax = new_figure(6.0, 2.6)
    w, h = 1.3, 0.6
    for c, head in enumerate(heads):
        ax.add_patch(Rectangle((c * w, 3 * h), w, h, facecolor=FILL_2 if c else "white", edgecolor=INK, linewidth=1))
        ax.text(c * w + w / 2, 3.5 * h, head, ha="center", va="center", fontsize=11, fontweight="bold")
    for r, name in enumerate(names):
        y = (2 - r) * h
        ax.add_patch(Rectangle((0, y), w, h, facecolor=FILL_2, edgecolor=INK, linewidth=1))
        ax.text(w / 2, y + h / 2, name, ha="center", va="center", fontsize=11, fontweight="bold")
        for c in range(4):
            ax.add_patch(Rectangle(((c + 1) * w, y), w, h, facecolor="white", edgecolor=INK, linewidth=1))
            if (r, c) not in blanks:
                ax.text((c + 1.5) * w, y + h / 2, str(t[r][c]), ha="center", va="center", fontsize=12)
    ax.set_title(title, fontsize=12)
    ax.set_xlim(-0.05, 5 * w + 0.05)
    ax.set_ylim(-0.05, 4 * h + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _prob(v: Fraction, raw: int, top: int) -> tuple[str, list[str]]:
    forms = [f"{raw}/{top}"] if f"{raw}/{top}" != frac(v) else []
    if (v * 1000).denominator == 1:
        forms.append(f"{float(v):g}")
    return frac(v), forms


def questions(p: dict, rng: random.Random) -> list:
    _, cols, do, does = CONTEXTS[p["context"]]
    t = p["table"]
    r, c = p["asked"]
    total = t[-1][-1]
    qs = [short(f"Some numbers are missing from the table. How many {ROWS[r].lower()} {do[c]}?", t[r][c])]
    rr, cc = p["fraction_cell"]
    ans, forms = _prob(Fraction(t[rr][cc], total), t[rr][cc], total)
    qs.append(short(f"What fraction of the {total} students are {ROWS[rr].lower()} who {do[cc]}? Give your answer as a fraction.",
                    ans, forms))
    if p["band"] == "UP":
        rr, cc = p["given_cell"]
        ans, forms = _prob(Fraction(t[rr][cc], t[rr][-1]), t[rr][cc], t[rr][-1])
        qs.append(short(f"A {ONE[ROWS[rr]]} is chosen at random. What is the probability that the {ONE[ROWS[rr]]} {does[cc]}?",
                        ans, forms))
    return qs
