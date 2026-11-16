"""Decimals, powers of ten, standard form and bounds (LS, UP), as Cambridge Lower Secondary "Decimals" (ordering
decimals), "Multiplying and dividing by powers of 10" (and upper and lower bounds), and Cambridge IGCSE "Fractions,
percentages and standard form" and "Understanding measurement" (limits of accuracy) teach them.

Four kinds of figure:
- shift (LS): a place-value chart (thousands to thousandths) with a number in its top row and, below, the number
  after it was multiplied or divided by 10, 100 or 1000, every digit moved. What was it multiplied or divided by (MCQ,
  times or divide by 10 or 100 -- a 2 by 2 design)? Or the lower row empty: what number goes there?
- line (LS): a stretch of number line between two decimals, ticks in tenths of the gap, points lettered P, Q, R. The
  value at a letter; which letter is a given number; which is the greatest.
- standard (LS, UP): a place-value chart from millions to millionths holding a large or small number. The number in
  standard form (MCQ: the power's size and sign varied); the power of ten.
- bounds (LS, UP): a digital display (a scale, a stopwatch, a tape) showing a measurement and the accuracy it is
  given to. Its lower bound, its upper bound, and the error interval (MCQ: the bounds half a unit or a whole unit
  away, with the right or wrong inequality signs).
"""
from __future__ import annotations

import random
from decimal import Decimal

from matplotlib.patches import FancyBboxPatch, Rectangle

from ..core import FILL_2, INK, NAMES, mcq, new_figure, short

ID = "decimal_chart"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = ("mathematics.decimals", "mathematics.powers-of-10", "mathematics.multiplication-division-decimals",
            "mathematics.decimals-multiplying", "mathematics.standard-form", "mathematics.bounds-upper-lower",
            "mathematics.estimating-and-rounding")
# A topic whose sections the book lists is reached only if its name or a section names what the figure teaches.
NEEDS = r"decimal|powers? of|standard form|bound|limits of accuracy|numeration|0\.1"
AVOID = r"bases|glossary|recurring|project|sets of numbers"

SUP = str.maketrans("0123456789-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻")
SHIFT_COLS = ["Th", "H", "T", "O", "t", "h", "th"]  # thousands ... thousandths
STD_COLS = ["M", "HTh", "TTh", "Th", "H", "T", "O", "t", "h", "th", "tth", "hth", "m"]
SHIFT_LEADS = ["{n} shows a number on a place value chart, and the number after one step.",
               "{n} moves the digits of a number on a place value chart.",
               "{n} multiplies or divides a number and shows it on a place value chart.",
               "{n} writes a number and its answer on a place value chart."]
LINE_LEADS = ["{n} marks some decimals on a number line.", "{n} zooms in on part of a number line.",
              "{n} places decimals on a number line.", "{n} labels points on a number line."]
STD_LEADS = ["{n} writes a number in a place value chart.", "{n} puts a very {size} number in a place value chart.",
             "{n} shows a {size} number on a place value chart.", "{n} copies a {size} number into a place value chart."]
BOUND_LEADS = ["{n} reads a measurement from the display shown.", "{n} records the reading shown on the display.",
               "{n} writes down the measurement on the display.", "{n} notes the display's reading."]
DEVICES = [("kitchen scale", "g", "mass", "m"), ("stopwatch", "s", "time", "t"), ("tape measure", "cm", "length", "l"),
           ("thermometer", "°C", "temperature", "T"), ("measuring jug", "ml", "volume", "V")]


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["sub"] == "standard":
        return ("mathematics.standard-form", "mathematics.powers-of-10")
    if p["sub"] == "bounds":
        return ("mathematics.bounds-upper-lower", "mathematics.estimating-and-rounding")
    return ("mathematics.decimals", "mathematics.powers-of-10", "mathematics.multiplication-division-decimals",
            "mathematics.decimals-multiplying")


def avoid_for(p: dict) -> str:
    if p["sub"] in ("shift", "line"):
        return AVOID + r"|percent|fraction|integers|sets of numbers|standard form|irrational|numeration"
    if p["sub"] == "standard":
        return AVOID + r"|estimation and rounding|ordering decimals|^4 decimals"
    return AVOID + r"|fraction|percent|ordering decimals|^4 decimals|integers"


