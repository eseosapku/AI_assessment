"""Spreadsheet formulas (LS, UP): a grid with column letters and row numbers, a header row and four or five rows of
names and numbers (test marks, or fruit sold at a market), and one cell below a column selected, its formula in the
formula bar above the grid. What
the formula's cell shows, what it shows when the formula is changed to another, and which cell holds a value.

Every key is the formula evaluated on the grid: SUM, AVERAGE (always a whole number here), MAX, MIN, COUNTIF and IF.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "spreadsheet_formula"
KIND = "table.data"
SUBJECT = "computing"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("spreadsheet-functions", "complex-formulas-functions", "spreadsheet-cells"))
AVOID = r"database|network|internet|security|graphic|presentation|email|python|html|logic gate|boolean|objects in a document"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"spreadsheet|formula|function|cell|worksheet|excel|calc"
CONTEXTS = {
    "marks": ("Name", ["Maths", "English", "Science"], NAMES, (20, 100)),
    "market": ("Day", ["Bananas", "Mangoes", "Avocados"], ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], (5, 60)),
}
WIDTH = {"A": 2.0, "B": 1.6, "C": 1.6, "D": 1.6}


def _cell(table, ref):
    return table[int(ref[1:]) - 1][ord(ref[0]) - ord("A")]


def _values(table, col, last):
    return [_cell(table, f"{col}{r}") for r in range(2, last + 1)]


def evaluate(table: list, text: str):
    """The value a formula of the five kinds drawn here gives."""
    import re
    m = re.fullmatch(r"=(SUM|AVERAGE|MAX|MIN)\(([A-D])2:\2(\d+)\)", text)
    if m:
        xs = _values(table, m.group(2), int(m.group(3)))
        return {"SUM": sum(xs), "MAX": max(xs), "MIN": min(xs), "AVERAGE": sum(xs) // len(xs)}[m.group(1)]
    m = re.fullmatch(r'=COUNTIF\(([A-D])2:\1(\d+),">(\d+)"\)', text)
    if m:
        return sum(x > int(m.group(3)) for x in _values(table, m.group(1), int(m.group(2))))
    m = re.fullmatch(r'=IF\(([A-D]\d+)>=(\d+),"(\w+)","(\w+)"\)', text)
    return m.group(3) if _cell(table, m.group(1)) >= int(m.group(2)) else m.group(4)


def _formula(kind: str, col: str, last: int, table: list, rng: random.Random, context: str) -> str:
    if kind in ("SUM", "AVERAGE", "MAX", "MIN"):
        return f"={kind}({col}2:{col}{last})"
    if kind == "COUNTIF":
        xs = sorted(_values(table, col, last))
        n = rng.choice(xs[:-1])  # a threshold some values pass and some do not
        return f'=COUNTIF({col}2:{col}{last},">{n}")'
    r = rng.randint(2, last)
    words = ("Pass", "Fail") if context == "marks" else ("High", "Low")
    return f'=IF({col}{r}>=50,"{words[0]}","{words[1]}")'


def sample(rng: random.Random) -> dict:
    context = rng.choice(list(CONTEXTS))
    head, cols, labels, (lo, hi) = CONTEXTS[context]
    while True:
        n = rng.randint(4, 5)
        names = rng.sample(labels, n) if context == "marks" else labels[:n]
        table = [[head] + cols] + [[nm] + [rng.randint(lo, hi) for _ in cols] for nm in names]
        col = rng.choice("BCD")
        last = n + 1
        if sum(_values(table, col, last)) % n:  # an AVERAGE asked of this column must be whole
            continue
        first, second = rng.sample(["SUM", "AVERAGE", "MAX", "MIN", "COUNTIF", "IF"], 2)
        f1, f2 = (_formula(k, col, last, table, rng, context) for k in (first, second))
        if evaluate(table, f1) == evaluate(table, f2):
            continue
        numbers = [x for row in table[1:] for x in row[1:]]
        once = [x for x in numbers if numbers.count(x) == 1]
        if not once:
            continue
        return {"band": rng.choice(BANDS), "context": context, "table": table, "col": col, "at": f"{col}{last + 1}",
                "formula": f1, "change": f2, "find": rng.choice(once)}


def draw(p: dict):
    table = p["table"]
    rows = len(table) + 1  # and the formula's row
    fig, ax = new_figure(7.4, 3.8)
    rh = 0.55
    xs, x = {}, 0.6
    for c in "ABCD":
        xs[c] = x
        x += WIDTH[c]
    top = (rows + 1) * rh
    # column letters and row numbers
    for c in "ABCD":
        ax.add_patch(Rectangle((xs[c], top - rh), WIDTH[c], rh, facecolor="#d9dee3", edgecolor="#777777", linewidth=0.8))
        ax.text(xs[c] + WIDTH[c] / 2, top - rh / 2, c, ha="center", va="center", fontsize=10, fontweight="bold")
    ax.add_patch(Rectangle((0, top - rh), 0.6, rh, facecolor="#d9dee3", edgecolor="#777777", linewidth=0.8))
    for r in range(1, rows + 1):
        y = top - (r + 1) * rh
        ax.add_patch(Rectangle((0, y), 0.6, rh, facecolor="#d9dee3", edgecolor="#777777", linewidth=0.8))
        ax.text(0.3, y + rh / 2, str(r), ha="center", va="center", fontsize=10, fontweight="bold")
        for c in "ABCD":
            ref = f"{c}{r}"
            is_formula = ref == p["at"]
            ax.add_patch(Rectangle((xs[c], y), WIDTH[c], rh, facecolor="#fff6cc" if is_formula else "white",
                                   edgecolor=INK if is_formula else "#999999", linewidth=1.6 if is_formula else 0.8))
            if r <= len(table):
                v = table[r - 1][ord(c) - ord("A")]
                bold = "bold" if r == 1 else "normal"
                if isinstance(v, int):
                    ax.text(xs[c] + WIDTH[c] - 0.12, y + rh / 2, str(v), ha="right", va="center", fontsize=10.5)
                else:
                    ax.text(xs[c] + 0.12, y + rh / 2, v, ha="left", va="center", fontsize=10.5, fontweight=bold)
    # the formula bar: the selected cell's name and its formula, as a spreadsheet shows them (P3k look)
    fy = top + 0.25
    ax.add_patch(Rectangle((0, fy), 1.2, rh, facecolor="white", edgecolor="#777777", linewidth=0.8))
    ax.text(0.6, fy + rh / 2, p["at"], ha="center", va="center", fontsize=10.5, fontweight="bold")
    ax.add_patch(Rectangle((1.2, fy), x - 1.2, rh, facecolor="white", edgecolor="#777777", linewidth=0.8))
    ax.text(1.35, fy + rh / 2, "fx", ha="left", va="center", fontsize=10.5, style="italic", color="#555555")
    ax.text(1.85, fy + rh / 2, p["formula"], ha="left", va="center", fontsize=10.5, family="monospace")
    ax.set_xlim(-0.1, x + 0.1)
    ax.set_ylim(-0.1, fy + rh + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def _forms(v) -> list[str]:
    return [str(v)]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    table, at = p["table"], p["at"]
    v1, v2 = evaluate(table, p["formula"]), evaluate(table, p["change"])
    find = p["find"]
    ref = next(f"{chr(ord('A') + c)}{r + 1}" for r, row in enumerate(table) for c, x in enumerate(row) if x == find)
    return [short(f"{who} types the formula shown in cell {at} {rng.choice(SETTINGS)}. What does cell {at} show?", v1, _forms(v1)),
            short(f"{friend} changes the formula in {at} to {p['change']}. What value is shown in cell {at} now?", v2, _forms(v2)),
            short(f"Look at the spreadsheet {who} made. Which cell holds {find}?", ref, [ref, ref.lower(), f"cell {ref}", f"cell {ref.lower()}"])]
