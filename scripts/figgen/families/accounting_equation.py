"""The accounting equation (LS, UP), as Cambridge IGCSE Accounting 0452 (chapter 1), Rwanda's S4 Financial Accounting
book ("Accounting equation"), its S1 and S2 Entrepreneurship books ("Initiation to accounting", "The accounting
equation") and the NERDC Business Studies books set it: a Rwandan trader's assets on one side, liabilities and capital
on the other, one amount left as "?", the equation printed (Assets = Liabilities + Capital), and one transaction on
the next day.

LS: three or four assets, one or two liabilities; the owner takes cash, pays in more capital, buys goods on credit,
pays a supplier, buys equipment, borrows, or is paid by a customer. UP adds four to six assets and two transactions
that change capital by other than the amount: goods sold above cost for cash, and goods taken for the owner's use.

Asks the missing amount, and the owner's capital after the transaction (most transactions leave it as it was: the
slips are adding or taking off the amount).
"""
from __future__ import annotations

import random
import re

from ..core import NAMES, mcq, money, short
from ._accounts import MONTHS, SUPPLIERS, TOWNS, TRADES, YEARS, article, frw, page, rule
from .econ_tables import fit

ID = "accounting_equation"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("LS", "UP")
CONCEPTS = ("accounting.accounting-equation",)
ALSO = ("business.accounting-equation",)  # Rwanda's Entrepreneurship books and NERDC Business Studies teach it
# A topic whose sections the book lists is reached only if one names the equation, or assets, liabilities and capital
# together, or is Rwanda's S1 unit that starts accounting.
NEEDS = r"accounting equation|assets, liabilities and capital|initiation to accounting"
# Topics that carry the equation as a background concept but teach statements, ledgers or other organisations.
AVOID = (r"final accounts|compan|partnership|interpretation|trial balance|ledgers|control|club|incomplete|growth|"
         r"financial statements|journal|rules")

# (asset, lowest, highest, step); LS uses the first five.
ASSETS = [("Equipment", 200_000, 2_000_000, 10_000), ("Inventory", 100_000, 1_500_000, 5_000),
          ("Trade receivables", 50_000, 600_000, 5_000), ("Bank", 100_000, 1_500_000, 5_000), ("Cash", 20_000, 300_000, 1_000),
          ("Motor vehicle", 2_000_000, 9_000_000, 100_000), ("Furniture", 150_000, 900_000, 10_000)]
LIABILITIES = [("Trade payables", 50_000, 800_000, 5_000), ("Bank loan", 300_000, 3_000_000, 50_000)]
# What each transaction needs on the table.
NEEDS_ON = {"drawings_cash": ["Cash"], "capital_bank": ["Bank"], "buy_credit": ["Inventory", "Trade payables"],
            "pay_supplier": ["Bank", "Trade payables"], "buy_equipment": ["Equipment", "Bank"], "loan": ["Bank", "Bank loan"],
            "receive_debtor": ["Bank", "Trade receivables"], "sell_goods": ["Inventory", "Cash"], "goods_own_use": ["Inventory"]}
LS_EVENTS = ["drawings_cash", "capital_bank", "buy_credit", "pay_supplier", "buy_equipment", "loan", "receive_debtor"]
UP_EVENTS = LS_EVENTS + ["sell_goods", "goods_own_use", "sell_goods"]


def changes(kind: str, a: int, b: int) -> tuple[dict, dict]:
    """The change to each asset and each liability a transaction touches."""
    return {"drawings_cash": ({"Cash": -a}, {}), "capital_bank": ({"Bank": a}, {}),
            "buy_credit": ({"Inventory": a}, {"Trade payables": a}), "pay_supplier": ({"Bank": -a}, {"Trade payables": -a}),
            "buy_equipment": ({"Equipment": a, "Bank": -a}, {}), "loan": ({"Bank": a}, {"Bank loan": a}),
            "receive_debtor": ({"Bank": a, "Trade receivables": -a}, {}), "sell_goods": ({"Inventory": -a, "Cash": b}, {}),
            "goods_own_use": ({"Inventory": -a}, {})}[kind]


