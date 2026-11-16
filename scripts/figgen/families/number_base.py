"""Number bases (LS, UP), as Rwanda S3 "Number Bases", NERDC JSS 1–3 "Number bases" and the WAEC, JAMB and NERDC SS
"Number and numeration" syllabuses teach them: place value in another base, changing base by repeated division, and
adding or subtracting in a base.

Four kinds of figure:
- chart: a place-value chart in base b (2 to 9), its columns headed b³ = 125, b² = 25 ..., a numeral's digits in it.
  The number in base ten; the value of the digit in one column; which base-ten number it is (MCQ, the mistakes being
  the digits read as base ten and the place values shifted one column).
- ladder: a base-ten number changed to base b by repeated division by b, quotients down the left and remainders
  ("r 3") on the right, one remainder (or quotient) shown as a box. The number in base b (read from the bottom up),
  the missing remainder or quotient, and which reading is right (MCQ: bottom up or top down).
- add / subtract: two base-b numerals in columns, the answer line empty. The sum (or difference) in base b, and the
  answer's digit in one column.
The base is printed in every figure; no stem carries a number the student needs.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, NAMES, article, mcq, new_figure, short

ID = "number_base"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = ("mathematics.binary-system", "mathematics.operations-using-bases", "mathematics.equations-involving-bases")
# A topic whose sections the book lists is reached only if its name or a section is about bases or numeration.
NEEDS = r"\bbases?\b|binary|numeration|number system"
AVOID = r"binary operation"

SUBS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"]
SUP = {0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵"}
WORD = {2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine"}
CHART_LEADS = ["{n} writes a base-{b} numeral in a place value chart.", "{n} puts the digits of a base-{b} number in a "
               "place value chart.", "{n} shows a number in base {b} on a place value chart.",
               "{n} copies a base-{b} numeral into a place value chart."]
LADDER_LEADS = ["{n} changes a base-ten number into base {b} by dividing again and again by {b}.",
                "{n} converts a number from base ten to base {b} by repeated division by {b}.",
                "{n} divides a base-ten number by {b} again and again to write it in base {b}.",
                "{n} uses repeated division by {b} to change a number into base {b}."]
SUM_LEADS = ["{n} sets out {an} {op} of two base-{b} numbers in columns.", "{n} writes two base-{b} numbers in columns to "
             "{verb} them.", "{n} lines up two numbers written in base {b} to {verb} them.",
             "{n} copies a base-{b} {op} into columns."]


def digits(n: int, b: int) -> list[int]:
    out = []
    while n:
        n, r = divmod(n, b)
        out.append(r)
    return out[::-1] or [0]


def numeral(ds) -> str:
    return "".join(str(d) for d in ds)


def value(ds, b: int) -> int:
    v = 0
    for d in ds:
        v = v * b + d
    return v


def sub(b: int) -> str:
    return SUBS[b]


def base_forms(s: str, b: int) -> list[str]:
    """A base-b numeral as a student may write it: 1033, 1033₅, 1033 base 5, (1033)₅, 1033_5."""
    return [s, f"{s}{sub(b)}", f"({s}){sub(b)}", f"{s}_{b}", f"{s} base {b}", f"{s} in base {b}", f"({s})_{b}",
            f"{s} (base {b})", f"{s}base{b}"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = rng.choice(["chart", "ladder", "add", "subtract"])
    p = {"band": band, "sub": kind, "name": rng.choice(NAMES)}
    bases = [2, 3, 4, 5, 6, 7, 8, 9] if band == "UP" else [2, 3, 4, 5, 6, 7, 8]
    if kind == "chart":
        b = rng.choice(bases)
        n = rng.choice([4, 5] if b <= 3 else [3, 4])
        while True:
            ds = [rng.randint(1, b - 1)] + [rng.randint(0, b - 1) for _ in range(n - 1)]
            if sum(1 for d in ds if d) >= 2 and len(set(ds)) >= 2:
                break
        col = rng.choice([i for i, d in enumerate(ds) if d and i < n - 1])
        p.update(b=b, digits=ds, col=col)
        return p
    if kind == "ladder":
        while True:
            b = rng.choice(bases)
            n = rng.randint(20, 400 if band == "UP" else 250)
            ds = digits(n, b)
            if 3 <= len(ds) <= 6:
                break
        steps = len(ds)  # rows of division, the last giving quotient 0
        hide = rng.choice(["r", "q"]) if steps > 3 else "r"
        row = rng.randrange(steps) if hide == "r" else rng.randrange(1, steps)
        p.update(b=b, n=n, hide=hide, row=row)
        return p
    while True:
        b = rng.choice(bases)
        la, lb = rng.choice([(3, 3), (4, 3), (4, 4), (3, 2)] if b > 2 else [(4, 4), (5, 4), (5, 5)])
        a = [rng.randint(1, b - 1)] + [rng.randint(0, b - 1) for _ in range(la - 1)]
        c = [rng.randint(1, b - 1)] + [rng.randint(0, b - 1) for _ in range(lb - 1)]
        va, vc = value(a, b), value(c, b)
        if kind == "add":
            carries = sum(1 for x, y in zip(a[::-1], c[::-1]) if x + y >= b)
            if carries >= 1:
                break
        else:
            if va <= vc:
                continue
            borrows = sum(1 for x, y in zip(a[::-1], c[::-1]) if x < y)
            if borrows >= 1 and va - vc >= b:
                break
    ans = digits(va + vc if kind == "add" else va - vc, b)
    p.update(b=b, top=a, bottom=c, col=rng.randrange(len(ans)))
    return p


# --- the working ----------------------------------------------------------------------------------------------

def ladder_rows(n: int, b: int) -> list[tuple[int, int | None]]:
    """The short-division ladder: each row's number and the remainder left when it was divided (None on the top row)."""
    rows = [(n, None)]
    while n:
        n, r = divmod(n, b)
        rows.append((n, r))
    return rows


