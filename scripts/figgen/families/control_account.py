"""A sales or purchases ledger control account (UP; the same at AS Level), as Cambridge IGCSE Accounting 0452 (chapter
16), AS 9706 (chapter 14), Rwanda's S4 Financial Accounting book and the WAEC, NERDC and JAMB syllabuses set it.
Two forms:

- the account itself, a T with Dr and Cr sides and Date, Details and Frw columns: the balance b/d on the 1st and the
  month's totals posted on its last day, with the balancing left to the student;
- the information an exam question gives: the month's totals from the books of prime entry and the cash book, listed
  without their sides, sometimes with cash sales (or cash purchases), which do not belong in the account at all.

Sales ledger control: the opening debit balance, credit sales, a dishonoured cheque or interest charged (debit);
receipts, discounts allowed, sales returns, irrecoverable debts and a contra with the purchases ledger (credit).
Purchases ledger control: the opening credit balance and credit purchases (credit); payments, discounts received,
purchases returns and a contra with the sales ledger (debit).

Asks the balance carried down at the month's end, and the side and amount of the balance brought down on the 1st of
the next month (two sides by two amounts: the right total, and the total with the usual slip -- cash sales let in, the
contra on the wrong side, or the opening balance left out).
"""
from __future__ import annotations

import calendar
import random

from ..core import GRID, INK, NAMES, mcq, money, short
from ._accounts import MONTHS, PLACES, SHORT_MONTHS, TOWNS, TRADES, YEARS, article, frw, page, rule
from .econ_tables import fit

ID = "control_account"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # Cambridge AS Level chapter 14, "Control accounts", draws the same account
# NERDC SS3 "Control accounts" carries books of prime entry (the totals come from them) but not control accounts.
CONCEPTS = ("accounting.control-accounts", "accounting.books-of-prime-entry")
NEEDS = r"control accounts?"
# Only a topic named for control accounts: books of prime entry is a broad concept, and the NERDC, JAMB and WAEC topics
# list no sections for NEEDS to judge. (Read: avoid every topic whose name does not say "control account".)
AVOID = r"^(?!.*control account)"

# code -> (side, the account's details, the information's line)
SALES = {
    "opening": ("Dr", "Balance b/d", "Trade receivables on the 1st (debit balance)"),
    "credit_sales": ("Dr", "Sales", "Credit sales"),
    "dishonoured": ("Dr", "Bank (dishonoured cheque)", "A customer's cheque dishonoured by the bank"),
    "interest": ("Dr", "Interest charged", "Interest charged on overdue customer accounts"),
    "receipts": ("Cr", "Bank", "Cash and cheques received from credit customers"),
    "discounts_allowed": ("Cr", "Discount allowed", "Discounts allowed"),
    "sales_returns": ("Cr", "Sales returns", "Sales returns"),
    "irrecoverable": ("Cr", "Irrecoverable debts", "Irrecoverable debts written off"),
    "contra": ("Cr", "Purchases ledger control", "Contra: set off against the purchases ledger"),
    "cash_sales": (None, None, "Cash sales"),
}
PURCHASES = {
    "opening": ("Cr", "Balance b/d", "Trade payables on the 1st (credit balance)"),
    "credit_purchases": ("Cr", "Purchases", "Credit purchases"),
    "payments": ("Dr", "Bank", "Payments to credit suppliers"),
    "discounts_received": ("Dr", "Discount received", "Discounts received"),
    "purchases_returns": ("Dr", "Purchases returns", "Purchases returns"),
    "contra": ("Dr", "Sales ledger control", "Contra: set off against the sales ledger"),
    "cash_purchases": (None, None, "Cash purchases"),
}
TABLE = {"sales": SALES, "purchases": PURCHASES}
NAME = {"sales": "sales ledger control account", "purchases": "purchases ledger control account"}


