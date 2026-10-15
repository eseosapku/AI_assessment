"""An analysed petty cash book on the imprest system (UP), laid out as Cambridge IGCSE Accounting 0452 (chapter 5) and
Rwanda's S4 Financial Accounting book draw it: a Receipts column, then Date, Details, Voucher no., Total and three or
four analysis columns (Transport, Stationery, Cleaning, ...). The float (imprest) is printed above the book. The month
opens with the float in hand: either a balance b/d equal to it, or a small balance b/d and the cash drawn from the
bank on the 1st to make it up. Five to eight vouchers are paid, each entered in the Total column and in one analysis
column, and sometimes a small sum is received into petty cash (a staff phone call repaid, waste paper sold). The
totals and the balance are left to the student.

Asks an analysis column's total, the total paid out, the cash drawn from the bank on the 1st of the next month to
bring the cash in hand back up to the float (the float less the balance c/d: what was spent, less anything received),
and the balance c/d.
"""
from __future__ import annotations

import calendar
import random

from ..core import GRID, INK, NAMES, mcq, money, short
from ._accounts import MONTHS, PLACES, SHORT_MONTHS, TOWNS, TRADES, YEARS, article, frw, page, rule
from .econ_tables import fit

ID = "petty_cash_book"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP",)
# Rwanda's S2 Entrepreneurship chapter lists no petty cash book among its sections, so the family stays at UP.
CONCEPTS = ("accounting.petty-cash-book", "accounting.books-of-prime-entry")
ALSO = ("business.prime-books-and-source-documents",)  # S5 Entrepreneurship "Accounting Prime Books"
# A topic whose sections the book lists is reached only if one names the petty cash book, the imprest, or the prime
# books (Rwanda's S5 Entrepreneurship chapter, whose prime books include it). A petty cash voucher alone is a source
# document, not the book.
NEEDS = r"petty cash book|imprest|prime books"
# Topics that share books of prime entry but teach other books: control accounts, the ledgers, the cash book in
# double entry (IGCSE chapter 4, whose stray "petty cash" line is an exercise of chapter 5), reconciliation, errors.
AVOID = r"control account|ledgers?\b|book.keeping|reconcil|correction|trial balance|source documents|introduction"

# Analysis columns, and what a voucher in each pays for.
COLUMNS = {
    "Transport": ["Moto fare to the bank", "Bus fare to Nyabugogo", "Taxi for a delivery", "Moto fare to a supplier",
                  "Bus fare to Huye", "Moto fare to the tax office"],
    "Stationery": ["Printing paper", "Pens and pencils", "Receipt books", "Envelopes", "Files and folders", "Printer ink"],
    "Cleaning": ["Soap and detergent", "Brooms and mops", "Cleaner's wage", "Toilet paper", "Cleaning cloths", "Bin bags"],
    "Refreshments": ["Tea and sugar", "Drinking water", "Milk for staff tea", "Soft drinks for visitors", "Bread for staff tea"],
    "Postage": ["Stamps", "Parcel to Rubavu", "Courier to Musanze", "Registered letter", "Parcel to Rusizi"],
    "Repairs": ["Door lock repaired", "Tap repaired", "Window glass replaced", "Chair repaired", "Socket repaired"],
    "Airtime": ["Airtime for the office phone", "Internet bundle", "Airtime for deliveries", "Airtime for the manager"],
}
# Small sums paid into petty cash.
RECEIPTS = ["Staff phone call repaid", "Sale of waste paper", "Sale of empty cartons", "Staff photocopies repaid"]
IMPRESTS = [30_000, 40_000, 50_000, 60_000, 80_000, 100_000]
# The most a voucher in these columns costs, whatever the float: a moto fare is not 17 500 Frw (P3y review).
CAP = {"Transport": 6_000, "Refreshments": 8_000, "Airtime": 10_000, "Postage": 12_000}


