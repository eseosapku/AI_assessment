"""An expense or income account for a year with amounts owing or paid in advance at both ends (UP, AL), as Cambridge
IGCSE Accounting 0452 chapter 11 (Other payables and other receivables) and AS 9706 chapter 10 (Accruals and
prepayments) set it: the balance brought down on 1 January (an accrual or a prepayment), the year's payments or
receipts by bank, and room to balance it. A note under the account gives what the year must be charged with. Two
sub-types:
- "rate": the note gives the rent (or premium, or contract) a month; asks the charge (or income) for the year in
  the income statement, and the balance carried down at the year end: how much, and accrued or prepaid.
- "closing": the note gives what is owing (or paid in advance) at the year end; asks the amount transferred to the
  income statement and the total at the foot of each side once the account is balanced.

Every key is the account worked through: an expense's charge = payments + prepayment b/d - accrual b/d + accrual
c/d - prepayment c/d; income likewise, with income received in advance in place of a prepayment. The balance is a
choice of two amounts by two kinds (accrued or prepaid), so it cannot be told from the options alone; the wrong
amount is the slip of leaving out the opening balance.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, money, short
from ._accounts import TOWNS, TRADES, YEARS, article, frw
from ._year_ledger import ledger

ID = "accrual_prepayment"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP", "AL")
CONCEPTS = ("accounting.accruals-and-prepayments", "accounting.accrued-and-prepaid-income")
# A topic whose sections the book lists is reached only if one names accruals, prepayments or other payables.
NEEDS = r"accru|prepa|other payables|other receivables|matching"
# Clubs, manufacturing and the statements themselves use the adjustments; their chapters teach something else.
AVOID = (r"club|societ|non-profit|manufactur|\btax|partnership|compan|statements? of profit|financial position|"
         r"incomplete|costing|budget|cash flow|interpretation")

# (account, the note's words for it, what a question calls it, lowest and highest a month, step)
RATE_EXPENSES = [("Rent", "Rent of the shop", "rent", 40_000, 250_000, 5_000),
                 ("Insurance", "Insurance premium", "insurance", 10_000, 60_000, 1_000),
                 ("Internet", "Internet subscription", "internet", 15_000, 80_000, 1_000),
                 ("Security services", "Security guard contract", "security services", 40_000, 150_000, 5_000)]
RATE_INCOME = [("Rent receivable", "A room in the building is let to a tenant for", "rent", 30_000, 150_000, 5_000)]
# (account, what a note and a question call it, lowest and highest payment, step, how it may stand at the year end)
CLOSING_EXPENSES = [("Electricity", "electricity", 10_000, 60_000, 500, ("accrued", "prepaid")),
                    ("Water", "water", 5_000, 30_000, 500, ("accrued", "prepaid")),
                    ("Wages", "wages", 150_000, 600_000, 5_000, ("accrued",)),
                    ("Telephone", "telephone charges", 5_000, 40_000, 500, ("accrued", "prepaid")),
                    ("Transport", "transport costs", 10_000, 80_000, 1_000, ("accrued",))]
CLOSING_INCOME = [("Commission receivable", "commission", 20_000, 150_000, 1_000, ("accrued", "prepaid")),
                  ("Rent receivable", "rent", 30_000, 200_000, 5_000, ("accrued", "prepaid"))]
SIZES = [1, 2, 3, 3, 4, 6]  # months a payment covers


def _dates(rng, n: int) -> list[tuple[int, int]]:
    months = sorted(rng.sample(range(1, 13), n))
    return [(m, rng.randint(2, 28)) for m in months]


def _side(kind: str, ahead: bool) -> str:
    """Where a balance brought down stands: an expense paid ahead, or income still to come, is a debit."""
    return ("Dr" if ahead else "Cr") if kind == "expense" else ("Cr" if ahead else "Dr")


def _rate(rng, kind: str, year: int) -> dict:
    account, label, noun, lo, hi, step = rng.choice(RATE_EXPENSES if kind == "expense" else RATE_INCOME)
    rate = rng.randrange(lo, hi + 1, step)
    while True:
        o, ahead, c = rng.randint(1, 3), rng.random() < 0.5, rng.choice([-3, -2, -1, 1, 2, 3])
        months = 12 + c - (o if ahead else -o)  # the months paid for during the year
        slip = months - 12  # the balance if the opening one is left out
        if slip == 0 or abs(slip) == abs(c):
            continue
        n = rng.randint(2, 5)
        sizes = [rng.choice(SIZES) for _ in range(n)]
        if sum(sizes) != months:
            continue
        entries = [[m, d, k * rate] for (m, d), k in zip(_dates(rng, n), sizes)]
        note = f"{label} {frw(rate)} Frw a month." if kind == "income" else f"{label}: {frw(rate)} Frw a month"
        return {"account": account, "noun": noun, "rate": rate, "opening": [_side(kind, ahead), o * rate],
                "entries": entries, "closing": None, "note": note}


def _closing(rng, kind: str, year: int) -> dict:
    account, noun, lo, hi, step, states = rng.choice(CLOSING_EXPENSES if kind == "expense" else CLOSING_INCOME)
    while True:
        n = rng.randint(3, 5)
        entries = [[m, d, rng.randrange(lo, hi + 1, step)] for m, d in _dates(rng, n)]
        ahead = rng.random() < 0.5 and "prepaid" in states
        opening = rng.randrange(lo // 2, hi + 1, step)
        state = rng.choice(states)
        bal = rng.randrange(lo // 2, hi + 1, step)
        cash = sum(e[2] for e in entries)
        charge = cash + (opening if ahead else -opening) + (bal if state == "accrued" else -bal)
        foot = cash + (opening if ahead else 0) + (bal if state == "accrued" else 0)
        amounts = [e[2] for e in entries] + [opening, bal, charge, foot]
        # what is owing or paid ahead is a payment or so, never most of the year's charge
        if max(opening, bal) > max(e[2] for e in entries) or charge < cash // 2 or len(set(amounts)) < len(amounts):
            continue
        if kind == "expense":
            note = f"At 31 December {year}: {noun} {'owing' if state == 'accrued' else 'paid in advance'}, {frw(bal)} Frw"
        else:
            note = (f"At 31 December {year}: {noun} "
                    f"{'still to be received' if state == 'accrued' else 'received in advance'}, {frw(bal)} Frw")
        return {"account": account, "noun": noun, "rate": 0, "opening": [_side(kind, ahead), opening],
                "entries": entries, "closing": [state, bal], "note": note}


def sample(rng: random.Random) -> dict:
    trade = rng.choice([t for t, _ in TRADES])
    year = rng.choice(YEARS)
    kind = rng.choice(["expense", "expense", "income"])
    mode = rng.choice(["rate", "closing"])
    body = _rate(rng, kind, year) if mode == "rate" else _closing(rng, kind, year)
    return {"band": rng.choice(BANDS), "business": f"{article(trade)} {trade} in {rng.choice(TOWNS)}", "year": year,
            "kind": kind, "mode": mode, **body}


def draw(p: dict):
    opening = [1, 1, "Balance b/d", p["opening"][1]]
    cash = [[m, d, "Bank", amount] for m, d, amount in p["entries"]]
    debits, credits = [], []
    (debits if p["opening"][0] == "Dr" else credits).append(opening)
    (debits if p["kind"] == "expense" else credits).extend(cash)
    return ledger(f"{p['account']} account", debits, credits, year=p["year"], notes=[p["note"]])


def figures(p: dict) -> tuple[int, str, int, int, int]:
    """The charge (or income) for the year, the kind and amount of the balance at the year end, the balance if the
    opening one is left out, and the total at the foot of each side once balanced."""
    side, opening = p["opening"]
    cash = sum(e[2] for e in p["entries"])
    ahead = side == ("Dr" if p["kind"] == "expense" else "Cr")
    net = cash + (opening if ahead else -opening)
    if p["mode"] == "rate":
        charge = 12 * p["rate"]
        diff = net - charge
        state, bal = ("prepaid" if diff > 0 else "accrued"), abs(diff)
    else:
        state, bal = p["closing"]
        charge = net + (bal if state == "accrued" else -bal)
    foot = cash + (opening if ahead else 0) + (bal if state == "accrued" else 0)
    return charge, state, bal, abs(cash - charge), foot


def words(kind: str, state: str, amount: int) -> str:
    if kind == "expense":
        return f"{frw(amount)} Frw accrued (owing)" if state == "accrued" else f"{frw(amount)} Frw prepaid (paid in advance)"
    return f"{frw(amount)} Frw accrued (still to be received)" if state == "accrued" else f"{frw(amount)} Frw received in advance"


VERBS = ["keeps the books of", "is the bookkeeper for", "keeps the accounts of", "does the bookkeeping for",
         "prepares the year-end accounts of"]


def questions(p: dict, rng: random.Random) -> list:
    who, year, kind = rng.choice(NAMES), p["year"], p["kind"]
    charge, state, bal, slip, foot = figures(p)
    lead = f"{who} {rng.choice(VERBS)} {p['business']}. "
    if kind == "expense":
        ask = f"What is the charge for {p['noun']} in the income statement for the year ended 31 December {year}?"
    else:
        ask = f"How much {p['noun']} income is shown in the income statement for the year ended 31 December {year}?"
    out = [short(lead + ask, charge, money(charge))]
    account = p["account"].lower()
    if p["mode"] == "rate":
        other = "prepaid" if state == "accrued" else "accrued"
        options = [words(kind, s, a) for s in (state, other) for a in (bal, slip)]
        kinds = "accrued or prepaid" if kind == "expense" else "accrued or received in advance"
        out.append(mcq(f"The {account} account is balanced on 31 December {year}. What balance is carried down, and is it "
                       f"{kinds}?", options[0], options[1:], rng))
    else:
        out.append(short(f"Once the {account} account is balanced on 31 December {year}, what total appears at the foot "
                         "of each side?", foot, money(foot)))
    return out
