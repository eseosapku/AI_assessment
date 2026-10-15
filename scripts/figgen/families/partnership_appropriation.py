"""A partnership's profit appropriated (UP, AL), as Cambridge IGCSE Accounting 0452 chapter 19, AS 9706 chapter 18
and the WAEC Partnership accounts syllabus set it: two or three partners, the profit for the year, interest on
capital and on drawings at printed rates, a salary for one partner (or two), and the profit-sharing ratio. Two
layouts (the sub-types):
- "agreement": the profit, the terms of the partnership agreement, and a table of each partner's capital and drawings;
- "account": the appropriation account part-completed (interest and salaries entered), its residual profit and the
  partners' shares of it left as "?".

Asks one partner's share of the residual profit, and another's total share of the profit (salary, interest on
capital and share of the residual profit, less interest on drawings). Every key is the appropriation worked through:
residual profit = profit + interest on drawings - salaries - interest on capital, shared in the ratio. The figures
are chosen so every share is a whole number of francs.
"""
from __future__ import annotations

import random

from ..core import NAMES, money, short
from ._accounts import TOWNS, TRADES, YEARS, article, frw, page, rule
from .econ_tables import fit, table

ID = "partnership_appropriation"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP", "AL")
# The appropriation account closes a partnership's income statement; WAEC's "Partnership accounts" carries only that
# concept, so it is named too, and AVOID keeps the family to topics named for partners.
CONCEPTS = ("accounting.partnership-accounts", "accounting.financial-statements-sole-traders")
# A topic whose sections the book lists is reached only if one names partners or the appropriation of profit.
NEEDS = r"partner|appropriation"
# Only a topic named for partners teaches the appropriation account: any other name (a company, a merger, a sole
# trader's statements, "Final accounts") is avoided, and so are the chapters on dissolution.
AVOID = r"^(?!.*partner)|dissolution|merger|acquisition|compan"

RATIOS = {2: [[3, 2], [2, 1], [1, 1], [3, 1], [5, 3], [4, 3], [3, 2], [2, 1]],
          3: [[3, 2, 1], [2, 2, 1], [4, 3, 3], [5, 3, 2], [2, 1, 1], [3, 3, 2]]}


def figures(p: dict) -> dict:
    """Each partner's interest on capital and on drawings, salary, share of the residual profit and total share."""
    out, ioc_all, iod_all = {}, 0, 0
    for name, capital, drawings, salary, _ in p["partners"]:
        ioc_all += capital * p["ioc"] // 100
        iod_all += drawings * p["iod"] // 100
    residual = p["profit"] + iod_all - sum(x[3] for x in p["partners"]) - ioc_all
    whole = sum(x[4] for x in p["partners"])
    for name, capital, drawings, salary, ratio in p["partners"]:
        ioc, iod, share = capital * p["ioc"] // 100, drawings * p["iod"] // 100, residual * ratio // whole
        out[name] = {"ioc": ioc, "iod": iod, "salary": salary, "share": share, "total": salary + ioc + share - iod}
    return {"partners": out, "residual": residual, "ioc": ioc_all, "iod": iod_all,
            "salaries": sum(x[3] for x in p["partners"])}


