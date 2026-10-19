"""Promotion campaign results (UP, with AS Level chapters reached by name; LS for NERDC JSS "Marketing introduction"):
a table of what a Rwandan business spent on each advertising medium and what each brought in, with the formulas
printed under it. Three sub-types:

- campaign (UP): media (radio, television, posters, a newspaper, billboards, flyers, social media ...) with the cost,
  the people reached and the sales each advert brought; cost per sale = cost ÷ sales printed. Asks one medium's cost
  per sale, the medium with the lowest cost per sale (never the cheapest advert nor the one with most sales, both among
  the options), and the share of the budget spent on one medium (formula in the stem).
- digital (UP): online adverts with cost, impressions, clicks and sales; click-through rate = clicks ÷ impressions
  × 100 and cost per sale printed. Asks a click-through rate, the lowest cost per sale (the highest click-through rate,
  the cheapest advert and the most sales among the options), and a cost per click or a share of the budget.
- simple (LS): three or four media with their cost and the new customers each brought; cost per new customer printed.
  Asks one medium's cost per new customer, the lowest, and the total spent.

Every cost per sale, rate and share asked is a whole number; the lowest cost per sale leads the next by 100 Frw
at least, and each medium costs what such an advert costs (television dearest, flyers cheapest).
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, money, short
from .econ_tables import frw, titled_table

ID = "promotion_results"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("UP", "LS")
ALSO_BANDS = {"UP": ("AL",)}  # AS Level "What is marketing?" and "Marketing planning" read the same table
CONCEPTS = ("business.marketing-strategy", "business.digital-marketing")
# A topic whose sections the book lists (and an AS chapter, by its name) is reached only if it names what this teaches.
NEEDS = r"promotion|advertis|marketing"
# Listed without sections and sharing marketing strategy, but teaching other parts of marketing.
AVOID = r"e-commerce|market research|distribution|product and pric|globalisation|international|^trade"

# (the business, what it advertised, what one sale is)
FIRMS = [
    ("a juice maker in Rwamagana", "its new mango juice", "crates"),
    ("a hotel in Rubavu", "its weekend offer", "bookings"),
    ("a phone shop in Muhanga", "a new smartphone", "phones"),
    ("a bakery in Huye", "its new brown bread", "orders"),
    ("a furniture workshop in Musanze", "its school desks", "desks"),
    ("a dairy in Nyagatare", "its new yoghurt", "crates"),
    ("a bookshop in Kigali", "a new revision guide", "books"),
    ("a solar company in Kigali", "home solar kits", "kits"),
]
ONE_WORD = ["Radio", "Television", "Newspaper", "Posters", "Billboards", "Flyers"]
TWO_WORD = ["Social media", "Text messages"]  # at most one a figure, so no option stands apart by its length
ONLINE = ["Social media", "Search engine", "Video site", "Website banner", "Email newsletter"]
# What a month's advert in each medium costs, in francs: television dearest, flyers and messages cheapest.
COSTS = {"Television": (800_000, 2_500_000), "Radio": (200_000, 800_000), "Newspaper": (150_000, 600_000),
         "Posters": (50_000, 300_000), "Billboards": (300_000, 1_200_000), "Flyers": (30_000, 200_000),
         "Social media": (50_000, 400_000), "Text messages": (30_000, 200_000), "Search engine": (80_000, 500_000),
         "Video site": (100_000, 600_000), "Website banner": (40_000, 300_000), "Email newsletter": (20_000, 150_000)}

# How many people a month's advert in each medium reaches, in thousands.
REACH = {"Television": (100, 400), "Radio": (50, 300), "Newspaper": (10, 60), "Posters": (5, 30), "Billboards": (20, 120),
         "Flyers": (2, 15), "Social media": (20, 200), "Text messages": (5, 40)}


def _priced(rng: random.Random, name: str) -> tuple[int, int]:
    """A cost per sale (a multiple of 50 francs) and a number of sales whose product lies in the medium's range."""
    lo, hi = COSTS[name]
    while True:
        per, sales = rng.randrange(200, 6001, 50), rng.randrange(20, 801, 10)
        if lo <= per * sales <= hi:
            return per, sales


def _whole_share(cost: int, total: int) -> bool:
    return cost * 100 % total == 0


