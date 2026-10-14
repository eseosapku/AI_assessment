"""A depreciation schedule (UP, AL): an asset bought on 1 January for a stated cost, its method (straight-line over
a useful life to a residual value, straight-line at a percentage of cost, or reducing balance at a stated rate),
and a table of two to four years -- net book value at the start, depreciation for the year, net book value at the
end -- with the last year's depreciation and value left as "?".

Asks the depreciation for the year left blank, and the net book value after n years (that year, or a year or two
past the table). Cost and rate are chosen so that every value is a whole number of francs (Review Focus 2).
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import INK, NAMES, money, short
from ._accounts import TOWNS, YEARS, article, frw, page, rule

ID = "depreciation"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP", "AL")
CONCEPTS = ("accounting.depreciation-methods", "accounting.depreciation-in-financial-statements")
ALSO = ("business.depreciation-and-asset-valuation",)
# A topic whose sections the book lists is reached only if one names depreciation.
NEEDS = r"depreciat|non-current assets|fixed assets|net book value"
# Tax depreciation follows the tax law's pools, not these methods; the rest only mention non-current assets.
AVOID = r"\btax|partnership|club|societ|manufactur|cash flow|costing|incomplete|compan|interpretation|size of business"

# (asset, lowest cost, highest cost, the businesses that own one)
ASSETS = [
    ("delivery van", 8_000_000, 24_000_000, ["hardware shop", "bakery", "grocery", "furniture workshop", "electronics shop"]),
    ("motorcycle", 1_500_000, 4_000_000, ["pharmacy", "bakery", "phone shop", "grocery"]),
    ("maize mill", 2_000_000, 10_000_000, ["maize milling business", "farming cooperative"]),
    ("sewing machine", 600_000, 2_000_000, ["tailoring workshop"]),
    ("display fridge", 800_000, 3_000_000, ["grocery", "restaurant", "pharmacy"]),
    ("photocopier", 1_000_000, 4_000_000, ["stationery shop", "printing shop"]),
    ("coffee pulping machine", 3_000_000, 12_000_000, ["coffee washing station", "coffee cooperative"]),
    ("bread oven", 2_000_000, 8_000_000, ["bakery"]),
    ("computer", 600_000, 2_000_000, ["phone shop", "hair salon", "stationery shop"]),
]


def run(p: dict, years: int) -> list[tuple[Fraction, Fraction, Fraction]]:
    """Each year's net book value at the start, depreciation and net book value at the end."""
    out, nbv = [], Fraction(p["cost"])
    for _ in range(years):
        if p["method"] == "sl":
            d = Fraction(p["cost"] - p["residual"], p["life"])
        elif p["method"] == "pc":
            d = Fraction(p["cost"] * p["rate"], 100)
        else:
            d = nbv * p["rate"] / 100
        out.append((nbv, d, nbv - d))
        nbv -= d
    return out


