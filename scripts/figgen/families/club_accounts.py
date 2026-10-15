"""A club's or society's accounts (UP, AL), as Cambridge IGCSE Accounting 0452 chapter 18 and AS 9706 chapter 23 set
them, for a Rwandan sports club or society. Two sub-types:
- "rp": a receipts and payments account for the year: the bank balance (or overdraft) brought down, the receipts
  (subscriptions, fees, refreshment sales, donations) and the payments, not yet balanced. Asks the balance at the
  year end (how much, and cash at bank or an overdraft) and the total at the foot of each side once balanced.
- "subs": a subscriptions account for the year: subscriptions in arrears and paid in advance brought down on
  1 January, the subscriptions received by bank, and a note of the arrears and advance at 31 December. Asks the
  subscriptions for the income and expenditure account, and the total at the foot of each side once balanced.

Every key is the account worked through: income = received - arrears b/d + advance b/d + arrears c/d - advance c/d.
The bank balance is a choice of two amounts by two kinds (cash at bank or overdraft), so it cannot be told from the
options alone; the wrong amount is the slip of leaving out the opening balance.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, money, short
from ._accounts import YEARS, frw
from ._year_ledger import ledger

ID = "club_accounts"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP", "AL")
CONCEPTS = ("accounting.club-and-society-accounts",)
# A topic whose sections the book lists is reached only if one names clubs or their accounts.
NEEDS = r"club|societ|non-profit|receipts and payments|subscription|income and expenditure|accumulated fund"
# The AS book's chapter on books of prime entry lists the clubs chapter among its sections, but teaches none of it.
AVOID = r"prime entry|prime books|compan|partnership|manufactur|\btax"

CLUBS = ["Kimironko Football Club", "Huye Chess Club", "Rubavu Swimming Club", "Musanze Cycling Club",
         "Nyamirambo Drama Society", "Kicukiro Netball Club", "Remera Basketball Club", "Muhanga Music Society",
         "Rwamagana Tennis Club", "Nyagatare Volleyball Club", "Karongi Rowing Club", "Gisozi Debating Society"]
# (details, lowest, highest, step)
RECEIPTS = [("Competition entry fees", 20_000, 200_000, 5_000), ("Sale of refreshments", 50_000, 500_000, 5_000),
            ("Donations", 20_000, 300_000, 10_000), ("Annual dinner tickets", 50_000, 400_000, 5_000),
            ("Hire of hall received", 30_000, 250_000, 5_000)]
PAYMENTS = [("Rent of grounds", 100_000, 800_000, 10_000), ("Equipment", 50_000, 600_000, 5_000),
            ("Refreshments bought", 30_000, 300_000, 5_000), ("Coach's wages", 100_000, 600_000, 10_000),
            ("Transport to events", 20_000, 200_000, 5_000), ("Annual dinner costs", 40_000, 350_000, 5_000),
            ("Electricity", 10_000, 100_000, 1_000), ("Prizes", 20_000, 150_000, 5_000)]


def _rp(rng) -> dict:
    while True:
        receipts = [["Subscriptions", rng.randrange(200_000, 2_000_001, 10_000)]]
        receipts += [[d, rng.randrange(lo, hi + 1, st)] for d, lo, hi, st in rng.sample(RECEIPTS, rng.randint(2, 4))]
        payments = [[d, rng.randrange(lo, hi + 1, st)] for d, lo, hi, st in rng.sample(PAYMENTS, rng.randint(3, 5))]
        side = "Dr" if rng.random() < 0.75 else "Cr"
        opening = rng.randrange(20_000, 400_001, 5_000)
        dr = sum(v for _, v in receipts) + (opening if side == "Dr" else 0)
        cr = sum(v for _, v in payments) + (opening if side == "Cr" else 0)
        closing = dr - cr
        slip = abs(sum(v for _, v in receipts) - sum(v for _, v in payments))
        if abs(closing) < 5_000 or abs(closing) > 0.6 * max(dr, cr) or slip in (0, abs(closing)):
            continue
        amounts = [v for _, v in receipts + payments] + [opening, abs(closing), max(dr, cr), slip]
        if len(set(amounts)) == len(amounts):
            return {"opening": [side, opening], "receipts": receipts, "payments": payments}


def _subs(rng, year: int) -> dict:
    while True:
        n = rng.randint(1, 3)
        received = [[m, rng.randint(2, 28), rng.randrange(150_000, 1_200_001, 5_000)]
                    for m in sorted(rng.sample(range(1, 13), n))]
        arrears = [rng.randrange(5_000, 120_001, 5_000) if rng.random() < 0.85 else 0 for _ in range(2)]
        advance = [rng.randrange(5_000, 120_001, 5_000) if rng.random() < 0.85 else 0 for _ in range(2)]
        if not (arrears[0] + advance[0] and arrears[1] + advance[1]):
            continue
        cash = sum(e[2] for e in received)
        income = cash - arrears[0] + advance[0] + arrears[1] - advance[1]
        foot = arrears[0] + income + advance[1]
        amounts = [e[2] for e in received] + [a for a in arrears + advance if a] + [income, foot]
        if income > 0 and len(set(amounts)) == len(amounts):
            return {"arrears": arrears, "advance": advance, "received": received}


def sample(rng: random.Random) -> dict:
    year = rng.choice(YEARS)
    kind = rng.choice(["rp", "subs"])
    body = _rp(rng) if kind == "rp" else _subs(rng, year)
    return {"band": rng.choice(BANDS), "club": rng.choice(CLUBS), "year": year, "kind": kind, **body}


def draw(p: dict):
    y = p["year"]
    if p["kind"] == "rp":
        side, opening = p["opening"]
        debits = [list(r) for r in p["receipts"]]
        credits = [list(r) for r in p["payments"]]
        if side == "Dr":
            debits.insert(0, ["Balance b/d", opening])
        else:
            credits.insert(0, ["Balance b/d (overdraft)", opening])
        return ledger(p["club"], debits, credits, sides=("Receipts", "Payments"),
                      subtitle=f"Receipts and payments account for the year ended 31 December {y}")
    (a1, a2), (v1, v2) = p["arrears"], p["advance"]
    debits = [[1, 1, "Balance b/d (arrears)", a1]] if a1 else []
    credits = ([[1, 1, "Balance b/d (in advance)", v1]] if v1 else []) + [[m, d, "Bank", v] for m, d, v in p["received"]]
    notes = [f"At 31 December {y}:"] + ([f"•  subscriptions in arrears: {frw(a2)} Frw"] if a2 else []) + \
        ([f"•  subscriptions paid in advance: {frw(v2)} Frw"] if v2 else [])
    return ledger("Subscriptions account", debits, credits, year=y, notes=notes, subtitle=p["club"])


def figures(p: dict) -> tuple[int, int, int]:
    """For a receipts and payments account, the balance at the year end (an overdraft below nothing), the foot of
    each side, and the balance if the opening one is left out; for a subscriptions account, the year's income, the
    foot, and nothing."""
    if p["kind"] == "rp":
        side, opening = p["opening"]
        rec, pay = sum(v for _, v in p["receipts"]), sum(v for _, v in p["payments"])
        dr, cr = rec + (opening if side == "Dr" else 0), pay + (opening if side == "Cr" else 0)
        return dr - cr, max(dr, cr), abs(rec - pay)
    (a1, a2), (v1, v2) = p["arrears"], p["advance"]
    income = sum(e[2] for e in p["received"]) - a1 + v1 + a2 - v2
    return income, a1 + income + v2, 0


VERBS = ["is the treasurer of", "keeps the accounts of", "looks after the money of", "prepares the accounts of"]


def words(cash: bool, amount: int) -> str:
    return f"{'Cash at bank' if cash else 'Bank overdraft'} of {frw(amount)} Frw"


def questions(p: dict, rng: random.Random) -> list:
    who, y, club = rng.choice(NAMES), p["year"], p["club"]
    value, foot, slip = figures(p)
    lead = f"{who} {rng.choice(VERBS)} {club}. "
    if p["kind"] == "rp":
        options = [words(c, a) for c in (value > 0, value < 0) for a in (abs(value), slip)]
        return [mcq(lead + f"What is the club's bank balance on 31 December {y}, once the year's receipts and payments "
                    "are taken into account?", options[0], options[1:], rng),
                short(f"Once the receipts and payments account of {club} is balanced on 31 December {y}, what total "
                      "appears at the foot of each side?", foot, money(foot))]
    return [short(lead + f"What amount for subscriptions is shown in the income and expenditure account for the year "
                  f"ended 31 December {y}?", value, money(value)),
            short(f"Once the subscriptions account of {club} is balanced on 31 December {y}, what total appears at the "
                  "foot of each side?", foot, money(foot))]
