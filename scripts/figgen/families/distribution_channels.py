"""Channels of distribution (UP): how one Rwandan producer's goods reach consumers, drawn as three or four lettered
chains of boxes (producer, then any of agent, wholesaler and retailer, then consumer), the way WAEC/NERDC Marketing
("Distribution") and Commerce ("Trade", "Aids to trade") books draw them. The producer's price per unit is printed
above the chains, and every intermediary's box carries its mark-up %, with the rule printed: each sells at the price it
paid plus its mark-up on that price.

The number of intermediaries in a lettered channel, the price a consumer pays through another, and either one
intermediary's mark-up in francs per unit in a channel (never called profit: the figure gives no other costs) or how
much more a consumer pays through one channel than another. Every
price along every chain is a whole number of francs, and no two channels give the consumer the same price.
"""
from __future__ import annotations

import random

from matplotlib.patches import FancyBboxPatch

from ..core import INK, NAMES, count, money, short
from ._accounts import page

ID = "distribution_channels"
KIND = "process.flow"
SUBJECT = "business"
BANDS = ("UP",)
# The marketing mix's place (Distribution, IGCSE "Marketing"), and home trade through wholesalers and retailers
# (Commerce "Trade", "Trade and aids to trade", "Aids to trade").
CONCEPTS = ("business.marketing-mix", "business.international-trade-and-aids")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"distribut|channel|marketing mix: place|trade"
# Listed without sections and sharing the marketing mix or trade, but teaching other things.
AVOID = r"e-commerce|pricing|promotion|digital|transport|insurance|research|globalisation"

# (the product as one unit of it, the unit, the producer, the producer's price range and step in francs)
PRODUCTS = [
    ("bag of rice", "bag", "a rice mill in Bugesera", 18_000, 32_000, 1_000),
    ("crate of soda", "crate", "a drinks factory in Kigali", 6_000, 12_000, 200),
    ("carton of soap", "carton", "a soap factory in Rubavu", 10_000, 20_000, 500),
    ("box of tea", "box", "a tea factory in Nyamasheke", 2_000, 5_000, 100),
    ("sack of maize flour", "sack", "a maize mill in Nyagatare", 15_000, 28_000, 1_000),
    ("tray of eggs", "tray", "a poultry farm in Rwamagana", 3_000, 4_500, 100),
    ("pair of school shoes", "pair", "a shoe factory in Kigali", 8_000, 14_000, 500),
    ("jerrycan of cooking oil", "jerrycan", "an oil mill in Muhanga", 20_000, 36_000, 1_000),
    ("bag of cement", "bag", "a cement works in Rusizi", 8_000, 12_000, 200),
    ("packet of coffee", "packet", "a coffee roaster in Huye", 3_000, 6_000, 100),
]
# The chains a channel may take between the producer and the consumer.
CHAINS = {
    "direct": [],
    "retail": ["Retailer"],
    "wholesale": ["Wholesaler"],
    "long": ["Wholesaler", "Retailer"],
    "agent": ["Agent", "Wholesaler", "Retailer"],
}
MARKUPS = {"Agent": [5, 10], "Wholesaler": [10, 15, 20, 25], "Retailer": [20, 25, 30, 40, 50]}


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def _prices(start: int, chain: list) -> list[float]:
    out, price = [], start
    for _, up in chain:
        price = price * (100 + up) / 100
        out.append(price)
    return out


def _consumer(start: int, chain: list) -> int:
    return int(_prices(start, chain)[-1]) if chain else start


def sample(rng: random.Random) -> dict:
    product, unit, producer, lo, hi, step = rng.choice(PRODUCTS)
    while True:
        k = rng.choice([3, 4])
        kinds = ["long"] + rng.sample([c for c in CHAINS if c != "long"], k - 1)
        rng.shuffle(kinds)
        start = rng.randrange(lo, hi + 1, step)
        chans = [[[role, rng.choice(MARKUPS[role])] for role in CHAINS[c]] for c in kinds]
        if any(not float(x).is_integer() for c in chans for x in _prices(start, c)):
            continue
        ends = [_consumer(start, c) for c in chans]
        if len(set(ends)) < len(ends):
            continue
        return {"band": "UP", "product": product, "unit": unit, "producer": producer, "price": start,
                "channels": chans}


BOX_W, BOX_H, GAP, LEFT, ROW = 1.3, 0.62, 0.42, 1.15, 0.95


