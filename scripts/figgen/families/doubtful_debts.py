"""Trade receivables over two year ends and a provision for doubtful debts at a printed percentage of them (UP, AL),
as Cambridge IGCSE Accounting 0452 chapter 13 and AS 9706 chapter 12 set the exercise: a table of the receivables
at each 31 December, any irrecoverable debt still to be written off, and the provision's rate. At UP the rate is
the same both years; at AL it may change.

Asks the provision at the second year end, the change in the provision and its effect on profit (an increase is an
expense that reduces profit, a decrease is income that increases it), and the trade receivables less the provision
in the statement of financial position. The provision is worked out on the receivables left once the irrecoverable
debt is written off. The change is a choice of two amounts by two directions, so it cannot be told from the options
alone; the wrong amount is a usual slip: the whole new provision charged, or the write-off forgotten.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, money, short
from ._accounts import PLACES, TOWNS, TRADES, YEARS, article, customer, frw
from .econ_tables import titled_table

ID = "doubtful_debts"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP", "AL")
CONCEPTS = ("accounting.provisions-for-doubtful-debts", "accounting.irrecoverable-debts")
# A topic whose sections the book lists is reached only if one names doubtful or irrecoverable debts.
NEEDS = r"doubtful|irrecoverable|bad debts|provisions? for"
# Control accounts write debts off too, but teach no provision; companies and the rest only carry one.
AVOID = r"control account|compan|partnership|club|societ|manufactur|\btax|costing|interpretation|incomplete"

RATES = [2, 3, 4, 5, 6, 8, 10]


def figures(p: dict) -> tuple[int, int]:
    """The provision at each year end: its rate of the receivables left once any debt is written off."""
    (r1, r2), (w1, w2), (c1, c2) = p["receivables"], p["written_off"], p["rates"]
    return c1 * (r1 - w1) // 100, c2 * (r2 - w2) // 100


def slip_amount(p: dict) -> int:
    """The usual wrong amount for the change: the write-off forgotten, or else the whole new provision charged."""
    before, after = figures(p)
    change = abs(after - before)
    if p["written_off"][1]:
        forgot = abs(p["rates"][1] * p["receivables"][1] // 100 - before)
        if forgot and forgot != change:
            return forgot
    return after


def sample(rng: random.Random) -> dict:
    trade, word = rng.choice(TRADES)
    town = rng.choice(TOWNS)
    while True:
        band = rng.choice(BANDS)
        c1 = rng.choice(RATES)
        c2 = c1 if band == "UP" or rng.random() < 0.5 else rng.choice([r for r in RATES if r != c1])
        r1 = rng.randrange(300_000, 3_000_001, 10_000)
        r2 = round(r1 * rng.uniform(0.7, 1.4) / 10_000) * 10_000
        w1 = rng.randrange(5_000, 60_001, 1_000) if rng.random() < 0.2 else 0
        w2 = rng.randrange(5_000, 90_001, 1_000) if rng.random() < 0.55 else 0
        p = {"band": band, "trader": f"{rng.choice(PLACES) if town == 'Kigali' else town} {word}",
             "business": f"{article(trade)} {trade} in {town}", "year": rng.choice(YEARS),
             "receivables": [r1, r2], "written_off": [w1, w2], "rates": [c1, c2], "debtor": customer(rng) if w2 else ""}
        before, after = figures(p)
        change = abs(after - before)
        if (c1 * (r1 - w1)) % 100 or (c2 * (r2 - w2)) % 100 or change < 1_000 or change == slip_amount(p):
            continue
        slip = slip_amount(p)  # the whole new provision is a slip by design; any other slip a number of its own
        amounts = [r1, r2, w1, w2, before, after, change, r2 - w2 - after] + ([slip] if slip != after else [])
        shown = [a for a in amounts if a]
        if len(set(shown)) == len(shown):
            return p


def draw(p: dict):
    y = p["year"]
    (r1, r2), (w1, w2), (c1, c2) = p["receivables"], p["written_off"], p["rates"]
    rows = [["Trade receivables, before any write-off (Frw)" if w1 or w2 else "Trade receivables (Frw)", frw(r1), frw(r2)]]
    notes = ["The provision for doubtful debts is a percentage of the trade receivables at each year end."]
    if w1 or w2:
        rows.append(["Irrecoverable debts to write off (Frw)", frw(w1) if w1 else "–", frw(w2) if w2 else "–"])
        notes.append("It is worked out after the irrecoverable debts are written off.")
    if w2:
        notes.append(f"The debt to write off on 31 December {y} is owed by {p['debtor']}.")
    rows.append(["Provision for doubtful debts", f"{c1}%", f"{c2}%"])
    return titled_table(f"{p['trader']}: trade receivables", ["", f"31 December {y - 1}", f"31 December {y}"], rows,
                        ["l", "r", "r"], notes=notes)


VERBS = ["keeps the accounts of", "is the bookkeeper for", "prepares the year-end accounts of", "checks the receivables of"]


def words(up: bool, amount: int) -> str:
    return f"Increase of {frw(amount)} Frw, which reduces profit" if up else f"Decrease of {frw(amount)} Frw, which increases profit"


def questions(p: dict, rng: random.Random) -> list:
    who, y = rng.choice(NAMES), p["year"]
    before, after = figures(p)
    change = after - before
    slip = slip_amount(p)
    options = [words(up, a) for up in (change > 0, change < 0) for a in (abs(change), slip)]
    net = p["receivables"][1] - p["written_off"][1] - after
    return [
        short(f"{who} {rng.choice(VERBS)} {p['trader']}, {p['business']}. What is the provision for doubtful debts at "
              f"31 December {y}?", after, money(after)),
        mcq(f"How does the provision for doubtful debts change in the year ended 31 December {y}, and what is the effect "
            "on profit?", options[0], options[1:], rng),
        short(f"What amount for trade receivables, less the provision for doubtful debts, is shown in the statement of "
              f"financial position at 31 December {y}?", net, money(net)),
    ]
