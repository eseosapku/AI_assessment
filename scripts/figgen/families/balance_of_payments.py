"""The current account of the balance of payments (UP; AL by ALSO_BANDS): an economy's current account for one year
in billions of francs, as Cambridge IGCSE and AS Level and the Rwanda S6 book set it out: exports and imports of
goods, exports and imports of services, net primary income (negative, as Rwanda's is) and net secondary income
(remittances and grants, positive), then the current account balance. One figure is marked "?": the balance itself,
or net primary or secondary income.

The trade in goods balance; then, if the balance is the blank, whether the current account is in surplus or deficit
and by how much (two directions by two amounts: the right one and the one left when the income lines are forgotten or
primary income's sign is lost), or else the missing income line from the printed balance; and the trade in services
balance or the goods and services balance. Every rule is in its stem, and a deficit is asked as a negative number.
The table names no country and no year, so it is never passed off as a real record.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, short
from .econ_tables import titled_table

ID = "balance_of_payments"
KIND = "table.data"
SUBJECT = "economics"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same table in Cambridge AS Level, whose chapter is named for it
CONCEPTS = ("economics.balance-of-payments", "economics.current-account-balance", "economics.balance-of-trade",
            "economics.balance-of-payments-deficits")
# Commerce's trade topics (WAEC, JAMB, NERDC) teach the balance of trade and of payments under business.
ALSO = ("business.international-trade-and-aids",)
# "Nigerian economy" is another country's; AS Level's chapter on policy for the current account works no table;
# WAEC Commerce's "Aids to trade" (banking, insurance, transport) and quality topics share only the trade concept.
AVOID = r"nigeria|government policy|^aids to trade$|transport and insurance|quality"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"balance of pay|current account|balance of trade|\bBOP\b"

ROWS = [("xg", "Exports of goods"), ("mg", "Imports of goods"), ("xs", "Exports of services"),
        ("ms", "Imports of services"), ("pi", "Primary income (net)"), ("si", "Secondary income (net)")]


def _tens(rng: random.Random, lo: int, hi: int) -> int:
    return 10 * rng.randint(lo // 10, hi // 10)


def sample(rng: random.Random) -> dict:
    while True:
        it = {"xg": _tens(rng, 1000, 3500), "mg": _tens(rng, 1500, 4000), "xs": _tens(rng, 500, 1500),
              "ms": _tens(rng, 500, 1500), "pi": -_tens(rng, 50, 400), "si": _tens(rng, 200, 1200)}
        goods, services = it["xg"] - it["mg"], it["xs"] - it["ms"]
        ca = goods + services + it["pi"] + it["si"]
        if abs(ca) < 50 or abs(goods) < 50 or abs(services) < 30 or abs(goods + services) < 50:
            continue
        if len(set(it.values()) | {ca}) < 7 or _slip(it) is None:
            continue
        return {"band": "UP", "items": it, "blank": rng.choice(["ca", "ca", "pi", "si"]),
                "third": rng.choice(["services", "goods_services"])}


def _slip(it: dict) -> int | None:
    """The amount a student reaches by forgetting the income lines, by adding primary income as if it were positive, or
    by leaving out services: the first that is plainly not the balance."""
    goods, services = it["xg"] - it["mg"], it["xs"] - it["ms"]
    ca = goods + services + it["pi"] + it["si"]
    slips = [abs(goods + services), abs(ca - 2 * it["pi"]), abs(goods + it["pi"] + it["si"])]
    return next((s for s in slips if s and abs(s - abs(ca)) >= 50), None)


def _signed(v: int) -> str:
    return ("−" if v < 0 else "") + f"{abs(v):,}".replace(",", " ")


def draw(p: dict):
    it = p["items"]
    ca = sum(it[k] * (-1 if k in ("mg", "ms") else 1) for k in it)
    rows = [[label, "?" if k == p["blank"] else _signed(it[k])] for k, label in ROWS]
    rows.append(["Current account balance", "?" if p["blank"] == "ca" else _signed(ca)])
    return titled_table("Current account for one year", ["Item", "Billion Frw"], rows, ["l", "r"], least=1.4)


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]
CA_RULE = ("The current account balance = trade in goods balance + trade in services balance + net primary income + "
           "net secondary income.")


def _forms(v: int, balance: bool = True) -> list[str]:
    """A signed number of billions, as a student may write it: −1530, -1 530, and for a balance 1530 deficit."""
    shown = f"{abs(v):,}".replace(",", " ")
    out = []
    for n in (str(abs(v)), shown, f"{abs(v):,}"):
        for unit in ("", " billion", " billion Frw", " bn"):
            for sign in (["-", "−"] if v < 0 else ["", "+"]):
                out.append(f"{sign}{n}{unit}")
            if balance:
                word = "deficit" if v < 0 else "surplus"
                out += [f"{word} of {n}{unit}", f"{n}{unit} {word}", f"a {word} of {n}{unit}"]
    return [str(v)] + [f for i, f in enumerate(out) if f not in out[:i] and f != str(v)]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    it = p["items"]
    goods, services = it["xg"] - it["mg"], it["xs"] - it["ms"]
    ca = goods + services + it["pi"] + it["si"]
    neg = " Give a deficit as a negative number."
    marked = {"ca": "the balance", "pi": "net primary income", "si": "net secondary income"}[p["blank"]]
    qs = [short(f"{who} {rng.choice(VERBS)} this current account {rng.choice(SETTINGS)}, with {marked} marked ?. The trade in "
                f"goods balance = exports of goods − imports of goods. What is the trade in goods balance, in billion "
                f"Frw?{neg}", goods, _forms(goods))]
    if p["blank"] == "ca":
        wrong = _slip(it)
        amt = lambda v: f"{v:,}".replace(",", " ")  # noqa: E731
        options = [f"A {w} of {amt(v)} billion Frw" for w in ("surplus", "deficit") for v in (abs(ca), wrong)]
        key = f"A {'surplus' if ca > 0 else 'deficit'} of {amt(abs(ca))} billion Frw"
        qs.append(mcq(f"{CA_RULE} Is the current account in surplus or deficit, and by how much?", key, options, rng))
    else:
        name = {"pi": "net primary income", "si": "net secondary income"}[p["blank"]]
        qs.append(short(f"{CA_RULE} What is {name}, marked ?, in billion Frw? If it is negative, give it with a minus sign.",
                        it[p["blank"]], _forms(it[p["blank"]], balance=False)))
    if p["third"] == "services":
        qs.append(short("The trade in services balance = exports of services − imports of services. What is the trade in "
                        f"services balance, in billion Frw?{neg}", services, _forms(services)))
    else:
        both = goods + services
        qs.append(short("The goods and services balance = exports of goods and services − imports of goods and services. "
                        f"What is the goods and services balance, in billion Frw?{neg}", both, _forms(both)))
    return qs
