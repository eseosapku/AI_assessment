"""Break-even charts (UP; the same chart in AS Level): a Rwandan firm's fixed costs, total costs and total revenue as
three straight lines on a grid in francs, each named at its right-hand end, output per month across. The concept-
linked successor to the break_even pilot. Two sub-types: the selling price and variable cost per unit printed in a
box, or left for the student to read off the lines.

The break-even output (where total revenue meets total costs, on a gridline), the margin of safety at a planned
output (its formula in the stem), and the profit or loss at another output (an MCQ in a balanced two-by-two: profit or
loss, by the right amount or the contribution, total revenue less variable costs, which forgets the fixed costs).
Every gridline crossing is exact: the price and the variable cost times an output step, and the fixed costs, are
whole numbers of gridlines.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "break_even_chart"
KIND = "econ.curve"
SUBJECT = "business"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same chart in Cambridge AS Level, where a chapter is named for it
CONCEPTS = ("business.break-even-analysis",)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"break.?even|margin of safety|marginal costing"
# Cost accounting teaches the same chart (Cambridge AS Accounting, "Marginal costing": break-even charts).
ALSO = ("accounting.break-even-analysis",)
# Listed without sections and sharing break-even: pricing in the marketing mix, and finance in general.
AVOID = r"product and pric|marketing mix|^finance$|business finance|accounting fundamentals|size of business"

# (the firm, what it makes, the unit, prices, variable costs, output steps on the chart)
FIRMS = [
    ("a bakery in Huye", "bread", "loaves", [600, 800, 1000, 1200], [200, 300, 400, 500, 600], [50, 100, 200]),
    ("a tailoring workshop in Kigali", "school uniforms", "uniforms", [8000, 10000, 12000, 15000],
     [4000, 5000, 6000, 8000], [10, 20]),
    ("a juice maker in Rwamagana", "bottles of juice", "bottles", [500, 600, 800, 1000], [200, 300, 400],
     [100, 200, 500]),
    ("a furniture workshop in Musanze", "chairs", "chairs", [20000, 25000, 30000, 40000], [10000, 12000, 15000, 20000],
     [5, 10]),
    ("a soap maker in Rubavu", "bars of soap", "bars", [300, 400, 500, 600], [100, 150, 200, 250, 300], [200, 500]),
    ("a printing shop in Muhanga", "posters", "posters", [1000, 1500, 2000], [500, 600, 800, 1000], [50, 100]),
    ("a brick maker in Bugesera", "bricks", "bricks", [100, 120, 150, 200], [40, 50, 60, 80], [1000, 2000]),
    ("a poultry farm in Nyagatare", "trays of eggs", "trays", [3000, 3500, 4000, 5000], [1500, 2000, 2500],
     [20, 50, 100]),
]
YSTEPS = [1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000, 1000000]


def sample(rng: random.Random) -> dict:
    firm, product, unit, prices, variables, xsteps = rng.choice(FIRMS)
    while True:
        price = rng.choice(prices)
        var = rng.choice([v for v in variables if v < price])
        xstep = rng.choice(xsteps)
        nx = rng.randint(8, 12)
        k = rng.randint(3, nx - 3)
        be, qmax = k * xstep, nx * xstep
        fixed = (price - var) * be
        top = price * qmax
        # The lines' names at the right-hand end sit apart: each gap at least 8% of the chart's height.
        if (price - var) * (qmax - be) < 0.08 * top or var * qmax < 0.08 * top or fixed < 0.08 * top:
            continue
        fits = [y for y in YSTEPS if price * xstep % y == 0 and var * xstep % y == 0 and fixed % y == 0
                and 10 <= top / y <= 24]
        if not fits:
            continue
        ystep = max(fits)
        label = next(m for m in (1, 2, 4, 5, 10) if -(-top // (ystep * m)) <= 10)
        planned = rng.choice(range(be + xstep, qmax + 1, xstep))
        loss = rng.random() < 0.5
        outs = range(xstep, be, xstep) if loss else range(be + xstep, qmax + 1, xstep)
        out = rng.choice([q for q in outs if (price - var) * q * 2 != fixed])  # the slip never matches the key
        return {"band": "UP", "firm": firm, "product": product, "unit": unit, "price": price, "var": var,
                "fixed": fixed, "be": be, "xstep": xstep, "qmax": qmax, "ystep": ystep, "label": label,
                "shown": rng.random() < 0.5, "planned": planned, "out": out}


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def draw(p: dict):
    price, var, fixed, qmax, ystep = p["price"], p["var"], p["fixed"], p["qmax"], p["ystep"]
    top = price * qmax
    labels = ystep * p["label"]
    ytop = -(-top // labels) * labels
    if ytop - top < 0.04 * ytop:
        ytop += labels
    room = 0.27 * qmax  # past the last output, where the lines are named
    fig, ax = new_figure(7.4, 4.8)
    ax.plot([0, qmax], [fixed, fixed], color=INK, linewidth=1.6, linestyle=":", gid="fixed")
    ax.plot([0, qmax], [fixed, fixed + var * qmax], color=INK, linewidth=1.8, linestyle="--", gid="total_costs")
    ax.plot([0, qmax], [0, top], color=INK, linewidth=2.0, gid="revenue")
    for y, name in ((top, "Total revenue"), (fixed + var * qmax, "Total costs"), (fixed, "Fixed costs")):
        ax.text(qmax + 0.02 * qmax, y, name, ha="left", va="center", fontsize=9, fontweight="bold")
    if p["shown"]:
        one = p["unit"][:-1] if p["unit"].endswith("s") else p["unit"]
        ax.text(0.03 * qmax, ytop - 0.05 * ytop, f"Selling price: {fr(price)} Frw per {one}\n"
                f"Variable cost: {fr(var)} Frw per {one}", ha="left", va="top", fontsize=9,
                bbox=dict(boxstyle="round,pad=0.35", facecolor="white", edgecolor=INK, linewidth=0.8))
    xs = p["xstep"]
    every = 2 if (qmax // xs + 1) * (len(fr(qmax)) + 2) > 60 else 1  # long numbers: a label on every other line
    ax.set_xticks(range(0, qmax + 1, xs * every))
    ax.set_xticklabels([fr(x) for x in range(0, qmax + 1, xs * every)])
    ax.set_xticks(range(0, qmax + 1, xs), minor=True)
    ax.set_yticks(range(0, ytop + 1, labels))
    ax.set_yticklabels([fr(y) for y in range(0, ytop + 1, labels)])
    ax.set_yticks(range(0, ytop + 1, ystep), minor=True)
    ax.tick_params(which="minor", length=0)
    ax.tick_params(labelsize=8)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, qmax + room)
    ax.set_ylim(0, ytop)
    ax.set_xlabel(f"Output ({p['unit']} per month)")
    ax.set_ylabel("Costs and revenue (Frw)")
    ax.set_title(f"Break-even chart for {p['firm']}", fontsize=11.5)
    return fig


VERBS = ["draws", "studies", "is given", "prepares", "checks"]
SETTINGS = ["for a business plan", "before asking a bank for a loan", "for the owner", "for a class test",
            "in a business studies lesson", "to plan next month's output"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    unit, firm = p["unit"], p["firm"]
    price, var, fixed, be = p["price"], p["var"], p["fixed"], p["be"]
    out = p["out"]
    profit = (price - var) * out - fixed
    slip = (price - var) * out  # total revenue less variable costs: the fixed costs forgotten
    amounts = [abs(profit), slip]
    options = [f"{side} of {fr(a)} Frw" for side in ("Profit", "Loss") for a in amounts]
    key = options[(0 if profit > 0 else 2)]
    Firm = firm[0].upper() + firm[1:]
    return [
        short(f"{who} {rng.choice(VERBS)} this break-even chart for {firm} {rng.choice(SETTINGS)}. "
              f"What is the break-even output, in {unit}?", be, [f"{be} {unit}", f"{fr(be)} {unit}", f"{be} units"]),
        short(f"{Firm} plans to sell {fr(p['planned'])} {unit} a month. Margin of safety = planned output − "
              f"break-even output. What is the margin of safety, in {unit}?", p["planned"] - be,
              [f"{p['planned'] - be} {unit}", f"{fr(p['planned'] - be)} {unit}", f"{p['planned'] - be} units"]),
        mcq(f"At an output of {fr(out)} {unit} a month, does {firm} make a profit or a loss, and how much?", key,
            [o for o in options if o != key], rng),
    ]
