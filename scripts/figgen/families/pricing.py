"""Cost-plus pricing (UP): a small table of a Rwandan product's costs per unit (materials, labour and overheads, with
their total or without it) and the mark-up on cost or the profit margin on the selling price the maker wants. Two
sub-types: a mark-up, or a margin.

The selling price (cost plus the mark-up, or the price that gives the margin, with the margin's formula in the stem),
the mark-up % that another selling price would give (formula in the stem), and the profit per unit. Every amount is a
whole number of francs and every percentage a whole number, by choice of costs and rates.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, money, new_figure, short

ID = "pricing"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("UP",)
CONCEPTS = ("business.price-and-price-fluctuations", "business.costs-and-revenue")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"pricing|mix: price|mark.?up|cost.?plus|unit cost|profit margin"
# Topics listed without sections that share costs-and-revenue but teach no pricing.
AVOID = r"e-commerce|aids to trade|transport|insurance|^finance$"

# (the product, the unit it is costed per, the maker, materials, labour and overheads ranges in francs, their step)
PRODUCTS = [
    ("a loaf of bread", "loaf", "a bakery in Huye", (200, 400), (50, 150), (20, 100), 10),
    ("a school uniform", "uniform", "a tailoring workshop in Kigali", (3000, 6000), (1000, 3000), (500, 1500), 100),
    ("a woven basket", "basket", "a weaving cooperative in Nyanza", (1000, 3000), (2000, 5000), (200, 1000), 100),
    ("a bar of soap", "bar", "a soap maker in Rubavu", (150, 300), (30, 100), (20, 80), 10),
    ("a wooden chair", "chair", "a furniture workshop in Musanze", (8000, 15000), (5000, 10000), (2000, 5000), 500),
    ("a bag of roasted coffee", "bag", "a coffee roaster in Huye", (3000, 5000), (500, 1500), (500, 1000), 100),
    ("a litre of yoghurt", "litre", "a dairy in Nyagatare", (400, 700), (100, 200), (100, 200), 10),
    ("a pair of leather sandals", "pair", "a leather workshop in Muhanga", (2000, 4000), (1000, 2500), (300, 1000), 100),
]
MARKUPS = [10, 20, 25, 30, 40, 50, 60, 75, 100]
MARGINS = [10, 20, 25, 40, 50]


def _pick(rng: random.Random, lo_hi: tuple, step: int) -> int:
    return step * rng.randint(lo_hi[0] // step, lo_hi[1] // step)


def sample(rng: random.Random) -> dict:
    product, unit, maker, mat, lab, ovh, step = rng.choice(PRODUCTS)
    mode = rng.choice(["markup", "margin"])
    while True:
        costs = [["Materials", _pick(rng, mat, step)], ["Labour", _pick(rng, lab, step)], ["Overheads", _pick(rng, ovh, step)]]
        cost = sum(c[1] for c in costs)
        pct = rng.choice(MARKUPS if mode == "markup" else MARGINS)
        num, den = (cost * (100 + pct), 100) if mode == "markup" else (cost * 100, 100 - pct)
        if num % den:
            continue
        price = num // den
        other = rng.choice(MARKUPS)
        if cost * (100 + other) % 100:
            continue
        rival = cost * (100 + other) // 100
        if rival == price or other == pct:  # never the figure's own percentage, which a guess would copy
            continue
        return {"band": "UP", "product": product, "unit": unit, "maker": maker, "costs": costs, "mode": mode,
                "pct": pct, "total_shown": rng.random() < 0.5, "other_price": rival}


def fr(v: int) -> str:
    return f"{v:,}".replace(",", " ")


def draw(p: dict):
    rows = [(name, fr(v), False) for name, v in p["costs"]]
    if p["total_shown"]:
        rows.append((f"Total cost per {p['unit']}", fr(sum(v for _, v in p["costs"])), True))
    lw, cw, rh = 4.2, 2.0, 0.55
    fig, ax = new_figure(6.2, 0.55 * (len(rows) + 5))
    top = (len(rows) + 1) * rh
    ax.text(0, top + 0.5, f"Costs of making {p['product']}", ha="left", va="center", fontsize=11.5, fontweight="bold")
    ax.add_patch(Rectangle((0, top - rh), lw, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
    ax.add_patch(Rectangle((lw, top - rh), cw, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
    ax.text(0.15, top - rh / 2, f"Cost per {p['unit']}", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(lw + cw / 2, top - rh / 2, "Frw", ha="center", va="center", fontsize=10, fontweight="bold")
    for r, (name, shown, bold) in enumerate(rows):
        y = top - (r + 2) * rh
        shade = "#f2f3f4" if bold else "white"
        ax.add_patch(Rectangle((0, y), lw, rh, facecolor=shade, edgecolor="#888888", linewidth=0.7))
        ax.add_patch(Rectangle((lw, y), cw, rh, facecolor=shade, edgecolor="#888888", linewidth=0.7))
        weight = "bold" if bold else "normal"
        ax.text(0.15, y + rh / 2, name, ha="left", va="center", fontsize=10, fontweight=weight)
        ax.text(lw + cw - 0.15, y + rh / 2, shown, ha="right", va="center", fontsize=10, fontweight=weight)
    bottom = top - (len(rows) + 1) * rh
    rule = (f"Mark-up on cost: {p['pct']}%" if p["mode"] == "markup"
            else f"Profit margin on the selling price: {p['pct']}%")
    ax.add_patch(Rectangle((0, bottom - 0.85), lw + cw, rh, facecolor="#fff6cc", edgecolor=INK, linewidth=1.0))
    ax.text(0.15, bottom - 0.85 + rh / 2, rule, ha="left", va="center", fontsize=10, fontweight="bold")
    ax.set_xlim(-0.05, lw + cw + 0.05)
    ax.set_ylim(bottom - 0.95, top + 0.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["for the coming month", "for a new customer", "before a market day", "for the price list", "for a trade fair"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    unit = p["unit"]
    cost = sum(v for _, v in p["costs"])
    pct = p["pct"]
    if p["mode"] == "markup":
        price = cost * (100 + pct) // 100
        first = (f"{who} works for {p['maker']} and prices {p['product']} {rng.choice(SETTINGS)} by cost-plus pricing: "
                 f"the mark-up shown is added to the total cost per {unit}. What price does {who} charge, in Frw?")
    else:
        price = cost * 100 // (100 - pct)
        first = (f"{who} works for {p['maker']} and prices {p['product']} {rng.choice(SETTINGS)} to earn the profit "
                 f"margin shown, where profit margin = profit ÷ selling price × 100. What price does {who} charge, in Frw?")
    other = p["other_price"]
    up = (other - cost) * 100 // cost
    thing = p["product"].split(" ", 1)[1]  # "loaf of bread"
    # The profit names its own basis, and comes before the rival's price: "at that price" after it was read as the
    # rival's (P3p review, 17 of 30).
    basis = f"{pct}% mark-up" if p["mode"] == "markup" else f"{pct}% profit margin"
    return [
        short(first, price, money(price)),
        short(rng.choice([f"At the price set with the {basis} shown, what is the profit per {unit}, in Frw?",
                          f"How much profit per {unit} does {who} make when pricing with the {basis} shown, in Frw?"]),
              price - cost, money(price - cost)),
        short(rng.choice([f"A shop nearby sells the same {thing} for {fr(other)} Frw, with the same costs. ",
                          f"Suppose the {thing} were sold for {fr(other)} Frw instead. "])
              + f"Mark-up % = (selling price − cost per {unit}) ÷ cost per {unit} × 100. What mark-up % does that price give?",
              up, [f"{up}%", f"{up} %", f"{up} percent"]),
    ]
