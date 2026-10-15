"""A sole trader's statement of financial position (UP), in the vertical layout of Cambridge IGCSE Accounting 0452
(Part B of the financial statements), Rwanda S4 Financial Accounting and the WAEC and NERDC books: non-current
assets and their total; current assets less current liabilities, each totalled; net current assets; a bank loan
perhaps; net assets; then capital: the opening balance, plus the profit for the year, less drawings, and the
closing capital. The net current assets, the totals below them and the net assets are "?", and so is one line of
the capital section: the closing capital, the profit for the year or the drawings (the sub-types).

Asks the net current assets (current assets - current liabilities) and the capital line left blank. Every key is
the statement worked through: closing capital = opening capital + profit - drawings, and it equals the net assets.
The closing capital is a choice among the usual slips: drawings added, drawings left out, the profit left out.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, money, short
from ._accounts import TOWNS, TRADES, YEARS, article, frw, page, rule

ID = "financial_position"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same layout in Cambridge AS Level, where the chapter is named for it
# Accruals and prepayments too, where the statement shows them as other receivables or payables (concepts_for): the
# AS Level chapter on this statement is mapped to that concept and not to the statements'.
CONCEPTS = ("accounting.financial-statements-sole-traders", "accounting.incomplete-records",
            "accounting.accruals-and-prepayments")
ALSO = ("business.financial-statements",)  # Rwanda's Entrepreneurship books teach it under business
# A topic whose sections the book lists is reached only if one names the statement, its old name or what it works
# out; the statement of affairs is the same statement, drawn up from incomplete records.
NEEDS = r"financial position|balance sheet|part b|net current assets|working capital|statement of aff|incomplete records"
# Partnerships, companies and clubs draw it another way; the errors chapter only shows its effect on the statement.
AVOID = (r"partnership|compan|club|societ|non-profit|manufactur|\btax|costing|budget|cash flow|interpretation|analysis|"
         r"merger|acquisition|errors|journal|further considerations|ledgers|prime books|growth|^finance")

NON_CURRENT = [("Premises", 4_000_000, 30_000_000, 500_000), ("Fixtures and fittings", 300_000, 2_000_000, 50_000),
               ("Equipment", 300_000, 3_000_000, 50_000), ("Motor vehicle", 2_000_000, 12_000_000, 100_000),
               ("Machinery", 800_000, 6_000_000, 100_000), ("Office furniture", 200_000, 1_500_000, 50_000)]
BLANKS = ["closing", "closing", "profit", "drawings"]


def concepts_for(p: dict) -> tuple:
    """The statement's concepts, and accruals and prepayments where it lists other receivables or payables."""
    other = any(name.startswith("Other") for name, _ in p["current_assets"] + p["current_liabilities"])
    return CONCEPTS if other else CONCEPTS[:2]


def sample(rng: random.Random) -> dict:
    trade = rng.choice([t for t, _ in TRADES])
    while True:
        non_current = [[name, rng.randrange(lo, hi + 1, step)]
                       for name, lo, hi, step in sorted(rng.sample(NON_CURRENT, rng.randint(2, 4)), key=NON_CURRENT.index)]
        current = [["Inventory", rng.randrange(300_000, 3_000_001, 10_000)],
                   ["Trade receivables", rng.randrange(150_000, 1_500_001, 5_000)]]
        if rng.random() < 0.5:
            current.append(["Other receivables", rng.randrange(10_000, 150_001, 5_000)])
        liabilities = [["Trade payables", rng.randrange(150_000, 1_500_001, 5_000)]]
        if rng.random() < 0.5:
            liabilities.append(["Other payables", rng.randrange(10_000, 150_001, 5_000)])
        if rng.random() < 0.25:
            liabilities.append(["Bank overdraft", rng.randrange(50_000, 600_001, 5_000)])
            current.append(["Cash", rng.randrange(10_000, 200_001, 1_000)])
        else:
            current.append(["Bank", rng.randrange(50_000, 2_000_001, 5_000)])
            if len(current) < 4 and rng.random() < 0.5:
                current.append(["Cash", rng.randrange(10_000, 200_001, 1_000)])
        loan = rng.choice([0, 0, rng.randrange(1_000_000, 6_000_001, 100_000)])
        nca = sum(v for _, v in non_current)
        ca = sum(v for _, v in current)
        cl = sum(v for _, v in liabilities)
        closing = nca + ca - cl - loan
        if ca - cl < 100_000 or closing < 1_000_000:
            continue
        profit = round(closing * rng.uniform(0.1, 0.35) / 5_000) * 5_000
        drawings = round(profit * rng.uniform(0.2, 0.8) / 5_000) * 5_000
        opening = closing - profit + drawings
        p = {"band": "UP", "owner": rng.choice(NAMES), "business": f"{article(trade)} {trade} in {rng.choice(TOWNS)}",
             "year": rng.choice(YEARS), "non_current": non_current, "current_assets": current,
             "current_liabilities": liabilities, "loan": loan, "opening": opening, "profit": profit,
             "drawings": drawings, "blank": rng.choice(BLANKS)}
        # every amount on the page, and every blank, a different number: nothing is read off by coincidence
        amounts = [v for _, v in non_current + current + liabilities] + [nca, ca, cl, ca - cl, closing, opening, profit,
                                                                        opening + profit, drawings]
        if loan:
            amounts += [loan, nca + ca - cl]
        if len(set(amounts)) == len(amounts) and min(amounts) > 0:
            return p


