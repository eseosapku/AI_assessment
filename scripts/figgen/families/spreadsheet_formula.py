"""Spreadsheet formulas (LS, UP): a grid with column letters and row numbers, a header row and four or five rows of
names and numbers (test marks, or fruit sold at a market), and one cell below a column selected, its formula in the
formula bar above the grid. What
the formula's cell shows, what it shows when the formula is changed to another, and which cell holds a value.

Every key is the formula evaluated on the grid: SUM, AVERAGE (always a whole number here), MAX, MIN, COUNTIF and IF.

A what-if model (P4, sub "whatif"): a small model in a spreadsheet (a juice stall's profit, a poultry farm's week, a
savings plan for a bicycle) with its input cells shaded and the formula of every other cell printed beside it. One
input cell is changed: what the result cell shows then, what a middle cell shows then, and the smallest whole value of
an input that makes the result pass a stated mark (a goal-seek by hand). Every key is the printed formulas worked
through on the new inputs.
"""
from __future__ import annotations

import random
import re

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, NAMES, money, new_figure, short

ID = "spreadsheet_formula"
KIND = "table.data"
SUBJECT = "computing"
BANDS = ("LS", "UP")
# An Upper Secondary spreadsheet is drawn the same in the AS Level IT chapters named "Spreadsheets" and "Modelling".
ALSO_BANDS = {"UP": ("AL",)}
FORMULA = tuple(f"computing.{c}" for c in ("spreadsheet-functions", "complex-formulas-functions", "spreadsheet-cells",
                                           "microsoft-excel", "data-manipulation"))
WHATIF = tuple(f"computing.{c}" for c in ("spreadsheet-what-if-analysis", "modelling", "complex-formulas-functions",
                                          "spreadsheet-cells", "microsoft-excel", "data-manipulation"))
CONCEPTS = tuple(dict.fromkeys(FORMULA + WHATIF))
AVOID = (r"database|network|internet|security|graphic|presentation|email|python|html|logic gate|boolean|"
         r"objects in a document|operating system|chart|export|c\+\+|java|visual basic|\bAI\b|artificial|project")
# A topic whose sections the book lists is reached only if one names what this figure teaches; an AS Level topic only
# if its name does ("Spreadsheets", "Chapter 8: Spreadsheets", "Modelling"). The IGCSE ICT book by Brown and Watson
# names its spreadsheet chapter "Create a data model" (sections "Manipulate data", "Present data").
NEEDS = r"spreadsheet|formula|function|cell|worksheet|excel|calc|google sheet|data model|manipulate data|^modelling$"
CONTEXTS = {
    "marks": ("Name", ["Maths", "English", "Science"], NAMES, (20, 100)),
    "market": ("Day", ["Bananas", "Mangoes", "Avocados"], ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], (5, 60)),
}
WIDTH = {"A": 2.0, "B": 1.6, "C": 1.6, "D": 1.6}


def concepts_for(p: dict) -> tuple[str, ...]:
    return WHATIF if p.get("sub") == "whatif" else FORMULA


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
    if rng.random() < 0.35:
        return _sample_whatif(rng)
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
    if p.get("sub") == "whatif":
        return _draw_whatif(p)
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
    if p.get("sub") == "whatif":
        return _whatif_questions(p, rng)
    who, friend = rng.sample(NAMES, 2)
    table, at = p["table"], p["at"]
    v1, v2 = evaluate(table, p["formula"]), evaluate(table, p["change"])
    find = p["find"]
    ref = next(f"{chr(ord('A') + c)}{r + 1}" for r, row in enumerate(table) for c, x in enumerate(row) if x == find)
    return [short(f"{who} types the formula shown in cell {at} {rng.choice(SETTINGS)}. What does cell {at} show?", v1, _forms(v1)),
            short(f"{friend} changes the formula in {at} to {p['change']}. What value is shown in cell {at} now?", v2, _forms(v2)),
            short(f"Look at the spreadsheet {who} made. Which cell holds {find}?", ref, [ref, ref.lower(), f"cell {ref}", f"cell {ref.lower()}"])]