def dec(x) -> str:
    """A decimal as printed: no trailing zeros, no exponent."""
    d = Decimal(str(x)).normalize()
    s = format(d, "f")
    return s


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["shift", "line", "standard", "bounds"] if band == "LS" else ["standard", "bounds", "standard"])
    p = {"band": band, "sub": sub, "name": rng.choice(NAMES)}
    if sub == "shift":
        while True:
            digits = [rng.randint(0, 9) for _ in range(3)]
            if digits[0] and digits[-1]:
                break
        op = rng.choice(["×", "÷"])
        k = rng.choice([1, 2, 3])
        # where the number starts in the chart: three digits, kept inside it before and after
        start = rng.randint(3, 4) if op == "×" else rng.randint(1, 2)
        if op == "×":
            start = max(start, k)
        else:
            start = min(start, 4 - k)
        p.update(digits=digits, start=start, op=op, k=k, ask=rng.choice(["op", "result"]))
        return p
    if sub == "line":
        step = rng.choice(["0.1", "0.01"])
        lo = Decimal(rng.randint(1, 20)) if step == "0.1" else Decimal(rng.randint(10, 99)) / 10
        marks = sorted(rng.sample(range(1, 10), 3))
        order = rng.sample("PQR", 3)
        p.update(lo=dec(lo), step=step, marks=marks, letters=order)
        return p
    if sub == "standard":
        big = rng.random() < 0.5
        n = rng.choice([2, 3])  # significant figures
        while True:
            sig = [rng.randint(1, 9)] + [rng.randint(0, 9) for _ in range(n - 1)]
            if sig[-1]:
                break
        e = rng.randint(4, 6) if big else -rng.randint(2, 7 - n)  # the last digit stays inside the chart
        p.update(sig=sig, e=e)
        return p
    device, unit, what, letter = rng.choice(DEVICES)
    acc = rng.choice(["10", "1", "0.1"] if unit in ("g", "ml") else ["1", "0.1"])
    if acc == "10":
        v = 10 * rng.randint(12, 95)
    elif acc == "1":
        v = rng.randint(12, 95)
    else:
        v = Decimal(rng.randint(120, 950)) / 10
        if v == v.to_integral():
            v += Decimal("0.1")
    p.update(device=device, unit=unit, what=what, letter=letter, acc=acc, value=dec(v))
    return p


# --- the mathematics --------------------------------------------------------------------------------------------

def shift_numbers(p: dict) -> tuple[Decimal, Decimal]:
    place = [Decimal(10) ** (3 - i) for i in range(7)]  # Th=1000 ... th=0.001
    before = sum(d * place[p["start"] + i] for i, d in enumerate(p["digits"]))
    f = Decimal(10) ** p["k"]
    after = before * f if p["op"] == "×" else before / f
    return before.normalize(), after.normalize()


def line_value(p: dict, i: int) -> Decimal:
    return Decimal(p["lo"]) + Decimal(p["step"]) * i


def std_value(p: dict) -> Decimal:
    m = Decimal("".join(map(str, p["sig"]))) / Decimal(10) ** (len(p["sig"]) - 1)
    return (m * Decimal(10) ** p["e"]).normalize()


def std_text(sig, e) -> str:
    m = str(sig[0]) + ("." + "".join(map(str, sig[1:])) if len(sig) > 1 else "")
    return f"{m} × 10{str(e).translate(SUP)}"


def bounds(p: dict) -> tuple[Decimal, Decimal]:
    v, a = Decimal(p["value"]), Decimal(p["acc"])
    return v - a / 2, v + a / 2


# --- drawing ------------------------------------------------------------------------------------------------

def _chart(ax, cols, rows: list[dict | None], w: float = 0.85, y0: float = 0.0):
    """A place-value chart: a header row and number rows ({column index: digit}); a dot after the ones column."""
    ones = cols.index("O")
    n = len(rows)
    top = y0 + 0.62 * (n + 1)
    for j, c in enumerate(cols):
        ax.add_patch(Rectangle((j * w, top - 0.62), w, 0.62, facecolor=FILL_2, edgecolor=INK, linewidth=1.1))
        ax.text(j * w + w / 2, top - 0.31, c, ha="center", va="center", fontsize=11, fontweight="bold", gid=f"head:{c}")
    for r, row in enumerate(rows):
        y = top - 0.62 * (r + 2)
        for j in range(len(cols)):
            ax.add_patch(Rectangle((j * w, y), w, 0.62, facecolor="white", edgecolor=INK, linewidth=1.1,
                                   gid=f"behind-cell:{r}:{j}"))
            if row is not None and j in row:
                ax.text(j * w + w / 2, y + 0.31, str(row[j]), ha="center", va="center", fontsize=15, gid=f"digit:{r}:{j}")
        ax.plot([(ones + 1) * w], [y + 0.08], "o", color=INK, markersize=4.5, gid=f"behind-dot:{r}")
    return top


