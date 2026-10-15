"""Demand and supply schedules with their plotted curves (UP): a table of six prices in francs and the quantities
demanded and supplied at each, for a good sold in a Rwandan market, with the same schedules plotted below it on a grid,
each pair a gridline crossing. Two sub-types:
- market: quantity demanded and quantity supplied; the equilibrium price, the excess demand at a price below it
  (its formula stated), and whether there is a shortage or a surplus at another price, and how large (two amounts ×
  two sides);
- households: the demand of two households, the only buyers, and the market supply; the market demand at a price
  (their sum, stated), the price at which market demand equals supply, and the shortage or surplus at another price.
  The plot shows each household's demand curve, not the market's and not supply: the student adds them.

The schedules are straight: demand falls and supply rises by a whole number of steps a row, and exactly one row,
never the first or last, clears the market.
"""
from __future__ import annotations

import random

import matplotlib.pyplot as plt

from ..core import INK, NAMES, mcq, money, short
from . import _micro as g
from .econ_tables import fit, frw, table

ID = "demand_schedule"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("UP",)
CONCEPTS = tuple(f"economics.{c}" for c in ("demand-schedule", "supply-schedule", "demand-and-supply",
                                            "market-equilibrium"))
ALSO = ("business.demand-and-supply-theory", "business.market-equilibrium")  # Rwanda's Entrepreneurship S4
# A topic whose sections the book lists is reached only if its name or a section names schedules or equilibrium.
NEEDS = r"schedule|equilibri|market demand|demand and supply|price determination|law of (demand|supply)"
# Chapters sharing the concepts but teaching something else: elasticity, consumer theory (utility), market structures,
# IGCSE's decision makers, revenue, the macroeconomy, the marketing books, the Commerce books' "Trade" (home trade and
# retailing) and Entrepreneurship's opening chapter on basic concepts.
AVOID = (r"elasticit|consumer theory|utility|market structure|decision makers|revenue|cost|aggregate|national income|"
         r"marketing|market research|product and pricing|fiscal|^trade$|basic economic concepts")

# good: sold per, quantity unit, (market quantity step, household quantity step), price steps, places
GOODS = {
    "tomatoes": ("kg", "kg", (20, 1), (50, 100), ["at Kimironko market, Kigali", "at the market in Musanze"]),
    "Irish potatoes": ("kg", "kg", (50, 2), (25, 50), ["at the market in Musanze", "in Nyabihu"]),
    "milk": ("litre", "litres", (20, 1), (25, 50), ["in Nyagatare", "in Rwamagana"]),
    "rice": ("kg", "kg", (20, 1), (100, 200), ["in Bugesera", "at the market in Huye"]),
    "beans": ("kg", "kg", (50, 1), (100, 200), ["at the market in Huye", "in Kayonza"]),
    "eggs": ("tray", "trays", (10, 1), (200, 500), ["at Nyabugogo market, Kigali", "in Muhanga"]),
    "bananas": ("bunch", "bunches", (10, 1), (500, 1000), ["in Karongi", "at the market in Ngoma"]),
    "sugar": ("kg", "kg", (20, 1), (100, 200), ["in Rusizi", "in Nyanza"]),
}
ROWS = 6