def sample(rng: random.Random) -> dict:
    firm, offer, sale = rng.choice(FIRMS)
    kind = rng.choices(["campaign", "digital", "simple"], weights=[3, 3, 2])[0]
    while True:
        if kind == "digital":
            names = rng.sample(ONLINE, rng.randint(3, 4))
        else:
            k = rng.randint(4, 5) if kind == "campaign" else rng.randint(3, 4)
            names = rng.sample(ONE_WORD, k) if rng.random() < 0.5 else rng.sample(ONE_WORD, k - 1) + [rng.choice(TWO_WORD)]
            rng.shuffle(names)
        k = len(names)
        pers, sales = map(list, zip(*(_priced(rng, n) for n in names)))
        costs = [a * b for a, b in zip(pers, sales)]
        best = pers.index(min(pers))
        if sorted(pers)[1] - pers[best] < 100:
            continue
        if best in (costs.index(min(costs)), sales.index(max(sales))):
            continue
        if costs.count(min(costs)) > 1 or sales.count(max(sales)) > 1 or len(set(costs)) < k:
            continue
        total = sum(costs)
        if kind == "simple":
            rows = [[n, c, s] for n, c, s in zip(names, costs, sales)]
        elif kind == "campaign":
            reach = [1_000 * rng.randint(*REACH[n]) for n in names]
            if not any(_whole_share(c, total) for c in costs):
                continue
            rows = [[n, c, r, s] for n, c, r, s in zip(names, costs, reach, sales)]
        else:
            imps = [rng.randrange(20_000, 300_001, 1_000) for _ in range(k)]
            ctrs = rng.sample(range(1, 9), k)
            clicks = [i * r // 100 for i, r in zip(imps, ctrs)]
            if any(i * r % 100 for i, r in zip(imps, ctrs)) or any(s >= c for s, c in zip(sales, clicks)):
                continue
            if ctrs.index(max(ctrs)) == best:
                continue
            if not any(c % n == 0 for c, n in zip(costs, clicks)) and not any(_whole_share(c, total) for c in costs):
                continue
            rows = [[n, c, i, cl, s] for n, c, i, cl, s in zip(names, costs, imps, clicks, sales)]
        return {"band": "LS" if kind == "simple" else "UP", "kind": kind, "firm": firm, "offer": offer, "sale": sale,
                "rows": rows}


def draw(p: dict):
    rows, sale = p["rows"], p["sale"]
    title = f"Advertising results: {p['firm']}, for {p['offer']}"
    if p["kind"] == "campaign":
        heads = ["Medium", "Cost (Frw)", "People reached", f"Sales\n({sale})"]
        notes = ["Cost per sale = cost ÷ number of sales"]
    elif p["kind"] == "digital":
        heads = ["Online advert", "Cost (Frw)", "Impressions\n(times shown)", "Clicks", f"Sales\n({sale})"]
        notes = ["Click-through rate (%) = clicks ÷ impressions × 100", "Cost per sale = cost ÷ number of sales"]
    else:
        heads = ["Medium", "Cost (Frw)", "New customers"]
        notes = ["Cost per new customer = cost ÷ number of new customers"]
    body = [[r[0]] + [frw(v) for v in r[1:]] for r in rows]
    return titled_table(title, heads, body, ["l"] + ["r"] * (len(heads) - 1), notes=notes)


VERBS = ["studies", "analyses", "is given", "reviews", "compares", "presents"]
SETTINGS = ["for the marketing manager", "for a business studies lesson", "before planning the next campaign",
            "for the owner", "for a class project", "for a marketing report"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    rows, firm, kind = p["rows"], p["firm"], p["kind"]
    names = [r[0] for r in rows]
    cost = {r[0]: r[1] for r in rows}
    sales = {r[0]: r[-1] for r in rows}
    per = {n: cost[n] // sales[n] for n in names}
    best = min(per, key=per.get)
    cheap, most = min(cost, key=cost.get), max(sales, key=sales.get)
    what = "new customer" if kind == "simple" else "sale"
    intro = f"{who} {rng.choice(VERBS)} these advertising results of {firm} {rng.choice(SETTINGS)}. "
    pool = [n for n in names if n != best] if rng.random() < 0.7 else names
    x = rng.choice(pool)
    own = short(f"What was the cost per {what} of the {x.lower()} advert, in Frw?", per[x], money(per[x]))
    trap = [cheap, most]
    if kind == "digital":
        rate = {r[0]: r[3] * 100 // r[2] for r in rows}
        trap.append(max(rate, key=rate.get))
    rest = [n for n in names if n != best and n not in trap]
    rng.shuffle(rest)
    lowest = mcq(rng.choice([f"Which advert for {p['offer']} had the lowest cost per {what}?",
                             f"For {firm}, which medium gave the lowest cost per {what}?"]),
                 best, list(dict.fromkeys(trap + rest)), rng)
    total = sum(cost.values())
    shares = [n for n in names if cost[n] * 100 % total == 0]

    def share(n: str):
        v = cost[n] * 100 // total
        return short(f"Share of the budget = cost of the advert ÷ total cost of all the adverts × 100. What share of "
                     f"the advertising budget was spent on the {n.lower()} advert, in %?", v, [f"{v}%", f"{v} %",
                                                                                              f"{v} percent"])

    if kind == "campaign":
        return [short(intro + own.stem, own.answer, own.accepted), lowest, share(rng.choice(shares))]
    if kind == "simple":
        return [short(intro + own.stem, own.answer, own.accepted), lowest,
                short(f"How much was spent in total on the adverts for {p['offer']}, in Frw?", total, money(total))]
    clicks = {r[0]: r[3] for r in rows}
    a = rng.choice(names)
    ctr = clicks[a] * 100 // next(r[2] for r in rows if r[0] == a)
    first = short(intro + f"What is the click-through rate of the {a.lower()} advert, in %?", ctr,
                  [f"{ctr}%", f"{ctr} %", f"{ctr} percent"])
    clicky = [n for n in names if cost[n] % clicks[n] == 0]
    clicky = [n for n in clicky if n != a] or clicky
    if clicky and (not shares or rng.random() < 0.5):
        b = rng.choice(clicky)
        cpc = cost[b] // clicks[b]
        third = short(f"Cost per click = cost ÷ number of clicks. What was the cost per click for the {b.lower()} "
                      f"advert, in Frw?", cpc, money(cpc))
    else:
        third = share(rng.choice(shares))
    return [first, lowest, third]