def _draw_shift(p: dict):
    fig, ax = new_figure(7.4, 3.0)
    top_row = {p["start"] + i: d for i, d in enumerate(p["digits"])}
    move = p["k"] if p["op"] == "×" else -p["k"]
    after = {j - move: d for j, d in top_row.items()}
    _, val = shift_numbers(p)
    # zeros a writer must put in: between the moved digits and the ones column
    ones = SHIFT_COLS.index("O")
    for row in (top_row, after):
        lo, hi = min(row), max(row)
        for j in range(min(lo, ones), max(hi, ones) + 1):
            row.setdefault(j, 0)
    rows = [top_row, None if p["ask"] == "result" else after]
    _chart(ax, SHIFT_COLS, rows)
    w = 0.85
    x = len(SHIFT_COLS) * w + 0.25
    label = "?" if p["ask"] == "op" else f"{p['op']} {10 ** p['k']}"
    ax.annotate("", xy=(x + 0.2, 0.31), xytext=(x + 0.2, 0.93), arrowprops={"arrowstyle": "-|>", "color": INK, "lw": 1.5})
    ax.plot([x + 0.2, x + 0.2], [0.31, 0.93], alpha=0, gid="arrow:ends")
    ax.text(x + 0.45, 0.62, label, ha="left", va="center", fontsize=13, gid="op")
    ax.text(len(SHIFT_COLS) * w / 2, 2.1, "Th thousands, H hundreds, T tens, O ones, t tenths, h hundredths, th thousandths",
            ha="center", va="center", fontsize=8.5, gid="key")
    ax.set_xlim(-0.1, x + 1.6)
    ax.set_ylim(-0.1, 2.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_line(p: dict):
    fig, ax = new_figure(7.6, 2.4)
    L = 9.0
    ax.plot([0, L], [0, 0], color=INK, linewidth=1.6)
    for i in range(11):
        x = L * i / 10
        big = i in (0, 5, 10)
        ax.plot([x, x], [-0.18 if big else -0.11, 0.18 if big else 0.11], color=INK, linewidth=1.4 if big else 1.0,
                gid=f"tick:{i}")
        if i in (0, 10):
            ax.text(x, -0.35, dec(line_value(p, i)), ha="center", va="top", fontsize=12, gid=f"end:{i}")
    for i, letter in zip(p["marks"], p["letters"]):
        x = L * i / 10
        ax.annotate("", xy=(x, 0.2), xytext=(x, 0.75), arrowprops={"arrowstyle": "-|>", "color": INK, "lw": 1.4})
        ax.plot([x, x], [0.2, 0.75], alpha=0, gid=f"arrow:{letter}")
        ax.text(x, 0.85, letter, ha="center", va="bottom", fontsize=13, fontweight="bold", gid=f"letter:{letter}")
    ax.set_xlim(-0.6, L + 0.6)
    ax.set_ylim(-0.85, 1.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_standard(p: dict):
    fig, ax = new_figure(9.6, 2.6)
    ones = STD_COLS.index("O")
    first = ones - p["e"]  # the column of the first significant digit
    row = {first + i: d for i, d in enumerate(p["sig"])}
    for j in range(min(first, ones), max(max(row), ones) + 1):
        row.setdefault(j, 0)
    _chart(ax, STD_COLS, [row], w=0.7)
    ax.text(len(STD_COLS) * 0.7 / 2, 1.62, "M millions, HTh hundred thousands, TTh ten thousands ... th thousandths, "
            "tth ten-thousandths, hth hundred-thousandths, m millionths", ha="center", va="center", fontsize=8, gid="key")
    ax.set_xlim(-0.1, len(STD_COLS) * 0.7 + 0.1)
    ax.set_ylim(-0.1, 1.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def acc_words(p: dict) -> str:
    unit = p["unit"]
    return {"10": f"to the nearest 10 {unit}", "1": f"to the nearest {'degree' if unit == '°C' else '1 ' + unit}",
            "0.1": "to 1 decimal place"}[p["acc"]]


def _draw_bounds(p: dict):
    fig, ax = new_figure(5.2, 3.0)
    ax.add_patch(FancyBboxPatch((0, 0.9), 4.6, 1.5, boxstyle="round,pad=0,rounding_size=0.2", facecolor="#dfe6e9",
                                edgecolor=INK, linewidth=1.8, gid="behind-case"))
    ax.add_patch(Rectangle((0.35, 1.15), 3.9, 0.95, facecolor="#20262b", edgecolor=INK, linewidth=1.2, gid="behind-screen"))
    ax.text(4.05, 1.62, f"{p['value']} {p['unit']}", ha="right", va="center", fontsize=20, family="monospace",
            color="#7CFC7C", gid="reading")
    ax.text(2.3, 2.6, p["device"], ha="center", va="center", fontsize=12, gid="device")
    ax.text(2.3, 0.5, f"The reading is correct {acc_words(p)}.", ha="center", va="center", fontsize=11, gid="accuracy")
    ax.set_xlim(-0.4, 5.0)
    ax.set_ylim(0.2, 2.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"shift": _draw_shift, "line": _draw_line, "standard": _draw_standard, "bounds": _draw_bounds}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def num_forms(d: Decimal, unit: str = "") -> list[str]:
    s = dec(d)
    out = [s]
    if s.startswith("0."):
        out.append(s[1:])
    if unit:
        out += [f"{x} {unit}" for x in list(out)] + [f"{x}{unit}" for x in list(out)]
    return out


def questions(p: dict, rng: random.Random) -> list:
    name, sub = p["name"], p["sub"]
    if sub == "shift":
        before, after = shift_numbers(p)
        lead = rng.choice(SHIFT_LEADS).format(n=name)
        if p["ask"] == "op":
            key = f"{p['op']} {10 ** p['k']}"
            other_op = "÷" if p["op"] == "×" else "×"
            near = 10 ** (p["k"] + 1) if p["k"] < 3 else 10 ** (p["k"] - 1)
            opts = [key, f"{other_op} {10 ** p['k']}", f"{p['op']} {near}", f"{other_op} {near}"]
            return [mcq(f"{lead} What was the number in the top row multiplied or divided by?", key, opts[1:], rng)]
        return [short(f"{lead} What number goes in the empty row?", dec(after), num_forms(after))]
    if sub == "line":
        lead = rng.choice(LINE_LEADS).format(n=name)
        i, letter = rng.choice(list(zip(p["marks"], p["letters"])))
        v = line_value(p, i)
        q1 = short(f"{lead} What number is at {letter}?", dec(v), num_forms(v))
        j, other = rng.choice([(a, b) for a, b in zip(p["marks"], p["letters"]) if b != letter])
        q2 = mcq(f"On the number line, which letter shows {dec(line_value(p, j))}?", other,
                 [x for x in "PQR" if x != other], rng)
        big = max(p["marks"])
        top = dict(zip(p["marks"], p["letters"]))[big]
        q3 = mcq("Which letter on the number line shows the greatest number?", top, [x for x in "PQR" if x != top], rng)
        return [q1, rng.choice([q2, q3])]
    if sub == "standard":
        sig, e = p["sig"], p["e"]
        size = "large" if e > 0 else "small"
        lead = rng.choice(STD_LEADS).format(n=name, size=size)
        s = rng.choice([-1, 1])
        opts = [std_text(sig, e), std_text(sig, -e), std_text(sig, e + s), std_text(sig, -(e + s))]
        q1 = mcq(f"{lead} Which shows the number in standard form?", opts[0], opts[1:], rng)
        q2 = short("When the number in the place value chart is written in standard form, A × 10ⁿ, what is n?", str(e),
                   [str(e), str(e).replace("-", "−")])
        return [q1, q2]
    lo, hi = bounds(p)
    letter, unit, what = p["letter"], p["unit"], p["what"]
    a = Decimal(p["acc"])
    key = f"{dec(lo)} ≤ {letter} < {dec(hi)}"
    opts = [key, f"{dec(lo)} < {letter} ≤ {dec(hi)}", f"{dec(lo - a / 2)} ≤ {letter} < {dec(hi + a / 2)}",
            f"{dec(lo - a / 2)} < {letter} ≤ {dec(hi + a / 2)}"]

    def make(kind: str, lead: str):
        q = _make(kind, lead)
        if lead.endswith(", "):
            q.stem = lead + q.stem[len(lead)].lower() + q.stem[len(lead) + 1:]
        return q

    def _make(kind: str, lead: str):
        if kind == "lo":
            return short(f"{lead}What is the lower bound of the {what}?", dec(lo), num_forms(lo, unit))
        if kind == "hi":
            return short(f"{lead}What is the upper bound of the {what}?", dec(hi), num_forms(hi, unit))
        return mcq(f"{lead}The {what} is {letter} {unit}. Which is the error interval for {letter}?", key, opts[1:], rng)

    kinds = rng.sample(["lo", "hi", "int"], 2)
    lead = rng.choice(BOUND_LEADS).format(n=name)
    return [make(kinds[0], lead + " "), make(kinds[1], f"For the reading on the {p['device']}, ")]
