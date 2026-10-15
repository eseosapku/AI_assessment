"""A trial balance (UP), laid out as Cambridge IGCSE Accounting 0452 and Rwanda S4-S6 books do: a sole trader's six
to nine ledger balances listed in a Debit and a Credit column, each on its natural side (assets, expenses and
drawings debit; capital, liabilities and income credit), one figure left as "?" and the column totals left as "?".

Asks the missing figure and the column totals. Every key is the columns added up: the complete column's total is
both totals, and the missing figure is that total less the rest of its own column.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, money, short
from ._accounts import PLACES, TOWNS, TRADES, YEARS, article, frw, page, rule

ID = "trial_balance"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same layout in Cambridge AS Level, where the chapter is named for it
# The book chapters on the trial balance carry double entry but not the trial-balance concept (the P0 map missed it).
CONCEPTS = ("accounting.trial-balance", "accounting.double-entry-bookkeeping")
ALSO = ("business.general-ledger-and-trial-balance",)  # Rwanda's Entrepreneurship books teach it under business
# A topic whose sections the book lists is reached only if one names the trial balance.
NEEDS = r"trial balance"
AVOID = (r"partnership|compan|club|societ|non-profit|manufactur|incomplete|tax|costing|budget|control account|suspense|"
         r"correction|books of (original|prime) entry|introduction")

# (account, natural side, lowest, highest, step), in the order a textbook lists them.
ACCOUNTS = [
    ("Drawings", "Dr", 300_000, 2_400_000, 50_000),
    ("Premises", "Dr", 6_000_000, 20_000_000, 500_000), ("Motor vehicle", "Dr", 4_000_000, 12_000_000, 100_000),
    ("Equipment", "Dr", 800_000, 5_000_000, 50_000), ("Fixtures and fittings", "Dr", 500_000, 3_000_000, 50_000),
    ("Inventory", "Dr", 300_000, 2_500_000, 10_000), ("Trade receivables", "Dr", 200_000, 1_800_000, 10_000),
    ("Bank", "Dr", 100_000, 2_500_000, 10_000), ("Cash", "Dr", 20_000, 300_000, 5_000),
    ("Bank loan", "Cr", 1_000_000, 6_000_000, 100_000), ("Trade payables", "Cr", 200_000, 1_800_000, 10_000),
    ("Bank overdraft", "Cr", 100_000, 900_000, 10_000),
    ("Sales returns", "Dr", 50_000, 400_000, 5_000), ("Purchases returns", "Cr", 30_000, 300_000, 5_000),
    ("Carriage inwards", "Dr", 20_000, 200_000, 5_000),
    ("Wages", "Dr", 600_000, 3_600_000, 50_000), ("Rent", "Dr", 300_000, 1_800_000, 50_000),
    ("Electricity", "Dr", 80_000, 600_000, 5_000), ("Insurance", "Dr", 60_000, 480_000, 5_000),
    ("Advertising", "Dr", 50_000, 400_000, 5_000), ("Transport", "Dr", 50_000, 400_000, 5_000),
    ("Telephone", "Dr", 30_000, 240_000, 5_000), ("General expenses", "Dr", 50_000, 300_000, 5_000),
    ("Discount allowed", "Dr", 10_000, 150_000, 5_000), ("Discount received", "Cr", 10_000, 150_000, 5_000),
    ("Rent received", "Cr", 120_000, 900_000, 10_000), ("Commission received", "Cr", 50_000, 600_000, 10_000),
]
ORDER = ["Capital"] + [a[0] for a in ACCOUNTS[:12]] + ["Sales", "Purchases"] + [a[0] for a in ACCOUNTS[12:]]
# Accounts a trader would not hold together: a bank balance and an overdraft, rent paid on owned premises.
CLASH = [{"Bank", "Bank overdraft"}, {"Premises", "Rent"}, {"Rent", "Rent received"}]
ENDS = ["31 December", "31 March", "30 June", "30 September"]
MONEY = {"Bank", "Cash", "Bank overdraft"}


def sample(rng: random.Random) -> dict:
    while True:
        n = rng.randint(6, 9)
        others = rng.sample(ACCOUNTS, n - 3)
        names = {a[0] for a in others}
        if any(c <= names for c in CLASH) or not names & MONEY:
            continue  # every business keeps a bank account or cash
        purchases = rng.randrange(3_000_000, 12_000_001, 50_000)
        sales = round(purchases * rng.uniform(1.3, 1.9) / 50_000) * 50_000
        rows = {"Purchases": ["Purchases", "Dr", purchases], "Sales": ["Sales", "Cr", sales]}
        for name, side, lo, hi, step in others:
            rows[name] = [name, side, rng.randrange(lo, hi + 1, step)]
        dr = sum(r[2] for r in rows.values() if r[1] == "Dr")
        cr = sum(r[2] for r in rows.values() if r[1] == "Cr")
        capital = dr - cr
        # the owner's capital: a real stake in the business, in whole thousands
        if capital < max(1_000_000, dr * 0.15) or capital % 1_000:
            continue
        rows["Capital"] = ["Capital", "Cr", capital]
        listed = [rows[a] for a in ORDER if a in rows]
        amounts = [r[2] for r in listed]
        if len(set(amounts)) < len(amounts):
            continue
        # capital is the figure most often left out in an exam; any other may be
        capital_at = next(i for i, r in enumerate(listed) if r[0] == "Capital")
        blank = capital_at if rng.random() < 0.3 else rng.randrange(len(listed))
        trade, word = rng.choice(TRADES)
        town = rng.choice(TOWNS)
        place = rng.choice(PLACES) if town == "Kigali" else town
        return {"band": "UP", "trader": f"{place} {word}", "business": f"{article(trade)} {trade} in {town}",
                "date": f"{rng.choice(ENDS)} {rng.choice(YEARS)}", "rows": listed, "blank": blank}


# The page, in inches.
NAME_W, AMT_W, X0, ROW = 2.75, 1.4, 0.12, 0.3


def draw(p: dict):
    rows = p["rows"]
    width = 2 * X0 + NAME_W + 2 * AMT_W
    height = 1.28 + (len(rows) + 2) * ROW
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, p["trader"], ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Trial balance at {p['date']}", ha="center", va="top", fontsize=11)
    head = top - 0.68
    x_dr, x_cr = X0 + NAME_W, X0 + NAME_W + AMT_W
    for x, word in ((x_dr, "Debit"), (x_cr, "Credit")):
        ax.text(x + AMT_W / 2, head - 0.02, word, ha="center", va="top", fontsize=10, fontweight="bold")
        ax.text(x + AMT_W / 2, head - 0.26, "Frw", ha="center", va="top", fontsize=9.5)
    ax.text(X0 + 0.08, head - 0.14, "Account", ha="left", va="top", fontsize=10, fontweight="bold")
    first = head - 0.52
    rule(ax, X0, width - X0, first, width=0.8)
    for i, (name, side, amount) in enumerate(rows):
        y = first - (i + 0.5) * ROW
        ax.text(X0 + 0.08, y, name, ha="left", va="center", fontsize=10)
        x = (x_dr if side == "Dr" else x_cr) + AMT_W - 0.1
        if i == p["blank"]:
            ax.text(x, y, "?", ha="right", va="center", fontsize=10.5, fontweight="bold")
        else:
            ax.text(x, y, frw(amount), ha="right", va="center", fontsize=10)
    # the totals, single-ruled above and double-ruled below, left for the student
    y_tot = first - (len(rows) + 0.7) * ROW
    for x in (x_dr, x_cr):
        rule(ax, x + 0.12, x + AMT_W - 0.06, y_tot + ROW / 2)
        ax.text(x + AMT_W - 0.1, y_tot, "?", ha="right", va="center", fontsize=10.5, fontweight="bold")
        rule(ax, x + 0.12, x + AMT_W - 0.06, y_tot - ROW / 2, double=True)
    ax.text(X0 + 0.08, y_tot, "Totals", ha="left", va="center", fontsize=10, style="italic")
    bottom = y_tot - ROW / 2 - 0.12
    for x in (X0, x_dr, x_cr, width - X0):
        ax.plot([x, x], [head + 0.06, bottom], color=INK, linewidth=0.8)
    rule(ax, X0, width - X0, head + 0.06, width=0.8)
    rule(ax, X0, width - X0, bottom, width=0.8)
    return fig


VERBS = ["extracts", "draws up", "prepares", "writes out"]
TOTALS = ["The trial balance balances. What is the total of each column?",
          "When it is complete, what is the total of the debit column, and of the credit column?",
          "What does each column of the completed trial balance add up to? (The two totals are equal.)"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    rows = p["rows"]
    name, side, _ = rows[p["blank"]]
    total = sum(r[2] for r in rows if r[1] != side)  # the other column is complete
    rest = sum(r[2] for i, r in enumerate(rows) if r[1] == side and i != p["blank"])
    missing = total - rest
    return [short(f"{who} {rng.choice(VERBS)} the trial balance of {p['trader']}, {p['business']}, at {p['date']}. "
                  f"What is the missing figure for {name}?", missing, money(missing)),
            short(rng.choice(TOTALS), total, money(total))]