def _line(rng: random.Random, at_eq: int, e: int, falling: bool, lo: int = 1) -> list[int] | None:
    """A straight schedule through `at_eq` at row e, changing by a whole number of steps a row."""
    step = rng.choice([1, 2, 3])
    vals = [at_eq + (e - i) * step if falling else at_eq - (e - i) * step for i in range(ROWS)]
    return vals if min(vals) >= lo else None


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["market", "households"])
    good = rng.choice(sorted(GOODS))
    per, qunit, (mstep, hstep), psteps, places = GOODS[good]
    while True:
        e = rng.randint(1, ROWS - 2)
        pstep = rng.choice(psteps)
        k0 = rng.randint(1, 5)
        prices = [pstep * (k0 + i) for i in range(ROWS)]
        if kind == "market":
            dq = mstep
            qe = rng.randint(4, 11)
            d, s = _line(rng, qe, e, True), _line(rng, qe, e, False)
            if not d or not s or max(d + s) > 16:
                continue
            return {"band": "UP", "kind": kind, "good": good, "place": rng.choice(places), "prices": prices,
                    "qd": [v * dq for v in d], "ha": None, "hb": None, "qs": [v * dq for v in s], "step": dq}
        dq = hstep
        qa, qb = rng.randint(3, 8), rng.randint(3, 8)
        ha, hb = _line(rng, qa, e, True), _line(rng, qb, e, True)
        s = _line(rng, qa + qb, e, False)
        if not ha or not hb or not s or max(ha + hb + s) > 20 or ha == hb:
            continue
        return {"band": "UP", "kind": kind, "good": good, "place": rng.choice(places), "prices": prices,
                "qd": None, "ha": [v * dq for v in ha], "hb": [v * dq for v in hb], "qs": [v * dq for v in s], "step": dq}


def _columns(p: dict) -> tuple[list[str], list[list[int]], list[tuple[str, str, list[int]]]]:
    """The table's headings and rows, and the curves plotted: (gid, label, quantities)."""
    per, qunit = GOODS[p["good"]][:2]
    unit = f"({qunit} per week)"
    if p["kind"] == "market":
        heads = [f"Price\n(Frw per {per})", f"Quantity demanded\n{unit}", f"Quantity supplied\n{unit}"]
        cols = [p["qd"], p["qs"]]
        curves = [("D", "D", p["qd"]), ("S", "S", p["qs"])]
    else:
        heads = [f"Price\n(Frw per {per})", f"Household A's\ndemand {unit}", f"Household B's\ndemand {unit}",
                 f"Market supply\n{unit}"]
        cols = [p["ha"], p["hb"], p["qs"]]
        # each household's demand only: supply drawn against one household would cross it at no equilibrium
        curves = [("DA", "DA", p["ha"]), ("DB", "DB", p["hb"])]
    rows = [[pr] + [c[i] for c in cols] for i, pr in enumerate(p["prices"])]
    return heads, rows, curves


def draw(p: dict):
    good = p["good"]
    per, qunit = GOODS[good][:2]
    heads, rows, curves = _columns(p)
    texts = [[frw(v) for v in r] for r in rows]
    widths = [fit(h, *(r[j] for r in texts), least=1.15) for j, h in enumerate(heads)]
    tw = sum(widths)
    title = f"Demand and supply of {good} {p['place']}"
    th = 0.42 + 0.56 + 0.36 * len(rows)  # the title's line, the heading row and the body
    gh = 3.7
    W = max(6.4, tw + 0.6, fit(title, size=11, pad=0.6))
    H = th + 0.35 + gh + 0.75
    fig = plt.figure(figsize=(W, H))
    ax_t = fig.add_axes([0, (H - th - 0.1) / H, 1, (th + 0.1) / H])
    ax_t.set_xlim(0, W)
    ax_t.set_ylim(-th, 0.1)
    ax_t.axis("off")
    ax_t.text(W / 2, -0.15, title, ha="center", va="center", fontsize=11, fontweight="bold")
    table(ax_t, heads, texts, widths, top=-0.42, align=["c"] * len(heads), x0=(W - tw) / 2)

    ax = fig.add_axes([0.95 / W, 0.62 / H, (W - 1.35) / W, gh / H])
    dq, dp = p["step"], p["prices"][1] - p["prices"][0]
    qx = max(v for _, _, col in curves for v in col) // dq + 2
    py = p["prices"][-1] // dp + 1
    every = 1 if qx <= 14 else 2
    g.grid(ax, qx, py, dq, dp, f"Quantity ({qunit} per week)", f"Price (Frw per {per})", xevery=every)
    board = g.Board(ax, qx, py, dq, dp)
    ends = []
    for gid, label, col in curves:
        pts = [(v, pr) for v, pr in zip(col, p["prices"])]
        style = "--" if gid == "DB" else "-"
        ax.plot([x for x, _ in pts], [y for _, y in pts], color=INK, linewidth=1.8, linestyle=style, gid=gid,
                marker="o", markersize=4)
        steps = [(x / dq, y / dp) for x, y in pts]
        board.path(steps)
        far = max(steps)  # the end of greater quantity
        near = min(steps)
        slope = (far[1] - near[1]) / (far[0] - near[0])
        ends.append((label, far, slope))
    for label, far, slope in ends:
        board.end_label(label, far, slope)
    return fig