def _items(rng, kind: str, form: str) -> list:
    r = lambda lo, hi, step: rng.randrange(lo, hi + 1, step)  # noqa: E731
    opening = r(100_000, 1_500_000, 5_000)
    flow = r(400_000, 3_000_000, 10_000)
    settled = round((opening + flow) * rng.uniform(0.6, 0.88) / 1_000) * 1_000
    out = [["opening", opening]]
    if kind == "sales":
        out += [["credit_sales", flow], ["receipts", settled]]
        if rng.random() < 0.8:
            out.append(["discounts_allowed", max(1_000, round(settled * rng.uniform(0.01, 0.03) / 500) * 500)])
        if rng.random() < 0.8:
            out.append(["sales_returns", max(1_000, round(flow * rng.uniform(0.02, 0.06) / 500) * 500)])
        out.append(["irrecoverable", r(5_000, 60_000, 500)])
        out.append(["contra", r(5_000, 80_000, 500)])
        if rng.random() < 0.3:
            out.append(["dishonoured", r(10_000, 90_000, 1_000)])
        if rng.random() < 0.15:
            out.append(["interest", r(1_000, 8_000, 100)])
        cash = "cash_sales"
    else:
        out += [["credit_purchases", flow], ["payments", settled]]
        if rng.random() < 0.8:
            out.append(["discounts_received", max(1_000, round(settled * rng.uniform(0.01, 0.03) / 500) * 500)])
        if rng.random() < 0.8:
            out.append(["purchases_returns", max(1_000, round(flow * rng.uniform(0.02, 0.06) / 500) * 500)])
        out.append(["contra", r(5_000, 80_000, 500)])
        cash = "cash_purchases"
    if form == "list" and rng.random() < 0.5:
        out.insert(rng.randrange(1, len(out) + 1), [cash, r(100_000, 900_000, 5_000)])
    return out


def _balance(p: dict) -> int:
    t = TABLE[p["kind"]]
    dr = sum(a for _, c, a in p["items"] if t[c][0] == "Dr")
    cr = sum(a for _, c, a in p["items"] if t[c][0] == "Cr")
    return dr - cr if p["kind"] == "sales" else cr - dr


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["sales", "purchases"])
    form = rng.choice(["account", "list"])
    trade, word = rng.choice([t for t in TRADES if t[0] not in ("hair salon", "restaurant")])
    town = rng.choice(TOWNS)
    place = rng.choice(PLACES) if town == "Kigali" else town
    year, month = rng.choice(YEARS), rng.randint(1, 12)
    last = calendar.monthrange(year, month)[1]
    while True:
        items = [[1 if c == "opening" else last, c, a] for c, a in _items(rng, kind, form)]
        p = {"band": "UP", "kind": kind, "form": form, "trader": f"{place} {word}",
             "business": f"{article(trade)} {trade} in {town}", "year": year, "month": month, "items": items}
        bal = _balance(p)
        amounts = [a for _, _, a in items]
        if bal < 20_000 or len(set(amounts)) < len(amounts) or bal in amounts or _slip(p) in amounts + [bal]:
            continue
        return p


def _slip(p: dict) -> int:
    """The balance with the usual slip: cash sales let in, else the opening balance left out, else the contra on the
    wrong side."""
    bal = _balance(p)
    got = {c: a for _, c, a in p["items"]}
    cash = got.get("cash_sales") or got.get("cash_purchases")
    if cash:
        return bal + cash
    if p["form"] == "account" and bal - got["opening"] > 0:
        return bal - got["opening"]
    return bal + 2 * got["contra"]


COLS = (0.62, 2.2, 1.0)
SIDE_W = sum(COLS)
X0, ROW, FS = 0.12, 0.28, 10


