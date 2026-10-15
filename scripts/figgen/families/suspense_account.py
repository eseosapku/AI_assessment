"""A trial balance that does not agree, and the errors found later (UP; an AS Level sub-type), as Cambridge IGCSE
Accounting 0452 (chapter 15, "Journal entries and correction of errors"), AS 9706 (chapters 6 and 15), Rwanda's S4
Financial Accounting book ("Correction of Errors") and the WAEC and JAMB trial balance topics set it: the two column
totals, the draft profit worked out before the errors were found, and three or four errors in words.

The errors explain the difference exactly. UP: two or three one-sided errors (an amount posted to only one account,
or posted as the wrong figure, often two digits swapped) and perhaps one error of principle, which leaves the trial
balance agreeing. AL: also an amount entered on the wrong side of its account, which moves both totals.

Asks the side and amount of the suspense account's opening entry (the short column takes the difference; two sides by
two amounts), the corrected profit for the year, and, when there is one, which error does not affect the trial
balance. A draft profit is corrected by the error's effect on income or expenses: an expense left out lowers it, an
expense overstated raises it, and a revenue item entered on the wrong side moves it by twice its amount.
"""
from __future__ import annotations

import random
import re

from ..core import NAMES, mcq, money, short
from ._accounts import PLACES, SUPPLIERS, TOWNS, TRADES, YEARS, article, customer, frw, page, rule
from .econ_tables import fit

ID = "suspense_account"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP", "AL")
CONCEPTS = ("accounting.suspense-account", "accounting.correction-of-errors", "accounting.errors-and-trial-balance")
# A topic whose sections the book lists is reached only if one names the suspense account, the correction of errors,
# or what to do when the trial balance fails to agree.
NEEDS = r"suspense|correction of errors|correct(ing)? errors|fails? to agree"
# Topics that carry the same concepts but teach control accounts, banking, the books of prime entry or the ledgers
# (the NERDC, JAMB and WAEC topics list no sections, so their names decide).
AVOID = (r"control account|reconcil|books of (original|prime) entry|^ledgers|double entry|incomplete|partnership|"
         r"compan|club")

# The ledger accounts an error may touch: (account, how the payment reads).
EXPENSES = [("Rent", "rent"), ("Wages", "wages"), ("Electricity", "electricity"), ("Insurance", "insurance"),
            ("Advertising", "advertising"), ("Water", "water")]
INCOMES = [("Commission received", "commission received"), ("Rent received", "rent received")]
ONE_SIDED = ["omit_expense", "omit_income", "expense_as", "income_as"]
PRINCIPLE = ["principle_asset", "principle_drawings", "principle_repairs"]
WRONG_SIDE = ["wrong_side_income", "wrong_side_expense"]
ENDS = ["31 December", "31 March", "30 June", "30 September"]


def effect(kind: str, a: int, w: int | None) -> tuple[int, int, int]:
    """By how much an error overstates the debit total and the credit total, and what correcting it adds to profit."""
    return {"omit_expense": (-a, 0, -a), "omit_income": (0, -a, a),
            "expense_as": (w - a if w else 0, 0, w - a if w else 0), "income_as": (0, w - a if w else 0, a - w if w else 0),
            "principle_asset": (0, 0, a), "principle_drawings": (0, 0, a), "principle_repairs": (0, 0, -a),
            "wrong_side_income": (a, -a, 2 * a), "wrong_side_expense": (-a, a, -2 * a)}[kind]


def _swap(rng) -> tuple[int, int]:
    """An amount and the same amount with two digits swapped, as a misposting usually is: 46 000 posted as 64 000."""
    d1, d2 = rng.sample(range(1, 10), 2)
    if rng.random() < 0.5:
        return (10 * d1 + d2) * 1_000, (10 * d2 + d1) * 1_000
    h = rng.randint(1, 9)
    return (100 * h + 10 * d1 + d2) * 100, (100 * h + 10 * d2 + d1) * 100


