"""A manufacturer's costs for a year (UP, AL), as Cambridge IGCSE Accounting 0452 chapter 20 and AS 9706 chapter 20
set them, for a Rwandan workshop or factory. Two layouts (the sub-types):
- "extract": the balances from the books, in a table: inventories of raw materials and work in progress at both
  ends of the year, purchases of raw materials and the carriage on them, direct factory wages, royalties, factory
  overheads (one perhaps shared with the office, the factory's fraction printed), and costs that are not the
  factory's (office salaries, selling expenses, finished goods);
- "account": the manufacturing account part-completed: the cost of raw materials consumed worked out, then the
  prime cost, its totals with the overheads and work in progress, and the cost of production left as "?".

Asks the prime cost and the cost of production; at AL, where goods pass to the trading account at cost of
production plus a printed percentage, also the factory profit. Every key is the account worked through:
raw materials consumed = opening inventory + purchases + carriage - closing inventory; prime cost = materials
consumed + direct labour + royalties; cost of production = prime cost + factory overheads + opening work in progress
- closing work in progress. Each formula is in its stem or drawn in the account.
"""
from __future__ import annotations

import random

from ..core import NAMES, money, short
from ._accounts import YEARS, frw, page, rule
from .econ_tables import titled_table

ID = "manufacturing_account"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP", "AL")
# The IGCSE book's two copies map the chapter differently: one names manufacturing accounts, the other only the
# costs it classifies.
CONCEPTS = ("accounting.manufacturing-accounts", "accounting.cost-classification")
# A topic whose sections the book lists is reached only if one names the account or what it works out.
NEEDS = r"manufactur|prime cost|cost of production|work in progress"
# Costing chapters classify the same costs for another purpose (a cost sheet, absorption, budgets); only a topic named
# for manufacturing accounts teaches this layout.
AVOID = r"^(?!.*manufactur)"

FIRMS = [("Huye Furniture Makers", "furniture", "Huye"), ("Kigali Shoe Makers", "shoes", "Kigali"),
         ("Musanze Juice Factory", "fruit juice", "Musanze"), ("Rwamagana Brick Works", "bricks", "Rwamagana"),
         ("Nyabugogo Soap Makers", "soap", "Kigali"), ("Muhanga Textile Mill", "cloth", "Muhanga"),
         ("Gikondo Paint Factory", "paint", "Kigali"), ("Rubavu Bottling Company", "bottled water", "Rubavu"),
         ("Nyagatare Dairy Products", "yoghurt", "Nyagatare"), ("Rusizi Coffee Processors", "roasted coffee", "Rusizi")]
# (factory overhead, lowest, highest)
OVERHEADS = [("Indirect factory wages", 300_000, 1_500_000), ("Factory rent", 200_000, 1_200_000),
             ("Factory power", 100_000, 800_000), ("Depreciation of factory machinery", 100_000, 900_000),
             ("Factory insurance", 50_000, 300_000), ("Factory supervisor's salary", 400_000, 1_500_000),
             ("Repairs to factory machinery", 50_000, 400_000)]
# (a cost shared with the office, the factory overhead it stands for, lowest and highest in units of 5 000 per part)
SHARED = [("Rent and rates", "Factory rent", 20, 60), ("Electricity", "Factory power", 8, 30),
          ("Insurance", "Factory insurance", 4, 16)]
PARTS = [[3, 4], [2, 3], [4, 5], [3, 5]]
OTHERS = [("Office salaries", 500_000, 2_000_000), ("Selling expenses", 100_000, 800_000),
          ("Inventory of finished goods at 1 January", 300_000, 2_000_000), ("Carriage outwards", 20_000, 200_000),
          ("Advertising", 50_000, 500_000)]


