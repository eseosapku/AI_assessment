"""A sole trader's income statement (UP), laid out as Cambridge IGCSE Accounting 0452 and Rwanda S4-S6 books do:
revenue; cost of sales worked from opening inventory, purchases and closing inventory; gross profit; three to five
expenses and their total; profit for the year. Two of the three lines cost of sales, gross profit and profit for
the year are left as "?".

Asks the two lines left blank. Every key is the statement worked through: cost of sales = opening inventory +
purchases - closing inventory; gross profit = revenue - cost of sales; profit for the year = gross profit - expenses.
The cost of sales is asked as a choice among the usual slips: closing inventory added, or left out, or the two
inventories swapped.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, money, short
from ._accounts import TOWNS, TRADES, YEARS, article, frw, page, rule

ID = "income_statement"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same layout in Cambridge AS Level, where the chapter is named for it
CONCEPTS = ("accounting.financial-statements-sole-traders",)
ALSO = ("business.financial-statements",)  # Rwanda's Entrepreneurship books teach it under business
# A topic whose sections the book lists is reached only if one names the income statement or what it works out.
NEEDS = r"income statement|profit or loss|trading|final accounts|financial statements|cost of sales|gross profit|sole trader"
# Part B of the financial statements is the statement of financial position; interpretation is ratios.
AVOID = (r"partnership|compan|club|societ|non-profit|manufactur|tax|costing|budget|cash flow|incomplete|stakeholder|"
         r"auditing|international|merger|acquisition|interpretation|financial statements\W+part b")

# (expense, lowest and highest share of revenue)
EXPENSES = [("Wages", 0.05, 0.14), ("Rent", 0.02, 0.06), ("Electricity", 0.005, 0.02), ("Insurance", 0.004, 0.015),
            ("Transport", 0.008, 0.03), ("Advertising", 0.004, 0.02), ("Telephone", 0.002, 0.008), ("Water", 0.002, 0.008),
            ("General expenses", 0.004, 0.02)]
BLANKS = [["cos", "gp"], ["gp", "profit"], ["cos", "profit"]]


def figures(p: dict) -> dict:
    cos = p["opening"] + p["purchases"] - p["closing"]
    gp = p["revenue"] - cos
    total = sum(e[1] for e in p["expenses"])
    return {"available": p["opening"] + p["purchases"], "cos": cos, "gp": gp, "total": total, "profit": gp - total}


def sample(rng: random.Random) -> dict:
    trade = rng.choice([t for t, _ in TRADES])
    while True:
        revenue = rng.randrange(4_000_000, 30_000_001, 50_000)
        cos = round(revenue * rng.uniform(0.5, 0.75) / 10_000) * 10_000
        opening = rng.randrange(300_000, 3_000_001, 10_000)
        closing = rng.randrange(300_000, 3_000_001, 10_000)
        expenses = [[name, max(5_000, round(revenue * rng.uniform(lo, hi) / 5_000) * 5_000)]
                    for name, lo, hi in rng.sample(EXPENSES, rng.randint(3, 5))]
        p = {"band": "UP", "owner": rng.choice(NAMES), "business": f"{article(trade)} {trade} in {rng.choice(TOWNS)}",
             "year": rng.choice(YEARS), "revenue": revenue, "opening": opening,
             "purchases": cos - opening + closing, "closing": closing, "expenses": expenses, "blanks": rng.choice(BLANKS)}
        f = figures(p)
        if opening == closing or f["profit"] < revenue * 0.03:
            continue
        # every amount on the page, and every blank, a different number: nothing is read off by coincidence
        amounts = [revenue, opening, p["purchases"], closing, f["available"], f["total"], f["cos"], f["gp"], f["profit"]]
        amounts += [e[1] for e in expenses]
        if len(set(amounts)) == len(amounts):
            return p


LABEL_W, AMT_W, X0, ROW = 3.2, 1.3, 0.12, 0.28


def draw(p: dict):
    f = figures(p)
    inner, outer = "inner", "outer"
    blank = set(p["blanks"])
    # (label, indent, column, amount or "?", the column ruled off above it): a line is ruled under the figures it totals
    lines = [("Revenue", 0, outer, p["revenue"], None),
             ("Less Cost of sales", 0, None, None, None),
             ("Opening inventory", 1, inner, p["opening"], None),
             ("Add Purchases", 1, inner, p["purchases"], None),
             ("", 1, inner, f["available"], inner),
             ("Less Closing inventory", 1, inner, p["closing"], None),
             ("Cost of sales", 1, outer, "?" if "cos" in blank else f["cos"], inner),
             ("Gross profit", 0, outer, "?" if "gp" in blank else f["gp"], outer),
             ("Less Expenses", 0, None, None, None)]
    lines += [(name, 1, inner, amount, None) for name, amount in p["expenses"]]
    lines += [("Total expenses", 1, outer, f["total"], inner),
              ("Profit for the year", 0, outer, "?" if "profit" in blank else f["profit"], outer)]
    width = 2 * X0 + LABEL_W + 2 * AMT_W
    height = 1.12 + len(lines) * ROW
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, p["owner"], ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Income statement for the year ended 31 December {p['year']}", ha="center", va="top", fontsize=11)
    x_in, x_out = X0 + LABEL_W + AMT_W, X0 + LABEL_W + 2 * AMT_W  # right edges of the two money columns
    head = top - 0.82
    for x in (x_in, x_out):
        ax.text(x - 0.08, head, "Frw", ha="right", va="center", fontsize=10, fontweight="bold")
    for i, (label, indent, col, amount, above) in enumerate(lines):
        y = head - (i + 1) * ROW
        if label:
            bold = "bold" if label in ("Gross profit", "Profit for the year") else "normal"
            ax.text(X0 + 0.05 + 0.3 * indent, y, label, ha="left", va="center", fontsize=10, fontweight=bold)
        if col is None:
            continue
        x = x_in if col == inner else x_out
        text = amount if amount == "?" else frw(amount)
        ax.text(x - 0.08, y, text, ha="right", va="center", fontsize=10.5 if text == "?" else 10,
                fontweight="bold" if text == "?" else "normal")
        if above:
            xr = x_in if above == inner else x_out
            rule(ax, xr - AMT_W + 0.2, xr - 0.04, y + ROW / 2, width=0.8)
    y_last = head - len(lines) * ROW
    rule(ax, x_out - AMT_W + 0.2, x_out - 0.04, y_last - ROW / 2, double=True, width=0.8)
    return fig


INTRO = ["runs", "owns", "is the owner of", "has"]
ASK = ["What is", "Work out", "Calculate"]


def questions(p: dict, rng: random.Random) -> list:
    f = figures(p)
    who, year = p["owner"], p["year"]
    intro = f"{who} {rng.choice(INTRO)} {p['business']} and prepares this income statement. "
    out = []
    for b in ("cos", "gp", "profit"):
        if b not in p["blanks"]:
            continue
        lead = intro if not out else ""
        ask = rng.choice(ASK)
        end = "?" if ask == "What is" else "."
        if b == "cos":
            slips = [p["opening"] + p["purchases"] + p["closing"], p["purchases"] + p["closing"] - p["opening"],
                     p["opening"] + p["purchases"], p["purchases"] - p["closing"]]
            out.append(mcq(f"{lead}What is {who}'s cost of sales for {year}?", f"{frw(f['cos'])} Frw",
                           [f"{frw(v)} Frw" for v in slips if v > 0], rng))
        elif b == "gp":
            out.append(short(f"{lead}{ask} {who}'s gross profit for {year}{end}", f["gp"], money(f["gp"])))
        else:
            out.append(short(f"{lead}{ask} {who}'s profit for the year {year}{end}", f["profit"], money(f["profit"])))
    return out
