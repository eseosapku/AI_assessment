"""A simple budget for one month (P, Primary Social Studies): a family's, a pupil's or a school garden club's, as two
tables side by side, money in (sale of beans, pocket money, members' contributions) and money out (school materials,
soap, seeds), every amount in Rwandan francs written as a Primary book writes it ("12 500 Frw"). The totals are left
as "?".

Lower (P2 to P4): two rows in and two or three out, in whole five hundreds. Upper: three in and three or four out, in
whole hundreds.

- How much money comes in altogether? How much goes out altogether? How much is saved (what is left over)?
- Is the money saved enough to buy something costing a stated amount? Never a near thing: the price is at least
  500 Frw more or less than the savings. The wrong options are the right difference with the wrong answer, and the
  slips of comparing the price with all the money in, or with the money out, instead of with the savings.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, mcq, money, new_figure, short

ID = "budget_p"
KIND = "table.data"
SUBJECT = "social-studies"
BANDS = ("P",)
CONCEPTS = tuple(f"social-studies.{c}" for c in ("family-budget", "money-finance", "saving", "money-spending-decisions",
                                                  "economy"))
# A topic whose sections the book lists is reached only if its name or a section names a budget or the economy.
NEEDS = r"budget|econom"
AVOID = (r"\bgod\b|god's|bible|qur'?an|prayer|faith|\bsin\b|creation|commandment|charity|"
         r"democracy and governance|community helpers|rights and responsibilities|historical events")

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November",
          "December"]
# Each row: its label, and the range of a plausible amount at the lower level and at the upper level.
ROWS = {
    "family": {
        "in": {"Sale of beans": (2000, 8000, 5000, 20000), "Sale of milk": (2000, 6000, 4000, 15000),
               "Sale of bananas": (1500, 5000, 3000, 12000), "Sale of maize": (2000, 6000, 4000, 15000),
               "Sale of eggs": (1000, 3000, 2000, 6000), "Pay from work": (5000, 10000, 10000, 30000),
               "Sale of potatoes": (1500, 5000, 3000, 12000)},
        "out": {"School materials": (1000, 3000, 2000, 8000), "Soap": (500, 1500, 800, 3000),
                "Salt and sugar": (1000, 2500, 1500, 5000), "Transport": (500, 2000, 1000, 6000),
                "Paraffin": (500, 1500, 800, 3000), "Health insurance": (1500, 3000, 3000, 9000),
                "Cooking oil": (1000, 2500, 1500, 4000)},
        "buy": [("a hen", 4000, 8000), ("a school bag", 3000, 10000), ("a pair of shoes", 3000, 15000),
                ("a hoe", 2000, 5000), ("a blanket", 5000, 15000), ("a radio", 8000, 25000), ("a goat", 20000, 60000),
                ("a mattress", 15000, 40000), ("a jerrycan", 1000, 3000)],
    },
    "pupil": {
        "in": {"Pocket money": (1000, 3000, 1500, 5000), "Gift from grandmother": (500, 2000, 1000, 4000),
               "Sale of eggs": (500, 1500, 800, 3000), "Gift from uncle": (500, 2000, 1000, 4000)},
        "out": {"Exercise books": (500, 1500, 600, 2000), "Pens and pencils": (500, 1000, 300, 1200),
                "Soap": (500, 1000, 500, 1500), "Bus fare": (500, 1000, 400, 1500), "A ruler": (500, 500, 200, 600)},
        "buy": [("a story book", 1000, 3000), ("a football", 2000, 6000), ("a school bag", 3000, 10000),
                ("a water bottle", 1000, 3000), ("a dictionary", 2000, 6000)],
    },
    "club": {
        "in": {"Sale of cabbages": (2000, 6000, 3000, 12000), "Sale of carrots": (1500, 5000, 2000, 10000),
               "Sale of tomatoes": (2000, 6000, 3000, 12000), "Members' contributions": (2000, 5000, 3000, 10000),
               "Sale of beans": (2000, 6000, 3000, 12000)},
        "out": {"Seeds": (500, 2000, 1000, 4000), "Manure": (1000, 3000, 1500, 5000), "A hoe": (2000, 3000, 2000, 4500),
                "Exercise books": (500, 1500, 600, 2000), "Soap": (500, 1000, 500, 1500)},
        "buy": [("a watering can", 3000, 8000), ("a hoe", 2000, 5000), ("a spade", 3000, 8000),
                ("a wheelbarrow", 25000, 60000), ("a rake", 2000, 5000)],
    },
}


def stages(p: dict) -> tuple[int, int] | None:
    return (4, 6) if p["level"] == "upper" else None


def fr(n: int) -> str:
    """Francs as a Primary book prints them: a space for thousands ("12 500")."""
    return f"{n:,}".replace(",", " ")


def _amount(rng: random.Random, lo: int, hi: int, step: int) -> int:
    return rng.randrange(-(-lo // step), hi // step + 1) * step


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    step = 500 if level == "lower" else 100
    while True:
        owner = rng.choice(["family", "family", "pupil", "club"])
        table = ROWS[owner]
        n_in, n_out = (2, rng.randint(2, 3)) if level == "lower" else (3, rng.randint(3, 4))
        k = 0 if level == "lower" else 2
        ins = [[lab, _amount(rng, *table["in"][lab][k:k + 2], step)] for lab in rng.sample(sorted(table["in"]), n_in)]
        outs = [[lab, _amount(rng, *table["out"][lab][k:k + 2], step)] for lab in rng.sample(sorted(table["out"]), n_out)]
        saved = sum(a for _, a in ins) - sum(a for _, a in outs)
        if saved < 1000:
            continue
        enough = rng.random() < 0.5
        costs = []
        for d in range(500, min(5000, saved // 2 if enough else 5000) + 1, step):
            cost = saved - d if enough else saved + d
            costs += [[item, cost] for item, lo, hi in table["buy"]
                      if lo <= cost <= hi and item.lower() not in {lab.lower() for lab, _ in outs}]  # not bought already
        if not costs:
            continue
        return {"band": "P", "level": level, "owner": owner, "name": rng.choice(NAMES), "month": rng.choice(MONTHS),
                "money_in": ins, "money_out": outs, "item": rng.choice(costs)}


# --- drawing ----------------------------------------------------------------------------------------

def title(p: dict) -> str:
    if p["owner"] == "family":
        return f"{p['name']}'s family budget for {p['month']}"
    if p["owner"] == "pupil":
        return f"{p['name']}'s budget for {p['month']}"
    return f"School garden club budget for {p['month']}"


def _table(ax, x: float, top: float, head: str, rows: list, n: int) -> None:
    lw, aw, rh = 3.9, 2.2, 0.62
    lines = [head] + [r[0] for r in rows] + [""] * (n - len(rows)) + ["Total"]
    for k, label in enumerate(lines):
        y = top - (k + 0.5) * rh
        if k == 0:
            ax.fill([x, x + lw + aw, x + lw + aw, x], [top, top, top - rh, top - rh], color="#dbe9f6", zorder=0)
            ax.text(x + 0.15, y, label, ha="left", va="center", fontsize=11.5, fontweight="bold")
            ax.text(x + lw + aw / 2, y, "Amount", ha="center", va="center", fontsize=11.5, fontweight="bold")
        elif label == "Total":
            ax.text(x + 0.15, y, "Total", ha="left", va="center", fontsize=11, fontweight="bold")
            ax.text(x + lw + aw / 2, y, "?", ha="center", va="center", fontsize=11, fontweight="bold", gid="total")
        elif label:
            ax.text(x + 0.15, y, label, ha="left", va="center", fontsize=11)
            ax.text(x + lw + aw - 0.15, y, f"{fr(rows[k - 1][1])} Frw", ha="right", va="center", fontsize=11)
    bottom = top - len(lines) * rh
    for k in range(len(lines) + 1):
        heavy = k in (0, 1, len(lines) - 1, len(lines))
        ax.plot([x, x + lw + aw], [top - k * rh] * 2, color=INK, linewidth=1.6 if heavy else 0.8)
    for xx in (x, x + lw, x + lw + aw):
        ax.plot([xx, xx], [top, bottom], color=INK, linewidth=1.2)


def draw(p: dict):
    fig, ax = new_figure(10.0, 4.4)
    fig.subplots_adjust(left=0.01, right=0.99, bottom=0.01, top=0.99)
    n = max(len(p["money_in"]), len(p["money_out"]))
    top = 0.0
    _table(ax, 0.0, top, "Money in", p["money_in"], n)
    _table(ax, 6.8, top, "Money out", p["money_out"], n)
    ax.text(6.45, top + 0.55, title(p), ha="center", va="center", fontsize=13, fontweight="bold")
    bottom = top - (n + 2) * 0.62
    ax.set_xlim(-0.15, 13.05)
    ax.set_ylim(bottom - 0.15, top + 0.95)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

def _yes(n: int) -> str:
    return f"Yes. {fr(n)} Frw is left over."


def _no(n: int) -> str:
    return f"No. {fr(n)} Frw more is needed."


def _against(have: int, cost: int) -> str | None:
    """What a child says comparing the price with `have`."""
    return _yes(have - cost) if have > cost else _no(cost - have) if have < cost else None


def questions(p: dict, rng: random.Random) -> list:
    who, month = p["name"], p["month"]
    total_in = sum(a for _, a in p["money_in"])
    total_out = sum(a for _, a in p["money_out"])
    saved = total_in - total_out
    if p["owner"] == "family":
        lead = rng.choice([f"{who}'s family wrote this budget for {month}.",
                           f"{who}'s family planned its money for {month}."])
    elif p["owner"] == "pupil":
        lead = rng.choice([f"{who} wrote this budget for {month}.", f"{who} planned how to use money in {month}."])
    else:
        lead = rng.choice([f"{who} keeps the school garden club's budget for {month}.",
                           f"{who} wrote the garden club's budget for {month}."])
    item, cost = p["item"]
    key = _against(saved, cost)
    flipped = _no(saved - cost) if saved > cost else _yes(cost - saved)  # the right difference, the wrong answer
    slips = [flipped, _against(total_in, cost), _against(total_out, cost),
             (_yes(saved - cost + 1000) if saved > cost else _no(cost - saved + 1000))]  # a slip in the subtraction
    return [
        short(f"{lead} How much money comes in altogether in {month}?", total_in, money(total_in)),
        short(f"How much money goes out altogether in {month}?", total_out, money(total_out)),
        short(f"All the money left over in {month} is saved. How much money is saved?", saved, money(saved)),
        mcq(f"Is the money saved enough to buy {item} for {fr(cost)} Frw?", key, [s for s in slips if s], rng),
    ]