def _error(rng, kind: str, used: set) -> list | None:
    """[kind, account, the right amount, the wrong amount or None]."""
    if kind in ("omit_expense", "expense_as", "wrong_side_expense"):
        extra = {"omit_expense": [("Purchases", None)], "expense_as": [("Sales returns", None), ("Carriage inwards", None)],
                 "wrong_side_expense": [("Carriage inwards", None)]}[kind]
        free = [a for a, _ in EXPENSES + extra if a not in used]
    elif kind in ("omit_income", "income_as", "wrong_side_income"):
        extra = {"omit_income": [("Sales", None)], "income_as": [("Discount received", None), ("Purchases returns", None)],
                 "wrong_side_income": [("Discount received", None)]}[kind]
        free = [a for a, _ in INCOMES + extra if a not in used]
    else:
        free = [{"principle_asset": "Equipment", "principle_drawings": "Drawings", "principle_repairs": "Repairs"}[kind]]
    if not free:
        return None  # every account this kind of error could touch is taken: the caller draws again
    account = rng.choice(free)
    used.add(account)
    if kind.endswith("_as"):
        a, w = _swap(rng)
        return [kind, account, a, w]
    if kind.startswith("principle"):
        return [kind, account, rng.randrange(30_000, 400_001, 5_000), None]
    if kind.startswith("wrong_side"):
        return [kind, account, rng.randrange(2_000, 40_001, 500), None]
    return [kind, account, rng.randrange(5_000, 150_001, 500), None]


def sample(rng: random.Random) -> dict:
    band = rng.choice(["UP", "AL"])
    trade, word = rng.choice(TRADES)
    town = rng.choice(TOWNS)
    place = rng.choice(PLACES) if town == "Kigali" else town
    while True:
        used: set[str] = set()
        kinds = rng.sample(ONE_SIDED, 2)
        if band == "AL":
            kinds.append(rng.choice(WRONG_SIDE))
        kinds.append(rng.choice(PRINCIPLE) if rng.random() < 0.6 else rng.choice(ONE_SIDED))
        rng.shuffle(kinds)
        errors = [_error(rng, k, used) for k in kinds]
        if None in errors:
            continue
        names = {"customer": customer(rng), "supplier": rng.choice(SUPPLIERS)}
        true_total = rng.randrange(3_000_000, 15_000_001, 1_000)
        effects = [effect(e[0], e[2], e[3]) for e in errors]
        dr = true_total + sum(x[0] for x in effects)
        cr = true_total + sum(x[1] for x in effects)
        draft = rng.randrange(600_000, 5_000_001, 1_000)
        profit = draft + sum(x[2] for x in effects)
        diff = abs(dr - cr)
        printed = [e[2] for e in errors] + [e[3] for e in errors if e[3]]
        if not diff or diff in printed or profit <= 0 or profit == draft or len(set(printed)) < len(printed):
            continue
        return {"band": band, "trader": f"{place} {word}", "business": f"{article(trade)} {trade} in {town}",
                "date": f"{rng.choice(ENDS)} {rng.choice(YEARS)}", "dr_total": dr, "cr_total": cr, "draft_profit": draft,
                "errors": errors, "names": names}


def describe(e: list, names: dict) -> str:
    kind, account, a, w = e
    acc = account.lower()
    plural = account in ("Wages", "Sales returns", "Purchases returns")
    was = "were" if plural else "was"
    thing = dict(EXPENSES + INCOMES).get(account)
    amount = f"{frw(a)} Frw"
    if kind == "omit_expense":
        if account == "Purchases":
            return (f"Credit purchases of {amount} from {names['supplier']} were credited to the supplier's account but "
                    "not debited to the purchases account.")
        return f"{amount} paid for {thing} was entered in the bank account but not posted to the {acc} account."
    if kind == "omit_income":
        if account == "Sales":
            return (f"Credit sales of {amount} to {names['customer']} were debited to the customer's account but not "
                    "credited to the sales account.")
        return f"{amount} of {thing} was entered in the bank account but not posted to the {acc} account."
    if kind in ("expense_as", "income_as"):
        if thing and kind == "expense_as":
            return f"{amount} paid for {thing} was posted to the {acc} account as {frw(w)} Frw."
        if thing:
            return f"{amount} of {thing} was posted to the {acc} account as {frw(w)} Frw."
        return f"{account} of {amount} {was} posted to the {acc} account as {frw(w)} Frw."
    if kind == "principle_asset":
        return f"Equipment bought for {amount} was debited to the purchases account."
    if kind == "principle_drawings":
        return f"Drawings of {amount} taken by the owner from the bank were debited to the wages account."
    if kind == "principle_repairs":
        return f"Repairs to the delivery van costing {amount} were debited to the motor vehicle account."
    side, right = ("debit", "credit") if kind == "wrong_side_income" else ("credit", "debit")
    if thing:
        lead = f"{amount} of {thing}" if kind == "wrong_side_income" else f"{amount} paid for {thing}"
        return f"{lead} was entered on the {side} side of the {acc} account instead of the {right} side."
    return f"{account} of {amount} {was} entered on the {side} side of the {acc} account instead of the {right} side."


FS = 10


