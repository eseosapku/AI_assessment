"""Credit creation by commercial banks (UP), as the JAMB, WAEC and Rwanda S5 books teach money and banking.

Two sub-types:
- rounds: a first deposit at Bank A, which keeps the reserve ratio printed above the table (10%, 20% or 25%) and lends
  the rest; the loan is spent and deposited at Bank B, and so on, three or four banks shown with one cell marked "?".
  Asks the credit multiplier (1 ÷ reserve ratio, stated), the total deposits created when the process runs to the end
  (first deposit × multiplier) or the credit created (that total less the first deposit), the cell marked "?", and the
  loan or reserves of the next bank, after the last one shown, so that no answer is only read from the table.
- balance: a commercial bank's balance sheet (customers' deposits, shareholders' capital and retained profits against
  cash in tills, its balance at the central bank, loans, government bonds and premises), totals printed and one item
  marked "?". Asks the missing item (total assets = total liabilities), the cash reserve ratio and the excess reserves
  above the central bank's required ratio, each with its formula stated.

Every amount is whole: each first deposit is a multiple of the power of the reserve ratio's denominator it needs.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, money, short
from .econ_tables import frw, sheet, table, fit, titled_table

ID = "credit_creation"
KIND = "table.data"
SUBJECT = "economics"
BANDS = ("UP",)
CONCEPTS = ("economics.banking-institutions", "economics.money-supply", "economics.money")
# A topic whose sections the book lists is reached only if its name or a section names banks, credit or money supply.
NEEDS = r"\bbank|credit|money supply|financial institution|^money$"
# S5 "Inflation" names money supply in a section on when it does not cause inflation, and works no bank's table.
AVOID = r"nigeria|inflation"

FIRST = [100000, 200000, 400000, 500000, 640000, 800000, 1000000, 1280000, 2000000, 2560000, 5000000]
BANKS = "ABCDE"
TOWNS = ["Kigali", "Huye", "Musanze", "Rubavu", "Nyagatare", "Muhanga"]


def _whole(first: int, r: int, n: int) -> bool:
    """Whether every deposit, reserve and loan up to the bank after the n shown is whole."""
    return all((Fraction(first) * Fraction(100 - r, 100) ** k * Fraction(r, 100)).denominator == 1 and
               (Fraction(first) * Fraction(100 - r, 100) ** (k + 1)).denominator == 1 for k in range(n + 1))


def _rows(first: int, r: int, n: int) -> list[list[int]]:
    """Deposit, reserves kept and loan made at each bank, n + 1 of them (the last is not shown)."""
    out, dep = [], Fraction(first)
    for _ in range(n + 1):
        kept = dep * r / 100
        out.append([int(dep), int(kept), int(dep - kept)])
        dep -= kept
    return out


def _rounds(rng: random.Random) -> dict:
    r, n = rng.choice([10, 20, 25]), rng.choice([3, 4])
    first = rng.choice([f for f in FIRST if _whole(f, r, n)])
    return {"band": "UP", "kind": "rounds", "ratio": r, "initial": first, "rows": n,
            "blank": [rng.randint(1, n - 1), rng.randint(0, 2)], "total": rng.choice(["deposits", "credit"]),
            "next": rng.choice(["loan", "reserves"])}


def _balance(rng: random.Random) -> dict:
    while True:
        deposits = 10 * rng.randint(30, 90)
        req = rng.choice([5, 8, 10, 12])
        crr = rng.randint(10 * req + 20, 10 * req + 90)  # tenths of a per cent
        reserves = Fraction(deposits * crr, 1000)
        excess = reserves - Fraction(req * deposits, 100)
        if reserves.denominator != 1 or excess.denominator != 1 or excess <= 0:
            continue
        reserves = int(reserves)
        cash = rng.randint(reserves * 3 // 10, reserves * 6 // 10)
        capital, retained = rng.randint(40, 120), rng.randint(20, 80)
        total = deposits + capital + retained
        loans = rng.randint(total * 55 // 100, total * 70 // 100)
        bonds = rng.randint(total * 8 // 100, total * 15 // 100)
        premises = total - reserves - loans - bonds
        items = {"deposits": deposits, "capital": capital, "retained": retained, "cash": cash,
                 "central": reserves - cash, "loans": loans, "bonds": bonds, "premises": premises}
        if premises < 5 or len(set(items.values())) < len(items):
            continue
        return {"band": "UP", "kind": "balance", "items": items, "req": req, "town": rng.choice(TOWNS),
                "blank": rng.choice(["capital", "retained", "loans", "bonds", "premises"])}


def sample(rng: random.Random) -> dict:
    return _rounds(rng) if rng.random() < 0.5 else _balance(rng)


LIABILITIES = [("deposits", "Customers' deposits"), ("capital", "Shareholders' capital"), ("retained", "Retained profits")]
ASSETS = [("cash", "Cash in tills"), ("central", "Balance at the central bank"), ("loans", "Loans to customers"),
          ("bonds", "Government bonds"), ("premises", "Premises and equipment")]


def draw(p: dict):
    if p["kind"] == "rounds":
        r, n = p["ratio"], p["rows"]
        rows = _rows(p["initial"], r, n)[:n]
        body = [[f"Bank {BANKS[i]}"] + ["?" if [i, j] == p["blank"] else frw(v) for j, v in enumerate(row)]
                for i, row in enumerate(rows)]
        body.append(["… and so on", "", "", ""])
        heads = ["Bank", "New deposit\n(Frw)", "Reserves kept\n(Frw)", "Loan made\n(Frw)"]
        return titled_table("How banks create credit", heads, body, ["l", "r", "r", "r"],
                            [f"Reserve ratio: {r}%   (credit multiplier = 1 ÷ reserve ratio)"], least=1.3)
    it = p["items"]
    total = sum(it[k] for k, _ in LIABILITIES)
    shown = lambda k: "?" if k == p["blank"] else frw(it[k])  # noqa: E731
    body = []
    for i in range(len(ASSETS)):
        left = [LIABILITIES[i][1], shown(LIABILITIES[i][0])] if i < len(LIABILITIES) else ["", ""]
        body.append(left + [ASSETS[i][1], shown(ASSETS[i][0])])
    body.append(["Total", frw(total), "Total", frw(total)])
    heads = ["Liabilities", "Frw billion", "Assets", "Frw billion"]
    rows = [[str(v) for v in r] for r in body]
    widths = [fit(h, *(r[j] for r in rows), least=1.2) for j, h in enumerate(heads)]
    width = sum(widths)
    fig, ax = sheet(width, 0.41 + 0.56 + 0.36 * len(rows))
    ax.text(width / 2, -0.17, f"Balance sheet of a commercial bank in {p['town']}", ha="center", va="center",
            fontsize=10.5, fontweight="bold")
    table(ax, heads, rows, widths, top=-0.41, align=["l", "r", "l", "r"])
    return fig


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]
LEND = "The banks keep the reserve ratio shown and lend the rest."


def _billions(v) -> list[str]:
    s = f"{float(v):.1f}".rstrip("0").rstrip(".")
    return [s, f"{s} billion", f"{s} billion Frw", f"Frw {s} billion", f"{s} bn"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "rounds":
        r, n, first = p["ratio"], p["rows"], p["initial"]
        rows = _rows(first, r, n)
        mult = 100 // r
        opening = f"{who} {rng.choice(VERBS)} this table of how banks create credit {rng.choice(SETTINGS)}. "
        if p["total"] == "deposits":
            total = short("Total deposits created = first deposit × credit multiplier, where credit multiplier = 1 ÷ reserve "
                          "ratio. When the process runs to the end, what total deposits are created, in Frw?",
                          first * mult, money(first * mult))
        else:
            made = first * mult - first
            total = short("The credit created = total deposits created − the first deposit, where total deposits created = "
                          "first deposit × (1 ÷ reserve ratio). When the process runs to the end, how much credit is "
                          "created, in Frw?", made, money(made))
        i, j = p["blank"]
        nxt = BANKS[n]
        what, col = ("loan made", 2) if p["next"] == "loan" else ("reserves kept", 1)
        return [
            short(f"{opening}Credit multiplier = 1 ÷ reserve ratio. What is the credit multiplier?", mult,
                  [f"{mult} times", f"×{mult}", f"x{mult}"]),
            total,
            short(f"{LEND} What is the amount marked ?, in Frw?", rows[i][j], money(rows[i][j])),
            short(f"{LEND} If the process goes on in the same way, what would be the {what} by Bank {nxt}, in Frw?",
                  rows[n][col], money(rows[n][col])),
        ]
    it, req = p["items"], p["req"]
    reserves = it["cash"] + it["central"]
    crr = Fraction(100 * reserves, it["deposits"])
    excess = reserves - req * it["deposits"] // 100
    key = f"{float(crr):.1f}".rstrip("0").rstrip(".")
    forms = [key, f"{float(crr):.1f}"]
    forms += [f"{f}{u}" for f in list(forms) for u in ("%", " %", " per cent", " percent")]
    return [
        short(f"{who} {rng.choice(VERBS)} this balance sheet of a commercial bank in {p['town']} {rng.choice(SETTINGS)}. "
              "On a balance sheet, total assets = total liabilities. What is the amount marked ?, in Frw billion?",
              it[p["blank"]], _billions(it[p["blank"]])),
        short("Cash reserve ratio = (cash in tills + balance at the central bank) ÷ customers' deposits × 100. What is the "
              f"cash reserve ratio of the bank in {p['town']}, as a percentage?", key, forms),
        short(f"The central bank requires reserves of {req}% of customers' deposits. Excess reserves = (cash in tills + "
              f"balance at the central bank) − required reserves. What are the excess reserves of the bank in {p['town']}, "
              "in Frw billion?", excess, _billions(excess)),
    ]
