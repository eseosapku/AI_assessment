"""A ledger account (UP), as Cambridge IGCSE Accounting 0452 and Rwanda S4-S6 books draw it: a T with Dr and Cr
sides, each with Date, Details and Frw columns, three to five dated entries for one month and perhaps a balance
b/d on the 1st. Four accounts: Bank (a debit balance, or an overdraft), Cash, a credit customer's account in the
sales ledger and a supplier's in the purchases ledger. The balancing lines are left to the student: no balance
c/d and no totals are printed.

Asks the balance c/d at the month's end, the side (and amount) of the balance b/d on the 1st of the next month,
and the total at the foot of the debit side once balanced. Every key is the account balanced: the larger side's
total, less the smaller side's (Review Focus 1: the balance b/d falls on the larger side).
"""
from __future__ import annotations

import calendar
import random

from ..core import GRID, INK, NAMES, mcq, money, short
from ._accounts import MONTHS, SHORT_MONTHS, SUPPLIERS, TOWNS, TRADES, YEARS, article, customer, frw, page, rule

ID = "t_account"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same layout in Cambridge AS Level, where the chapter is named for it
CONCEPTS = ("accounting.balancing-accounts", "accounting.ledgers", "accounting.double-entry-bookkeeping")
ALSO = ("business.general-ledger-and-trial-balance", "business.bookkeeping-and-accounting-basics")  # Rwanda's Entrepreneurship books teach it under business
# A topic whose sections the book lists is reached only if one names ledger accounts or their balancing ("trial
# balance" alone is not balancing an account).
NEEDS = r"balancing|balanced|balance [cb]/d|\bledgers?\b|double.entry|posting|t.accounts?\b|three.column"
# Topics that share the concepts but teach something else: journals, the trial balance, errors, reconciliation,
# depreciation and accruals accounts, statements, and other kinds of business.
AVOID = (r"partnership|compan|club|societ|non-profit|manufactur|incomplete|tax|costing|budget|cash flow|control account|"
         r"depreciation|financial statements|payables|receivables|correction|errors|trial balance|reconciliation|"
         r"books of (original|prime) entry|journaliz|introduction|^finance")

# (details, side, lowest, highest, step, at most once): what goes into and out of the bank and the cash.
# "customer" and "supplier" stand for a named credit customer paying in, or a supplier being paid.
BANK = [("Sales", "Dr", 50_000, 600_000, 5_000, False), ("Capital", "Dr", 300_000, 2_000_000, 50_000, True),
        ("Loan", "Dr", 500_000, 2_500_000, 100_000, True), ("Commission received", "Dr", 10_000, 80_000, 1_000, True),
        ("customer", "Dr", 20_000, 300_000, 5_000, False),
        ("Purchases", "Cr", 50_000, 500_000, 5_000, False), ("Rent", "Cr", 60_000, 300_000, 10_000, True),
        ("Wages", "Cr", 50_000, 250_000, 5_000, False), ("Electricity", "Cr", 10_000, 60_000, 1_000, True),
        ("Drawings", "Cr", 20_000, 150_000, 5_000, False), ("Equipment", "Cr", 100_000, 900_000, 10_000, True),
        ("Insurance", "Cr", 20_000, 120_000, 5_000, True), ("supplier", "Cr", 30_000, 400_000, 5_000, False)]
CASH = [("Sales", "Dr", 5_000, 80_000, 500, False), ("Commission received", "Dr", 2_000, 20_000, 500, True),
        ("customer", "Dr", 5_000, 40_000, 500, False),
        ("Purchases", "Cr", 5_000, 60_000, 500, False), ("Wages", "Cr", 5_000, 40_000, 500, False),
        ("Transport", "Cr", 1_000, 15_000, 500, True), ("Stationery", "Cr", 1_000, 10_000, 500, True),
        ("Water", "Cr", 2_000, 12_000, 500, True), ("Drawings", "Cr", 5_000, 30_000, 500, False)]
WEIGHTS = {"bank": 4, "cash": 2, "customer": 3, "supplier": 3}


def _amount(rng, lo, hi, step):
    return rng.randrange(lo, hi + 1, step)


def _days(rng, groups: int, last: int) -> list[int]:
    """A day for each group of entries, in order, between the 2nd and the day before the month's last."""
    return sorted(rng.sample(range(2, last), groups))