def _payments(rng, imprest: int, cols: list[str], last: int):
    n = rng.randint(5, 8)
    while True:  # every column used, none more than three times
        picks = list(range(len(cols))) + [rng.randrange(len(cols)) for _ in range(n - len(cols))]
        if max(picks.count(c) for c in range(len(cols))) <= 3:
            break
    rng.shuffle(picks)
    days = sorted(rng.sample(range(2, last), n))
    used: set[str] = set()
    out = []
    first = rng.randrange(14, 160)
    hi = max(1_500, imprest * 18 // 100)
    for k, (day, col) in enumerate(zip(days, picks)):
        details = rng.choice([d for d in COLUMNS[cols[col]] if d not in used])
        used.add(details)
        out.append([day, details, first + k, rng.randrange(800, min(hi, CAP.get(cols[col], hi)) + 1, 100), col])
    return out


def sample(rng: random.Random) -> dict:
    trade, word = rng.choice(TRADES)
    town = rng.choice(TOWNS)
    place = rng.choice(PLACES) if town == "Kigali" else town
    year, month = rng.choice(YEARS), rng.randint(1, 12)
    last = calendar.monthrange(year, month)[1]
    while True:
        imprest = rng.choice(IMPRESTS)
        cols = rng.sample(list(COLUMNS), rng.randint(3, 4))
        pays = _payments(rng, imprest, cols, last)
        if rng.random() < 0.5:
            opening = [[1, "Balance b/d", imprest]]
        else:  # last month's balance, made up to the float from the bank on the 1st
            left = rng.randrange(1_000, imprest * 3 // 10, 100)
            opening = [[1, "Balance b/d", left], [1, "Bank", imprest - left]]
        receipts = []
        if rng.random() < 0.45:
            receipts = [[rng.randrange(4, last - 3), rng.choice(RECEIPTS), rng.randrange(500, 3_001, 100)]]
        spent = sum(r[3] for r in pays)
        other = sum(r[2] for r in receipts)
        bal = imprest + other - spent
        if not 0.5 * imprest <= spent <= 0.9 * imprest:
            continue
        totals = [sum(r[3] for r in pays if r[4] == c) for c in range(len(cols))]
        if not any(sum(1 for r in pays if r[4] == c) >= 2 for c in range(len(cols))):
            continue
        # no total, balance or amount to restore that is also an amount printed, and no two keys alike
        printed = [r[2] for r in opening + receipts] + [r[3] for r in pays]
        keys = totals + [spent, bal, spent - other]
        if len(set(keys)) < len(keys) - (0 if other else 1) or set(keys) & set(printed):
            continue
        return {"band": "UP", "trader": f"{place} {word}", "business": f"{article(trade)} {trade} in {town}",
                "year": year, "month": month, "imprest": imprest, "columns": cols, "opening": opening,
                "receipts": receipts, "payments": pays}


ROW, X0, FS = 0.27, 0.1, 9.5


def draw(p: dict):
    cols = p["columns"]
    details = [r[1] for r in p["opening"] + p["receipts"]] + [r[1] for r in p["payments"]]
    heads = ["Receipts\nFrw", "Date", "Details", "Voucher\nno.", "Total\nFrw"] + [f"{c}\nFrw" for c in cols]
    widths = [0.95, 0.72, fit(*details, size=FS, bold=False, least=1.6, pad=0.24), 0.78, 0.9]
    widths += [fit(c, size=FS, least=0.9, pad=0.22) for c in cols]
    lines = sorted([(r[0], 0, "in", r) for r in p["opening"]] + [(r[0], 2, "in", r) for r in p["receipts"]]
                   + [(r[0], 1, "out", r) for r in p["payments"]], key=lambda e: (e[0], e[1]))
    rows = len(lines) + 1 + 2  # the year, the entries, and two lines for the student to balance on
    width = 2 * X0 + sum(widths)
    height = 1.18 + 0.52 + rows * ROW + 0.1
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, p["trader"], ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Petty cash book for {MONTHS[p['month'] - 1]} {p['year']}", ha="center", va="top",
            fontsize=10.5)
    ax.text(width / 2, top - 0.56, f"Imprest system: the float (imprest) is {frw(p['imprest'])} Frw", ha="center", va="top",
            fontsize=10, style="italic")
    head = top - 0.98
    xs = [X0]
    for w in widths:
        xs.append(xs[-1] + w)
    for j, h in enumerate(heads):
        ax.text(xs[j] + widths[j] / 2, head - 0.26, h, ha="center", va="center", fontsize=FS, fontweight="bold",
                linespacing=1.1)
    first = head - 0.52
    bottom = first - rows * ROW
    rule(ax, X0, width - X0, head, width=0.9)
    rule(ax, X0, width - X0, first, width=0.9)
    rule(ax, X0, width - X0, bottom, width=0.9)
    for j, x in enumerate(xs):
        heavy = j in (0, len(xs) - 1, 1, 5)  # the frame, and the rules either side of the receipts and the total
        ax.plot([x, x], [head, bottom], color=INK if heavy else GRID, linewidth=0.9 if heavy else 0.8)

    def cell(j: int, i: int, text: str, align: str = "r"):
        y = first - (i + 0.5) * ROW
        x = xs[j] + 0.07 if align == "l" else xs[j + 1] - 0.08 if align == "r" else xs[j] + widths[j] / 2
        ax.text(x, y, text, ha={"l": "left", "r": "right", "c": "center"}[align], va="center", fontsize=FS)

    cell(1, 0, str(p["year"]), "l")
    mon = SHORT_MONTHS[p["month"] - 1]
    for i, (day, _, way, r) in enumerate(lines, start=1):
        cell(1, i, f"{mon} {day}" if i == 1 else str(day), "l")
        cell(2, i, r[1], "l")
        if way == "in":
            cell(0, i, frw(r[2]))
        else:
            cell(3, i, str(r[2]), "c")
            cell(4, i, frw(r[3]))
            cell(5 + r[4], i, frw(r[3]))
    return fig


def _of(name: str) -> str:
    """A business's possessive: "Huye Bakery's", "Huye Tailors'"."""
    return name + ("'" if name.endswith("s") else "'s")


VERBS = ["is the petty cashier of", "looks after the petty cash of", "handles the petty cash of", "is in charge of the petty cash at"]
SYSTEM = ["keeps an analysed petty cash book on the imprest system", "uses the imprest system and an analysed petty cash book",
          "records every voucher in an analysed petty cash book"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    month, year = MONTHS[p["month"] - 1], p["year"]
    last = calendar.monthrange(year, p["month"])[1]
    nm, ny = MONTHS[p["month"] % 12], year + (p["month"] == 12)
    cols = p["columns"]
    totals = [sum(r[3] for r in p["payments"] if r[4] == c) for c in range(len(cols))]
    spent = sum(r[3] for r in p["payments"])
    other = sum(r[2] for r in p["receipts"])
    bal = p["imprest"] + other - spent
    restore = p["imprest"] - bal
    col = rng.choice([c for c in range(len(cols)) if sum(1 for r in p["payments"] if r[4] == c) >= 2])
    trader = p["trader"]
    out = [short(f"{who} {rng.choice(VERBS)} {trader}, {p['business']}, and {rng.choice(SYSTEM)}. "
                 f"What is the total of the {cols[col]} column for {month} {year}?", totals[col], money(totals[col]))]
    # "restore the imprest" alone was read as "repay what was spent" (P3y review): the cash in hand is made up to the float
    ask_restore = (f"On 1 {nm} {ny}, cash is drawn from the bank to bring the cash in hand in {_of(trader)} petty cash book "
                   f"back up to the float of {frw(p['imprest'])} Frw. How much must be drawn?")
    ask_spent = f"How much was paid out of petty cash in total by {trader} during {month} {year}?"
    if other:
        # the slips: the receipt forgotten, the balance itself, the receipt added in
        out.append(short(ask_spent, spent, money(spent)))
        out.append(mcq(ask_restore, f"{frw(restore)} Frw", [f"{frw(v)} Frw" for v in (spent, bal, spent + other)], rng))
    elif rng.random() < 0.5:
        out.append(short(ask_spent, spent, money(spent)))
    else:
        out.append(short(ask_restore, restore, money(restore)))
    out.append(short(f"What is the balance carried down (c/d) in {_of(trader)} petty cash book on {last} {month} {year}?",
                     bal, money(bal)))
    return out
