"""Budget lines (UP, AL): what a student in Rwanda can buy each week with a set income (bus rides and lunches,
exercise books and pens), drawn on a grid of whole units. BL1 is the first budget line, its income printed in the
figure; BL2 is the line after one change: the income changes (a parallel shift), or the price of one good changes
(the line pivots on the other good's intercept). Four lettered bundles sit on gridline crossings, each plainly
inside or outside each line, never on one.

Asks the price of a good (the income ÷ the line's intercept), the new income or the new price after the change,
and which lettered bundle is affordable on one line but not the other: exactly one is. At AS Level also the
opportunity cost of one more unit of the good across, in units of the other (the line's slope), always exact to
two decimal places.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from ..core import INK, NAMES, mcq, money, new_figure, short
from . import _micro as g
from .econ_tables import frw

ID = "budget_line"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("UP", "AL")
CONCEPTS = ("economics.budget-line",)
# A topic whose sections the book lists is reached only if its name or a section names budget lines.
NEEDS = r"budget line|consumer equilibrium|indifference"
# IGCSE's decision makers share the concept in the map but teach no budget line.
AVOID = r"decision makers|utility"

# the good across (plural, singular) and the good up the side
GOODS = [
    ("bus rides", "bus ride", "lunches", "lunch"),
    ("exercise books", "exercise book", "pens", "pen"),
    ("mangoes", "mango", "avocados", "avocado"),
    ("cinema tickets", "cinema ticket", "snacks", "snack"),
    ("loaves of bread", "loaf of bread", "litres of milk", "litre of milk"),
    ("moto rides", "moto ride", "phone data bundles", "phone data bundle"),
    ("bottles of juice", "bottle of juice", "chapatis", "chapati"),
]
NOTE = (4.6, 2.3)  # the corner the income note takes, in grid steps from the top-right


def _between(pt, x0, y0, x1, y1) -> bool:
    return (Fraction(pt[0], x0) + Fraction(pt[1], y0) > 1) != (Fraction(pt[0], x1) + Fraction(pt[1], y1) > 1)


def _points(rng: random.Random, x0, y0, x1, y1, qx, py) -> dict | None:
    def cost(pt, xi, yi):
        return Fraction(pt[0], xi) + Fraction(pt[1], yi)

    def plain(pt):
        return all(abs(cost(pt, xi, yi) - 1) >= Fraction(1, 7) for xi, yi in ((x0, y0), (x1, y1)))

    def labelled(pt):  # where each line's name goes: by its intercept across, or up the side when those are shared
        if x0 == x1:
            return any(pt[0] <= 1.6 and yi - 0.3 <= pt[1] <= yi + 1.6 for yi in (y0, y1))
        return any(xi - 0.3 <= pt[0] <= xi + 1.8 and pt[1] <= 1.6 for xi in (x0, x1))

    grid = [(x, y) for x in range(1, qx) for y in range(1, py)
            if plain((x, y)) and not (x >= qx - NOTE[0] and y >= py - NOTE[1]) and not labelled((x, y))]
    mid = [pt for pt in grid if _between(pt, x0, y0, x1, y1)]
    inner = [pt for pt in grid if not _between(pt, x0, y0, x1, y1) and cost(pt, x0, y0) < 1]
    outer = [pt for pt in grid if not _between(pt, x0, y0, x1, y1) and cost(pt, x0, y0) > 1]
    if not mid or not inner or not outer:
        return None
    for _ in range(40):
        pts = [rng.choice(mid), rng.choice(inner), rng.choice(outer), rng.choice(inner + outer)]
        if len(set(pts)) == 4 and all(math.dist(a, b) >= 1.9 for i, a in enumerate(pts) for b in pts[i + 1:]):
            pts.sort()
            return {k: list(v) for k, v in zip("ABCD", pts)}
    return None


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    xs, x1s, ys, y1s = rng.choice(GOODS)
    change = rng.choice(["income", "px", "py"])
    while True:
        x0, y0 = rng.randint(4, 12), rng.randint(4, 12)
        if band == "AL" and (Fraction(y0, x0) * 100).denominator != 1:
            continue  # the opportunity cost is asked: exact to two places
        base = 50 * math.lcm(x0, y0)
        ts = [t for t in range(1, 30) if 2000 <= base * t <= 30000]
        if not ts:
            continue
        income = base * rng.choice(ts)
        px, py = income // x0, income // y0
        if not (100 <= px <= 3000 and 100 <= py <= 3000 and income <= 20000):
            continue  # a student's week: prices from a hundred francs to a few thousand
        if change == "income":
            step = math.lcm(px, py)
            cands = [m for m in range(step, 3 * income, step) if m != income and 3 <= m // px <= 13 and 3 <= m // py <= 13
                     and abs(m // px - x0) >= 2]
            if not cands:
                continue
            income2 = rng.choice(cands)
            x1, y1 = income2 // px, income2 // py
        elif change == "px":
            cands = [x for x in range(3, 14) if abs(x - x0) >= 2 and income % x == 0 and (income // x) % 10 == 0
                     and 100 <= income // x <= 4000]
            if not cands:
                continue
            income2, x1, y1 = income, rng.choice(cands), y0
        else:
            cands = [y for y in range(3, 14) if abs(y - y0) >= 2 and income % y == 0 and (income // y) % 10 == 0
                     and 100 <= income // y <= 4000]
            if not cands:
                continue
            income2, x1, y1 = income, x0, rng.choice(cands)
        qx, py_ = max(x0, x1) + 2, max(y0, y1) + 2
        points = _points(rng, x0, y0, x1, y1, qx, py_)
        if not points:
            continue
        return {"band": band, "x_plural": xs, "x_sing": x1s, "y_plural": ys, "y_sing": y1s, "change": change,
                "income": income, "x0": x0, "y0": y0, "income2": income2, "x1": x1, "y1": y1, "qx": qx, "py": py_,
                "points": points, "ask_x": rng.random() < 0.5}


def draw(p: dict):
    qx, py = p["qx"], p["py"]
    fig, ax = new_figure(6.0, 5.4)
    g.grid(ax, qx, py, 1, 1, f"{p['x_plural'].capitalize()} (per week)", f"{p['y_plural'].capitalize()} (per week)")
    board = g.Board(ax, qx, py, 1, 1)
    lines = [("BL1", p["x0"], p["y0"], "-"), ("BL2", p["x1"], p["y1"], "--")]
    for gid, xi, yi, style in lines:
        board.line(yi, Fraction(-yi, xi), gid, style)
    for letter, (x, y) in p["points"].items():
        ax.plot([x], [y], "o", color=INK, markersize=5.5, zorder=4)
        board.block(x - 0.15, x + 0.15, y - 0.15, y + 0.15)
    board.block(qx - NOTE[0], qx, py - NOTE[1], py)
    ax.text(qx - 0.2, py - 0.25, f"BL1: income of\n{frw(p['income'])} Frw a week", ha="right", va="top", fontsize=9.5,
            fontweight="bold", linespacing=1.3)
    shared_x = p["x0"] == p["x1"]
    for gid, xi, yi, _ in lines:
        slope = -yi / xi
        if shared_x:  # both lines meet the axis across at one point: name each where it starts, up the side
            ok = any(board.label(gid, back, yi + slope * back, 11, where=[(1, 1)]) for back in (0, 0.6, 1.2, 1.8, 2.6))
        else:
            ok = any(board.label(gid, xi - back, -slope * back, 11, where=[(1, 1)]) for back in (0, 0.6, 1.2, 1.8, 2.6))
        if not ok:
            board.end_label(gid, (xi, 0), slope)
    for letter, (x, y) in p["points"].items():
        others = [v for k, v in p["points"].items() if k != letter]
        if not board.label(letter, x, y, 11.5, gap=0.12, pad=0.05, others=others,
                           where=[(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]):
            raise ValueError("no room for a point's letter")
    ax.set_title(f"Budget lines for {p['x_plural']} and {p['y_plural']}", fontsize=11.5)
    return fig


SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before an exam"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    xs, xone, ys, yone = p["x_plural"], p["x_sing"], p["y_plural"], p["y_sing"]
    inc, x0, y0, inc2, x1, y1 = (p[k] for k in ("income", "x0", "y0", "income2", "x1", "y1"))
    px, py = inc // x0, inc // y0
    good, price = (xone, px) if p["ask_x"] else (yone, py)
    qs = [short(f"{who} has {frw(inc)} Frw a week to spend on {xs} and {ys}, and draws BL1 as the budget line "
                f"{rng.choice(SETTINGS)}. Price = income ÷ the most of a good the income buys. What is the price of one "
                f"{good}, in Frw?", price, money(price))]
    if p["change"] == "income":
        qs.append(short(f"The weekly income spent on {xs} and {ys} changes, prices stay the same, and the budget line moves from BL1 "
                        "to BL2. What is the new income, in Frw a week?", inc2, money(inc2)))
        grows = inc2 > inc
    else:
        what, one, new = (xs, xone, inc // x1) if p["change"] == "px" else (ys, yone, inc // y1)
        qs.append(short(f"The price of {what} changes while the income stays at {frw(inc)} Frw a week, and the budget "
                        f"line moves from BL1 to BL2. What is the new price of one {one}, in Frw?", new, money(new)))
        grows = new < (px if p["change"] == "px" else py)
    pts = p["points"]
    key = next(k for k, v in pts.items() if _between(v, x0, y0, x1, y1))
    first, then = ("BL2", "BL1") if grows else ("BL1", "BL2")
    qs.append(mcq(f"The budget lines are for {xs} and {ys}. Which point shows a bundle that is affordable on {first} but "
                  f"not on {then}?", f"Point {key}", [f"Point {k}" for k in "ABCD" if k != key], rng))
    if p["band"] == "AL":
        oc = Fraction(y0, x0)
        text = format(float(oc), "g")
        forms = [text, f"{oc.numerator}/{oc.denominator}" if oc.denominator > 1 else text, f"{text} {yone if oc == 1 else ys}"]
        qs.append(short(f"On BL1, how many {ys} are given up for each extra {xone} bought? (The opportunity cost = the "
                        f"price of one {xone} ÷ the price of one {yone}.)", text, forms))
    return qs