def _bank_or_cash(rng, kind: str, last: int):
    menu = BANK if kind == "bank" else CASH
    while True:
        dr, cr = [], []
        r = rng.random()
        if kind == "bank":
            if r < 0.6:
                dr.append([1, "Balance b/d", _amount(rng, 50_000, 900_000, 5_000)])
            elif r < 0.85:
                cr.append([1, "Balance b/d", _amount(rng, 50_000, 400_000, 5_000)])  # an overdraft brought down
        elif r < 0.8:
            dr.append([1, "Balance b/d", _amount(rng, 10_000, 100_000, 500)])
        n = rng.randint(3, 5)
        picks, used = [], set()
        while len(picks) < n:
            item = rng.choice(menu)
            if item[5] and item[0] in used:
                continue
            used.add(item[0])
            picks.append(item)
        if {p[1] for p in picks} != {"Dr", "Cr"}:
            continue
        for day, (detail, side, lo, hi, step, _) in zip(_days(rng, n, last), picks):
            name = customer(rng) if detail == "customer" else rng.choice(SUPPLIERS) if detail == "supplier" else detail
            (dr if side == "Dr" else cr).append([day, name, _amount(rng, lo, hi, step)])
        if max(len(dr), len(cr)) > 4:
            continue
        total_dr, total_cr = sum(e[2] for e in dr), sum(e[2] for e in cr)
        if abs(total_dr - total_cr) < (5_000 if kind == "bank" else 1_000):
            continue
        if kind == "cash" and not _never_below(dr, cr):
            continue
        if kind == "bank" and total_cr > total_dr and total_cr - total_dr > 600_000:
            continue  # an overdraft a small business might run, no deeper
        return dr, cr


def _never_below(up: list, down: list) -> bool:
    """Whether a running balance (up less down, day by day, increases first) never falls below nothing."""
    events = sorted([(e[0], 0, e[2]) for e in up] + [(e[0], 1, -e[2]) for e in down])
    running = 0
    for _, _, v in events:
        running += v
        if running < 0:
            return False
    return True


def _personal(rng, kind: str, last: int):
    """A credit customer's or a supplier's account: last month's balance settled (perhaps less a 5% cash discount),
    goods sold or bought on credit, some returned, and what is left owing at the month's end."""
    cust = kind == "customer"
    up_name, back, discount = ("Sales", "Sales returns", "Discount allowed") if cust else ("Purchases", "Purchases returns", "Discount received")
    while True:
        opening = rng.randrange(40_000, 300_001, 20_000) if rng.random() < 0.75 else 0
        groups = []  # each a list of (up or down, details, amount), entered on one day
        if opening:
            groups.append(_settle(rng, opening, discount))
        sales = [rng.randrange(20_000, 400_001, 5_000) for _ in range(rng.randint(1, 2) if opening else 2)]
        groups.append([("up", up_name, sales[0])])
        ret = 0
        if rng.random() < 0.5:
            ret = max(1_000, round(sales[0] * rng.choice([0.1, 0.15, 0.2, 0.25]) / 1_000) * 1_000)
            groups.append([("down", back, ret)])
        if not opening:
            groups.append(_settle(rng, sales[0] - ret, discount))
        if len(sales) > 1:
            groups.append([("up", up_name, sales[1])])
        n = sum(len(g) for g in groups)
        if not 3 <= n <= 5:
            continue
        up, down = [], []
        if opening:
            up.append([1, "Balance b/d", opening])
        for day, group in zip(_days(rng, len(groups), last), groups):
            for way, detail, amount in group:
                (up if way == "up" else down).append([day, detail, amount])
        if max(len(up), len(down)) > 4 or sum(e[2] for e in up) - sum(e[2] for e in down) < 5_000:
            continue
        return (up, down) if cust else (down, up)


def _settle(rng, owed: int, discount: str) -> list:
    """Paying what is owed: by bank, less a 5% cash discount half the time it comes to whole thousands."""
    disc = owed // 20 if owed % 20_000 == 0 and rng.random() < 0.5 else 0
    how = "Cash" if owed <= 60_000 and rng.random() < 0.3 else "Bank"
    return [("down", how, owed - disc)] + ([("down", discount, disc)] if disc else [])


def sample(rng: random.Random) -> dict:
    kind = rng.choices(list(WEIGHTS), weights=list(WEIGHTS.values()))[0]
    year = rng.choice(YEARS)
    month = rng.randint(1, 12)
    last = calendar.monthrange(year, month)[1]
    if kind in ("bank", "cash"):
        dr, cr = _bank_or_cash(rng, kind, last)
        account = kind.capitalize()
    else:
        dr, cr = _personal(rng, kind, last)
        account = customer(rng) if kind == "customer" else rng.choice(SUPPLIERS)
    trade = rng.choice(TRADES)[0]
    return {"band": "UP", "kind": kind, "account": account, "business": f"{article(trade)} {trade} in {rng.choice(TOWNS)}",
            "year": year, "month": month, "debits": dr, "credits": cr}


# The page, in inches: each side's Date, Details and Frw columns.
COLS = (0.62, 2.0, 0.95)
SIDE = sum(COLS)
X0 = 0.12
ROW = 0.28