def sample(rng: random.Random) -> dict:
    band = rng.choice(["LS", "UP"])
    trade = rng.choice([t for t, _ in TRADES])
    town = rng.choice(TOWNS)
    year, month = rng.choice(YEARS), rng.randint(1, 12)
    while True:
        kind = rng.choice(LS_EVENTS if band == "LS" else UP_EVENTS)
        need = set(NEEDS_ON[kind])
        pool = ASSETS[:5] if band == "LS" else ASSETS
        n_assets = rng.randint(3, 4) if band == "LS" else rng.randint(4, 6)
        names = [a[0] for a in pool]
        chosen = [a for a in names if a in need]
        chosen += rng.sample([a for a in names if a not in chosen], max(0, n_assets - len(chosen)))
        assets = [[a[0], rng.randrange(a[1], a[2] + 1, a[3])] for a in pool if a[0] in chosen]
        n_liab = rng.randint(1, 2) if band == "LS" else 2
        liab_names = [x[0] for x in LIABILITIES if x[0] in need]
        if len(liab_names) < n_liab:
            liab_names += rng.sample([x[0] for x in LIABILITIES if x[0] not in liab_names], n_liab - len(liab_names))
        liabilities = [[x[0], rng.randrange(x[1], x[2] + 1, x[3])] for x in LIABILITIES if x[0] in liab_names]
        capital = sum(v for _, v in assets) - sum(v for _, v in liabilities)
        if capital < 100_000 or capital % 1_000:
            continue
        held = dict(assets) | dict(liabilities)
        b = 0
        if kind == "drawings_cash":
            a = rng.randrange(5_000, held["Cash"] // 2 + 1, 1_000)
        elif kind in ("pay_supplier", "receive_debtor"):
            limit = held["Trade payables" if kind == "pay_supplier" else "Trade receivables"]
            if kind == "pay_supplier":
                limit = min(limit, held["Bank"])
            a = rng.randrange(10_000, max(10_001, limit * 4 // 5), 5_000)
        elif kind == "buy_equipment":
            a = rng.randrange(20_000, max(20_001, held["Bank"] * 4 // 5), 5_000)
        elif kind in ("sell_goods", "goods_own_use"):
            a = rng.randrange(10_000, max(10_001, held["Inventory"] // 2), 5_000)
            b = a + rng.randrange(5_000, max(5_001, a * 3 // 5), 5_000) if kind == "sell_goods" else 0
        else:  # capital paid in, goods bought on credit, a further loan
            a = rng.randrange(20_000, 600_001, 5_000)
        da, dl = changes(kind, a, b)
        if any(held[k] + v < 0 for k, v in (da | dl).items()):
            continue
        parts = [("assets", i) for i in range(len(assets))] + [("liabilities", i) for i in range(len(liabilities))]
        blank = ["capital"] if rng.random() < 0.4 else list(rng.choice(parts))
        amounts = [v for _, v in assets + liabilities] + [capital]
        new_capital = capital + sum(da.values()) - sum(dl.values())
        if len(set(amounts)) < len(amounts) or new_capital in amounts and new_capital != capital or a in amounts:
            continue
        return {"band": band, "owner": rng.choice(NAMES), "trade": trade, "business": f"{article(trade)} {trade} in {town}",
                "town": town, "year": year, "month": month, "day": rng.randint(1, 25), "assets": assets,
                "liabilities": liabilities, "capital": capital, "blank": blank, "event": [kind, a, b],
                "supplier": rng.choice(SUPPLIERS)}


def _date(p: dict, plus: int = 0) -> str:
    return f"{p['day'] + plus} {MONTHS[p['month'] - 1]} {p['year']}"


def _of(name: str) -> str:
    return name + ("'" if name.endswith("s") else "'s")


def event_text(p: dict) -> str:
    kind, a, b = p["event"]
    owner, on = p["owner"], f"On {_date(p, 1)}"
    amount = f"{frw(a)} Frw"
    return {"drawings_cash": f"{on}, {owner} takes {amount} from the business's cash for personal use.",
            "capital_bank": f"{on}, {owner} pays {amount} of personal savings into the business's bank account.",
            "buy_credit": f"{on}, the business buys goods for resale costing {amount} on credit from {p['supplier']}.",
            "pay_supplier": f"{on}, the business pays {amount} by bank to {p['supplier']}, a credit supplier.",
            "buy_equipment": f"{on}, the business buys equipment for {amount}, paying by bank.",
            "loan": f"{on}, the business borrows a further {amount} from its bank; the money is paid into its bank account.",
            "receive_debtor": f"{on}, a credit customer pays the business {amount} by bank.",
            "sell_goods": f"{on}, the business sells goods that cost {amount} for {frw(b)} Frw in cash.",
            "goods_own_use": f"{on}, {owner} takes goods costing {amount} from the business's inventory for personal use."}[kind]


FS, X0, ROW = 10, 0.14, 0.3


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
    name_w, amt_w, gap = 1.9, 1.15, 0.3
    side = name_w + amt_w
    width = 2 * X0 + 2 * side + gap
    blank = p["blank"]
    left = [(n, "?" if blank == ["assets", i] else frw(v)) for i, (n, v) in enumerate(p["assets"])]
    right = [(n, "?" if blank == ["liabilities", i] else frw(v)) for i, (n, v) in enumerate(p["liabilities"])]
    right_rows = len(right) + 2  # the liabilities, the heading for capital, and capital
    rows = max(len(left), right_rows)
    event = _wrap(f"Transaction: {event_text(p)}", width - 2 * X0 - 0.3)
    height = 1.88 + rows * ROW + len(event) * 0.27
    fig, ax = page(width, height)
    top = height - 0.1
    trade = p["trade"]
    ax.text(width / 2, top, f"{_of(p['owner'])} {trade}, {p['town']}", ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Assets, liabilities and capital at {_date(p)}", ha="center", va="top", fontsize=10.5)
    head = top - 0.74
    xl, xr = X0, X0 + side + gap
    for x, word in ((xl, "Assets"), (xr, "Liabilities")):
        ax.text(x + 0.08, head - 0.18, word, ha="left", va="center", fontsize=FS, fontweight="bold")
        ax.text(x + side - 0.1, head - 0.18, "Frw", ha="right", va="center", fontsize=FS, fontweight="bold")
        rule(ax, x, x + side, head, width=0.9)
        rule(ax, x, x + side, head - 0.36, width=0.9)
    first = head - 0.36

    def line(x, i, label, value, bold=False):
        y = first - (i + 0.5) * ROW
        ax.text(x + 0.08, y, label, ha="left", va="center", fontsize=FS, fontweight="bold" if bold else "normal")
        if value is not None:
            ax.text(x + side - 0.1, y, value, ha="right", va="center", fontsize=FS,
                    fontweight="bold" if value == "?" else "normal")

    for i, (n, v) in enumerate(left):
        line(xl, i, n, v)
    for i, (n, v) in enumerate(right):
        line(xr, i, n, v)
    line(xr, len(right), "Capital", None, bold=True)
    line(xr, len(right) + 1, f"{p['owner']}'s capital" if not p["owner"].endswith("s") else f"{p['owner']}' capital",
         "?" if blank == ["capital"] else frw(p["capital"]))
    bottom = first - rows * ROW - 0.06
    for x in (xl, xr):
        rule(ax, x, x + side, bottom, width=0.9)
        for xx in (x, x + side):
            ax.plot([xx, xx], [head, bottom], color="#111111", linewidth=0.9)
    ax.text(width / 2, bottom - 0.12, "Assets = Liabilities + Capital", ha="center", va="top", fontsize=10.5,
            fontweight="bold")
    y = bottom - 0.54
    for k, text in enumerate(event):
        ax.text(X0 + 0.15, y - k * 0.27, text, ha="left", va="top", fontsize=FS, style="italic")
    return fig


INTRO = ["owns", "runs", "has", "is the owner of"]


def questions(p: dict, rng: random.Random) -> list:
    owner = p["owner"]
    kind, a, b = p["event"]
    capital = p["capital"]
    da, dl = changes(kind, a, b)
    new_capital = capital + sum(da.values()) - sum(dl.values())
    blank = p["blank"]
    if blank == ["capital"]:
        item, missing = "capital", capital
    else:
        item, missing = p[blank[0]][blank[1]]
        item = item.lower()
    # the slips: capital left as it was, or moved by the amount (or twice it) the wrong way; four steps of the amount
    # in a row, the key at any place among them, so the middle option is not the answer by habit
    if kind == "sell_goods":
        wrong = [capital, capital + b, capital - a]
    else:
        k = (new_capital - capital) // a
        start = k - rng.randrange(4)
        if capital + start * a <= 0:
            start = k
        wrong = [capital + j * a for j in range(start, start + 4) if j != k]
    return [short(f"{owner} {rng.choice(INTRO)} {p['business']}. Using the accounting equation, what is the missing "
                  f"figure for {item} at {_date(p)}?", missing, money(missing)),
            mcq(f"What is {_of(owner)} capital after the transaction on {_date(p, 1)} shown under the table?",
                f"{frw(new_capital)} Frw", [f"{frw(v)} Frw" for v in wrong if v > 0 and v != new_capital], rng)]