def _account(p: dict):
    t = TABLE[p["kind"]]
    debits = [(d, t[c][1], a) for d, c, a in p["items"] if t[c][0] == "Dr"]
    credits = [(d, t[c][1], a) for d, c, a in p["items"] if t[c][0] == "Cr"]
    cols = (COLS[0], max(COLS[1], fit(*(e[1] for e in debits + credits), size=FS, bold=False, pad=0.25)), COLS[2])
    side_w = sum(cols)
    rows = max(len(debits), len(credits)) + 2
    width = 2 * X0 + 2 * side_w
    height = (rows + 2) * ROW + 0.92
    fig, ax = page(width, height)
    xc = X0 + side_w
    top = height - 0.12
    ax.text(width / 2, top, p["trader"], ha="center", va="top", fontsize=10, style="italic", color="#444444")
    top -= 0.3
    ax.text(width / 2, top, NAME[p["kind"]].capitalize(), ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(X0, top, "Dr", ha="left", va="top", fontsize=11, fontweight="bold")
    ax.text(width - X0, top, "Cr", ha="right", va="top", fontsize=11, fontweight="bold")
    t_line = top - 0.42
    bottom = t_line - (rows + 2) * ROW
    mon = SHORT_MONTHS[p["month"] - 1]
    for side_x, entries in ((X0, debits), (xc, credits)):
        x = side_x
        for w in cols[:-1]:
            x += w
            ax.plot([x, x], [t_line, bottom], color=GRID, linewidth=0.8)
        y = t_line - ROW / 2
        ax.text(side_x + 0.06, y, "Date", ha="left", va="center", fontsize=9.5, fontweight="bold")
        ax.text(side_x + cols[0] + 0.08, y, "Details", ha="left", va="center", fontsize=9.5, fontweight="bold")
        ax.text(side_x + side_w - 0.12, y, "Frw", ha="right", va="center", fontsize=9.5, fontweight="bold")
        ax.text(side_x + 0.06, y - ROW, str(p["year"]), ha="left", va="center", fontsize=FS)
        for i, (day, detail, amount) in enumerate(entries):
            y = t_line - (i + 2.5) * ROW
            ax.text(side_x + 0.06, y, f"{mon} {day}" if i == 0 else str(day), ha="left", va="center", fontsize=FS)
            ax.text(side_x + cols[0] + 0.08, y, detail, ha="left", va="center", fontsize=FS)
            ax.text(side_x + side_w - 0.12, y, frw(amount), ha="right", va="center", fontsize=FS)
    rule(ax, X0, width - X0, t_line - ROW, width=0.6, colour="#666666")
    ax.plot([X0, width - X0], [t_line, t_line], color=INK, linewidth=1.8, solid_capstyle="butt")
    ax.plot([xc, xc], [t_line, bottom], color=INK, linewidth=1.8, solid_capstyle="butt")
    return fig


def _list(p: dict):
    t = TABLE[p["kind"]]
    month = f"{MONTHS[p['month'] - 1]} {p['year']}"
    lines = [t[c][2].replace("on the 1st", f"on 1 {MONTHS[p['month'] - 1]}") for _, c, _ in p["items"]]
    desc_w = fit(*lines, size=FS, bold=False, least=4.2, pad=0.4)
    amt_w = 1.3
    width = 2 * X0 + desc_w + amt_w
    height = 1.52 + len(lines) * 0.3
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, p["trader"], ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Information for the {NAME[p['kind']]}, {month}", ha="center", va="top", fontsize=10.5)
    ax.text(width / 2, top - 0.56, "Totals for the month, from the books of prime entry and the cash book", ha="center",
            va="top", fontsize=9.5, style="italic", color="#333333")
    head = top - 0.92
    ax.text(X0 + 0.08, head - 0.15, "Details", ha="left", va="center", fontsize=FS, fontweight="bold")
    ax.text(width - X0 - 0.1, head - 0.15, "Frw", ha="right", va="center", fontsize=FS, fontweight="bold")
    rule(ax, X0, width - X0, head, width=0.9)
    rule(ax, X0, width - X0, head - 0.3, width=0.9)
    for i, (line, (_, _, amount)) in enumerate(zip(lines, p["items"])):
        y = head - 0.3 - (i + 0.5) * 0.3
        ax.text(X0 + 0.08, y, line, ha="left", va="center", fontsize=FS)
        ax.text(width - X0 - 0.1, y, frw(amount), ha="right", va="center", fontsize=FS)
    bottom = head - 0.3 - len(lines) * 0.3 - 0.08
    rule(ax, X0, width - X0, bottom, width=0.9)
    for x in (X0, X0 + desc_w, width - X0):
        ax.plot([x, x], [head, bottom], color=INK if x != X0 + desc_w else GRID, linewidth=0.9)
    return fig


def draw(p: dict):
    return _account(p) if p["form"] == "account" else _list(p)


def _of(name: str) -> str:
    """A business's possessive: "Huye Bakery's", "Huye Tailors'"."""
    return name + ("'" if name.endswith("s") else "'s")


VERBS = ["keeps the books of", "is the bookkeeper at", "is the accounts clerk at", "does the bookkeeping for"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    name, trader = NAME[p["kind"]], p["trader"]
    month, year = MONTHS[p["month"] - 1], p["year"]
    last = calendar.monthrange(year, p["month"])[1]
    nm, ny = MONTHS[p["month"] % 12], year + (p["month"] == 12)
    bal, slip = _balance(p), _slip(p)
    side = "Debit" if p["kind"] == "sales" else "Credit"
    other = "Credit" if side == "Debit" else "Debit"
    how = " from the information shown" if p["form"] == "list" else ""
    return [short(f"{who} {rng.choice(VERBS)} {trader}, {p['business']}, and prepares the {name} for {month} {year}"
                  f"{how}. What is the balance carried down on {last} {month} {year}?", bal, money(bal)),
            mcq(f"On 1 {nm} {ny}, the balance of {_of(trader)} {name} is brought down. On which side is it entered, and for "
                "how much?", f"{side}, {frw(bal)} Frw",
                [f"{other}, {frw(bal)} Frw", f"{side}, {frw(slip)} Frw", f"{other}, {frw(slip)} Frw"], rng)]
