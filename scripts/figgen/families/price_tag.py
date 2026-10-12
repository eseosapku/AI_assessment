"""Percentages in money (LS, UP): a sale tag, a receipt with VAT at 18%, a salesperson's weekly sales
slip with a commission rate, or a bank's savings notice with simple (LS) or compound (UP) interest.

Every answer is a whole number of francs; a compound amount is asked to the nearest franc, as the
stem says. Amounts accept "1,500", "1500", "1500 Frw" and the other fair forms (core.money).
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle, FancyBboxPatch

from ..core import FILL_2, INK, NAMES, money, new_figure, short

ID = "price_tag"
KIND = "business.document"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "buying-selling-prices", "percentage-change", "multipliers-percentage-change", "commission", "indirect-taxes", "interest-rates",
    "borrowing-investing-money", "commercial-arithmetic",
))
# Percentages in money: not logarithms, nor powers of 10.
AVOID = r"logarithm|powers of"
# What is on sale, and what it costs before the sale, in Frw: a bicycle is never 8,500 Frw.
GOODS = {"pair of shoes": (8000, 30000), "radio": (10000, 40000), "mobile phone": (30000, 150000), "school bag": (6000, 20000),
         "mattress": (30000, 90000), "bicycle": (60000, 150000), "cooking pot": (5000, 20000), "football": (5000, 15000)}
RECEIPT = [("Rice, 5 kg", 4500, 7000), ("Cooking oil, 1 litre", 2500, 3500), ("Sugar, 2 kg", 2500, 3500), ("Beans, 3 kg", 2000, 3500),
           ("Soap", 500, 1000), ("Tea leaves", 1000, 2000), ("Salt", 300, 600), ("Exercise books", 1500, 3000)]
BANKS = ["Savings account", "School fees saver", "Young savers' account"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = rng.choice(["sale", "vat", "commission", "interest"])
    base = {"band": band, "kind": kind, "name": rng.choice(NAMES)}
    if kind == "sale":
        item = rng.choice(sorted(GOODS))
        lo, hi = GOODS[item]
        return base | {"item": item, "was": 500 * rng.randint(lo // 500, hi // 500), "rate": rng.choice([10, 15, 20, 25, 30, 40, 50])}
    if kind == "vat":
        lines = rng.sample(RECEIPT, 3)
        return base | {"lines": [n for n, _, _ in lines], "prices": [50 * rng.randint(lo // 50, hi // 50) for _, lo, hi in lines]}
    if kind == "commission":
        return base | {"sales": [1000 * rng.randint(20, 150) for _ in range(5)], "rate": rng.choice([2, 3, 4, 5, 8, 10])}
    return base | {"bank": rng.choice(BANKS), "rate": rng.choice([3, 4, 5, 6, 8, 10]), "compound": band == "UP" and rng.random() < 0.7}


def _card(ax, w: float, h: float, tag: bool = False):
    ax.add_patch(FancyBboxPatch((0.2, 0.2), w, h, boxstyle="round,pad=0.05,rounding_size=0.25", facecolor=FILL_2 if tag else "white",
                                edgecolor=INK, linewidth=1.6))
    if tag:  # the hole the string goes through
        ax.add_patch(Circle((0.8, 0.2 + h / 2), 0.18, facecolor="white", edgecolor=INK, linewidth=1.2))


def draw(p: dict):
    k = p["kind"]
    if k == "sale":
        fig, ax = new_figure(5.0, 2.8)
        _card(ax, 9.0, 4.4, tag=True)
        ax.text(5.0, 3.7, p["item"].capitalize(), ha="center", va="center", fontsize=13, fontweight="bold")
        ax.text(5.0, 2.5, f"Was {p['was']:,} Frw", ha="center", va="center", fontsize=13)
        ax.text(5.0, 1.2, f"Now {p['rate']}% off", ha="center", va="center", fontsize=17, fontweight="bold")
        ax.set_xlim(0, 9.6)
        ax.set_ylim(0, 4.8)
    elif k == "vat":
        rows = len(p["lines"])
        fig, ax = new_figure(4.6, 4.6)
        _card(ax, 9.0, rows + 4.6)
        top = rows + 3.8
        ax.text(4.7, top, f"{p['name']}'s receipt", ha="center", va="center", fontsize=12, fontweight="bold")
        for i, (line, price) in enumerate(zip(p["lines"], p["prices"])):
            ax.text(0.8, top - 1.1 - i, line, ha="left", va="center", fontsize=11)
            ax.text(8.8, top - 1.1 - i, f"{price:,}", ha="right", va="center", fontsize=11)
        y = top - 1.1 - rows
        ax.plot([0.8, 8.8], [y + 0.45, y + 0.45], color=INK, linewidth=0.8)
        for j, label in enumerate(("Subtotal", "VAT at 18%", "Total (Frw)")):
            ax.text(0.8, y - j, label, ha="left", va="center", fontsize=11, fontweight="bold" if j == 2 else "normal")
            ax.text(8.8, y - j, "........", ha="right", va="center", fontsize=11)
        ax.set_xlim(0, 9.6)
        ax.set_ylim(0, rows + 5.0)
    elif k == "commission":
        fig, ax = new_figure(4.6, 4.4)
        _card(ax, 9.0, 8.4)
        ax.text(4.7, 7.9, f"{p['name']}'s sales this week", ha="center", va="center", fontsize=12, fontweight="bold")
        for i, (day, v) in enumerate(zip(("Monday", "Tuesday", "Wednesday", "Thursday", "Friday"), p["sales"])):
            ax.text(0.8, 6.7 - i, day, ha="left", va="center", fontsize=11)
            ax.text(8.8, 6.7 - i, f"{v:,} Frw", ha="right", va="center", fontsize=11)
        ax.plot([0.8, 8.8], [2.25, 2.25], color=INK, linewidth=0.8)
        ax.text(4.7, 1.3, f"Commission: {p['rate']}% of sales", ha="center", va="center", fontsize=12, fontweight="bold")
        ax.set_xlim(0, 9.6)
        ax.set_ylim(0, 8.8)
    else:
        fig, ax = new_figure(5.0, 2.8)
        _card(ax, 9.0, 4.4)
        ax.text(5.0, 3.8, p["bank"], ha="center", va="center", fontsize=14, fontweight="bold")
        ax.text(5.0, 2.5, f"{p['rate']}% interest a year", ha="center", va="center", fontsize=15)
        ax.text(5.0, 1.2, "Compound: interest is added each year" if p["compound"] else "Simple interest on what you save",
                ha="center", va="center", fontsize=11)
        ax.set_xlim(0, 9.6)
        ax.set_ylim(0, 4.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _amount(stem: str, n: int):
    return short(stem, n, money(n))


def questions(p: dict, rng: random.Random) -> list:
    k, name = p["kind"], p["name"]
    if k == "sale":
        was, r = p["was"], p["rate"]
        now = _amount(f"{name} buys the {p['item']} in the sale. How much does {name} pay?", was * (100 - r) // 100)
        saved = _amount(f"How much does {name} save on the {p['item']} by buying it in the sale?", was * r // 100)
        share = short("The sale price is what percentage of the old price?", 100 - r, [f"{100 - r}%"])
        return [now, saved, share]
    if k == "vat":
        sub = sum(p["prices"])
        return [_amount(f"What is the subtotal on {name}'s receipt?", sub),
                _amount("How much is the VAT at 18%?", sub * 18 // 100),
                _amount(f"How much does {name} pay in total, with the VAT?", sub * 118 // 100)]
    if k == "commission":
        sales, r = sum(p["sales"]), p["rate"]
        qs = [_amount(f"What is the total of {name}'s sales this week?", sales),
              _amount(f"How much commission does {name} earn this week?", sales * r // 100)]
        if p["band"] == "UP":
            wage = 1000 * rng.randint(10, 40)
            qs.append(_amount(f"{name} also earns a basic wage of {wage:,} Frw a week. What is {name}'s total pay this week?",
                              wage + sales * r // 100))
        return qs
    r = p["rate"]
    P = 10000 * rng.randint(1, 20)
    n = rng.randint(2, 4) if p["compound"] else rng.randint(2, 5)
    if p["compound"]:
        amount = Fraction(P) * (1 + Fraction(r, 100)) ** n
        key = int(amount + Fraction(1, 2))
        return [_amount(f"{name} saves {P:,} Frw in this account for {n} years. How much is in the account at the end? "
                        "Give your answer to the nearest franc.", key),
                _amount(f"How much interest does {name} earn over the {n} years, to the nearest franc?", key - P)]
    interest = P * r * n // 100
    return [_amount(f"{name} saves {P:,} Frw in this account for {n} years. How much interest does {name} earn?", interest),
            _amount(f"How much does {name} have at the end of the {n} years?", P + interest)]