def _wrap(text: str, width: float) -> list[str]:
    """Lines no wider than `width` inches, never breaking inside an amount ("75 000 Frw")."""
    glued = re.sub(r"(?<=\d) (?=\d{3}\b|Frw\b)", "\u00a0", text)
    lines, cur = [], ""
    for word in glued.split(" "):
        trial = f"{cur} {word}".strip()
        if cur and fit(trial.replace("\u00a0", " "), size=FS, bold=False, pad=0) > width:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    return [ln.replace("\u00a0", " ") for ln in lines + [cur]]


def draw(p: dict):
    width, x0, num_w = 7.6, 0.14, 0.38
    text_w = width - 2 * x0 - num_w - 0.05
    wrapped = [_wrap(describe(e, p["names"]), text_w) for e in p["errors"]]
    n_lines = sum(len(w) for w in wrapped)
    height = 2.9 + n_lines * 0.27 + len(wrapped) * 0.08 + 0.12
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, p["trader"], ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Trial balance at {p['date']}: the totals do not agree", ha="center", va="top", fontsize=10.5)
    box_l, box_r = x0 + 0.9, width - x0 - 0.9
    rows = [("Total of the debit column", p["dr_total"]), ("Total of the credit column", p["cr_total"]),
            (f"Draft profit for the year ended {p['date']}", p["draft_profit"])]
    y = top - 0.72
    rule(ax, box_l, box_r, y, width=0.9)
    for i, (label, v) in enumerate(rows):
        yy = y - (i + 0.5) * 0.3
        ax.text(box_l + 0.1, yy, label, ha="left", va="center", fontsize=FS)
        ax.text(box_r - 0.1, yy, f"{frw(v)} Frw", ha="right", va="center", fontsize=FS)
        if i == 1:
            rule(ax, box_l, box_r, yy - 0.15, width=0.6, colour="#888888")
    y_box = y - 3 * 0.3
    rule(ax, box_l, box_r, y_box, width=0.9)
    for x in (box_l, box_r):
        ax.plot([x, x], [y, y_box], color="#111111", linewidth=0.9)
    ax.text(box_l, y_box - 0.12, "The draft profit was worked out before these errors were found.", ha="left", va="top",
            fontsize=9.5, style="italic", color="#333333")
    y = y_box - 0.52
    ax.text(x0, y, "Errors found later", ha="left", va="top", fontsize=10.5, fontweight="bold")
    # Each error is in the one account it names: read otherwise, a misposting could be two wrong entries that agree.
    ax.text(x0, y - 0.3, "In each error, the other half of the double entry was correct.", ha="left", va="top",
            fontsize=9.5, style="italic", color="#333333")
    y -= 0.64
    for i, lines in enumerate(wrapped):
        ax.text(x0, y, f"{i + 1}", ha="left", va="top", fontsize=FS, fontweight="bold")
        for line in lines:
            ax.text(x0 + num_w, y, line, ha="left", va="top", fontsize=FS)
            y -= 0.27
        y -= 0.08
    return fig


VERBS = ["keeps the books of", "is the bookkeeper at", "checks the accounts of", "does the bookkeeping for"]


def _of(name: str) -> str:
    return name + ("'" if name.endswith("s") else "'s")


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    trader, date = p["trader"], p["date"]
    dr, cr = p["dr_total"], p["cr_total"]
    diff = abs(dr - cr)
    side = "Debit" if dr < cr else "Credit"
    other = "Credit" if side == "Debit" else "Debit"
    slip = diff // 2 if diff % 1_000 == 0 else 2 * diff  # the difference halved, as if one entry made it twice
    effects = [effect(e[0], e[2], e[3]) for e in p["errors"]]
    profit = p["draft_profit"] + sum(x[2] for x in effects)
    out = [mcq(f"{who} {rng.choice(VERBS)} {trader}, {p['business']}. The trial balance at {date} does not agree, so a "
               "suspense account is opened for the difference. On which side of the suspense account is the difference "
               "entered, and for how much?", f"{side}, {frw(diff)} Frw",
               [f"{other}, {frw(diff)} Frw", f"{side}, {frw(slip)} Frw", f"{other}, {frw(slip)} Frw"], rng),
           short(f"{_of(trader)} draft profit for the year ended {date} was worked out before the {len(p['errors'])} errors "
                 "listed were found. What is the corrected profit for the year once every error is corrected?",
                 profit, money(profit))]
    neutral = [i + 1 for i, x in enumerate(effects) if x[0] == x[1] == 0]
    if len(neutral) == 1:
        out.append(mcq(f"Which of the errors found in {_of(trader)} books does not affect the agreement of the trial "
                       f"balance at {date}?", f"Error {neutral[0]}",
                       [f"Error {i + 1}" for i in range(len(effects)) if i + 1 != neutral[0]], rng))
    return out