def answer_digits(p: dict) -> list[int]:
    b, va, vc = p["b"], value(p["top"], p["b"]), value(p["bottom"], p["b"])
    return digits(va + vc if p["sub"] == "add" else va - vc, b)


# --- drawing ------------------------------------------------------------------------------------------------

def _draw_chart(p: dict):
    b, ds = p["b"], p["digits"]
    n = len(ds)
    w = 1.55
    fig, ax = new_figure(max(5.4, 1.15 * n * w + 1.4), 2.9)
    for i, d in enumerate(ds):
        k = n - 1 - i
        ax.add_patch(Rectangle((i * w, 1.0), w, 0.75, facecolor=FILL_2, edgecolor=INK, linewidth=1.2))
        head = f"{b}{SUP[k]} = {b ** k}"
        ax.text(i * w + w / 2, 1.375, head, ha="center", va="center", fontsize=12, fontweight="bold", gid=f"head:{k}")
        ax.add_patch(Rectangle((i * w, 0.2), w, 0.8, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.text(i * w + w / 2, 0.6, str(d), ha="center", va="center", fontsize=17, gid=f"digit:{k}")
    ax.text(n * w / 2, 2.1, f"Place value chart in base {b}", ha="center", va="center", fontsize=12, gid="title")
    ax.set_xlim(-0.2, n * w + 0.2)
    ax.set_ylim(0.0, 2.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_ladder(p: dict):
    b, n = p["b"], p["n"]
    rows = ladder_rows(n, b)
    h = 0.62
    fig, ax = new_figure(4.8, 0.62 * len(rows) + 1.1)
    top = len(rows) * h
    for i, (q, r) in enumerate(rows):
        y = top - i * h
        hidden_q = p["hide"] == "q" and i == p["row"]
        hidden_r = p["hide"] == "r" and i == p["row"] + 1
        if i < len(rows) - 1:  # a divisor and its bus stop: the number below the bar is the next quotient
            ax.text(0.55, y, str(b), ha="right", va="center", fontsize=13, gid=f"divisor:{i}")
            ax.plot([0.7, 0.7], [y - h / 2 + 0.04, y + h / 2 - 0.04], color=INK, linewidth=1.3)
            ax.plot([0.7, 2.25], [y - h / 2 + 0.04, y - h / 2 + 0.04], color=INK, linewidth=1.3)
        if hidden_q:
            ax.add_patch(Rectangle((1.2, y - 0.2), 0.6, 0.4, fill=False, edgecolor=INK, linewidth=1.4, gid="box"))
        else:
            ax.text(1.5, y, str(q), ha="center", va="center", fontsize=13, gid=f"q:{i}")
        if r is not None:
            if hidden_r:
                ax.text(2.55, y, "r", ha="left", va="center", fontsize=13, gid=f"rlabel:{i}")
                ax.add_patch(Rectangle((2.85, y - 0.2), 0.42, 0.4, fill=False, edgecolor=INK, linewidth=1.4, gid="box"))
            else:
                ax.text(2.55, y, f"r {r}", ha="left", va="center", fontsize=13, gid=f"r:{i}")
    ax.text(4.0, top, f"base ten → base {b}", ha="left", va="center", fontsize=11, gid="title")
    ax.set_xlim(0.0, 6.6)
    ax.set_ylim(top - len(rows) * h + 0.1, top + 0.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_sum(p: dict):
    b, a, c = p["b"], p["top"], p["bottom"]
    width = max(len(a), len(c)) + 1
    w = 0.62
    fig, ax = new_figure(4.6, 2.9)
    right = 1.2 + width * w
    for row, ds in enumerate((a, c)):
        y = 1.9 - row * 0.62
        for i, d in enumerate(reversed(ds)):
            ax.text(right - (i + 0.5) * w, y, str(d), ha="center", va="center", fontsize=16, gid=f"d:{row}:{i}")
        ax.text(right + 0.08, y - 0.12, sub(b), ha="left", va="center", fontsize=14, gid=f"base:{row}")
    sign = "+" if p["sub"] == "add" else "−"
    ax.text(right - (width + 0.5) * w, 1.28, sign, ha="center", va="center", fontsize=16, gid="sign")
    ax.plot([right - (width + 0.9) * w, right + 0.05], [0.94, 0.94], color=INK, linewidth=1.4)
    ax.plot([right - (width + 0.9) * w, right + 0.05], [0.18, 0.18], color=INK, linewidth=1.4)
    ax.text(right + 0.95, 1.6, f"All numbers\nin base {b}", ha="left", va="center", fontsize=11, gid="title")
    ax.set_xlim(right - (width + 1.3) * w, right + 2.9)
    ax.set_ylim(0.0, 2.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"chart": _draw_chart, "ladder": _draw_ladder}.get(p["sub"], _draw_sum)(p)


# --- questions ----------------------------------------------------------------------------------------------

PLACE = {0: "units", 1: "{b}s", 2: "{b}²s", 3: "{b}³s", 4: "{b}⁴s", 5: "{b}⁵s"}


def questions(p: dict, rng: random.Random) -> list:
    b, name = p["b"], p["name"]
    if p["sub"] == "chart":
        ds = p["digits"]
        n = len(ds)
        v = value(ds, b)
        lead = rng.choice(CHART_LEADS).format(n=name, b=b)
        k = n - 1 - p["col"]
        d = ds[p["col"]]
        q2 = short(f"In the base-{b} place value chart, what is the value in base ten of the digit in the {b ** k}s "
                   "column?", d * b ** k)
        if rng.random() < 0.5:
            return [short(f"{lead} What is the number in base ten?", v), q2]
        # The mistakes: the digits read as a base-ten numeral, every place one column too far left, b x k read for b^k,
        # and the chart read from the right.
        wrongs = [int(numeral(ds)), v * b, sum(x * b * (n - 1 - i) for i, x in enumerate(ds[:-1])) + ds[-1],
                  value(ds[::-1], b), v + b ** (n - 1)]
        opts = list(dict.fromkeys(str(x) for x in wrongs if x != v))[:3]
        return [mcq(f"{lead} Which base-ten number does the chart show?", str(v), opts, rng), q2]
    if p["sub"] == "ladder":
        n = p["n"]
        rows = ladder_rows(n, b)
        ds = digits(n, b)
        s = numeral(ds)
        lead = rng.choice(LADDER_LEADS).format(n=name, b=b)
        if p["hide"] == "r":
            r = rows[p["row"] + 1][1]
            q2 = short(f"In the repeated division by {b}, what remainder belongs in the box?", r)
        else:
            q2 = short(f"In the repeated division by {b}, what number belongs in the box?", rows[p["row"]][0])
        if rng.random() < 0.5:
            return [short(f"{lead} What is the number in base {b}?", s, base_forms(s, b)), q2]
        # The mistakes: the remainders read from the top down, the last remainder left out, the first two swapped.
        rev = numeral(ds[::-1])
        drop = numeral(ds[1:]).lstrip("0") or "0"
        swap = numeral([ds[1], ds[0]] + ds[2:]).lstrip("0") or "0"
        extra = s + "0"  # one division too many
        slip = numeral(ds[:-1] + [(ds[-1] + 1) % b])  # the last remainder misread
        wrongs = [w + sub(b) for w in dict.fromkeys([rev, drop, swap, numeral(ds[:-1]), extra, slip]) if w != s]
        return [mcq(f"{lead} Which numeral is the number written in base {b}?", s + sub(b), wrongs[:3], rng), q2]
    op, verb = ("addition", "add") if p["sub"] == "add" else ("subtraction", "subtract")
    ans = answer_digits(p)
    s = numeral(ans)
    lead = rng.choice(SUM_LEADS).format(n=name, b=b, an=article(op), op=op, verb=verb)  # "an addition", "a subtraction"
    what = "sum" if p["sub"] == "add" else "difference"
    q1 = short(f"{lead} What is the {what} in base {b}?", s, base_forms(s, b))
    k = len(ans) - 1 - p["col"]
    place = PLACE[k].format(b=b) if k else "units"
    q2 = short(f"In the base-{b} {op}, which digit of the answer goes in the {place} column?", ans[p["col"]])
    return [q1, q2]
