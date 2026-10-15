"""A day book (UP): a sales, purchases, sales returns or purchases returns journal for one month, laid out as Cambridge
IGCSE Accounting 0452 (chapter 7, "Books of prime entry") and Rwanda's S4 Financial Accounting book ("Journalizing
Financial Transactions") draw it: Date, Name, Invoice no. (or Credit note no.), Folio and Amount, five to eight
entries, and the month's total left as "?". One customer or supplier appears more than once.

Asks the total posted at the month's end (as a short answer, or as the entry in the ledger account the book feeds:
the side and the amount, two sides by two amounts), and one customer's or supplier's total for the month.
"""
from __future__ import annotations

import calendar
import random

from ..core import GRID, INK, NAMES, mcq, money, short
from ._accounts import INITIALS, MONTHS, PLACES, SHORT_MONTHS, SUPPLIERS, SURNAMES, TOWNS, TRADES, YEARS, article, frw, page, rule
from .econ_tables import fit

ID = "day_book"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # Cambridge AS Level chapter 3, "Books of prime entry", draws the same journals
CONCEPTS = ("accounting.sales-journal", "accounting.purchases-journal", "accounting.sales-returns-journal",
            "accounting.purchases-returns-journal", "accounting.books-of-prime-entry")
ALSO = ("business.prime-books-and-source-documents",)  # Rwanda's S5 Entrepreneurship "Accounting Prime Books"
# A topic whose sections the book lists is reached only if one names the journals or the books of prime entry.
NEEDS = r"journal|day book|books of (prime|original) entry|prime books"
# Topics that share books of prime entry but teach the ledgers, control accounts, errors, petty cash or banking.
AVOID = r"control account|^ledgers|correction|petty cash|reconcil|trial balance|introduction|source documents"

BOOKS = {  # (title, the column for the document, the ledger the names are in, the account the total goes to)
    "sales": ("Sales journal", "Invoice\nno.", "SL", "sales"),
    "purchases": ("Purchases journal", "Invoice\nno.", "PL", "purchases"),
    "sales_returns": ("Sales returns journal", "Credit\nnote no.", "SL", "sales returns"),
    "purchases_returns": ("Purchases returns journal", "Credit\nnote no.", "PL", "purchases returns"),
}
SIDE = {"sales": "Credit", "purchases": "Debit", "sales_returns": "Debit", "purchases_returns": "Credit"}
CONTROL = {"sales": "sales ledger control", "sales_returns": "sales ledger control",
           "purchases": "purchases ledger control", "purchases_returns": "purchases ledger control"}


def concepts_for(p: dict) -> tuple[str, ...]:
    return ("accounting." + p["kind"].replace("_", "-") + "-journal", "accounting.books-of-prime-entry")


def sample(rng: random.Random) -> dict:
    kind = rng.choice(list(BOOKS))
    _, _, ledger, _ = BOOKS[kind]
    trade, word = rng.choice([t for t in TRADES if t[0] not in ("hair salon", "restaurant")])  # they sell for cash
    town = rng.choice(TOWNS)
    place = rng.choice(PLACES) if town == "Kigali" else town
    year, month = rng.choice(YEARS), rng.randint(1, 12)
    last = calendar.monthrange(year, month)[1]
    returns = kind.endswith("returns")
    while True:
        n = rng.randint(5, 8)
        k = 3 if n >= 7 and rng.random() < 0.4 else 2  # how often the asked name comes up
        if ledger == "SL":  # customers with different family names: "T. Mukamana" beside "A. Mukamana" is a trap
            pool = [f"{rng.choice(INITIALS)}. {sn}" for sn in rng.sample(SURNAMES, n - k + 1)]
        else:
            pool = rng.sample(SUPPLIERS, n - k + 1)
        repeat = pool[0]
        names = [repeat] * (k - 1) + pool
        rng.shuffle(names)
        days = sorted(rng.sample(range(1, last + 1), n))
        folios = {nm: f"{ledger} {f}" for nm, f in zip(pool, rng.sample(range(1, 40), len(pool)))}
        if kind == "sales":  # the business's own invoices, numbered in order
            start = rng.randrange(100, 900)
            numbers = [f"{start + i:04d}" for i in range(n)]
        elif kind == "sales_returns":
            start = rng.randrange(10, 80)
            numbers = [f"CN {start + i:03d}" for i in range(n)]
        elif kind == "purchases":  # each supplier's own invoice numbers
            numbers = [f"{x:04d}" for x in rng.sample(range(1000, 9999), n)]
        else:
            numbers = [f"CN {x:03d}" for x in rng.sample(range(10, 999), n)]
        lo, hi, step = (2_000, 60_000, 500) if returns else (20_000, 600_000, 1_000)
        amounts = [rng.randrange(lo, hi + 1, step) for _ in range(n)]
        rows = [[d, nm, no, folios[nm], a] for d, nm, no, a in zip(days, names, numbers, amounts)]
        total = sum(amounts)
        person = sum(r[4] for r in rows if r[1] == repeat)
        if len(set(amounts)) < n or {total, person} & set(amounts) or total - amounts[-1] in amounts:
            continue
        return {"band": "UP", "kind": kind, "trader": f"{place} {word}", "business": f"{article(trade)} {trade} in {town}",
                "year": year, "month": month, "rows": rows, "repeat": repeat}


