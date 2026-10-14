"""Trace tables (UP, AL): Cambridge-style pseudocode of six to eight numbered lines with a loop, beside its trace
table, one row each time round the loop, with some cells left blank. Three programs: a FOR loop adding k times
the counter, a WHILE loop counting subtractions, and a FOR loop keeping the largest item of an array (printed
with its indices from 1). A blank cell, the final output, and how many times the loop's first line runs.

Every key is the program executed (`execute`); the last row's output variable is always blank, so the output is
worked out, not read off.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "trace_table"
KIND = "cs.code"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("algorithms", "variable-assignment", "iteration-control", "program-testing-running"))
AVOID = r"spreadsheet|database|network|internet|security|graphic|document|presentation|email|python|html|logic gate|boolean|monitoring and control|expert system|modelling|systems life cycle|animation|expert system|monitoring and control|modelling|mail merge|data, information, knowledge|data processing and information|project management|scheduling|low-level|declarative|introduction to java|introduction to visual basic|introduction to c\+\+|complex data structure|digital project"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"trace|pseudocode|algorithm|program|loop|iteration|variable|testing|dry.run|selection|repetition"
FILL = "#eef1f3"
COLUMNS = {"sum": ["Count", "Total"], "while": ["X", "Y"], "max": ["i", "Max"]}
OUTPUT = {"sum": "Total", "while": "Y", "max": "Max"}


def code(p: dict) -> list[str]:
    t, v = p["template"], p["values"]
    if t == "sum":
        return ["DECLARE Count, Total : INTEGER", "Total ← 0", f"FOR Count ← 1 TO {v['n']}",
                f"    Total ← Total + Count * {v['k']}", "NEXT Count", "OUTPUT Total"]
    if t == "while":
        return ["DECLARE X, Y : INTEGER", f"X ← {v['a']}", "Y ← 0", f"WHILE X > {v['b']}",
                f"    X ← X - {v['c']}", "    Y ← Y + 1", "ENDWHILE", "OUTPUT Y"]
    return ["DECLARE i, Max : INTEGER", "Max ← Nums[1]", f"FOR i ← 2 TO {len(v['list'])}", "    IF Nums[i] > Max THEN",
            "        Max ← Nums[i]", "    ENDIF", "NEXT i", "OUTPUT Max"]


# The line, numbered from 1, that runs once each time round the loop
BODY = {"sum": 4, "while": 5, "max": 4}


def execute(p: dict) -> tuple[list[dict], int]:
    """The trace table's rows, one each time round the loop, and the value output."""
    t, v = p["template"], p["values"]
    rows = []
    if t == "sum":
        total = 0
        for count in range(1, v["n"] + 1):
            total += count * v["k"]
            rows.append({"Count": count, "Total": total})
        return rows, total
    if t == "while":
        x, y = v["a"], 0
        while x > v["b"]:
            x -= v["c"]
            y += 1
            rows.append({"X": x, "Y": y})
        return rows, y
    nums = v["list"]
    best = nums[0]
    for i in range(2, len(nums) + 1):
        if nums[i - 1] > best:
            best = nums[i - 1]
        rows.append({"i": i, "Max": best})
    return rows, best


def sample(rng: random.Random) -> dict:
    t = rng.choice(["sum", "while", "max"])
    while True:
        if t == "sum":
            v = {"n": rng.randint(4, 6), "k": rng.randint(2, 9)}
        elif t == "while":
            v = {"a": rng.randint(20, 60), "b": rng.randint(0, 12), "c": rng.randint(3, 9)}
        else:
            v = {"list": rng.sample(range(1, 100), rng.randint(5, 7))}
        p = {"band": rng.choice(BANDS), "template": t, "values": v}
        rows, _ = execute(p)
        if not 4 <= len(rows) <= 7:
            continue
        if t == "max" and len({r["Max"] for r in rows}) < 3:  # the largest changes at least twice, so the IF matters
            continue
        out_col = OUTPUT[t]
        last = len(rows) - 1
        others = [(r, c) for r in range(len(rows)) for c in COLUMNS[t] if (r, c) != (last, out_col) and r > 0]
        blanks = [[last, out_col]] + [list(b) for b in rng.sample(others, rng.randint(1, 3))]
        p["blanks"] = sorted(blanks)
        return p


