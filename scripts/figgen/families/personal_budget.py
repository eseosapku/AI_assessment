"""Personal budgets (LS, Entrepreneurship S2 "Personal budgeting"): a Rwandan student's or family's budget for one
month, as two tables side by side, income and expenses, each line in francs with the totals left as "?", and no
empty rows (an empty row made reviewers wonder whether an item was missing, P3y review). The
student's comes in pocket money, a weekend job and gifts and goes on transport, lunch and airtime; the family's comes
in a salary, milk sales and rent and goes on food, rent, school fees and health insurance. About half the budgets
are in deficit.

The total expenses; whether the budget shows a surplus or a deficit and of how much (an MCQ in a balanced
two-by-two: surplus or deficit, by the right amount or by the slip of leaving one expense out); and what is left in
savings after the month's surplus is added (or its deficit paid) and a planned purchase is made, with the savings at
the start and the price in the stem.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, mcq, money, new_figure, short

ID = "personal_budget"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("LS",)
CONCEPTS = ("business.personal-budgeting",)
# The same budget in social studies (P5): NERDC JSS 2-3 "Economics basics" (family budget) and the Rwanda GSCS units
# on personal finance -- S4 "Personal Finances" (keeping track of personal money and payment commitments) and S6
# "How to manage money" (saving, borrowing and debt); S5 "Money and Finance" teaches banks and payments, not budgets.
ALSO = ("social-studies.family-budget", "social-studies.personal-finances")
# The GSCS units are Upper Secondary books; the same student or family budget serves them as drawn, where the unit's
# own name says it teaches personal finance or managing money.
ALSO_BANDS = {"LS": ("UP",)}
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"budget|financial awareness|personal financ|manage money"  # S1 teaches the personal budget in "Financial awareness"
# Listed without sections, sharing the concept, but teaching consumers' rights rather than a budget.
AVOID = r"consumer education"

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
# Each line: (label, low, high) in francs; amounts are whole steps.
OWNERS = {
    "student": {
        "step": 500,
        "income": [("Pocket money", 5000, 20000), ("Weekend job", 4000, 15000), ("Gift from aunt", 2000, 10000),
                   ("Selling eggs", 2000, 8000)],
        "expenses": [("Lunch at school", 3000, 10000), ("Transport", 2000, 8000), ("Airtime", 1000, 3000),
                     ("Exercise books", 1000, 4000), ("Haircut", 1000, 2500), ("Soap and lotion", 1000, 3000),
                     ("Football club fee", 1000, 3000)],
        "buy": [("a calculator", 5000, 12000), ("a pair of shoes", 8000, 20000), ("a dictionary", 5000, 15000),
                ("a school bag", 6000, 15000), ("a football", 4000, 10000)],
    },
    "family": {
        "step": 1000,
        "income": [("Salary", 80000, 200000), ("Sale of milk", 10000, 40000), ("Sale of beans", 10000, 30000),
                   ("Rent from a room", 20000, 50000)],
        "expenses": [("Food", 40000, 90000), ("House rent", 30000, 60000), ("School fees", 20000, 60000),
                     ("Transport", 10000, 30000), ("Electricity and water", 8000, 20000),
                     ("Health insurance", 3000, 10000), ("Airtime and internet", 5000, 15000)],
        "buy": [("a gas cooker", 40000, 80000), ("a mattress", 30000, 70000), ("a water tank", 50000, 120000),
                ("a goat", 30000, 60000), ("a radio", 15000, 40000)],
    },
}


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def _amount(rng: random.Random, lo: int, hi: int, step: int) -> int:
    return step * rng.randint(-(-lo // step), hi // step)


def sample(rng: random.Random) -> dict:
    owner = rng.choice(["student", "family"])
    t = OWNERS[owner]
    step = t["step"]
    deficit = rng.random() < 0.5
    while True:
        income = [[lab, _amount(rng, lo, hi, step)] for lab, lo, hi in rng.sample(t["income"], rng.randint(2, 3))]
        lines = rng.sample(t["expenses"][1:], rng.randint(3, 4))
        if owner == "family" or rng.random() < 0.5:
            lines.insert(rng.randrange(len(lines) + 1), t["expenses"][0])  # a family always budgets for food
        else:
            lines.append(rng.choice([e for e in t["expenses"][1:] if e not in lines]))
        expenses = [[lab, _amount(rng, lo, hi, step)] for lab, lo, hi in lines]
        balance = sum(a for _, a in income) - sum(a for _, a in expenses)
        if (balance < 0) != deficit or abs(balance) < 2 * step:
            continue
        if abs(balance) == expenses[-1][1] or abs(balance + expenses[-1][1]) == abs(balance):
            continue  # the slip of leaving out the last expense gives another amount
        item, lo, hi = rng.choice(t["buy"])
        cost = _amount(rng, lo, hi, step)
        # savings at the start: enough to cover any deficit and the purchase, with some left
        least = max(step, cost - balance + 2 * step)
        saved = _amount(rng, least, least + 18 * step, step)
        return {"band": "LS", "owner": owner, "name": rng.choice(NAMES), "month": rng.choice(MONTHS),
                "income": income, "expenses": expenses, "item": [item, cost], "saved": saved}


def _table(ax, x: float, top: float, head: str, rows: list) -> None:
    lw, aw, rh = 3.3, 1.9, 0.5
    lines = [head] + [r[0] for r in rows] + ["Total"]
    for k, label in enumerate(lines):
        y = top - (k + 0.5) * rh
        if k == 0:
            ax.fill([x, x + lw + aw, x + lw + aw, x], [top, top, top - rh, top - rh], color="#dde3ea", zorder=0)
            ax.text(x + 0.12, y, label, ha="left", va="center", fontsize=10.5, fontweight="bold")
            ax.text(x + lw + aw / 2, y, "Amount (Frw)", ha="center", va="center", fontsize=10, fontweight="bold")
        elif label == "Total":
            ax.text(x + 0.12, y, f"Total {head.lower()}", ha="left", va="center", fontsize=10, fontweight="bold")
            ax.text(x + lw + aw - 0.15, y, "?", ha="right", va="center", fontsize=10.5, fontweight="bold")
        else:
            ax.text(x + 0.12, y, label, ha="left", va="center", fontsize=10)
            ax.text(x + lw + aw - 0.15, y, fr(rows[k - 1][1]), ha="right", va="center", fontsize=10)
    bottom = top - len(lines) * rh
    for k in range(len(lines) + 1):
        heavy = k in (0, 1, len(lines) - 1, len(lines))
        ax.plot([x, x + lw + aw], [top - k * rh] * 2, color=INK, linewidth=1.4 if heavy else 0.7, gid=f"rule:{head}:{k}")
    for xx in (x, x + lw, x + lw + aw):
        ax.plot([xx, xx], [top, bottom], color=INK, linewidth=1.0)


def title(p: dict) -> str:
    return f"{p['name']}'s {'family ' if p['owner'] == 'family' else ''}budget for {p['month']}"


def draw(p: dict):
    n = max(len(p["income"]), len(p["expenses"]))
    fig, ax = new_figure(11.0, 0.5 * (n + 2) + 1.0)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    _table(ax, 0.0, 0.0, "Income", p["income"])
    _table(ax, 5.6, 0.0, "Expenses", p["expenses"])
    ax.text(5.4, 0.5, title(p), ha="center", va="center", fontsize=12, fontweight="bold")
    bottom = -(n + 2) * 0.5
    ax.set_xlim(-0.1, 10.9)
    ax.set_ylim(bottom - 0.1, 0.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["writes", "plans", "draws up", "checks", "prepares"]


def questions(p: dict, rng: random.Random) -> list:
    name, month = p["name"], p["month"]
    income = sum(a for _, a in p["income"])
    spent = sum(a for _, a in p["expenses"])
    balance = income - spent
    slip = abs(income - (spent - p["expenses"][-1][1]))  # one expense left out
    amounts = [abs(balance), slip]
    options = [f"{side} of {fr(a)} Frw" for side in ("Surplus", "Deficit") for a in amounts]
    key = options[0 if balance > 0 else 2]
    whose = f"{name}'s family" if p["owner"] == "family" else name
    budget = f"{name}'s family budget" if p["owner"] == "family" else f"{name}'s budget"
    item, cost = p["item"]
    return [
        short(f"{name} {rng.choice(VERBS)} {'the family' if p['owner'] == 'family' else 'a'} budget for {month}. "
              f"What are the total expenses for {month}, in Frw?", spent, money(spent)),
        mcq(f"Does {budget} for {month} show a surplus or a deficit, and of how much?", key,
            [o for o in options if o != key], rng),
        short(f"{whose} has {fr(p['saved'])} Frw saved at the start of {month}. At the end of the month the surplus "
              f"is added to the savings, or the deficit is paid from them. Then {whose} buys {item} for {fr(cost)} Frw. "
              f"How much is left in savings, in Frw?", p["saved"] + balance - cost,
              money(p["saved"] + balance - cost)),
    ]
