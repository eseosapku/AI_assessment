"""Price elasticity of demand (UP): a good sold in Rwanda, priced in francs, shown as a demand schedule (a table of
four prices and the quantities demanded) or as a straight demand curve with two points marked on gridlines. The
PED for a change in price, as an absolute value to two decimal places; whether demand is price elastic or price
inelastic over that change; and the total revenue at a price.

The stem states the formula and that each % change is worked out from the original value; the midpoint method is
never used. On a straight demand curve that gives the PED at the original price, m·k / (n0 - m·k), which is
resampled until it is exact to two decimal places and plainly elastic (1.25 or more) or inelastic (0.80 or less):
elastic or inelastic either way round and by the midpoint too, so no method disputes the answer.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, mcq, money, new_figure, short
from .econ_tables import frw, titled_table

ID = "elasticity"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same layout in Cambridge AS Level, where the chapter is named for it
CONCEPTS = ("economics.elasticity", "economics.price-elasticity-demand")
ALSO = ("business.elasticity-of-demand",)  # Rwanda's Entrepreneurship books teach it under business
AVOID = r"elasticity of supply"  # a chapter on PES only: this figure is demand's
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"elasticit|\bPED\b"

# good, sold per, quantity unit, price step (Frw), quantity step, a fair price range in Frw
GOODS = {
    "milk": ("litre", "litres", 100, 20, (300, 900)),
    "sugar": ("kg", "kg", 200, 10, (800, 2000)),
    "Irish potatoes": ("kg", "kg", 50, 50, (200, 600)),
    "bread": ("loaf", "loaves", 200, 20, (400, 1600)),
    "avocados": ("avocado", "avocados", 50, 20, (100, 400)),
    "rice": ("kg", "kg", 200, 20, (800, 2000)),
    "data bundles": ("bundle", "bundles", 500, 10, (500, 3000)),
}
PLACES = ["a shop in Rubavu", "a market in Huye", "a kiosk in Kigali", "a shop in Musanze", "a market in Rwamagana",
          "a shop in Nyanza"]


def _ped(n0: int, m: int, k1: int, k2: int) -> Fraction:
    """|PED| for a change from the price k1 steps up to k2 steps, from the original values."""
    q1, q2 = n0 - m * k1, n0 - m * k2
    return abs(Fraction(q2 - q1, q1) / Fraction(k2 - k1, k1))


def _fits(n0: int, m: int, k1: int, k2: int) -> bool:
    e, back = _ped(n0, m, k1, k2), _ped(n0, m, k2, k1)
    q1, q2 = n0 - m * k1, n0 - m * k2
    mid = abs(Fraction(q2 - q1, q1 + q2) / Fraction(k2 - k1, k1 + k2))
    plain = e >= Fraction(5, 4) or e <= Fraction(4, 5)
    same = (e > 1) == (back > 1) == (mid > 1) and 1 not in (back, mid)
    tidy = (Fraction(1000 * (k2 - k1), k1).denominator == 1 and Fraction(1000 * (q2 - q1), q1).denominator == 1)  # % changes to 1 d.p.
    modest = 2 * abs(k2 - k1) <= k1  # a price change of 50% at most, as a paper would set
    return (e * 100).denominator == 1 and plain and same and tidy and modest and e <= 6


def sample(rng: random.Random) -> dict:
    show = rng.choice(["table", "graph"])
    good = rng.choice(sorted(GOODS))
    per, qunit, dp, dq, (lo, hi) = GOODS[good]
    klo, khi = -(-lo // dp), hi // dp
    while True:
        m = rng.choice([1, 1, 2])
        n0 = rng.randint(m * khi // 2 + 2, 16)
        if show == "table":
            step = rng.choice([1, 1, 2])
            k0 = rng.randint(klo, khi)
            ks = [k0 + step * i for i in range(4)]
        else:
            ks = sorted(rng.sample(range(klo, khi + 1), 2))
        if ks[-1] > khi or m * ks[-1] >= n0 or n0 - m * ks[-1] < 2:
            continue
        pairs = [(a, b) for a in ks for b in ks if a != b and _fits(n0, m, a, b)]
        if not pairs:
            continue
        k1, k2 = rng.choice(pairs)
        rows = [[k * dp, dq * (n0 - m * k)] for k in ks]
        return {"band": "UP", "show": show, "good": good, "place": rng.choice(PLACES), "dp": dp, "dq": dq, "n0": n0, "m": m,
                "rows": rows, "from": k1 * dp, "to": k2 * dp, "tr_at": rng.choice(ks) * dp}


def _heads(p: dict) -> tuple[str, str]:
    per, qunit = GOODS[p["good"]][:2]
    return f"Price\n(Frw per {per})", f"Quantity demanded\n({qunit} per week)"


def draw(p: dict):
    if p["show"] == "table":
        return titled_table(f"Demand for {p['good']} at {p['place']}", _heads(p),
                            [[frw(pr), frw(qd)] for pr, qd in p["rows"]], ["c", "c"], least=1.8)
    dp, dq, n0, m = p["dp"], p["dq"], p["n0"], p["m"]
    per, qunit = GOODS[p["good"]][:2]
    fig, ax = new_figure(6.0, 4.8)
    top_k = -(-n0 // m)  # the price steps up to where the curve meets the price axis
    ax.plot([0, dq * n0], [dp * Fraction(n0, m), 0], color=INK, linewidth=2.0)
    for pr, qd in p["rows"]:
        letter = "A" if pr == p["from"] else "B"  # the price changes from A to B
        ax.plot([0, qd, qd], [pr, pr, 0], color=INK, linestyle="--", linewidth=1.0)
        ax.plot([qd], [pr], "o", color=INK, markersize=6, zorder=4)
        ax.annotate(letter, (qd, pr), xytext=(7, 5), textcoords="offset points", fontsize=12, fontweight="bold")
    ax.annotate("D", (dq * (n0 - 0.6), dp * Fraction(6, 10 * m)), xytext=(4, 4), textcoords="offset points", fontsize=12,
                fontweight="bold")
    xstep = 2 if n0 > 10 else 1
    ystep = 2 if top_k > 10 else 1
    ax.set_xticks([dq * i for i in range(0, n0 + 2, xstep)])
    ax.set_xticks([dq * i for i in range(n0 + 2)], minor=True)
    ax.set_yticks([dp * i for i in range(0, top_k + 2, ystep)])
    ax.set_yticks([dp * i for i in range(top_k + 2)], minor=True)
    ax.set_xticklabels([frw(dq * i) for i in range(0, n0 + 2, xstep)])
    ax.set_yticklabels([frw(dp * i) for i in range(0, top_k + 2, ystep)])
    ax.set_xlim(0, dq * (n0 + 1))
    ax.set_ylim(0, dp * (top_k + 1))
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=9)
    ax.tick_params(which="minor", length=0)
    ax.set_xlabel(f"Quantity demanded ({qunit} per week)")
    ax.set_ylabel(f"Price (Frw per {per})")
    ax.set_title(f"Demand for {p['good']} at {p['place']}", fontsize=11.5)
    return fig


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club"]
FORMULA = ("PED = % change in quantity demanded ÷ % change in price, each % change worked out from the original "
           "value.")


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    rows = {pr: qd for pr, qd in p["rows"]}
    p1, p2 = p["from"], p["to"]
    e = abs(Fraction(rows[p2] - rows[p1], rows[p1]) / Fraction(p2 - p1, p1))
    key = f"{float(e):.2f}"
    move = "rises" if p2 > p1 else "falls"
    what = "demand schedule" if p["show"] == "table" else "demand curve"
    points = "" if p["show"] == "table" else " (point A to point B)"
    per = GOODS[p["good"]][0]
    tr = p["tr_at"] * rows[p["tr_at"]]
    elastic = e > 1
    return [
        short(f"{who} {rng.choice(VERBS)} this {what} for {p['good']} {rng.choice(SETTINGS)}. {FORMULA} When the price "
              f"{move} from {frw(p1)} Frw to {frw(p2)} Frw{points}, what is the PED? Give it as an absolute value (ignore the "
              f"minus sign), to two decimal places.", key, [key.rstrip("0").rstrip("."), f"-{key}", f"−{key}"]),
        mcq(f"For the price change from {frw(p1)} Frw to {frw(p2)} Frw, is demand for {p['good']} price elastic or price "
            "inelastic?", "Price elastic" if elastic else "Price inelastic",
            ["Price inelastic" if elastic else "Price elastic", "Unit elastic", "Perfectly inelastic"], rng),
        short(f"What is the total revenue from {p['good']} at {p['place']} when the price is {frw(p['tr_at'])} Frw per "
              f"{per}, in Frw per week?", tr, money(tr)),
    ]