def draw(p: dict):
    lines = code(p)
    rows, _ = execute(p)
    cols = COLUMNS[p["template"]]
    blanks = {tuple(b) for b in p["blanks"]}
    fig, ax = new_figure(9.0, 4.2)
    top = 5.6
    lh = 0.6
    ax.add_patch(Rectangle((0, top - len(lines) * lh - 0.25), 6.3, len(lines) * lh + 0.5, facecolor="#f7f8f9", edgecolor=INK, linewidth=1.1))
    for i, line in enumerate(lines):
        y = top - (i + 0.5) * lh
        ax.text(0.15, y, f"{i + 1:>2}", ha="left", va="center", fontsize=9.5, family="monospace", color="#555555")
        ax.text(0.65, y, line, ha="left", va="center", fontsize=10, family="monospace")
    if p["template"] == "max":
        nums = p["values"]["list"]
        bx = 0.9
        ax.text(0.0, -0.15, "Nums", ha="left", va="center", fontsize=10, family="monospace", fontweight="bold")
        for j, v in enumerate(nums):
            x = 0.9 + j * bx
            ax.text(x + bx / 2, 0.33, str(j + 1), ha="center", va="center", fontsize=8.5, color="#555555")
            ax.add_patch(Rectangle((x, -0.45), bx, 0.6, facecolor=FILL, edgecolor=INK, linewidth=1.0))
            ax.text(x + bx / 2, -0.15, str(v), ha="center", va="center", fontsize=10.5)
    # the trace table: a row-number column, then one column a variable
    tx, cw, rh = 7.0, 1.25, 0.55
    heads = ["Row"] + cols
    ty = top
    for c, h in enumerate(heads):
        ax.add_patch(Rectangle((tx + c * cw, ty - rh), cw, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        ax.text(tx + c * cw + cw / 2, ty - rh / 2, h, ha="center", va="center", fontsize=10, fontweight="bold", family="monospace")
    for r, row in enumerate(rows):
        y = ty - (r + 2) * rh
        ax.add_patch(Rectangle((tx, y), cw, rh, facecolor="#f2f3f4", edgecolor=INK, linewidth=1.0))
        ax.text(tx + cw / 2, y + rh / 2, str(r + 1), ha="center", va="center", fontsize=9.5, color="#555555")
        for c, h in enumerate(cols):
            ax.add_patch(Rectangle((tx + (c + 1) * cw, y), cw, rh, facecolor="white", edgecolor=INK, linewidth=1.0))
            if (r, h) not in blanks:
                ax.text(tx + (c + 1.5) * cw, y + rh / 2, str(row[h]), ha="center", va="center", fontsize=10.5)
    bottom = min(ty - (len(rows) + 1) * rh, -0.45 if p["template"] == "max" else 0.4)
    ax.set_xlim(-0.2, tx + len(heads) * cw + 0.2)
    ax.set_ylim(bottom - 0.2, top + 0.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    rows, out = execute(p)
    r, col = rng.choice(p["blanks"])
    val = rows[r][col]
    body = BODY[p["template"]]
    statement = code(p)[body - 1].strip()
    return [short(f"{who} completes this trace table {rng.choice(SETTINGS)}. What is the value of {col} in row {r + 1} of the trace table?",
                  val, [str(val)]),
            short(f"What is output by line {len(code(p))}, OUTPUT {OUTPUT[p['template']]}, when {friend} runs this pseudocode?", out, [str(out)]),
            short(f"How many times does line {body}, {statement}, run?", len(rows), [str(len(rows)), f"{len(rows)} times"])]