def figures(p: dict) -> dict:
    (r_open, r_close), (w_open, w_close) = p["raw"], p["wip"]
    materials = r_open + p["purchases"] + p["carriage"] - r_close
    prime = materials + p["labour"] + p["royalties"]
    overheads = sum(a * part[0] // part[1] if part else a for _, a, part in p["overheads"])
    cost = prime + overheads + w_open - w_close
    return {"materials": materials, "prime": prime, "overheads": overheads, "with_overheads": prime + overheads,
            "with_wip": prime + overheads + w_open, "cost": cost, "profit": cost * p["markup"] // 100}


def _amount(rng, lo: int, hi: int, step: int = 10_000) -> int:
    return rng.randrange(lo, hi + 1, step)


def sample(rng: random.Random) -> dict:
    firm, product, town = rng.choice(FIRMS)
    while True:
        band = rng.choice(BANDS)
        layout = rng.choice(["extract", "account"])
        shared = rng.choice(SHARED) if layout == "extract" and rng.random() < 0.5 else None
        # a shared cost replaces the factory's own line for it: "Insurance" beside "Factory insurance" would read twice
        menu = [o for o in OVERHEADS if not shared or o[0] != shared[1]]
        overheads = [[name, _amount(rng, lo, hi), None] for name, lo, hi in rng.sample(menu, rng.randint(3, 5))]
        if shared:
            name, _, lo, hi = shared
            part = rng.choice(PARTS)
            overheads.append([name, part[1] * rng.randint(lo // part[1] + 1, hi) * 5_000, part])
        others = [[n, _amount(rng, lo, hi)] for n, lo, hi in rng.sample(OTHERS, rng.randint(2, 3))] if layout == "extract" else []
        p = {"band": band, "firm": firm, "product": product, "town": town, "year": rng.choice(YEARS), "layout": layout,
             "raw": [_amount(rng, 100_000, 1_500_000), _amount(rng, 100_000, 1_500_000)],
             "purchases": _amount(rng, 1_000_000, 8_000_000, 50_000),
             "carriage": _amount(rng, 20_000, 200_000, 5_000) if rng.random() < 0.6 else 0,
             "labour": _amount(rng, 800_000, 5_000_000, 50_000), "royalties": _amount(rng, 50_000, 600_000),
             "overheads": overheads, "wip": [_amount(rng, 50_000, 800_000), _amount(rng, 50_000, 800_000)],
             "others": others, "markup": rng.choice([10, 20, 25]) if band == "AL" and rng.random() < 0.5 else 0}
        p["others"] = [[n.replace("1 January", f"1 January {p['year']}"), a] for n, a in others]  # as printed
        f = figures(p)
        printed = list(p["raw"]) + list(p["wip"]) + [p["purchases"], p["labour"], p["royalties"]]
        printed += [o[1] for o in overheads] + [o[1] for o in others] + ([p["carriage"]] if p["carriage"] else [])
        if layout == "account":
            printed += [p["raw"][0] + p["purchases"] + p["carriage"], f["materials"], f["overheads"]]
        asked = [f["prime"], f["cost"]] + ([f["profit"]] if p["markup"] else [])
        if f["materials"] <= 0 or p["wip"][0] == p["wip"][1] or p["raw"][0] == p["raw"][1]:
            continue
        # nothing asked is printed by coincidence, and no two answers are the same number
        if not set(asked) & set(printed) and len(set(asked)) == len(asked):
            return p


def _label(p: dict, name: str, part) -> str:
    return f"{name} ({part[0]}/{part[1]} factory, {part[1] - part[0]}/{part[1]} office)" if part else name


def _extract(p: dict):
    y = p["year"]
    top = [[f"Inventory of raw materials at 1 January {y}", p["raw"][0]],
           [f"Inventory of raw materials at 31 December {y}", p["raw"][1]],
           [f"Work in progress at 1 January {y}", p["wip"][0]], [f"Work in progress at 31 December {y}", p["wip"][1]]]
    rest = [["Purchases of raw materials", p["purchases"]], ["Direct factory wages", p["labour"]],
            ["Royalties", p["royalties"]]]
    if p["carriage"]:
        rest.append(["Carriage inwards on raw materials", p["carriage"]])
    rest += [[_label(p, n, part), a] for n, a, part in p["overheads"]]
    rest += [list(o) for o in p["others"]]
    # the order a bookkeeper lists balances in, not the order the account uses them: alphabetical, as a trial balance
    # extract often is, so the factory's costs and the office's are mixed
    rest.sort(key=lambda r: r[0])
    notes = [f"Goods are transferred to the trading account at cost of production plus {p['markup']}%."] if p["markup"] else []
    return titled_table(f"{p['firm']}: balances for the year ended 31 December {y}", ["Item", "Frw"],
                        [[r[0], frw(r[1])] for r in top + rest], ["l", "r"], notes=notes)


LABEL_W, AMT_W, X0, ROW = 3.9, 1.3, 0.12, 0.27
INNER, OUTER = "inner", "outer"


def _account(p: dict):
    y = p["year"]
    f = figures(p)
    rows = [(f"Inventory of raw materials at 1 January {y}", 0, OUTER, p["raw"][0], None, False),
            ("Add Purchases of raw materials", 0, OUTER, p["purchases"], None, False)]
    if p["carriage"]:
        rows.append(("Add Carriage inwards on raw materials", 0, OUTER, p["carriage"], None, False))
    rows += [("", 0, OUTER, p["raw"][0] + p["purchases"] + p["carriage"], OUTER, False),
             (f"Less Inventory of raw materials at 31 December {y}", 0, OUTER, p["raw"][1], None, False),
             ("Cost of raw materials consumed", 0, OUTER, f["materials"], OUTER, False),
             ("Direct labour", 0, OUTER, p["labour"], None, False),
             ("Royalties", 0, OUTER, p["royalties"], None, False),
             ("Prime cost", 0, OUTER, "?", OUTER, False),
             ("Add Factory overheads", 0, None, None, None, False)]
    rows += [(name, 1, INNER, a, None, False) for name, a, _ in p["overheads"]]
    rows += [("", 1, OUTER, f["overheads"], INNER, False), ("", 0, OUTER, "?", OUTER, False),
             (f"Add Work in progress at 1 January {y}", 0, OUTER, p["wip"][0], None, False),
             ("", 0, OUTER, "?", OUTER, False),
             (f"Less Work in progress at 31 December {y}", 0, OUTER, p["wip"][1], None, False),
             ("Cost of production", 0, OUTER, "?", OUTER, True)]
    notes = [f"Goods are transferred to the trading account at cost of production plus {p['markup']}%."] if p["markup"] else []
    width = 2 * X0 + LABEL_W + 2 * AMT_W
    height = 1.05 + (len(rows) + 0.6 + 1.2 * len(notes)) * ROW
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, p["firm"], ha="center", va="top", fontsize=12, fontweight="bold")
    ax.text(width / 2, top - 0.3, f"Manufacturing account for the year ended 31 December {y}", ha="center", va="top",
            fontsize=11)
    x_in, x_out = X0 + LABEL_W + AMT_W, X0 + LABEL_W + 2 * AMT_W
    head = top - 0.82
    for x in (x_in, x_out):
        ax.text(x - 0.08, head, "Frw", ha="right", va="center", fontsize=10, fontweight="bold")
    for i, (label, indent, col, amount, above, double) in enumerate(rows):
        y_ = head - (i + 1) * ROW
        if label:
            bold = "bold" if label in ("Prime cost", "Cost of production") else "normal"
            ax.text(X0 + 0.05 + 0.3 * indent, y_, label, ha="left", va="center", fontsize=10, fontweight=bold)
        if col is None:
            continue
        x = x_in if col == INNER else x_out
        text = amount if amount == "?" else frw(amount)
        ax.text(x - 0.08, y_, text, ha="right", va="center", fontsize=10.5 if text == "?" else 10,
                fontweight="bold" if text == "?" else "normal")
        if above:
            xr = x_in if above == INNER else x_out
            rule(ax, xr - AMT_W + 0.2, xr - 0.04, y_ + ROW / 2, width=0.8)
        if double:
            rule(ax, x - AMT_W + 0.2, x - 0.04, y_ - ROW / 2 + 0.03, double=True, width=0.8)
    for i, note in enumerate(notes):
        ax.text(X0 + 0.05, head - (len(rows) + 1.4 + i) * ROW, note, ha="left", va="center", fontsize=10, style="italic")
    return fig


def draw(p: dict):
    return _extract(p) if p["layout"] == "extract" else _account(p)


VERBS = ["keeps the accounts of", "is the accountant at", "prepares the year-end accounts of", "works in the office of"]


def questions(p: dict, rng: random.Random) -> list:
    who, y = rng.choice(NAMES), p["year"]
    f = figures(p)
    end = f"for the year ended 31 December {y}"
    out = [short(f"{who} {rng.choice(VERBS)} {p['firm']}, which makes {p['product']} in {p['town']}. Prime cost is the cost "
                 f"of raw materials consumed plus direct labour and royalties. What is the prime cost {end}?",
                 f["prime"], money(f["prime"])),
           short("The cost of production is prime cost plus factory overheads, plus work in progress at the start of the "
                 f"year, less work in progress at the end. What is the cost of production of {p['firm']} {end}?",
                 f["cost"], money(f["cost"]))]
    if p["markup"]:
        out.append(short(f"{p['firm']} transfers its goods to the trading account at cost of production plus "
                         f"{p['markup']}%. What is the factory profit {end}?", f["profit"], money(f["profit"])))
    return out