def sample(rng: random.Random) -> dict:
    trade = rng.choice([t for t, _ in TRADES])
    while True:
        band = rng.choice(BANDS)
        n = 3 if rng.random() < (0.5 if band == "AL" else 0.2) else 2
        names = rng.sample(NAMES, n)
        ratio = rng.choice(RATIOS[n])
        ioc, iod = rng.choice([5, 6, 8, 10]), rng.choice([2, 3, 4, 5])
        paid = rng.sample(range(n), 2 if n == 3 and band == "AL" and rng.random() < 0.5 else 1)
        partners = [[nm, rng.randrange(1_000_000, 10_000_001, 500_000), rng.randrange(200_000, 1_500_001, 50_000),
                     rng.randrange(300_000, 1_500_001, 50_000) if i in paid else 0, r]
                    for i, (nm, r) in enumerate(zip(names, ratio))]
        residual = sum(ratio) * rng.randrange(150, 1_500) * 1_000
        p = {"band": band, "business": f"{article(trade)} {trade} in {rng.choice(TOWNS)}", "year": rng.choice(YEARS),
             "profit": 0, "ioc": ioc, "iod": iod, "layout": rng.choice(["agreement", "account"]), "partners": partners}
        f = figures(p)  # with no profit yet: the residual is what the profit must cover
        p["profit"] = residual - f["residual"]
        f = figures(p)
        each = f["partners"].values()
        if p["profit"] <= 0 or any(e["total"] <= 0 for e in each):
            continue
        # nothing asked is printed by coincidence: the printed amounts and the answers all differ
        shown = [p["profit"], f["iod"], p["profit"] + f["iod"], f["salaries"] + f["ioc"]]
        shown += [x for x in (v for nm, c, d, s, r in partners for v in (c, d, s)) if x]
        shown += [e["ioc"] for e in each] + [e["iod"] for e in each]
        asked = [f["residual"]] + [e["share"] for e in each] + [e["total"] for e in each]
        if not set(shown) & set(asked) and len(set(e["total"] for e in each)) == n:
            return p


def firm(p: dict) -> str:
    names = [x[0] for x in p["partners"]]
    return " and ".join(names) if len(names) == 2 else f"{names[0]}, {names[1]} and {names[2]}"


def ratio_line(p: dict) -> str:
    return f"{' : '.join(x[0] for x in p['partners'])} = {' : '.join(str(x[4]) for x in p['partners'])}"


def _salaries(p: dict) -> str:
    paid = [f"{x[0]} {frw(x[3])} Frw" for x in p["partners"] if x[3]]
    return ("Salary: " if len(paid) == 1 else "Salaries: ") + " and ".join(paid) + " a year"