def sample(rng: random.Random) -> dict:
    while True:
        asset, lo, hi, owners = rng.choice(ASSETS)
        cost = rng.randrange(lo, hi + 1, 100_000)
        method = rng.choice(["sl", "pc", "rb", "rb"])
        k = rng.randint(2, 4)
        p = {"band": rng.choice(BANDS), "asset": asset, "business": None, "cost": cost, "method": method,
             "rate": None, "life": None, "residual": None, "start": 0, "shown": k, "nbv_after": 0}
        if method == "sl":
            p["life"] = rng.choice([4, 5, 6, 8, 10])
            p["residual"] = rng.choice([0, rng.randrange(0, cost // 5 + 1, 100_000)])
            last = p["life"]
        elif method == "pc":
            p["rate"] = rng.choice([10, 15, 20, 25])
            last = 100 // p["rate"] - 1  # still worth something at the end
        else:
            p["rate"] = rng.choice([10, 20, 25, 30, 40])
            last = k + 1
        if k > last:
            continue
        n = rng.randint(k, min(last, k + 2))
        values = run(p, max(k, n))
        if any(v.denominator != 1 for row in values for v in row):
            continue  # whole francs only
        if values[k - 1][1] == values[n - 1][2]:
            continue  # two answers the same number would read as a slip
        p["nbv_after"] = n
        p["start"] = rng.randint(YEARS[-1] - n - 3, YEARS[-1] - n + 1)  # the last year asked is past
        owner = rng.choice(owners)
        p["business"] = f"{article(owner)} {owner} in {rng.choice(TOWNS)}"
        return p


def method_line(p: dict) -> str:
    """The method as the schedule's heading states it."""
    if p["method"] == "rb":
        return f"Method: reducing balance, {p['rate']}% a year"
    if p["method"] == "pc":
        return f"Method: straight-line, {p['rate']}% of cost a year"
    tail = f"residual value {frw(p['residual'])} Frw" if p["residual"] else "no residual value"
    return f"Method: straight-line over {p['life']} years, {tail}"


def method_text(p: dict) -> str:
    if p["method"] == "rb":
        return f"reducing balance method at {p['rate']}% a year"
    if p["method"] == "pc":
        return f"straight-line method at {p['rate']}% of cost a year"
    tail = f"a residual value of {frw(p['residual'])} Frw" if p["residual"] else "no residual value"
    return f"straight-line method over {p['life']} years, with {tail}"


# The page, in inches: Year, then three money columns.
COLS = (0.95, 1.7, 1.7, 1.7)
X0, ROW = 0.12, 0.32


def draw(p: dict):
    k = p["shown"]
    width = 2 * X0 + sum(COLS)
    height = 2.16 + k * ROW
    fig, ax = page(width, height)
    top = height - 0.1
    ax.text(width / 2, top, f"Depreciation schedule: {p['asset']}", ha="center", va="top", fontsize=12, fontweight="bold")
    facts = [f"Bought on 1 January {p['start']} for {frw(p['cost'])} Frw",
             method_line(p), "Financial year ends on 31 December"]
    for i, line in enumerate(facts):
        ax.text(X0 + 0.05, top - 0.42 - i * 0.26, line, ha="left", va="top", fontsize=10)
    head_top = top - 1.32
    heads = ["Year", "Net book value\nat start (Frw)", "Depreciation for\nthe year (Frw)", "Net book value\nat end (Frw)"]
    xs = [X0]
    for w in COLS:
        xs.append(xs[-1] + w)
    for i, h in enumerate(heads):
        ax.text((xs[i] + xs[i + 1]) / 2, head_top - 0.27, h, ha="center", va="center", fontsize=9.5, fontweight="bold",
                linespacing=1.15)
    first = head_top - 0.56
    rule(ax, X0, xs[-1], first, width=0.8)
    for r, (start, dep, end) in enumerate(run(p, k)):
        y = first - (r + 0.5) * ROW
        blank = r == k - 1
        ax.text(xs[0] + COLS[0] / 2, y, str(p["start"] + r), ha="center", va="center", fontsize=10)
        cells = [frw(int(start)), "?" if blank else frw(int(dep)), "?" if blank else frw(int(end))]
        for c, text in enumerate(cells):
            ax.text(xs[c + 2] - 0.12, y, text, ha="right", va="center", fontsize=10.5 if text == "?" else 10,
                    fontweight="bold" if text == "?" else "normal")
    bottom = first - k * ROW - 0.06
    for x in xs:
        ax.plot([x, x], [head_top, bottom], color=INK, linewidth=0.8)
    rule(ax, X0, xs[-1], head_top, width=0.8)
    rule(ax, X0, xs[-1], bottom, width=0.8)
    return fig


VERBS = ["keeps the accounts of", "is the accountant at", "works out the depreciation for", "prepares the accounts of"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    k, n = p["shown"], p["nbv_after"]
    values = run(p, max(k, n))
    dep = int(values[k - 1][1])
    nbv = int(values[n - 1][2])
    return [short(f"{who} {rng.choice(VERBS)} {p['business']}. The {p['asset']} is depreciated by the {method_text(p)}. "
                  f"What is the depreciation for the year ended 31 December {p['start'] + k - 1}?", dep, money(dep)),
            short(f"What is the net book value of the {p['asset']} after {n} years, on 31 December {p['start'] + n - 1}?",
                  nbv, money(nbv))]
