"""Business Model Canvas (UP; Rwanda Entrepreneurship S5 "Business Plan Using Business Model Canvas", S6 "Business
Plan Pitch", and S3 "Developing a Business Plan" by name): the nine-block canvas for an invented Rwandan business (a
Huye bakery, a Rwamagana juice maker, a Musanze tour company, a Kigali tailor), laid out as the books draw it: Key
Partners, Key Activities over Key Resources, Value Propositions, Customer Relationships over Channels, Customer
Segments, and Cost Structure beside Revenue Streams along the bottom, each costed in francs a month. Each block shows two
short notes; one or two notes, lettered P and Q, wait below the canvas to be placed.

Which block a lettered note belongs in (the key from the fixed bank NOTES: only a block's first note, which fits that
block alone, is ever placed; the wrong options are blocks plainly wrong for it, chosen so the key is never the central
option); which revenue stream brings in the most money (one plainly largest); and the monthly profit, total revenue
less total costs, with the formula in the stem. A placed note never leaves its block empty, so no gap gives a key away.
"""
from __future__ import annotations

import random

from matplotlib.patches import FancyBboxPatch, Rectangle

from ..core import INK, NAMES, mcq, money, new_figure, short

ID = "business_model_canvas"
KIND = "diagram.template"
SUBJECT = "business"
BANDS = ("UP",)
# The same canvas serves Rwanda S3 "Developing a Business Plan" (Lower Secondary), where the topic's name says so.
ALSO_BANDS = {"UP": ("LS",)}
CONCEPTS = ("business.business-model-canvas", "business.business-plan-development")
# A topic whose sections the book lists is reached only if its name or a section names the canvas or a business plan.
NEEDS = r"business model canvas|business plan"
# Listed without sections, sharing the canvas or business plans, but teaching other things.
AVOID = r"business organisation|e-commerce|market research|forms of business"

BLOCKS = ["Key Partners", "Key Activities", "Key Resources", "Value Propositions", "Customer Relationships", "Channels",
          "Customer Segments"]
