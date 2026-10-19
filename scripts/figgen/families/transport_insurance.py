"""Transport and insurance for traders (UP), as WAEC/NERDC Commerce ("Transport and insurance", "Aids to trade") set
them, for goods moving between Kigali and the ports of Mombasa and Dar es Salaam. Two sub-types:

- transport: a clearing agent's quotes for four ways of sending goods (ordinary lorry, road and rail, express courier,
  air cargo): cost per tonne, days on the way and the most one shipment can carry. Asks the cheapest way to send a load
  within a deadline in one shipment (never the cheapest of all, which is too slow or too small), the total cost of a
  load by one way, and how many shipments a small carrier needs or how much one way saves on another.
- insurance: a policy schedule and a past claim: the goods' actual value, the sum insured (less than the value), the
  premium rate and a loss on the way, with premium = premium rate × sum insured and the average clause
  (compensation = sum insured ÷ actual value × loss) printed. The cover matches the journey (P4 review): goods-in-transit
  insurance for a road journey between Kigali and a port, marine cargo insurance for one with a sea voyage, and the
  cause of the loss happens on that journey (no sea water on a road). Asks, in the past tense the claim is told in, the
  premium paid, the compensation paid, and the part of the loss the trader bore.

The quotes are invented for the exercise and say so; every amount asked is whole francs.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from ..core import NAMES, count, mcq, money, short
from .econ_tables import frw, titled_table

ID = "transport_insurance"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("UP",)
CONCEPTS = ("business.transport-and-insurance", "business.international-trade-and-aids")
# A topic whose sections the book lists is reached only if its name or a section names transport or insurance.
NEEDS = r"transport|insurance|aids to trade|distribution"
# Home and foreign trade (JAMB and WAEC Commerce "Trade") share these concepts but teach buying and selling.
AVOID = r"^trade$"


def avoid_for(p: dict) -> str:
    """Choosing how to send goods is physical distribution; insuring them is not."""
    return AVOID + r"|distribution" if p["kind"] == "insurance" else AVOID


# Each way of sending goods: cost per tonne in francs (range, step), days (range), most tonnes per shipment (range, step)
MODES = {
    "Ordinary lorry": ((180_000, 260_000, 5_000), (6, 9), (28, 32, 1)),
    "Road and rail": ((140_000, 200_000, 5_000), (10, 16), (40, 60, 5)),
    "Express courier": ((400_000, 600_000, 10_000), (3, 5), (5, 12, 1)),
    "Air cargo": ((2_500_000, 4_000_000, 100_000), (1, 2), (2, 6, 1)),
}
# (the trader, what it sends, which way: out to the port or in from it)
TRADERS = [
    ("a coffee exporter in Kigali", "coffee", "out"), ("a tea exporter in Kigali", "tea", "out"),
    ("a mineral trader in Kigali", "tin ore", "out"), ("a hardware importer in Kigali", "iron sheets", "in"),
    ("an electronics importer in Kigali", "electronic goods", "in"), ("a textile importer in Kigali", "cloth", "in"),
]
PORTS = ["Mombasa", "Dar es Salaam"]
# Insured traders: (the business, the goods, which way: out to the port or in from it)
POLICIES = [
    ("Huye Coffee Exporters", "bags of coffee", "out"),
    ("Kigali Tea Traders", "chests of tea", "out"),
    ("Nyabugogo Hardware Importers", "bundles of iron sheets", "in"),
    ("Remera Electronics Importers", "boxes of television sets", "in"),
    ("Musanze Textile Importers", "bales of cloth", "in"),
]
# Each cover with the losses that happen on its journey: a road journey has no sea, a voyage has its own perils.
COVERS = {
    "road": ("Goods-in-transit insurance", ["damaged by rain when the lorry's cover tore", "damaged when the lorry overturned",
                                            "stolen from the lorry at night",
                                            "damaged when part of the load fell during unloading"]),
    "sea": ("Marine cargo insurance", ["damaged by sea water in a storm during the voyage",
                                       "damaged when containers shifted in rough seas",
                                       "damaged by sea water when a container leaked on the ship"]),
}
FAR_PORTS = ["Mumbai", "Dubai", "Guangzhou"]  # where imports come from by sea
MARKETS = ["Rotterdam", "Hamburg", "Dubai"]  # where exports go by sea
RATIOS = [Fraction(1, 2), Fraction(3, 5), Fraction(2, 3), Fraction(3, 4), Fraction(4, 5), Fraction(9, 10)]
RATES = [0.5, 1, 1.5, 2, 2.5, 3]


def _route(way: str, port: str) -> tuple[str, str]:
    return ("Kigali", port) if way == "out" else (port, "Kigali")


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.5:
        trader, goods, way = rng.choice(TRADERS)
        port = rng.choice(PORTS)
        while True:
            modes = []
            for name, ((lo, hi, st), (d0, d1), (m0, m1, ms)) in MODES.items():
                modes.append([name, rng.randrange(lo, hi + 1, st), rng.randint(d0, d1), rng.randrange(m0, m1 + 1, ms)])
            # the answer is chosen first, so no way of sending is the answer most of the time
            target = rng.choices(["Ordinary lorry", "Express courier", "Air cargo"], weights=[4, 4, 2])[0]
            cheapest = min(modes, key=lambda m: m[1])

            def answer(load: int, days: int):
                fits = [m for m in modes if m[2] <= days and m[3] >= load]
                return None if not fits or cheapest in fits else min(fits, key=lambda m: m[1])[0]

            pairs = [(t, d) for t in range(2, 31) for d in range(2, 15) if answer(t, d) == target]
            if not pairs:
                continue
            load, days = rng.choice(pairs)
            rng.shuffle(modes)
            start, end = _route(way, port)
            return {"band": "UP", "kind": "transport", "trader": trader, "goods": goods, "from": start, "to": end,
                    "modes": modes, "load": load, "deadline": days}
    who, goods, way = rng.choice(POLICIES)
    cover = rng.choice(["road", "sea"])
    port = rng.choice(PORTS)
    if cover == "road":
        journey = f"Kigali to {port} by lorry" if way == "out" else f"{port} to Kigali by lorry"
    elif way == "out":
        journey = f"Kigali to {rng.choice(MARKETS)}: by lorry to {port}, then by ship"
    else:
        journey = f"{rng.choice(FAR_PORTS)} to Kigali: by ship to {port}, then by lorry"
    loss_how = rng.choice(COVERS[cover][1])
    while True:
        value = rng.randrange(10_000_000, 60_000_001, 1_000_000)
        ratio = rng.choice(RATIOS)
        insured = value * ratio
        if insured.denominator != 1 or insured % 100_000:
            continue
        insured = int(insured)
        rate = rng.choice(RATES)
        if Fraction(str(rate)) * insured / 100 % 1:
            continue
        loss = rng.randrange(1_000_000, insured, 100_000)
        comp = Fraction(insured, value) * loss
        if comp.denominator != 1 or comp == loss or 2 * comp == loss:  # compensation and the trader's share differ
            continue
        return {"band": "UP", "kind": "insurance", "insured_by": who, "goods": goods, "bags": rng.randrange(100, 801, 20),
                "cover": cover, "journey": journey, "value": value, "insured": insured, "rate": rate, "loss": loss,
                "loss_how": loss_how}


def _rate(r) -> str:
    return f"{r:g}"


def draw(p: dict):
    if p["kind"] == "transport":
        body = [[m[0], frw(m[1]), str(m[2]), str(m[3])] for m in p["modes"]]
        return titled_table(f"Quotes for sending {p['goods']} from {p['from']} to {p['to']}",
                            ["Way of sending", "Cost per tonne\n(Frw)", "Time on the way\n(days)",
                             "Most per shipment\n(tonnes)"], body, ["l", "r", "r", "r"],
                            notes=["Cost of sending = cost per tonne × tonnes sent (rates for this exercise)"])
    body = [["Insured", p["insured_by"]], ["Goods", f"{p['bags']} {p['goods']}"],
            ["Journey", p["journey"]],
            ["Actual value of the goods", f"{frw(p['value'])} Frw"], ["Sum insured", f"{frw(p['insured'])} Frw"],
            ["Premium rate", f"{_rate(p['rate'])}% of the sum insured"],
            ["Loss on the journey", f"goods worth {frw(p['loss'])} Frw"], ["Cause", p["loss_how"]]]
    return titled_table(f"{COVERS[p['cover']][0]}: policy schedule and claim", ["Item", "Details"], body, ["l", "l"],
                        notes=["Premium = premium rate × sum insured",
                               "Average clause: compensation = sum insured ÷ actual value × loss"])


VERBS = ["works for", "keeps the books of", "arranges shipping for", "helps", "advises"]
# The claim is over: its questions are asked in the past (P4 review: "for the next order" beside a past claim).
CLAIM_VERBS = ["works for", "keeps the books of", "checks the records of", "advises", "studies a past claim by"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "transport":
        modes = {m[0]: m[1:] for m in p["modes"]}
        load, days = p["load"], p["deadline"]
        fits = {k: v for k, v in modes.items() if v[1] <= days and v[2] >= load}
        best = min(fits, key=lambda k: fits[k][0])
        first = mcq(f"{who} {rng.choice(VERBS)} {p['trader']} and must send {load} tonnes of {p['goods']} from "
                    f"{p['from']} to {p['to']} within {days} days, in one shipment. Which is the cheapest way?",
                    best, [k for k in modes if k != best], rng)
        mode = rng.choice(list(modes))
        t = rng.randint(2, min(modes[mode][2], 40))
        second = short(f"What is the total cost of sending {t} tonnes of {p['goods']} to {p['to']} by {mode.lower()}, "
                       f"in Frw?", t * modes[mode][0], money(t * modes[mode][0]))
        small = [k for k in modes if modes[k][2] <= 12]
        if rng.random() < 0.5:
            k = rng.choice(small)
            cap = modes[k][2]
            t = rng.choice([x for x in range(cap + 1, 4 * cap) if x % cap])
            n = math.ceil(t / cap)
            third = count(f"How many shipments by {k.lower()} are needed to send {t} tonnes of {p['goods']}?", n,
                          "shipments")
        else:
            a, b = rng.sample(list(modes), 2)
            if modes[a][0] > modes[b][0]:
                a, b = b, a
            t = rng.randint(2, min(modes[a][2], modes[b][2]))
            saved = t * (modes[b][0] - modes[a][0])
            third = short(f"How much is saved by sending {t} tonnes of {p['goods']} by {a.lower()} instead of by "
                          f"{b.lower()}, in Frw?", saved, money(saved))
        return [first, second, third]
    premium = int(Fraction(str(p["rate"])) * p["insured"] / 100)
    comp = int(Fraction(p["insured"], p["value"]) * p["loss"])
    firm = p["insured_by"]
    return [
        short(f"{who} {rng.choice(CLAIM_VERBS)} {firm}, which insured {p['bags']} {p['goods']} for the journey shown. "
              f"What premium did {firm} pay for this policy, in Frw?", premium, money(premium)),
        short(f"Under the average clause, how much compensation did the insurer pay {firm} for the loss, in Frw?", comp,
              money(comp)),
        short(f"How much of the loss of {frw(p['loss'])} Frw did {firm} have to bear itself, in Frw?", p["loss"] - comp,
              money(p["loss"] - comp)),
    ]
