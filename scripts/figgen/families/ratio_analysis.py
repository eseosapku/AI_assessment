"""Ratio analysis (UP, AL): a sole trader's income statement extract (revenue, cost of sales, gross profit,
expenses, profit for the year) beside a statement of financial position extract (current assets and current
liabilities, itemised and totalled), as Cambridge IGCSE Accounting 0452 and AS Accounting set them out.

Asks the current ratio (current assets ÷ current liabilities, to 2 decimal places, "1.75 : 1" accepted), the
gross margin (a choice among the usual slips: the mark-up, the cost of sales share, the profit margin) and the
profit margin; at AL also the liquid (acid test) ratio. Every formula is stated in its stem, and the figures are
chosen so each ratio is exact to 2 decimal places and each margin a whole percentage.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, mcq, short
from ._accounts import PLACES, TOWNS, TRADES, YEARS, article, frw, page, rule

ID = "ratio_analysis"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP", "AL")
CONCEPTS = ("accounting.ratio-analysis", "accounting.financial-statement-analysis")
ALSO = ("business.financial-ratios-and-analysis",)
# A topic whose sections the book lists is reached only if one names ratios or the analysis of accounts.
NEEDS = r"\bratios?\b|interpret|analysis of|liquidity|profitability|\bmargins?\b"  # not "consideRATIOns"
AVOID = (r"\btax|costing|budget|partnership changes|merger|acquisition|investment appraisal|inventory management|"
         r"control account|capacity|costs \(a level\)|business structure|size of business")

CURRENT = ["0.80", "0.90", "1.20", "1.25", "1.40", "1.50", "1.60", "1.75", "1.80", "2.00", "2.20", "2.25", "2.40", "2.50",
           "2.75", "3.00"]
LIQUID = ["0.50", "0.60", "0.75", "0.80", "0.90", "1.00", "1.10", "1.20", "1.25", "1.40", "1.50"]


def sample(rng: random.Random) -> dict:
    while True:
        cl = rng.randrange(200_000, 1_500_001, 20_000)
        r = Fraction(rng.choice(CURRENT))
        q = Fraction(rng.choice([x for x in LIQUID if Fraction(x) <= r - Fraction(3, 10)] or ["0.50"]))
        ca, liquid = cl * r, cl * q
        if ca.denominator != 1 or liquid.denominator != 1 or ca % 1_000 or liquid % 1_000 or liquid >= ca:
            continue
        ca, liquid = int(ca), int(liquid)
        receivables = round(liquid * rng.uniform(0.4, 0.8) / 1_000) * 1_000
        payables = round(cl * rng.uniform(0.6, 0.9) / 1_000) * 1_000
        revenue = rng.randrange(2_000_000, 20_000_001, 100_000)
        g = rng.choice([x for x in range(20, 61) if x != 50])
        pm = rng.randint(3, g - 8)
        gp, profit = revenue * g // 100, revenue * pm // 100
        p = {"band": rng.choice(BANDS), "year": rng.choice(YEARS),
             "current_assets": [["Inventory", ca - liquid], ["Trade receivables", receivables],
                                ["Cash and cash equivalents", liquid - receivables]],
             "current_liabilities": [["Trade payables", payables], ["Other payables", cl - payables]],
             "revenue": revenue, "cost_of_sales": revenue - gp, "expenses": gp - profit}
        amounts = [v for _, v in p["current_assets"] + p["current_liabilities"]] + [ca, cl, revenue, revenue - gp, gp,
                                                                                   gp - profit, profit]
        if min(amounts) <= 0 or len(set(amounts)) < len(amounts):
            continue
        trade, word = rng.choice(TRADES)
        town = rng.choice(TOWNS)
        place = rng.choice(PLACES) if town == "Kigali" else town
        p.update({"trader": f"{place} {word}", "business": f"{article(trade)} {trade} in {town}"})
        return p


LABEL_W, AMT_W, X0, GAP, ROW = 2.35, 1.2, 0.12, 0.4, 0.29


def draw(p: dict):
    ca = sum(v for _, v in p["current_assets"])
    cl = sum(v for _, v in p["current_liabilities"])
    rev, cos, exp = p["revenue"], p["cost_of_sales"], p["expenses"]
    left_w = LABEL_W + AMT_W
    right_x = X0 + left_w + GAP
    width = right_x + LABEL_W + 2 * AMT_W + X0
    rows = 3 + len(p["current_assets"]) + len(p["current_liabilities"]) + 1  # two headings, two totals
    height = 1.5 + rows * ROW + 0.35
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, p["trader"], ha="center", va="top", fontsize=12, fontweight="bold")
    # the income statement extract, on the left
    for x, w, title, when in ((X0, left_w, "Income statement (extract)", f"for the year ended 31 December {p['year']}"),
                              (right_x, LABEL_W + 2 * AMT_W, "Statement of financial position (extract)",
                               f"at 31 December {p['year']}")):
        ax.text(x + w / 2, top - 0.38, title, ha="center", va="top", fontsize=10.5, fontweight="bold")
        ax.text(x + w / 2, top - 0.64, when, ha="center", va="top", fontsize=10)
        ax.text(x + w - 0.08, top - 1.08, "Frw", ha="right", va="center", fontsize=10, fontweight="bold")
    ax.text(right_x + LABEL_W + AMT_W - 0.08, top - 1.08, "Frw", ha="right", va="center", fontsize=10, fontweight="bold")
    y0 = top - 1.08
    x_amt = X0 + left_w
    income = [("Revenue", rev, False), ("Cost of sales", cos, False), ("Gross profit", rev - cos, True),
              ("Expenses", exp, False), ("Profit for the year", rev - cos - exp, True)]
    for i, (label, v, above) in enumerate(income):
        y = y0 - (i + 1) * ROW
        ax.text(X0 + 0.05, y, label, ha="left", va="center", fontsize=10)
        ax.text(x_amt - 0.08, y, frw(v), ha="right", va="center", fontsize=10)
        if above:
            rule(ax, x_amt - AMT_W + 0.2, x_amt - 0.04, y + ROW / 2, width=0.8)
    rule(ax, x_amt - AMT_W + 0.2, x_amt - 0.04, y0 - len(income) * ROW - ROW / 2, double=True, width=0.8)
    # the statement of financial position extract, on the right: items in the inner column, totals in the outer
    x_in, x_out = right_x + LABEL_W + AMT_W, right_x + LABEL_W + 2 * AMT_W
    sofp = [("Current assets", None, None)] + [(n, v, "in") for n, v in p["current_assets"]] + [("", ca, "total")]
    sofp += [("Current liabilities", None, None)] + [(n, v, "in") for n, v in p["current_liabilities"]] + [("", cl, "total")]
    for i, (label, v, where) in enumerate(sofp):
        y = y0 - (i + 1) * ROW
        if label:
            heading = v is None
            ax.text(right_x + (0.05 if heading else 0.3), y, label, ha="left", va="center", fontsize=10,
                    fontweight="bold" if heading else "normal")
        if where == "in":
            ax.text(x_in - 0.08, y, frw(v), ha="right", va="center", fontsize=10)
        elif where == "total":
            ax.text(x_out - 0.08, y, frw(v), ha="right", va="center", fontsize=10)
            rule(ax, x_in - AMT_W + 0.2, x_in - 0.04, y + ROW / 2, width=0.8)
    # the two extracts boxed apart
    bottom = y0 - len(sofp) * ROW - 0.22
    for x, w in ((X0, left_w), (right_x, LABEL_W + 2 * AMT_W)):
        ax.plot([x - 0.06, x + w + 0.02, x + w + 0.02, x - 0.06, x - 0.06], [top - 0.3, top - 0.3, bottom, bottom, top - 0.3],
                color="#777777", linewidth=0.8)
    return fig


VERBS = ["analyses the accounts of", "compares the results of", "is studying the accounts of", "looks at the accounts of"]


def ratio(fr: Fraction) -> tuple[str, list[str]]:
    """A ratio to 2 decimal places, and the fair ways to write it: "1.50", "1.5", "1.50 : 1", "1.5:1", "1.5 to 1"."""
    key = f"{float(fr):.2f}"
    plain = key.rstrip("0").rstrip(".")
    forms = [key]
    for x in dict.fromkeys([key, plain]):
        forms += [x, f"{x} : 1", f"{x}:1", f"{x} to 1"]
    return key, list(dict.fromkeys(forms))


def pct(x: Fraction) -> str:
    return f"{x.numerator // x.denominator}%" if x.denominator == 1 else f"{float(x):.1f}%"


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    ca = sum(v for _, v in p["current_assets"])
    cl = sum(v for _, v in p["current_liabilities"])
    inventory = dict(p["current_assets"])["Inventory"]
    rev, cos, exp = p["revenue"], p["cost_of_sales"], p["expenses"]
    gp, profit = rev - cos, rev - cos - exp
    g, pm = Fraction(gp * 100, rev), Fraction(profit * 100, rev)
    current, current_forms = ratio(Fraction(ca, cl))
    qs = [short(f"{who} {rng.choice(VERBS)} {p['trader']}, {p['business']}, for {p['year']}. The current ratio is current "
                "assets ÷ current liabilities. What is the current ratio, to 2 decimal places?", current, current_forms),
          # the slips: the mark-up (gross profit ÷ cost of sales), the cost of sales share, the profit margin, the expenses' share
          mcq("The gross margin is gross profit ÷ revenue × 100. What is the gross margin, as a percentage?", pct(g),
              [pct(Fraction(gp * 100, cos)), pct(Fraction(cos * 100, rev)), pct(pm), pct(Fraction(exp * 100, rev))], rng),
          short("The profit margin is profit for the year ÷ revenue × 100. What is the profit margin, as a percentage?",
                str(pm), [f"{pm}%", f"{pm} %", f"{pm} percent"])]
    if p["band"] == "AL":
        liquid, liquid_forms = ratio(Fraction(ca - inventory, cl))
        qs.append(short("The liquid (acid test) ratio is (current assets − inventory) ÷ current liabilities. What is the "
                        "liquid ratio, to 2 decimal places?", liquid, liquid_forms))
    return qs