VERBS = ["studies", "is given", "copies", "looks at", "works from", "plots"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before an exam"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    good, place, prices, supply = p["good"], p["place"], p["prices"], p["qs"]
    per, qunit = GOODS[good][:2]
    unit = f"{qunit} per week"
    market = p["kind"] == "market"
    demand = p["qd"] if market else [a + b for a, b in zip(p["ha"], p["hb"])]
    e = next(i for i in range(len(prices)) if demand[i] == supply[i])
    off = [i for i in range(len(prices)) if i != e]
    below = [i for i in off if i < e]
    first, second = rng.choice(below), None
    second = rng.choice([i for i in off if i != first])
    gap = abs(demand[second] - supply[second])
    side, other = ("shortage", "surplus") if demand[second] > supply[second] else ("surplus", "shortage")
    mistakes = [abs(demand[second] - demand[e]), abs(supply[second] - supply[e])]
    if not market:
        mistakes += [abs(p["ha"][second] - supply[second]), abs(p["hb"][second] - supply[second])]
    wrong = rng.choice([m for m in mistakes if m and m != gap] or [gap + (demand[e] - demand[e + 1])])
    options = [f"A {other} of {frw(gap)} {unit}", f"A {side} of {frw(wrong)} {unit}", f"A {other} of {frw(wrong)} {unit}"]
    eq = prices[e]

    def qty(n: int) -> list[str]:
        return [str(n), f"{n} {qunit}", f"{n} {unit}"] + ([frw(n), f"{n:,}"] if n >= 1000 else [])

    if market:
        x = prices[first]
        excess = demand[first] - supply[first]
        return [
            short(f"{who} {rng.choice(VERBS)} the demand and supply schedules for {good} {place} {rng.choice(SETTINGS)}. "
                  f"What is the equilibrium price, in Frw per {per}?", eq, money(eq)),
            short(f"Excess demand = quantity demanded − quantity supplied. At a price of {frw(x)} Frw per {per}, what is "
                  f"the excess demand for {good} {place}, in {unit}?", excess, qty(excess)),
            mcq(f"At a price of {frw(prices[second])} Frw per {per}, is there a shortage or a surplus of {good} {place}, "
                "and how large is it?", f"A {side} of {frw(gap)} {unit}", options, rng),
        ]
    x = prices[first] if rng.random() < 0.5 else prices[rng.choice(off)]
    i = prices.index(x)
    total = p["ha"][i] + p["hb"][i]
    who_buys = f"Households A and B are the only buyers of {good} {place}."
    return [
        short(f"{who} {rng.choice(VERBS)} the demand schedules of households A and B, the only buyers of {good} {place}, "
              f"{rng.choice(SETTINGS)}. Market demand = household A's demand + household B's demand. What is the market "
              f"demand at a price of {frw(x)} Frw per {per}, in {unit}?", total, qty(total)),
        short(f"{who_buys} At what price does their market demand equal the market supply, in Frw per {per}?", eq, money(eq)),
        mcq(f"{who_buys} At a price of {frw(prices[second])} Frw per {per}, is there a shortage or a surplus, and how "
            "large is it?", f"A {side} of {frw(gap)} {unit}", options, rng),
    ]
