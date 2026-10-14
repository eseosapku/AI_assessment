"""Cash flow forecasts (UP): four months of a Rwandan business's receipts and payments, laid out as Cambridge IGCSE
Business 0450 lays a forecast out: two or three lines of receipts and their total, two to four lines of payments and
their total, then the net cash flow, the opening balance and the closing balance, in francs. Some cells are "?". A
negative amount is shown in brackets or with a minus sign, and the figure says which (the sub-types).

A month's net cash flow (a "?" cell), a closing balance (a "?" cell, with the next month's opening balance also "?",
so it is worked out, not read off), and the first month whose closing balance is negative (MCQ). That month is never
the first, and a net cash flow goes negative before it, so a student who reads the net cash flow for the balance
picks a wrong month.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, money, new_figure, short

ID = "cash_flow_forecast"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("UP",)
CONCEPTS = ("business.budgeting-and-forecasting",)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"cash.?flow|forecast|budget|working capital"
ALSO = ("accounting.budget-preparation",)

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
# (the business, its scale in tens of thousands of francs a month of cash sales, its second receipt, what it buys,
# a one-off it pays for)
BUSINESSES = [
    ("a bakery in Huye", (40, 80), "Payments from schools", "Flour and sugar", "New oven"),
    ("a tailoring shop in Kigali", (30, 70), "School uniform orders", "Cloth and thread", "Sewing machines"),
    ("a hardware shop in Musanze", (60, 120), "Credit sales received", "Goods for resale", "Delivery motorbike"),
    ("a hair salon in Rubavu", (30, 60), "Sales of hair products", "Hair products", "New dryers"),
    ("a printing shop in Muhanga", (40, 90), "Credit sales received", "Paper and ink", "New printer"),
    ("a poultry farm in Nyagatare", (40, 90), "Egg sales to hotels", "Chicken feed", "New chicken house"),
    ("a juice stall in Rusizi", (20, 50), "Orders for events", "Fruit", "New blender"),
    ("a furniture workshop in Rwamagana", (50, 110), "Deposits on orders", "Timber", "Power saw"),
]
THIRD = ["Bank loan", "Owner's capital", "Cooperative grant"]
ROWS = ["total_receipts", "total_payments", "net", "opening", "closing"]
TEN_K = 10_000


def _balances(p: dict) -> dict:
    rec = [sum(line[1][m] for line in p["receipts"]) for m in range(4)]
    pay = [sum(line[1][m] for line in p["payments"]) for m in range(4)]
    net = [r - q for r, q in zip(rec, pay)]
    opening, closing, bal = [], [], p["opening"]
    for m in range(4):
        opening.append(bal)
        bal += net[m]
        closing.append(bal)
    return {"total_receipts": rec, "total_payments": pay, "net": net, "opening": opening, "closing": closing}


def sample(rng: random.Random) -> dict:
    business, (lo, hi), second, stuff, one_off = rng.choice(BUSINESSES)
    start = rng.randrange(9)  # four months inside one year
    while True:
        base = rng.randint(lo, hi)
        sales = [max(5, base + rng.randint(-12, 12)) for _ in range(4)]
        receipts = [["Cash sales", sales], [second, [rng.randint(2, max(3, base // 3)) for _ in range(4)]]]
        if rng.random() < 0.4:  # a loan or capital paid in once
            m = rng.randrange(1, 4)
            receipts.append([rng.choice(THIRD), [rng.randint(10, 40) if k == m else 0 for k in range(4)]])
        ratio = rng.uniform(0.45, 0.7)
        payments = [[stuff, [max(2, round(s * ratio) + rng.randint(-3, 3)) for s in sales]],
                    ["Wages", [rng.randint(base // 5, base // 3)] * 4]]
        if rng.random() < 0.6:
            payments.append(["Rent", [rng.randint(3, max(4, base // 6))] * 4])
        if rng.random() < 0.7:  # a one-off purchase that takes the balance down
            m = rng.randrange(1, 4)
            payments.append([one_off, [rng.randint(base // 2, base) if k == m else 0 for k in range(4)]])
        p = {"band": "UP", "business": business, "start": start, "months": [MONTHS[start + k] for k in range(4)],
             "receipts": [[n, [v * TEN_K for v in vs]] for n, vs in receipts],
             "payments": [[n, [v * TEN_K for v in vs]] for n, vs in payments],
             "opening": rng.randint(3, 30) * TEN_K, "negative": rng.choice(["brackets", "minus"])}
        f = _balances(p)
        if 0 in f["closing"] or 0 in f["net"]:
            continue
        neg = [k for k in range(4) if f["closing"][k] < 0]
        if not neg or neg[0] == 0:
            continue
        first = neg[0]
        if min((k for k in range(4) if f["net"][k] < 0), default=4) >= first:
            continue  # the balance takes a fall it can bear before the one it cannot
        if max(abs(v) for row in f.values() for v in row) >= 10_000_000:
            continue
        a, b = rng.sample(range(4), 2)
        blanks = [["net", a], ["closing", b]] + ([["opening", b + 1]] if b < 3 else [])
        if rng.random() < 0.5:
            blanks.append([rng.choice(["total_receipts", "total_payments"]), a])
        p["blanks"] = sorted(blanks)
        p["ask"] = [a, b]
        return p


def fmt(v: int, style: str) -> str:
    """An amount as the forecast prints it: "1 250 000", "(40 000)" or "−40 000"."""
    s = f"{abs(v):,}".replace(",", " ")
    if v >= 0:
        return s
    return f"({s})" if style == "brackets" else f"−{s}"


def draw(p: dict):
    f = _balances(p)
    blanks = {tuple(b) for b in p["blanks"]}
    lines = [("head", "Receipts", None, None)]
    lines += [("line", n, f"receipt{i}", vs) for i, (n, vs) in enumerate(p["receipts"])]
    lines += [("total", "Total receipts", "total_receipts", None), ("head", "Payments", None, None)]
    lines += [("line", n, f"payment{i}", vs) for i, (n, vs) in enumerate(p["payments"])]
    lines += [("total", "Total payments", "total_payments", None), ("total", "Net cash flow", "net", None),
              ("line", "Opening balance", "opening", None), ("total", "Closing balance", "closing", None)]
    lw, cw, rh = 4.4, 2.0, 0.5
    width = lw + 4 * cw
    top = (len(lines) + 1) * rh
    fig, ax = new_figure(8.6, 0.42 * (len(lines) + 4))
    style = p["negative"]
    ax.text(0, top + 1.05, f"Cash flow forecast for {p['business']}, {p['months'][0]} to {p['months'][-1]}",
            ha="left", va="center", fontsize=11.5, fontweight="bold")
    note = ("All amounts in Frw. Figures in brackets are negative." if style == "brackets"
            else "All amounts in Frw. A minus sign (−) shows a negative amount.")
    ax.text(0, top + 0.45, note, ha="left", va="center", fontsize=9.5, style="italic", color="#333333")
    # the months across the top
    ax.add_patch(Rectangle((0, top - rh), lw, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
    for k, month in enumerate(p["months"]):
        x = lw + k * cw
        ax.add_patch(Rectangle((x, top - rh), cw, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
        ax.text(x + cw / 2, top - rh / 2, month, ha="center", va="center", fontsize=10, fontweight="bold")
    for r, (kind, label, key, values) in enumerate(lines):
        y = top - (r + 2) * rh
        bold = "bold" if kind in ("total", "head") else "normal"
        shade = "#f2f3f4" if kind == "total" else "white"
        ax.add_patch(Rectangle((0, y), lw, rh, facecolor=shade, edgecolor="#888888", linewidth=0.7))
        ax.text(0.15 if kind != "line" else 0.45, y + rh / 2, label, ha="left", va="center", fontsize=10, fontweight=bold,
                style="italic" if kind == "head" else "normal")
        for k in range(4):
            x = lw + k * cw
            ax.add_patch(Rectangle((x, y), cw, rh, facecolor=shade, edgecolor="#888888", linewidth=0.7))
            if kind == "head":
                continue
            v = values[k] if values is not None else f[key][k]
            blank = (key, k) in blanks
            ax.text(x + cw / 2 if blank else x + cw - 0.15, y + rh / 2, "?" if blank else fmt(v, style),
                    ha="center" if blank else "right", va="center", fontsize=10, fontweight="bold" if blank else bold,
                    gid=f"cell:{key}:{k}")
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(top - (len(lines) + 1) * rh - 0.05, top + 1.35)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["prepares", "draws up", "is checking", "is completing", "writes out"]
SETTINGS = ["before asking a bank for a loan", "for a business plan", "for a meeting with the owners",
            "for the business's accountant", "to plan the next four months", "for a business studies project"]


def cash_forms(n: int) -> list[str]:
    """Every fair way to write an amount of francs; a negative one with a minus sign or in brackets."""
    if n >= 0:
        return money(n)
    a = abs(n)
    nums = [str(a)] + ([f"{a:,}", f"{a:,}".replace(",", " ")] if a >= 1000 else [])
    forms = [str(n)]
    for x in nums:
        for shown in (f"-{x}", f"−{x}", f"({x})"):
            for unit in ("", " Frw", " RWF", " francs"):
                if shown + unit not in forms:
                    forms.append(shown + unit)
            if f"Frw {shown}" not in forms:
                forms.append(f"Frw {shown}")
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    f = _balances(p)
    a, b = p["ask"]
    months = p["months"]
    how = "in brackets" if p["negative"] == "brackets" else "with a minus sign"
    first = next(k for k in range(4) if f["closing"][k] < 0)
    net, close = f["net"][a], f["closing"][b]
    second = rng.choice([f"{friend} checks the forecast. What is the closing balance for {months[b]}, in Frw?",
                         f"What is the closing balance for {months[b]}, in Frw?",
                         f"{friend} fills in the missing cells. What should the closing balance for {months[b]} be, in Frw?"])
    return [
        short(f"{who} {rng.choice(VERBS)} this cash flow forecast for {p['business']} {rng.choice(SETTINGS)}. "
              f"What is the net cash flow for {months[a]}, in Frw? Write a negative amount {how}.", net, cash_forms(net)),
        short(f"{second} Write a negative amount {how}.", close, cash_forms(close)),
        mcq(rng.choice(["In which month is the closing balance negative for the first time?",
                        "In which month does the closing balance first fall below zero?",
                        f"{friend} wants to know when the business first runs short of cash. In which month is the "
                        f"closing balance negative for the first time?"]),
            months[first], [m for m in months if m != months[first]], rng),
    ]