# --- what-if models (P4) ----------------------------------------------------------------------------
# Each model: its title, its input rows (label, the values it may take), its formula rows (label, formula), the goal
# a student seeks by hand (the input to vary, the result cell, the test, the mark) and the noun of the varied input.
MODELS = {
    "stall": {"title": "Juice stall model",
              "inputs": [("Price of one cup (Frw)", list(range(300, 601, 50))), ("Cups sold", list(range(30, 91))),
                         ("Cost of one cup (Frw)", list(range(100, 251, 50))), ("Stall rent (Frw)", list(range(2000, 8001, 500)))],
              "outputs": [("Income (Frw)", "=B2*B3"), ("Total cost (Frw)", "=B4*B3+B5"), ("Profit (Frw)", "=B6-B7")],
              "goal": ["B3", "B8", ">", 0], "noun": "cups sold"},
    "farm": {"title": "Poultry farm model",
             "inputs": [("Number of hens", list(range(20, 61))), ("Eggs from one hen in a week", [4, 5, 6]),
                        ("Price of one egg (Frw)", list(range(100, 151, 10))),
                        ("Feed cost for the week (Frw)", list(range(5000, 15001, 500)))],
             "outputs": [("Eggs in a week", "=B2*B3"), ("Income for the week (Frw)", "=B6*B4"),
                         ("Profit for the week (Frw)", "=B7-B5")],
             "goal": ["B2", "B8", ">", 0], "noun": "hens"},
    "savings": {"title": "Bicycle savings model",
                "inputs": [("Money saved each week (Frw)", list(range(1000, 3001, 500))), ("Number of weeks", list(range(10, 31))),
                           ("Money at the start (Frw)", list(range(5000, 20001, 1000))),
                           ("Price of the bicycle (Frw)", list(range(60000, 120001, 5000)))],
                "outputs": [("Total saved (Frw)", "=B2*B3+B4"), ("Still needed (Frw)", "=B5-B6")],
                "goal": ["B3", "B7", "<=", 0], "noun": "weeks"},
    "tailor": {"title": "Tailoring shop model",
               "inputs": [("Dresses sold", list(range(5, 21))), ("Metres of cloth for one dress", [2, 3, 4]),
                          ("Price of 1 m of cloth (Frw)", list(range(1500, 3001, 500))),
                          ("Selling price of one dress (Frw)", list(range(12000, 20001, 1000)))],
               "outputs": [("Cloth needed (m)", "=B2*B3"), ("Cost of cloth (Frw)", "=B6*B4"), ("Income (Frw)", "=B2*B5"),
                           ("Profit (Frw)", "=B8-B7")],
               "goal": ["B2", "B9", ">=", None], "noun": "dresses sold"},
}
TESTS = {">": lambda v, m: v > m, ">=": lambda v, m: v >= m, "<=": lambda v, m: v <= m}


def run_model(formulas: list, inputs: dict) -> dict:
    """Every cell's value: the inputs as given, then each formula in row order, worked out on the cells above it."""
    cells = dict(inputs)
    for ref, text in formulas:
        expr = re.sub(r"B\d+", lambda m: str(cells[m.group(0)]), text[1:])
        assert re.fullmatch(r"[\d+\-*() ]+", expr), expr
        cells[ref] = eval(expr)  # noqa: S307 -- digits and + - * only, from the model table above
    return cells


def _formulas(model: dict) -> list:
    k = len(model["inputs"])
    return [[f"B{k + 2 + i}", f] for i, (_, f) in enumerate(model["outputs"])]


def _goal_value(formulas: list, inputs: dict, goal: list) -> int | None:
    ref, out, test, mark = goal
    for v in range(0, 5001):
        if TESTS[test](run_model(formulas, {**inputs, ref: v})[out], mark):
            return v
    return None


