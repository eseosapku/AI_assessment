"""Costs and revenue of a firm (UP, AL): a table of output, from nothing to six or seven units a day, against total
cost in francs, for a Rwandan firm (a Huye bakery, a Kigali tailor, a Musanze furniture workshop). The average
cost at an output and the marginal cost of a unit, each with its formula in the stem. At A Level the firm also
sells at a price printed above the table (perfect competition, MR = price) or the table adds total revenue
(MR falls), and the profit-maximising output is asked, by MC = MR.

Marginal cost falls and then rises (the U shape of the textbooks). With whole units, MC equal to MR at a unit
would tie two outputs on profit, so MC never equals MR: every unit up to the answer has MR above MC, and every
unit after it MR below, so profit is greatest at one output only.
"""
from __future__ import annotations

import random

from ..core import NAMES, money, short
from .econ_tables import frw, titled_table

ID = "cost_revenue"
KIND = "business.document"
SUBJECT = "economics"
BANDS = ("UP", "AL")
# The A Level table, with total revenue or a price and the profit-maximising output, is what Rwanda S4's "Revenues and
# profits of a firm" teaches (TR, AR, MR and profit), so it reaches that Upper Secondary topic by its name (P4).
ALSO_BANDS = {"AL": ("UP",)}
CONCEPTS = tuple(f"economics.{c}" for c in ("costs-of-production", "cost-functions", "revenue-and-profit"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"\bcosts?\b|cost function|revenues? and profits?"

# the firm, what it makes (plural, singular), and francs to one step of cost (MC moves in steps of 100 of these)
FIRMS = {
    "bakery": ("a bakery in Huye", "loaves", "loaf", 1),
    "tailor": ("a tailor in Kigali", "shirts", "shirt", 10),
    "furniture": ("a furniture workshop in Musanze", "chairs", "chair", 50),
    "soap": ("a soap maker in Rubavu", "boxes of soap", "box of soap", 5),
    "juice": ("a juice maker in Rwamagana", "crates of juice", "crate of juice", 20),
}


def concepts_for(p: dict) -> tuple[str, ...]:
    """Revenue and profit only where the figure shows them: at A Level."""
    return CONCEPTS if p["band"] == "AL" else CONCEPTS[:2]


def _mc(rng: random.Random, n: int) -> list[int]:
    """Marginal costs of units 1..n in steps: falling to a lowest unit, then rising faster and faster."""
    low = rng.choice([2, 3])
    base = rng.randint(2, 5)
    left = [base]
    for _ in range(low - 1):
        left.append(left[-1] + rng.randint(1, 2))
    rises = sorted(rng.randint(1, 4) for _ in range(n - low))
    right, v = [], base
    for r in rises:
        v += r
        right.append(v)
    return left[::-1] + right


def sample(rng: random.Random) -> dict:
    firm = rng.choice(sorted(FIRMS))
    unit = 100 * FIRMS[firm][3]  # francs in one step of cost
    band = rng.choice(BANDS)
    while True:
        n = rng.choice([6, 7])
        mc = _mc(rng, n)
        tc = [unit * rng.randint(5, 30)]
        for v in mc:
            tc.append(tc[-1] + unit * v)
        whole = [k for k in range(2, n + 1) if tc[k] % k == 0]
        if not whole:
            continue
        p = {"band": band, "firm": firm, "tc": tc, "mode": None, "price": None, "tr": None,
             "ac_at": rng.choice(whole), "mc_to": rng.randint(2, n)}
        if band == "UP":
            return p
        mcf = [None] + [unit * v for v in mc]
        mode = rng.choice(["price", "tr"])
        if mode == "price":
            # The last unit made costs less than the price; the next costs more (never equal: no tie).
            best = rng.randint(3, n - 1)
            below, above = max(mcf[1:best + 1]), mcf[best + 1]
            prices = [v for v in range(below + unit // 2, above, unit // 2)]
            if not prices:
                continue
            price = rng.choice(prices)
            tr = [price * k for k in range(n + 1)]
            p.update(mode="price", price=price)
        else:
            # Total revenue = output x a price that falls by the same step for each extra unit: MR falls twice as fast.
            b = unit // 2 * rng.choice([1, 2])
            a = rng.randint(4, 16) * unit
            tr = [k * (a - b * k) for k in range(n + 1)]
            if min(tr[1:]) <= 0 or any(y <= x for x, y in zip(tr, tr[1:])):
                continue
            p.update(mode="tr", tr=tr)
        mr = [None] + [tr[k] - tr[k - 1] for k in range(1, n + 1)]
        ups = [k for k in range(1, n + 1) if mr[k] > mcf[k]]
        if not ups or any(mr[k] == mcf[k] for k in range(1, n + 1)):
            continue
        best = max(ups)
        if ups != list(range(1, best + 1)) or not 2 <= best < n:
            continue  # MR above MC up to the answer, below it after: one profit-maximising output
        p["best"] = best
        return p


def draw(p: dict):
    place, plural, singular, _ = FIRMS[p["firm"]]
    heads = [f"Output\n({plural} per day)", "Total cost\n(Frw)"]
    rows = [[str(k), frw(c)] for k, c in enumerate(p["tc"])]
    if p["mode"] == "tr":
        heads.append("Total revenue\n(Frw)")
        rows = [r + [frw(v)] for r, v in zip(rows, p["tr"])]
    notes = [f"Price: {frw(p['price'])} Frw per {singular}"] if p["mode"] == "price" else []
    return titled_table(f"Costs at {place}", heads, rows, ["c", "r", "r"][:len(heads)], notes, least=1.5)


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    place, plural, singular, _ = FIRMS[p["firm"]]
    tc = p["tc"]
    q, k = p["ac_at"], p["mc_to"]
    ac, mc = tc[q] // q, tc[k] - tc[k - 1]
    qs = [
        short(f"{who} {rng.choice(VERBS)} the costs of {place} {rng.choice(SETTINGS)}. Average cost = total cost ÷ output. "
              f"What is the average cost when {q} {plural} are made, in Frw per {singular}?", ac, money(ac)),
        short(f"Marginal cost is the extra total cost of making one more unit. When output rises from {k - 1} to {k} "
              f"{plural}, what is the marginal cost, in Frw?", mc, money(mc)),
    ]
    if p["band"] == "AL":
        how = (f"Each {singular} sells at the price shown, so MR = price." if p["mode"] == "price" else
               "Marginal revenue (MR) is the extra total revenue from one more unit.")
        qs.append(short(f"{how} The firm maximises profit where MC = MR: it makes every unit whose MR is more than its MC, "
                        f"and none whose MC is more than its MR. What is the profit-maximising output, in {plural} per day?",
                        p["best"], [f"{p['best']} {plural}", f"{p['best']} {plural} per day", f"{p['best']} units"]))
    return qs