def _agreement(p: dict):
    y = p["year"]
    lines = [f"Profit for the year ended 31 December {y}: {frw(p['profit'])} Frw", "The partnership agreement:",
             f"• Interest on capital: {p['ioc']}% a year on each partner's capital",
             f"• Interest on drawings: {p['iod']}% of each partner's drawings for the year",
             f"• {_salaries(p)}", f"• Residual profit is shared {ratio_line(p)}"]
    heads = ["Partner", f"Capital at 1 January {y}\n(Frw)", f"Drawings during {y}\n(Frw)"]
    rows = [[nm, frw(c), frw(d)] for nm, c, d, _, _ in p["partners"]]
    widths = [fit(h, *(r[j] for r in rows), least=1.3) for j, h in enumerate(heads)]
    width = max([sum(widths)] + [fit(ln, size=10.5, bold=False, pad=0.2) for ln in lines]) + 0.3
    height = 0.75 + 0.33 * len(lines) + 0.2 + 0.56 + 0.36 * len(rows) + 0.15
    fig, ax = page(width, height)
    top = height - 0.12
    ax.text(width / 2, top, f"{firm(p)}: partnership", ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Partners in {p['business']}", ha="center", va="top", fontsize=10.5, style="italic")
    for i, ln in enumerate(lines):
        bold = "bold" if i == 1 else "normal"
        ax.text(0.15 + (0.2 if ln.startswith("•") else 0), top - 0.85 - 0.33 * i, ln, ha="left", va="center",
                fontsize=10.5, fontweight=bold)
    t_top = top - 0.85 - 0.33 * (len(lines) - 1) - 0.3
    x0 = (width - sum(widths)) / 2
    table(ax, heads, rows, widths, top=t_top, align=["l", "r", "r"], x0=x0)
    return fig


LABEL_W, AMT_W, X0, ROW = 3.6, 1.3, 0.12, 0.27
INNER, OUTER = "inner", "outer"


def _account(p: dict):
    f = figures(p)
    each = f["partners"]
    rows = [("Profit for the year", 0, OUTER, p["profit"], None, False),
            ("Add Interest on drawings", 0, None, None, None, False)]
    rows += [(nm, 1, INNER, each[nm]["iod"], None, False) for nm, *_ in p["partners"]]
    rows += [("", 1, OUTER, f["iod"], INNER, False), ("", 0, OUTER, p["profit"] + f["iod"], OUTER, False)]
    paid = [x for x in p["partners"] if x[3]]
    rows.append(("Less Salary" if len(paid) == 1 else "Less Salaries", 0, None, None, None, False))
    rows += [(x[0], 1, INNER, x[3], None, False) for x in paid]
    rows.append(("Less Interest on capital", 0, None, None, None, False))
    rows += [(nm, 1, INNER, each[nm]["ioc"], None, False) for nm, *_ in p["partners"]]
    rows += [("", 1, OUTER, f["salaries"] + f["ioc"], INNER, False),
             ("Residual profit", 0, OUTER, "?", OUTER, False),
             (f"Share of residual profit ({ratio_line(p)})", 0, None, None, None, False)]
    rows += [(nm, 1, INNER, "?", None, False) for nm, *_ in p["partners"]]
    rows.append(("", 1, OUTER, "?", INNER, True))
    width = 2 * X0 + LABEL_W + 2 * AMT_W
    height = 1.05 + (len(rows) + 0.6) * ROW
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, firm(p), ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Appropriation account for the year ended 31 December {p['year']}", ha="center",
            va="top", fontsize=11)
    x_in, x_out = X0 + LABEL_W + AMT_W, X0 + LABEL_W + 2 * AMT_W
    head = top - 0.82
    for x in (x_in, x_out):
        ax.text(x - 0.08, head, "Frw", ha="right", va="center", fontsize=10, fontweight="bold")
    for i, (label, indent, col, amount, above, double) in enumerate(rows):
        y = head - (i + 1) * ROW
        if label:
            ax.text(X0 + 0.05 + 0.3 * indent, y, label, ha="left", va="center", fontsize=10,
                    fontweight="bold" if label == "Residual profit" else "normal")
        if col is None:
            continue
        x = x_in if col == INNER else x_out
        text = amount if amount == "?" else frw(amount)
        ax.text(x - 0.08, y, text, ha="right", va="center", fontsize=10.5 if text == "?" else 10,
                fontweight="bold" if text == "?" else "normal")
        if above:
            xr = x_in if above == INNER else x_out
            rule(ax, xr - AMT_W + 0.2, xr - 0.04, y + ROW / 2, width=0.8)
        if double:
            rule(ax, x - AMT_W + 0.2, x - 0.04, y - ROW / 2 + 0.03, double=True, width=0.8)
    return fig


def draw(p: dict):
    return _agreement(p) if p["layout"] == "agreement" else _account(p)


VERBS = ["keeps the accounts of", "is the bookkeeper for", "prepares the year-end accounts of", "does the bookkeeping for"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice([n for n in NAMES if n not in {x[0] for x in p["partners"]}])
    y = p["year"]
    each = figures(p)["partners"]
    names = [x[0] for x in p["partners"]]
    one = rng.choice(names)
    paid = [nm for nm in names if each[nm]["salary"] and nm != one]
    other = rng.choice(paid or [nm for nm in names if nm != one])
    parts = (["salary"] if each[other]["salary"] else []) + ["interest on capital", "share of the residual profit"]
    listed = ", ".join(parts[:-1]) + " and " + parts[-1]
    return [
        short(f"{who} {rng.choice(VERBS)} {firm(p)}, partners in {p['business']}. What is {one}'s share of the residual "
              f"profit for the year ended 31 December {y}?", each[one]["share"], money(each[one]["share"])),
        short(f"What is {other}'s total share of the profit for {y}: {listed}, less interest on drawings?",
              each[other]["total"], money(each[other]["total"])),
    ]
