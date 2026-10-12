"""Shopping in Rwandan francs (P): a shop's price board, or the notes and coins in a purse.

Prices fit the school year: up to 1,000 Frw in Stages 1–2 (in tens), 5,000 Frw in Stages 3–4 (in
fifties) and 50,000 Frw in Stages 5–6 (in five hundreds). The notes and coins are the ones in use:
coins of 10, 20, 50 and 100 Frw; notes of 500, 1,000, 2,000 and 5,000 Frw. Every answer accepts
"1,500", "1500", "1500 Frw" and the other fair forms (core.money).
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

from ..core import FILL_2, INK, NAMES, count, mcq, money, new_figure, short

ID = "money"
KIND = "business.document"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("buying-selling-prices", "money-earning", "simple-budgeting-rwandan-currency", "buying-selling-role-play"))

# By school years: the price step, the most anything totals, what is sold (one, many, cheapest, dearest),
# the notes a shopper pays with, and the notes and coins a purse holds.
LEVELS = {
    (1, 2): {"step": 10, "limit": 1000, "pay": [500, 1000], "purse": [10, 20, 50, 100, 500],
             "items": [("mango", "mangoes", 100, 200), ("sweet", "sweets", 10, 50), ("pencil", "pencils", 50, 100),
                       ("exercise book", "exercise books", 200, 300), ("egg", "eggs", 100, 150), ("banana", "bananas", 50, 100),
                       ("bread roll", "bread rolls", 100, 200)]},
    (3, 4): {"step": 50, "limit": 5000, "pay": [1000, 2000, 5000], "purse": [100, 500, 1000, 2000],
             "items": [("loaf of bread", "loaves of bread", 500, 1000), ("bar of soap", "bars of soap", 500, 800),
                       ("exercise book", "exercise books", 300, 500), ("pen", "pens", 200, 300),
                       ("kilogram of sugar", "kilograms of sugar", 1200, 1500), ("bottle of water", "bottles of water", 300, 500),
                       ("avocado", "avocados", 200, 300), ("litre of milk", "litres of milk", 600, 800)]},
    (5, 6): {"step": 500, "limit": 50000, "pay": [5000, 10000, 20000, 50000], "purse": [500, 1000, 2000, 5000],
             "items": [("school bag", "school bags", 8000, 15000), ("pair of shoes", "pairs of shoes", 10000, 20000),
                       ("T-shirt", "T-shirts", 4000, 8000), ("football", "footballs", 5000, 9000), ("radio", "radios", 15000, 20000),
                       ("torch", "torches", 2000, 4000)]},
}


def stages(p: dict) -> tuple[int, int]:
    return tuple(p["years"])


def sample(rng: random.Random) -> dict:
    years = rng.choice(list(LEVELS))
    lv = LEVELS[years]
    name = rng.choice(NAMES)
    if rng.random() < 0.55:
        while True:
            chosen = rng.sample(lv["items"], rng.choice([4, 5]))
            items = [{"one": one, "many": many, "price": lv["step"] * rng.randint(lo // lv["step"], hi // lv["step"])}
                     for one, many, lo, hi in chosen]
            prices = [it["price"] for it in items]
            if prices.count(max(prices)) == 1 and len(set(prices)) >= 3:
                return {"band": "P", "years": list(years), "kind": "board", "items": items, "name": name}
    while True:
        pieces = sorted((rng.choice(lv["purse"]) for _ in range(rng.randint(3, 7))), reverse=True)
        if sum(pieces) <= lv["limit"]:
            return {"band": "P", "years": list(years), "kind": "purse", "pieces": pieces, "name": name}


def draw(p: dict):
    if p["kind"] == "board":
        items = p["items"]
        rows = len(items)
        fig, ax = new_figure(5.6, 1.4 + 0.55 * rows)
        ax.add_patch(FancyBboxPatch((0.2, 0.2), 9.6, rows + 1.4, boxstyle="round,pad=0.05,rounding_size=0.3",
                                    facecolor=FILL_2, edgecolor=INK, linewidth=1.6))
        ax.text(5, rows + 1.0, f"{p['name']}'s shop", ha="center", va="center", fontsize=13, fontweight="bold")
        for i, it in enumerate(items):
            y = rows - i
            ax.text(0.8, y, it["one"].capitalize(), ha="left", va="center", fontsize=12)
            ax.text(9.2, y, f"{it['price']:,} Frw", ha="right", va="center", fontsize=12)
            ax.plot([0.8, 9.2], [y - 0.45, y - 0.45], color=INK, linewidth=0.5)
        ax.set_xlim(0, 10)
        ax.set_ylim(0, rows + 1.8)
        ax.set_aspect("equal")
        ax.axis("off")
        return fig
    pieces = p["pieces"]
    notes, coins = [v for v in pieces if v >= 500], [v for v in pieces if v < 500]
    # Notes in rows of four above, coins in rows of six below; the figure grows with them, so every
    # label stays inside its note or coin.
    rows = [("note", notes[i:i + 4]) for i in range(0, len(notes), 4)] + [("coin", coins[i:i + 6]) for i in range(0, len(coins), 6)]
    height = 1.2 + sum(2.1 if kind == "note" else 1.9 for kind, _ in rows)
    width = max([0.8 + 3.6 * len(r) if kind == "note" else 0.8 + 1.7 * len(r) for kind, r in rows] + [6.0])
    fig, ax = new_figure(0.55 * width, 0.55 * height)
    y = height - 1.2
    ax.text(0.4, height - 0.55, f"{p['name']}'s purse", ha="left", va="center", fontsize=12, fontweight="bold")
    for kind, row in rows:
        if kind == "note":
            for j, v in enumerate(row):
                ax.add_patch(Rectangle((0.4 + 3.6 * j, y - 1.7), 3.2, 1.6, facecolor=FILL_2, edgecolor=INK, linewidth=1.4))
                ax.text(0.4 + 3.6 * j + 1.6, y - 0.9, f"{v:,} Frw", ha="center", va="center", fontsize=11, fontweight="bold")
            y -= 2.1
        else:
            for j, v in enumerate(row):
                ax.add_patch(Circle((1.1 + 1.7 * j, y - 0.85), 0.7, facecolor="white", edgecolor=INK, linewidth=1.4))
                ax.text(1.1 + 1.7 * j, y - 0.85, f"{v}", ha="center", va="center", fontsize=11, fontweight="bold")
            y -= 1.9
    ax.set_xlim(0, width)
    ax.set_ylim(0, height)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _amount(stem: str, n: int):
    return short(stem, n, money(n))


def questions(p: dict, rng: random.Random) -> list:
    lv = LEVELS[tuple(p["years"])]
    name = p["name"]
    if p["kind"] == "board":
        items = p["items"]
        while True:
            a, b = rng.sample(items, 2)
            n1, n2 = rng.randint(1, 3), rng.randint(1, 2)
            if n1 * a["price"] + n2 * b["price"] <= lv["limit"]:
                break
        word = lambda n, it: it["one"] if n == 1 else it["many"]  # noqa: E731
        total = _amount(f"How much do {n1} {word(n1, a)} and {n2} {word(n2, b)} cost altogether?", n1 * a["price"] + n2 * b["price"])
        c = rng.choice(items)
        paid = rng.choice([v for v in lv["pay"] if v > c["price"]])
        change = _amount(f"{name} pays for one {c['one']} with {paid:,} Frw. How much change should {name} get?", paid - c["price"])
        dear = max(items, key=lambda it: it["price"])
        dearest = mcq(f"Which item in {name}'s shop costs the most?", dear["one"], [it["one"] for it in items if it is not dear], rng)
        hi, lo = rng.choice([(x, y) for x in items for y in items if x["price"] > y["price"]])
        more = _amount(f"How much more does one {hi['one']} cost than one {lo['one']}?", hi["price"] - lo["price"])
        return [total, change, dearest, more]
    pieces = p["pieces"]
    have = sum(pieces)
    # A price the item really costs: an egg is never 400 Frw.
    while True:
        one, _, cheap, dear = rng.choice(lv["items"])
        costs = [v for v in range(cheap, dear + 1, lv["step"]) if v != have]
        if costs:
            cost = rng.choice(costs)
            break
    total = _amount(f"How much money is in {name}'s purse?", have)
    if cost > have:
        spend = _amount(f"How much more money does {name} need to buy one {one} costing {cost:,} Frw?", cost - have)
    else:
        spend = _amount(f"How much money will {name} have left after buying one {one} costing {cost:,} Frw?", have - cost)
    v = rng.choice(sorted(set(pieces)))
    noun = "notes" if v >= 500 else "coins"
    how_many = count(f"How many {v:,} Frw {noun} are in {name}'s purse?", pieces.count(v), noun)
    return [total, spend, how_many]