def _sample_whatif(rng: random.Random) -> dict:
    key = rng.choice(list(MODELS))
    model = MODELS[key]
    formulas = _formulas(model)
    result = formulas[-1][0]
    while True:
        values = [rng.choice(choices) for _, choices in model["inputs"]]
        inputs = {f"B{i + 2}": v for i, v in enumerate(values)}
        if key == "stall" and values[2] > values[0] - 100:
            continue
        cells = run_model(formulas, inputs)
        if cells[result] <= 0 or any(cells[r] < 0 for r, _ in formulas):
            continue
        ref = rng.choice(list(inputs))
        row = int(ref[1:]) - 2
        new = rng.choice([v for v in model["inputs"][row][1] if v != inputs[ref]])
        if key == "stall" and ref in ("B2", "B4") and {**inputs, ref: new}["B4"] > {**inputs, ref: new}["B2"] - 100:
            continue
        after = run_model(formulas, {**inputs, ref: new})
        mids = [r for r, _ in formulas[:-1] if after[r] != cells[r]]
        if after[result] <= 0 or after[result] == cells[result] or not mids:
            continue
        goal = list(model["goal"])
        if goal[3] is None:  # a round mark above today's profit
            goal[3] = (cells[result] // 10000 + rng.randint(2, 6)) * 10000
        target = _goal_value(formulas, inputs, goal)
        if target is None or target == inputs[goal[0]] or target <= 0:
            continue
        table = [["Item", "Value", "Formula in B"]]
        table += [[label, inputs[f"B{i + 2}"], ""] for i, (label, _) in enumerate(model["inputs"])]
        table += [[label, cells[r], f] for (label, _), (r, f) in zip(model["outputs"], formulas)]
        return {"band": rng.choice(BANDS), "sub": "whatif", "model": key, "title": model["title"], "table": table,
                "inputs": len(model["inputs"]), "change": [ref, new], "mid": rng.choice(mids), "result": result,
                "goal": goal, "noun": model["noun"]}


def _draw_whatif(p: dict):
    table = p["table"]
    widths = {"A": 3.5, "B": 1.5, "C": 1.9}
    rh = 0.5
    rows = len(table)
    fig, ax = new_figure(7.6, 0.6 + 0.5 * (rows + 3))
    xs, x = {}, 0.6
    for c in "ABC":
        xs[c] = x
        x += widths[c]
    top = (rows + 1) * rh
    ax.text(0, top + 0.18, p["title"], ha="left", va="bottom", fontsize=12, fontweight="bold")
    for c in "ABC":
        ax.add_patch(Rectangle((xs[c], top - rh), widths[c], rh, facecolor="#d9dee3", edgecolor="#777777", linewidth=0.8))
        ax.text(xs[c] + widths[c] / 2, top - rh / 2, c, ha="center", va="center", fontsize=10, fontweight="bold")
    ax.add_patch(Rectangle((0, top - rh), 0.6, rh, facecolor="#d9dee3", edgecolor="#777777", linewidth=0.8))
    for r in range(1, rows + 1):
        y = top - (r + 1) * rh
        ax.add_patch(Rectangle((0, y), 0.6, rh, facecolor="#d9dee3", edgecolor="#777777", linewidth=0.8))
        ax.text(0.3, y + rh / 2, str(r), ha="center", va="center", fontsize=10, fontweight="bold")
        is_input = 2 <= r <= p["inputs"] + 1
        for i, c in enumerate("ABC"):
            v = table[r - 1][i]
            shade = FILL_2 if (is_input and c == "B") else "white"
            ax.add_patch(Rectangle((xs[c], y), widths[c], rh, facecolor=shade, edgecolor="#999999", linewidth=0.8))
            if v == "":
                continue
            if r == 1:
                ax.text(xs[c] + 0.12, y + rh / 2, v, ha="left", va="center", fontsize=10.5, fontweight="bold")
            elif isinstance(v, int):
                ax.text(xs[c] + widths[c] - 0.12, y + rh / 2, str(v), ha="right", va="center", fontsize=10.5)
            elif c == "C":
                ax.text(xs[c] + 0.12, y + rh / 2, v, ha="left", va="center", fontsize=10.5, family="monospace")
            else:
                ax.text(xs[c] + 0.12, y + rh / 2, v, ha="left", va="center", fontsize=10.5)
    # the key: which cells are typed in
    ky = top - (rows + 1) * rh - 0.45
    ax.add_patch(Rectangle((0.6, ky - 0.15), 0.45, 0.3, facecolor=FILL_2, edgecolor="#999999", linewidth=0.8))
    ax.text(1.2, ky, "input cell (typed in); the other values in column B come from the formulas in column C",
            ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-0.1, x + 0.1)
    ax.set_ylim(ky - 0.3, top + 0.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


WHATIF_SETTINGS = ["in an ICT lesson", "to plan ahead", "for a class project", "at the computer club", "for homework",
                   "before market day"]
GOAL_WORDS = {">": "more than {m}", ">=": "at least {m}", "<=": "{m} or less"}


def _num_forms(v: int, frw: bool) -> list[str]:
    return money(v) if frw else [str(v)]


def _whatif_questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    table, k = p["table"], p["inputs"]
    labels = {f"B{r + 1}": row[0] for r, row in enumerate(table) if r}
    inputs = {f"B{i + 2}": table[i + 1][1] for i in range(k)}
    formulas = [[f"B{r + 1}", row[2]] for r, row in enumerate(table) if r > k]
    ref, new = p["change"]
    after = run_model(formulas, {**inputs, ref: new})
    res, mid = p["result"], p["mid"]
    title = p["title"][0].lower() + p["title"][1:]
    frw = lambda r: "(Frw)" in labels[r]  # noqa: E731
    gref, gout, test, mark = p["goal"]
    target = _goal_value(formulas, inputs, p["goal"])
    cond = GOAL_WORDS[test].format(m=mark)
    return [short(f"{who} uses the {title} {rng.choice(WHATIF_SETTINGS)}. If cell {ref} is changed from {inputs[ref]} to "
                  f"{new}, what value will cell {res} show?", after[res], _num_forms(after[res], frw(res))),
            short(f"In the {title}, the value in cell {ref} is changed to {new}. What will cell {mid} show then?",
                  after[mid], _num_forms(after[mid], frw(mid))),
            short(f"In the {title}, with the other inputs as shown, what is the smallest whole number of {p['noun']} "
                  f"in cell {gref} that makes cell {gout} {cond}?", target, [str(target), f"{target} {p['noun']}"])]