def _box(ax, x: float, y: float, title: str, note: str = "", shade: str = "white") -> None:
    ax.add_patch(FancyBboxPatch((x, y - BOX_H / 2), BOX_W, BOX_H, boxstyle="round,pad=0,rounding_size=0.08",
                                facecolor=shade, edgecolor=INK, linewidth=1.1))
    if note:
        ax.text(x + BOX_W / 2, y + 0.12, title, ha="center", va="center", fontsize=9.5, fontweight="bold")
        ax.text(x + BOX_W / 2, y - 0.14, note, ha="center", va="center", fontsize=9)
    else:
        ax.text(x + BOX_W / 2, y, title, ha="center", va="center", fontsize=9.5, fontweight="bold")


def draw(p: dict):
    chans = p["channels"]
    longest = max(len(c) for c in chans) + 2
    width = LEFT + longest * BOX_W + (longest - 1) * GAP + 0.2
    head = 1.05
    height = head + len(chans) * ROW + 0.15
    fig, ax = page(width, height)
    ax.text(0.1, height - 0.22, f"Channels of distribution for one {p['product']} from {p['producer']}",
            ha="left", va="center", fontsize=11, fontweight="bold")
    ax.text(0.1, height - 0.52, f"The producer sells one {p['unit']} for {fr(p['price'])} Frw.",
            ha="left", va="center", fontsize=9.5)
    ax.text(0.1, height - 0.78, "Each intermediary sells at the price it paid plus its mark-up on that price.",
            ha="left", va="center", fontsize=9.5)
    for i, chain in enumerate(chans):
        y = height - head - ROW * i - ROW / 2
        ax.text(0.1, y, f"Channel {'ABCD'[i]}", ha="left", va="center", fontsize=10, fontweight="bold")
        boxes = [("Producer", "", "#e6e9ec")] + [(r, f"mark-up {u}%", "white") for r, u in chain] + [("Consumer", "", "#e6e9ec")]
        x = LEFT
        for j, (title, note, shade) in enumerate(boxes):
            _box(ax, x, y, title, note, shade)
            if j < len(boxes) - 1:
                ax.annotate("", xy=(x + BOX_W + GAP - 0.03, y), xytext=(x + BOX_W + 0.03, y),
                            arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.1, "shrinkA": 0, "shrinkB": 0})
            x += BOX_W + GAP
    return fig


VERBS = ["studies", "draws up", "compares", "is asked about", "looks at", "explains"]
SETTINGS = ["for a Commerce lesson", "for a class presentation", "for homework", "before a marketing test",
            "for a project on trade", "for a revision quiz"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    chans, unit, start = p["channels"], p["unit"], p["price"]
    letters = "ABCD"[:len(chans)]
    what, rest = p["product"].split(" of ", 1)
    plural = f"{what}{'es' if what.endswith('x') else 's'} of {rest}"  # "bags of rice", "boxes of tea"
    ends = [_consumer(start, c) for c in chans]
    c_i = rng.randrange(len(chans))
    n = len(chans[c_i])
    first = count(f"{who} {rng.choice(VERBS)} how {plural} from {p['producer']} reach consumers {rng.choice(SETTINGS)}. "
                  f"How many intermediaries are there between the producer and the consumer in channel {letters[c_i]}?",
                  n, "intermediaries", "middlemen")
    long_ones = [i for i, c in enumerate(chans) if len(c) >= 2]
    p_i = rng.choice([i for i in long_ones if i != c_i] or long_ones)
    second = short(f"What price does a consumer pay for one {unit} bought through channel {letters[p_i]}, in Frw?",
                   ends[p_i], money(ends[p_i]))
    if rng.random() < 0.55:
        options = [(i, j) for i, c in enumerate(chans) for j, (role, _) in enumerate(c) if role != "Agent"]
        options = [o for o in options if o[0] != p_i] or options
        i, j = rng.choice(options)
        sells = _prices(start, chans[i])
        buys = start if j == 0 else sells[j - 1]
        gain = int(sells[j] - buys)
        role = chans[i][j][0].lower()
        # the figure gives a mark-up, not the intermediary's other costs: ask for the mark-up in francs (P4 review)
        third = short(f"In channel {letters[i]}, how many francs does the {role} add to the price of each {unit} as its "
                      f"mark-up?", gain, money(gain))
    else:
        a, b = rng.sample(range(len(chans)), 2)
        if ends[a] < ends[b]:
            a, b = b, a
        gap = ends[a] - ends[b]
        third = short(f"How much more does a consumer pay for one {unit} through channel {letters[a]} than through "
                      f"channel {letters[b]}, in Frw?", gap, money(gap))
    return [first, second, third]