def draw(p: dict):
    rows = max(len(p["debits"]), len(p["credits"])) + 2  # and two blank lines to balance the account on
    ledger = {"customer": "Sales ledger", "supplier": "Purchases ledger"}.get(p["kind"])
    width = 2 * X0 + 2 * SIDE
    height = (rows + 2) * ROW + 0.62 + (0.3 if ledger else 0)
    fig, ax = page(width, height)
    xc = X0 + SIDE
    top = height - 0.12
    if ledger:
        ax.text(width / 2, top, ledger, ha="center", va="top", fontsize=9.5, style="italic", color="#444444")
        top -= 0.3
    ax.text(width / 2, top, f"{p['account']} account", ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(X0, top, "Dr", ha="left", va="top", fontsize=11, fontweight="bold")
    ax.text(width - X0, top, "Cr", ha="right", va="top", fontsize=11, fontweight="bold")
    t_line = top - 0.42
    bottom = t_line - (rows + 2) * ROW
    for side_x in (X0, xc):
        x = side_x
        for w in COLS[:-1]:
            x += w
            ax.plot([x, x], [t_line, bottom], color=GRID, linewidth=0.8)
        y = t_line - ROW / 2
        ax.text(side_x + 0.06, y, "Date", ha="left", va="center", fontsize=9.5, fontweight="bold")
        ax.text(side_x + COLS[0] + 0.08, y, "Details", ha="left", va="center", fontsize=9.5, fontweight="bold")
        ax.text(side_x + SIDE - 0.08, y, "Frw", ha="right", va="center", fontsize=9.5, fontweight="bold")
        ax.text(side_x + 0.06, y - ROW, str(p["year"]), ha="left", va="center", fontsize=10)
    rule(ax, X0, width - X0, t_line - ROW, width=0.6, colour="#666666")
    mon = SHORT_MONTHS[p["month"] - 1]
    for side_x, entries in ((X0, p["debits"]), (xc, p["credits"])):
        for i, (day, detail, amount) in enumerate(entries):
            y = t_line - (i + 2.5) * ROW
            ax.text(side_x + 0.06, y, f"{mon} {day}" if i == 0 else str(day), ha="left", va="center", fontsize=10)
            ax.text(side_x + COLS[0] + 0.08, y, detail, ha="left", va="center", fontsize=10)
            ax.text(side_x + SIDE - 0.08, y, frw(amount), ha="right", va="center", fontsize=10)
    # the T itself
    ax.plot([X0, width - X0], [t_line, t_line], color=INK, linewidth=1.8, solid_capstyle="butt")
    ax.plot([xc, xc], [t_line, bottom], color=INK, linewidth=1.8, solid_capstyle="butt")
    return fig


VERBS = ["keeps the books of", "is the bookkeeper for", "writes up the ledger of", "keeps the accounts of", "does the bookkeeping for"]
FOOT = ["When the account is balanced, what total is written at the foot of the debit side?",
        "What total appears at the foot of the debit side once the account is balanced?",
        "Once the account is balanced off, what is the total at the foot of the debit side?"]


def _phrase(p: dict) -> str:
    return {"bank": "the bank account", "cash": "the cash account",
            "customer": f"the account of {p['account']}, a credit customer,",
            "supplier": f"the account of {p['account']}, a supplier,"}[p["kind"]]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    dr = sum(e[2] for e in p["debits"])
    cr = sum(e[2] for e in p["credits"])
    bal = abs(dr - cr)
    side, other = ("Debit", "Credit") if dr > cr else ("Credit", "Debit")
    last = calendar.monthrange(p["year"], p["month"])[1]
    nxt_month, nxt_year = (p["month"] % 12) + 1, p["year"] + (p["month"] == 12)
    # the plausible slips: the wrong side, the total for the balance, and the opening balance left out
    wrong = [f"{other} side, {frw(bal)} Frw", f"{side} side, {frw(max(dr, cr))} Frw"]
    opening_dr = sum(e[2] for e in p["debits"] if e[1] == "Balance b/d")
    opening_cr = sum(e[2] for e in p["credits"] if e[1] == "Balance b/d")
    if opening_dr or opening_cr:
        d2, c2 = dr - opening_dr, cr - opening_cr
        if d2 != c2:
            wrong.append(f"{'Debit' if d2 > c2 else 'Credit'} side, {frw(abs(d2 - c2))} Frw")
    wrong.append(f"{other} side, {frw(max(dr, cr))} Frw")
    return [
        short(f"{who} {rng.choice(VERBS)} {p['business']}. {who} balances {_phrase(p)} on {last} {MONTHS[p['month'] - 1]} {p['year']}. "
              "What is the balance carried down (c/d)?", bal, money(bal)),
        mcq(f"The balance is brought down (b/d) on 1 {MONTHS[nxt_month - 1]} {nxt_year}. On which side of the account is it "
            "entered, and for how much?", f"{side} side, {frw(bal)} Frw", wrong, rng),
        short(rng.choice(FOOT), max(dr, cr), money(max(dr, cr))),
    ]