X0, ROW, FS = 0.12, 0.29, 10


def draw(p: dict):
    title, doc, _, _ = BOOKS[p["kind"]]
    rows = p["rows"]
    widths = [0.9, fit(*(r[1] for r in rows), size=FS, bold=False, least=2.2, pad=0.3), 1.0, 0.75, 1.25]
    width = 2 * X0 + sum(widths)
    n = len(rows) + 2  # the year, the entries, and the total
    height = 0.82 + 0.52 + n * ROW + 0.18
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, p["trader"], ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"{title} for {MONTHS[p['month'] - 1]} {p['year']}", ha="center", va="top", fontsize=11)
    head = top - 0.72
    xs = [X0]
    for w in widths:
        xs.append(xs[-1] + w)
    for j, h in enumerate(["Date", "Name", doc, "Folio", "Amount\nFrw"]):
        ax.text(xs[j] + widths[j] / 2, head - 0.26, h, ha="center", va="center", fontsize=9.5, fontweight="bold",
                linespacing=1.1)
    first = head - 0.52
    rule(ax, X0, xs[-1], head, width=0.9)
    rule(ax, X0, xs[-1], first, width=0.9)
    ax.text(xs[0] + 0.08, first - 0.5 * ROW, str(p["year"]), ha="left", va="center", fontsize=FS)
    mon = SHORT_MONTHS[p["month"] - 1]
    for i, (day, name, number, folio, amount) in enumerate(rows, start=1):
        y = first - (i + 0.5) * ROW
        ax.text(xs[0] + 0.08, y, f"{mon} {day}" if i == 1 else str(day), ha="left", va="center", fontsize=FS)
        ax.text(xs[1] + 0.1, y, name, ha="left", va="center", fontsize=FS)
        ax.text(xs[2] + widths[2] / 2, y, number, ha="center", va="center", fontsize=FS)
        ax.text(xs[3] + widths[3] / 2, y, folio, ha="center", va="center", fontsize=FS)
        ax.text(xs[5] - 0.1, y, frw(amount), ha="right", va="center", fontsize=FS)
    y_tot = first - (len(rows) + 1.5) * ROW
    last = calendar.monthrange(p["year"], p["month"])[1]
    ax.text(xs[0] + 0.08, y_tot, str(last), ha="left", va="center", fontsize=FS)
    ax.text(xs[1] + 0.1, y_tot, "Total for the month", ha="left", va="center", fontsize=FS, style="italic")
    ax.text(xs[5] - 0.1, y_tot, "?", ha="right", va="center", fontsize=10.5, fontweight="bold")
    rule(ax, xs[4] + 0.15, xs[5] - 0.05, y_tot + ROW / 2 - 0.02, width=0.8)
    bottom = y_tot - ROW / 2 - 0.08
    rule(ax, xs[4] + 0.15, xs[5] - 0.05, bottom + 0.04, width=0.8, double=True)
    rule(ax, X0, xs[-1], bottom - 0.04, width=0.9)
    for j, x in enumerate(xs):
        ax.plot([x, x], [head, bottom - 0.04], color=INK if j in (0, len(xs) - 1) else GRID, linewidth=0.9)
    return fig


VERBS = ["keeps the books of prime entry for", "writes up the day books of", "is the bookkeeper at", "keeps the journals of"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    title, _, _, account = BOOKS[p["kind"]]
    book = title[0].lower() + title[1:]
    month, year = MONTHS[p["month"] - 1], p["year"]
    rows, trader, name = p["rows"], p["trader"], p["repeat"]
    total = sum(r[4] for r in rows)
    person = sum(r[4] for r in rows if r[1] == name)
    intro = f"{who} {rng.choice(VERBS)} {trader}, {p['business']}."
    if rng.random() < 0.5:
        side = SIDE[p["kind"]]
        other = "Debit" if side == "Credit" else "Credit"
        missed = total - rows[-1][4]  # the slip: the last entry left out of the total
        first = mcq(f"{intro} At the end of {month} {year}, the {book} is totalled and the total is posted to the "
                    f"general ledger. Which entry is made in the {account} account?", f"{side}, {frw(total)} Frw",
                    [f"{other}, {frw(total)} Frw", f"{side}, {frw(missed)} Frw", f"{other}, {frw(missed)} Frw"], rng)
    else:
        target = rng.choice([f"the {account} account", f"the {CONTROL[p['kind']]} account"])
        first = short(f"{intro} At the end of {month} {year}, the {book} is totalled. What total is posted to {target}?",
                      total, money(total))
    ask = {"sales": f"According to the sales journal of {trader}, how much did {name} buy on credit in {month} {year}?",
           "purchases": f"According to the purchases journal of {trader}, how much did {trader} buy on credit from {name} "
                        f"in {month} {year}?",
           "sales_returns": f"According to the sales returns journal of {trader}, what was the total value of the goods "
                            f"{name} returned in {month} {year}?",
           "purchases_returns": f"According to the purchases returns journal of {trader}, what was the total value of "
                                f"the goods {trader} returned to {name} in {month} {year}?"}[p["kind"]]
    return [first, short(ask, person, money(person))]
