"""Bank reconciliation (UP): a list of what a sole trader's books show at the month's end, as the information is set
out before a bank reconciliation statement in Cambridge IGCSE Accounting 0452 and Rwanda S4-S6 books. The balance
in the cash book (bank column); cheques paid to suppliers and not yet presented; an amount paid in and not yet
credited by the bank; and, on the bank statement only, bank charges and a credit transfer from a customer.

Asks the adjusted (updated) cash book balance -- the balance less the charges, plus the transfer -- and the
balance the bank statement should show: the adjusted balance, plus the unpresented cheques, less the amounts
not yet credited.
"""
from __future__ import annotations

import calendar
import random

from ..core import INK, NAMES, mcq, money, short
from ._accounts import MONTHS, PLACES, SUPPLIERS, TOWNS, TRADES, YEARS, article, customer, frw, page, rule

ID = "bank_reconciliation"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same layout in Cambridge AS Level, where the chapter is named for it
CONCEPTS = ("accounting.bank-reconciliation", "accounting.cash-book")
ALSO = ("business.bookkeeping-and-accounting-basics",)  # Rwanda's Entrepreneurship books teach it under business
# A topic whose sections the book lists is reached only if one names the reconciliation or the bank statement.
NEEDS = r"reconcil|bank statement"
AVOID = r"partnership|compan|club|societ|non-profit|manufactur|tax|costing|budget|petty cash|control account|^finance"


def sample(rng: random.Random) -> dict:
    while True:
        cash_book = rng.randrange(200_000, 3_000_001, 1_000)
        n = rng.randint(1, 3)
        first = rng.randrange(1200, 9800)
        numbers = sorted(rng.sample(range(first, first + 40), n))
        unpresented = [[f"{no:06d}", payee, rng.randrange(20_000, 600_001, 500)]
                       for no, payee in zip(numbers, rng.sample(SUPPLIERS, n))]
        month, year = rng.randint(1, 12), rng.choice(YEARS)
        last = calendar.monthrange(year, month)[1]
        days = sorted(rng.sample(range(last - 3, last + 1), rng.randint(1, 2)))
        lodgements = [[d, rng.randrange(50_000, 800_001, 1_000)] for d in days]
        charges = rng.randrange(2_000, 25_001, 500)
        transfer = [customer(rng), rng.randrange(20_000, 500_001, 1_000)]
        out = sum(r[2] for r in unpresented)
        lodged = sum(r[1] for r in lodgements)
        adjusted = cash_book - charges + transfer[1]
        statement = adjusted + out - lodged
        # a balance in hand at both ends; and no two slips that land on the right answer by chance
        if statement < 50_000 or out == lodged or charges == transfer[1]:
            continue
        shown = [cash_book, charges, transfer[1]] + [r[2] for r in unpresented] + [r[1] for r in lodgements]
        if len(set(shown)) < len(shown) or adjusted in shown or statement in shown:
            continue
        trade, word = rng.choice(TRADES)
        town = rng.choice(TOWNS)
        place = rng.choice(PLACES) if town == "Kigali" else town
        return {"band": "UP", "trader": f"{place} {word}", "business": f"{article(trade)} {trade} in {town}",
                "date": f"{last} {MONTHS[month - 1]} {year}", "cash_book": cash_book,
                "unpresented": unpresented, "lodgements": lodgements, "charges": charges, "transfer": transfer}


DESC_W, AMT_W, X0, ROW = 4.9, 1.25, 0.12, 0.3


def draw(p: dict):
    month = p["date"].split()[1]
    lines = [("item", f"Balance in the cash book (bank column) on {p['date']}", p["cash_book"]),
             ("head", "Cheques paid to suppliers, not yet presented at the bank:", None)]
    lines += [("sub", f"Cheque no. {no} to {payee}", amount) for no, payee, amount in p["unpresented"]]
    lines += [("head", "Amounts paid in, not yet credited by the bank:", None)]
    lines += [("sub", f"Paid in on {day} {month}", amount) for day, amount in p["lodgements"]]
    lines += [("head", "On the bank statement only, not yet in the cash book:", None),
              ("sub", "Bank charges", p["charges"]),
              ("sub", f"Credit transfer from {p['transfer'][0]}, a customer", p["transfer"][1])]
    width = 2 * X0 + DESC_W + AMT_W
    height = 1.32 + len(lines) * ROW
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, p["trader"], ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Information for the bank reconciliation at {p['date']}", ha="center", va="top", fontsize=10.5)
    head = top - 0.72
    x_amt = X0 + DESC_W
    ax.text(width - X0 - 0.1, head - ROW / 2, "Frw", ha="right", va="center", fontsize=10, fontweight="bold")
    ax.text(X0 + 0.08, head - ROW / 2, "Details", ha="left", va="center", fontsize=10, fontweight="bold")
    rule(ax, X0, width - X0, head - ROW, width=0.8)
    for i, (style, text, amount) in enumerate(lines):
        y = head - (i + 1.5) * ROW
        indent = 0.38 if style == "sub" else 0.08
        ax.text(X0 + indent, y, text, ha="left", va="center", fontsize=10, style="italic" if style == "head" else "normal")
        if amount is not None:
            ax.text(width - X0 - 0.1, y, frw(amount), ha="right", va="center", fontsize=10)
    bottom = head - (len(lines) + 1) * ROW - 0.08
    rule(ax, X0, width - X0, head, width=0.8)
    rule(ax, X0, width - X0, bottom, width=0.8)
    for x in (X0, x_amt, width - X0):
        ax.plot([x, x], [head, bottom], color=INK, linewidth=0.8)
    return fig


VERBS = ["prepares the bank reconciliation for", "reconciles the bank account of", "checks the cash book of",
         "compares the cash book and bank statement of"]
FIRST = ["First, the cash book is brought up to date with the items on the bank statement.",
         "The cash book is updated first for the items that appear only on the bank statement."]
SECOND = ["Starting from the updated cash book balance, a bank reconciliation statement is prepared. What balance should the bank statement show on {d}?",
          "A bank reconciliation statement starts from the updated cash book balance. What balance should the bank statement show on {d}?"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    out = sum(r[2] for r in p["unpresented"])
    lodged = sum(r[1] for r in p["lodgements"])
    adjusted = p["cash_book"] - p["charges"] + p["transfer"][1]
    statement = adjusted + out - lodged
    # the slips: the timing differences the wrong way round, the cash book not updated, the lodgement forgotten
    slips = [adjusted - out + lodged, p["cash_book"] + out - lodged, adjusted + out, p["cash_book"] - p["charges"] - p["transfer"][1] + out - lodged]
    wrong = [f"{frw(v)} Frw" for v in slips if v > 0 and v != statement]
    return [short(f"{who} {rng.choice(VERBS)} {p['business']} on {p['date']}. {rng.choice(FIRST)} "
                  "What is the adjusted cash book (bank column) balance?", adjusted, money(adjusted)),
            mcq(rng.choice(SECOND).format(d=p["date"]), f"{frw(statement)} Frw", wrong, rng)]
