"""Excludability and rivalry (AL): a table of five or six goods, lettered J to P as Cambridge multiple-choice papers
letter them, each with two facts stated Yes or No (is it rival: does one person's use leave less for others? is it
excludable: can people who do not pay be kept from using it?), and under it the 2 × 2 grid of rival / non-rival
against excludable / non-excludable, its boxes lettered W, X, Y and Z. The columns and rows come in either order, so
no box letter always means the same kind of good.

Asks which box a good belongs in, by its facts in the table; how many goods in the table are public goods (non-rival
and non-excludable); and which of four goods is a private good (rival and excludable) or a public good. The goods are
letters, not named things, so the table's facts decide every answer: "Is street lighting a public good?" is knowledge,
not the figure (P4 brief: a table that states the answer is not a question, and the case must be asked about).
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, count, mcq
from .econ_tables import fit, sheet, table

ID = "goods_grid"
KIND = "table.data"
SUBJECT = "economics"
BANDS = ("AL",)
CONCEPTS = ("economics.excludability-and-rivalry", "economics.public-private-goods")
# A topic whose sections the book lists is reached only if its name or a section names these ideas.
NEEDS = r"excludab|rival|public goods?|private goods?"

LETTERS = "JKLMNP"
# (rival, excludable) of each kind of good
TYPES = {"private": (True, True), "public": (False, False), "common": (True, False), "club": (False, True)}
TOWNS = ["Huye", "Musanze", "Rubavu", "Nyagatare", "Rusizi", "Muhanga", "Kayonza", "Karongi"]
RIVAL = "Rival?\n(one person's use leaves\nless for others)"
EXCL = "Excludable?\n(people who do not pay can\nbe kept from using it)"


def sample(rng: random.Random) -> dict:
    while True:
        n_public, n_private = rng.choice([1, 2]), rng.choice([1, 2])
        n = rng.choice([5, 6])
        rest = n - n_public - n_private
        if rest < 2:
            continue
        n_common = rng.randint(1, rest - 1)
        kinds = ["public"] * n_public + ["private"] * n_private + ["common"] * n_common + ["club"] * (rest - n_common)
        rng.shuffle(kinds)
        goods = [[letter, *TYPES[k]] for letter, k in zip(LETTERS, kinds)]
        ask_type = rng.choice(["private", "public"])
        if sum(k != ask_type for k in kinds) < 3:
            continue
        return {"band": "AL", "town": rng.choice(TOWNS), "goods": goods, "cols": rng.choice([[True, False], [False, True]]),
                "rows": rng.choice([[True, False], [False, True]]), "ask_box": rng.choice(LETTERS[:n]), "ask_type": ask_type}


def _box(p: dict, rival: bool, excludable: bool) -> str:
    """The box letter the grid gives a good: boxes lettered in reading order, W X on the top row and Y Z below."""
    return "WXYZ"[2 * p["rows"].index(excludable) + p["cols"].index(rival)]


def draw(p: dict):
    rows = [[f"Good {g}", "Yes" if r else "No", "Yes" if e else "No"] for g, r, e in p["goods"]]
    heads = ["Good", RIVAL, EXCL]
    widths = [fit(h, *(r[j] for r in rows), least=1.0) for j, h in enumerate(heads)]
    side, box, head_h, rh, hh = 1.55, 1.25, 0.36, 0.36, 0.86
    grid_w = side + 2 * box
    width = max(sum(widths), grid_w) + 0.2
    title = f"Features of {['five', 'six'][len(rows) - 5]} goods in {p['town']}"
    top_table = -0.42
    table_bottom = top_table - hh - rh * len(rows)
    grid_top = table_bottom - 0.5
    height = -(grid_top - head_h - 2 * box) + 0.1
    fig, ax = sheet(width, height)
    ax.text(width / 2, -0.18, title, ha="center", va="center", fontsize=10.5, fontweight="bold")
    table(ax, heads, rows, widths, top=top_table, rh=rh, hh=hh, align=["l", "c", "c"], x0=(width - sum(widths)) / 2)
    x0 = (width - grid_w) / 2 + side
    for j, rival in enumerate(p["cols"]):
        ax.text(x0 + box * (j + 0.5), grid_top - head_h / 2, "Rival" if rival else "Non-rival", ha="center",
                va="center", fontsize=10, fontweight="bold")
    for i, excl in enumerate(p["rows"]):
        yc = grid_top - head_h - box * (i + 0.5)
        ax.text(x0 - 0.12, yc, "Excludable" if excl else "Non-excludable", ha="right", va="center", fontsize=10,
                fontweight="bold")
        for j, rival in enumerate(p["cols"]):
            ax.add_patch(Rectangle((x0 + box * j, yc - box / 2), box, box, facecolor="white", edgecolor=INK, linewidth=1.2))
            ax.text(x0 + box * (j + 0.5), yc, _box(p, rival, excl), ha="center", va="center", fontsize=18,
                    fontweight="bold")
    return fig


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    goods = {g: (r, e) for g, r, e in p["goods"]}
    g = p["ask_box"]
    public = [k for k, (r, e) in goods.items() if not r and not e]
    kind = p["ask_type"]
    want = [k for k, v in goods.items() if v == TYPES[kind]]
    key = rng.choice(want)
    others = rng.sample([k for k in goods if k not in want], 3)
    return [
        mcq(f"{who} {rng.choice(VERBS)} this table and grid of goods in {p['town']} {rng.choice(SETTINGS)}. Using the "
            f"table, in which box of the grid does Good {g} belong?", f"Box {_box(p, *goods[g])}",
            [f"Box {b}" for b in "WXYZ" if b != _box(p, *goods[g])], rng),
        count(f"For the goods in {p['town']}: How many of the goods in the table are public goods?", len(public), "goods",
              "public goods"),
        mcq(f"For the goods in {p['town']}, using the table: which of these goods is a {kind} good?", f"Good {key}",
            [f"Good {k}" for k in others], rng),
    ]