# The wrong blocks offered for a note: blocks that are plainly wrong for it by the canvas's definitions (a supplier is
# no channel or customer group; a machine is no relationship; a place where customers buy is no activity), never the
# neighbouring blocks a note could be argued
# into (P4 blind review: Value Propositions against Customer Segments, Channels against Key Activities, Customer
# Relationships against Value Propositions all had two defensible keys).
FAR = {
    "Key Partners": ["Key Activities", "Channels", "Customer Segments"],
    "Key Activities": ["Key Partners", "Channels", "Customer Segments"],
    "Key Resources": ["Customer Relationships", "Channels", "Customer Segments"],
    "Value Propositions": ["Key Partners", "Key Resources", "Cost Structure"],
    "Customer Relationships": ["Key Partners", "Key Resources", "Cost Structure"],
    "Channels": ["Key Partners", "Key Activities", "Cost Structure"],
    "Customer Segments": ["Key Partners", "Key Activities", "Key Resources"],
}
# Three notes a block. The FIRST note of each block is the one that may wait below the canvas to be placed: it fits
# that block alone by the canvas's definitions (a supplier, an activity the firm does, a thing it owns, a benefit to
# the customer, a way it keeps customers, a way it reaches and sells to them, a group of customers). The other two only
# fill the canvas.
NOTES = {
    "bakery": {
        "firm": "Inzozi Bakery", "place": "Huye",
        "blocks": {
            "Key Partners": ["Flour mill that supplies our flour", "Dairy cooperative that supplies milk",
                             "Gas company that refills our cylinders"],
            "Key Activities": ["Baking bread every night", "Decorating wedding cakes", "Cleaning the ovens each week"],
            "Key Resources": ["Two gas ovens", "Five skilled bakers", "Secret recipe for honey bread"],
            "Value Propositions": ["Bread still warm at 6 a.m.", "Cakes made to order", "Soft bread that stays fresh"],
            "Customer Relationships": ["Loyalty card for regular customers", "WhatsApp group for regular buyers",
                                       "Owner greets customers by name"],
            "Channels": ["Shop in Huye town where customers buy bread", "Delivers to kiosks", "Takes orders by phone"],
            "Customer Segments": ["University students", "Families near the bakery", "Hotels and restaurants"],
        },
        "costs": [("Flour and sugar", 300000, 900000), ("Wages", 300000, 700000), ("Gas and electricity", 80000, 200000),
                  ("Rent", 100000, 250000)],
        "revenue": ["Bread sales", "Cake orders", "Hotel contracts"],
    },
    "juice": {
        "firm": "Umucyo Juice", "place": "Rwamagana",
        "blocks": {
            "Key Partners": ["Bottle supplier in Kigali", "Pineapple farmers' cooperative", "Bank that lent money for machines"],
            "Key Activities": ["Pressing and bottling juice", "Testing every batch", "Cleaning the machines daily"],
            "Key Resources": ["Juice-pressing machine", "Cold store room", "Food-safety certificate"],
            "Value Propositions": ["No added sugar", "Juice from local fruit", "Small bottles at a low price"],
            "Customer Relationships": ["Thank-you gifts for loyal schools", "Free tasting days in shops",
                                       "Phone line for customer complaints"],
            "Channels": ["Kiosk at the bus park where customers buy juice", "Supermarkets in Kigali", "Van deliveries to schools"],
            "Customer Segments": ["Health-conscious adults", "Schoolchildren", "Restaurants"],
        },
        "costs": [("Fruit", 200000, 700000), ("Bottles and labels", 150000, 400000), ("Wages", 300000, 700000),
                  ("Electricity", 60000, 180000)],
        "revenue": ["Supermarket sales", "School contracts", "Kiosk takings"],
    },
    "tours": {
        "firm": "Akagera Tours", "place": "Musanze",
        "blocks": {
            "Key Partners": ["Car hire company that rents us extra cars", "Hotels that host our guests",
                             "Village dance groups"],
            "Key Activities": ["Guiding hikes to the caves", "Planning each trip", "Servicing the vehicles"],
            "Key Resources": ["Two four-wheel-drive vehicles", "Guides who speak four languages", "Licence to run tours"],
            "Value Propositions": ["Trips to quiet places few tourists see", "Safe trips with expert guides",
                                   "One price includes meals"],
            "Customer Relationships": ["Thank-you email after each trip", "Personal guide for each group",
                                       "Reviews answered within a day"],
            "Channels": ["Website where tourists book and pay", "Travel agents in Kigali", "Stand at the airport"],
            "Customer Segments": ["Foreign tourists", "Rwandan families on holiday", "University study groups"],
        },
        "costs": [("Fuel", 150000, 500000), ("Guides' wages", 300000, 800000), ("Park fees", 200000, 600000),
                  ("Vehicle repairs", 50000, 200000)],
        "revenue": ["Day hikes", "Two-day packages", "Airport transfers"],
    },
    "tailor": {
        "firm": "Akeza Tailors", "place": "Kigali",
        "blocks": {
            "Key Partners": ["Fabric wholesaler in Nyabugogo", "Sewing-machine repairer", "Printer of school badges"],
            "Key Activities": ["Measuring and sewing clothes", "Designing new styles", "Buying fabric each week"],
            "Key Resources": ["Six sewing machines", "Skilled tailors", "Pattern book of designs"],
            "Value Propositions": ["Clothes ready in three days", "Made-to-measure fit", "Modern styles in African fabric"],
            "Customer Relationships": ["Birthday discount for regular customers", "Free repairs for a month",
                                       "Text message when clothes are ready"],
            "Channels": ["Shop at Kimironko market where customers order clothes", "Online page with photos",
                         "Stall at the weekend market"],
            "Customer Segments": ["Office workers", "Schools needing uniforms", "Brides and wedding guests"],
        },
        "costs": [("Fabric and thread", 200000, 600000), ("Wages", 250000, 600000), ("Rent", 80000, 200000),
                  ("Electricity", 30000, 90000)],
        "revenue": ["Uniform contracts", "Tailored outfits", "Repairs"],
    },
}


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def sample(rng: random.Random) -> dict:
    biz = rng.choice(list(NOTES))
    t = NOTES[biz]
    away = rng.sample(BLOCKS, rng.choice([1, 1, 2]))
    notes, outside = [], []
    for block in BLOCKS:
        clear, *rest = t["blocks"][block]
        if block in away:  # the clear note waits outside; the other two stay in the block
            outside.append([block, clear])
            shown = rest
        else:
            shown = rng.sample([clear] + rest, 2)
        notes += [[block, n] for n in shown]
    rng.shuffle(outside)
    outside = [["PQ"[i], b, n] for i, (b, n) in enumerate(outside)]
    while True:
        costs = [[name, 10000 * rng.randint(lo // 10000, hi // 10000)] for name, lo, hi in t["costs"]]
        revenue = [[name, 50000 * rng.randint(4, 40)] for name in t["revenue"]]
        amounts = sorted(a for _, a in revenue)
        profit = sum(amounts) - sum(a for _, a in costs)
        if amounts[-1] - amounts[-2] >= 100000 and profit >= 100000:
            return {"band": "UP", "biz": biz, "notes": notes, "outside": outside, "costs": costs, "revenue": revenue}


def _wrap(text: str, width: int = 24) -> list[str]:
    lines, line = [], ""
    for w in text.split():
        if line and len(line) + 1 + len(w) > width:
            lines.append(line)
            line = w
        else:
            line = f"{line} {w}".strip()
    return lines + [line]


# Each block's box: (x, y, width, height) on a 15 by 9.6 canvas.
BOXES = {"Key Partners": (0, 3.2, 3, 6.4), "Key Activities": (3, 6.4, 3, 3.2), "Key Resources": (3, 3.2, 3, 3.2),
         "Value Propositions": (6, 3.2, 3, 6.4), "Customer Relationships": (9, 6.4, 3, 3.2), "Channels": (9, 3.2, 3, 3.2),
         "Customer Segments": (12, 3.2, 3, 6.4), "Cost Structure": (0, 0, 7.5, 3.2), "Revenue Streams": (7.5, 0, 7.5, 3.2)}
LINE = 0.3


def _block(ax, name: str, items: list[str], width: int = 24) -> None:
    x, y, w, h = BOXES[name]
    ax.add_patch(Rectangle((x, y), w, h, facecolor="white", edgecolor=INK, linewidth=1.2))
    head = name if len(name) <= 20 else name.replace(" ", "\n", 1)
    ax.text(x + 0.12, y + h - 0.12, head, ha="left", va="top", fontsize=9.5, fontweight="bold")
    yy = y + h - 0.2 - LINE * (head.count("\n") + 1) - 0.3
    for item in items:
        for k, line in enumerate(_wrap(item, width)):
            ax.text(x + 0.14, yy, ("• " if k == 0 else "   ") + line, ha="left", va="center", fontsize=8.8)
            yy -= LINE
        yy -= 0.16


def draw(p: dict):
    t = NOTES[p["biz"]]
    fig, ax = new_figure(11.5, 9.0)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    for name in BLOCKS:
        _block(ax, name, [n for b, n in p["notes"] if b == name])
    _block(ax, "Cost Structure", [f"{n}: {fr(a)} Frw" for n, a in p["costs"]], width=60)
    _block(ax, "Revenue Streams", [f"{n}: {fr(a)} Frw" for n, a in p["revenue"]], width=60)
    ax.text(7.5, 10.15, f"Business Model Canvas: {t['firm']}, {t['place']}", ha="center", va="center", fontsize=12.5,
            fontweight="bold")
    ax.text(7.5, 9.8, "Costs and revenues are per month", ha="center", va="center", fontsize=9.5, style="italic")
    ax.text(0, -0.45, "Notes not yet placed on the canvas:", ha="left", va="center", fontsize=10, fontweight="bold")
    for i, (letter, _, text) in enumerate(p["outside"]):
        x = 0.2 + 7.5 * i
        ax.add_patch(FancyBboxPatch((x, -1.55), 6.8, 0.75, boxstyle="round,pad=0.02,rounding_size=0.1",
                                    facecolor="#fff6cc", edgecolor="#b8a650", linewidth=1.0))
        ax.text(x + 0.25, -1.175, letter, ha="left", va="center", fontsize=12, fontweight="bold")
        ax.text(x + 0.85, -1.175, text, ha="left", va="center", fontsize=10)
    ax.set_xlim(-0.1, 15.1)
    ax.set_ylim(-1.7, 10.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["fills in", "studies", "checks", "is given", "reviews"]
SETTINGS = ["for an entrepreneurship lesson", "before a business plan pitch", "for a school business club",
            "for homework", "for a class test", "with the owner"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    firm = NOTES[p["biz"]]["firm"]
    rev = {n: a for n, a in p["revenue"]}
    best = max(rev, key=rev.get)
    profit = sum(rev.values()) - sum(a for _, a in p["costs"])
    letter, block, _ = p["outside"][0]
    qs = [
        mcq(f"{who} {rng.choice(VERBS)} this business model canvas for {firm} {rng.choice(SETTINGS)}. "
            f"In which block of the canvas should note {letter} go?", block, FAR[block], rng),
        mcq(f"Which revenue stream on the canvas for {firm} brings in the most money each month?", best,
            [n for n in rev if n != best], rng),
        short(f"Monthly profit = total revenue − total costs. What monthly profit does the canvas for {firm} show, "
              f"in Frw?", profit, money(profit)),
    ]
    if len(p["outside"]) > 1:
        letter, block, _ = p["outside"][1]
        qs.append(mcq(f"On the canvas for {firm}, which block should note {letter} be written in?", block,
                      FAR[block], rng))
    return qs