LABEL_W, AMT_W, X0, ROW = 3.25, 1.3, 0.12, 0.27
INNER, OUTER = "inner", "outer"


def lines(p: dict) -> list:
    """(label, indent, column, amount or "?", the column ruled off above it, bold, a double rule under it)."""
    nca = sum(v for _, v in p["non_current"])
    ca = sum(v for _, v in p["current_assets"])
    cl = sum(v for _, v in p["current_liabilities"])
    blank = p["blank"]
    out = [("Non-current assets", 0, None, None, None, True, False)]
    out += [(name, 1, INNER, v, None, False, False) for name, v in p["non_current"]]
    out.append(("", 1, OUTER, nca, INNER, False, False))
    out.append(("Current assets", 0, None, None, None, True, False))
    out += [(name, 1, INNER, v, None, False, False) for name, v in p["current_assets"]]
    out.append(("", 1, INNER, ca, INNER, False, False))
    out.append(("Less Current liabilities", 0, None, None, None, True, False))
    out += [(name, 1, INNER, v, None, False, False) for name, v in p["current_liabilities"]]
    out.append(("", 1, INNER, cl, INNER, False, False))
    out.append(("Net current assets", 0, OUTER, "?", None, False, False))
    if p["loan"]:
        out.append(("", 0, OUTER, "?", OUTER, False, False))
        out.append(("Less Non-current liabilities", 0, None, None, None, True, False))
        out.append(("Bank loan", 1, OUTER, p["loan"], None, False, False))
    out.append(("Net assets", 0, OUTER, "?", OUTER, True, True))
    out.append(("", 0, None, None, None, False, False))  # a line's space under the double rule
    out.append(("Capital", 0, None, None, None, True, False))
    out.append(("Opening balance", 1, OUTER, p["opening"], None, False, False))
    out.append(("Add Profit for the year", 1, OUTER, "?" if blank == "profit" else p["profit"], None, False, False))
    out.append(("", 1, OUTER, "?" if blank == "profit" else p["opening"] + p["profit"], OUTER, False, False))
    out.append(("Less Drawings", 1, OUTER, "?" if blank == "drawings" else p["drawings"], None, False, False))
    closing = p["opening"] + p["profit"] - p["drawings"]
    out.append(("Closing capital", 0, OUTER, "?" if blank == "closing" else closing, OUTER, True, True))
    return out


def draw(p: dict):
    rows = lines(p)
    width = 2 * X0 + LABEL_W + 2 * AMT_W
    height = 1.05 + (len(rows) + 0.6) * ROW
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, p["owner"], ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Statement of financial position at 31 December {p['year']}", ha="center", va="top",
            fontsize=11)
    x_in, x_out = X0 + LABEL_W + AMT_W, X0 + LABEL_W + 2 * AMT_W  # right edges of the two money columns
    head = top - 0.82
    for x in (x_in, x_out):
        ax.text(x - 0.08, head, "Frw", ha="right", va="center", fontsize=10, fontweight="bold")
    for i, (label, indent, col, amount, above, bold, double) in enumerate(rows):
        y = head - (i + 1) * ROW
        if label:
            ax.text(X0 + 0.05 + 0.3 * indent, y, label, ha="left", va="center", fontsize=10,
                    fontweight="bold" if bold else "normal")
        if col is None:
            continue
        x = x_in if col == INNER else x_out
        text = amount if amount == "?" else frw(amount)
        ax.text(x - 0.08, y, text, ha="right", va="center", fontsize=10.5 if text == "?" else 10,
                fontweight="bold" if text == "?" else "normal")
        if above:
            xr = x_in if above == INNER else x_out
            rule(ax, xr - AMT_W + 0.2, xr - 0.04, y + ROW / 2, width=0.8)
        if double:
            rule(ax, x - AMT_W + 0.2, x - 0.04, y - ROW / 2 + 0.03, double=True, width=0.8)
    return fig


INTRO = ["runs", "owns", "is the owner of", "has"]
VERB = ["prepares", "draws up", "completes"]


def questions(p: dict, rng: random.Random) -> list:
    who, year = p["owner"], p["year"]
    ca = sum(v for _, v in p["current_assets"])
    cl = sum(v for _, v in p["current_liabilities"])
    o, pr, d = p["opening"], p["profit"], p["drawings"]
    closing = o + pr - d
    out = [short(f"{who} {rng.choice(INTRO)} {p['business']} and {rng.choice(VERB)} this statement of financial position. "
                 f"Net current assets are current assets less current liabilities. What are {who}'s net current assets "
                 f"at 31 December {year}?", ca - cl, money(ca - cl))]
    if p["blank"] == "closing":
        # the slips: drawings added, drawings left out, the profit left out, the loan forgotten
        slips = [o + pr + d, o + pr, o - d] + ([closing + p["loan"]] if p["loan"] else [])
        out.append(mcq(f"What is {who}'s closing capital at 31 December {year}?", f"{frw(closing)} Frw",
                       [f"{frw(v)} Frw" for v in slips if v > 0], rng))
    elif p["blank"] == "profit":
        out.append(short(f"What was {who}'s profit for the year ended 31 December {year}?", pr, money(pr)))
    else:
        out.append(short(f"How much did {who} take out of the business as drawings during {year}?", d, money(d)))
    return out
