"""Ratio, proportion, percentages and exchange rates with bar models and tables (LS, UP), as Cambridge Lower Secondary
"Simplifying ratios" (simplifying, sharing in a ratio, ratio and direct proportion), Cambridge IGCSE "Fractions,
percentages and standard form" (reverse percentages) and "Understanding measurement" (exchanging currencies), and
Rwanda S4 Subsidiary "Arithmetics" (percentages) teach them.

Five kinds of figure:
- share: a bar model of an amount shared between two people in a ratio, each part a box of the same size, the total
  printed over the whole bar. How much does one person get? How much more than the other? What is one box worth?
- simplify (LS): a mixing card (cement and sand, orange and mango juice, red and white paint) with the two amounts.
  The ratio in its simplest form.
- proportion (LS): a recipe for a number of people. How much of one thing for another number of people?
- percent: a bar in ten equal parts showing a price after a percentage discount or increase, the new price printed
  over its parts. The original price; the amount of the discount or increase. (Reverse percentages.)
- exchange (UP): a bank's board of exchange rates (1 US dollar = 1 300 Frw ...). Francs for an amount of a currency,
  or the currency for an amount of francs.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import FancyBboxPatch, Rectangle

from ..core import FILL_2, INK, NAMES, money, new_figure, short

ID = "ratio_bar"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = ("mathematics.working-with-ratio", "mathematics.ratio-problems", "mathematics.ratio-direct-proportion-ls",
            "mathematics.ratios-proportions-percentages", "mathematics.reverse-percentage",
            "mathematics.currency-conversion")
# A topic whose sections the book lists is reached only if its name or a section names what the figure teaches.
NEEDS = r"ratio|percent|proportion|currenc|exchang"
AVOID = r"project|trigonometry|thales|miles|measurement"

GOLD, BLUE = "#f6c26b", "#9cc9ec"
MIXES = [("cement", "sand", "bags"), ("orange juice", "mango juice", "cups"), ("red paint", "white paint", "tins"),
         ("maize flour", "cassava flour", "kg"), ("water", "milk", "litres"), ("soil", "compost", "buckets")]
RECIPES = [("chapati", [("flour", "g"), ("water", "ml"), ("oil", "ml")]),
           ("pancakes", [("flour", "g"), ("milk", "ml"), ("eggs", "")]),
           ("rice and beans", [("rice", "g"), ("beans", "g"), ("salt", "g")]),
           ("banana bread", [("flour", "g"), ("bananas", ""), ("sugar", "g")])]
ITEMS = ["bicycle", "radio", "school bag", "pair of shoes", "phone", "cooking pot", "mattress", "sewing machine"]
RATES = {"US dollar (USD)": [1250, 1300, 1350, 1400], "euro (EUR)": [1400, 1450, 1500, 1550],
         "Kenyan shilling (KES)": [10, 11, 12], "Ugandan shilling (UGX)": [0.35, 0.4], "pound (GBP)": [1700, 1750, 1800]}
SHARE_LEADS = ["{a} and {b} share some money in a ratio, as the bar model shows.",
               "{a} and {b} share a prize in a ratio, shown by the bar model.",
               "{a} and {b} divide some money between them, as the bar model shows.",
               "{a} and {b} split their earnings in a ratio; the bar model shows the shares."]
MIX_LEADS = ["{n} mixes {x} and {y} as the card shows.", "{n} follows the mixing card shown.",
             "{n} makes a mixture from the card shown.", "{n} uses the amounts on the card shown."]
RECIPE_LEADS = ["{n} follows the recipe shown.", "{n} cooks from the recipe card shown.", "{n} uses the recipe shown.",
                "{n} reads the recipe card shown."]
PERCENT_LEADS = ["{n} buys a {i} in a sale, as the bar model shows.", "{n} looks at the price of a {i}, shown by the bar model.",
                 "{n} draws a bar model for the price of a {i}.", "{n} compares the old and new price of a {i} with a bar model."]
EXCHANGE_LEADS = ["{n} changes money at a bank in Kigali, using the rates on the board.",
                  "{n} uses the exchange rates shown at a Kigali bank.", "{n} reads a bank's board of exchange rates.",
                  "{n} plans a trip using the exchange rates shown."]


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["sub"] == "percent":
        return ("mathematics.reverse-percentage", "mathematics.ratios-proportions-percentages")
    if p["sub"] == "exchange":
        return ("mathematics.currency-conversion",)
    return ("mathematics.working-with-ratio", "mathematics.ratio-problems", "mathematics.ratio-direct-proportion-ls",
            "mathematics.ratios-proportions-percentages")


def avoid_for(p: dict) -> str:
    """A ratio figure is no percentages chapter, nor a percentages bar a ratio chapter."""
    if p["sub"] == "percent":
        return AVOID + r"|ratio|currenc|exchang"
    if p["sub"] == "exchange":
        return AVOID.replace("|measurement", "") + r"|percent|ratio and proportion|simplifying ratios"
    return AVOID + r"|percent|currenc|exchang"


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["share", "simplify", "proportion", "percent"] if band == "LS" else ["share", "percent", "exchange"])
    p = {"band": band, "sub": sub, "name": rng.choice(NAMES)}
    if sub == "share":
        while True:
            a, b = rng.randint(1, 7), rng.randint(1, 7)
            if a != b and math.gcd(a, b) == 1 and a + b <= 11:
                break
        unit = rng.choice([500, 1000, 1500, 2000, 2500, 3000, 4000, 5000])
        p.update(parts=[a, b], total=unit * (a + b), other=rng.choice([n for n in NAMES if n != p["name"]]))
        return p
    if sub == "simplify":
        x, y, u = rng.choice(MIXES)
        while True:
            a, b, k = rng.randint(1, 7), rng.randint(1, 7), rng.randint(2, 6)
            if a != b and math.gcd(a, b) == 1:
                break
        p.update(mix=[x, y, u], amounts=[a * k, b * k])
        return p
    if sub == "proportion":
        return _retry_proportion(p, rng)
    if sub == "percent":
        kind = rng.choice(["discount", "increase"])
        pct = rng.choice([10, 20, 30, 40]) if kind == "discount" else rng.choice([10, 20, 30])
        tenth = rng.choice([500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000])
        new = tenth * (100 + (pct if kind == "increase" else -pct)) // 10
        p.update(kind=kind, pct=pct, new=new, item=rng.choice(ITEMS))
        return p
    cur = rng.sample(sorted(RATES), 3)
    rates = [rng.choice(RATES[c]) for c in cur]
    k = rng.randrange(3)
    way = rng.choice(["to_frw", "from_frw"])
    amount = rng.choice([20, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 500])
    if isinstance(rates[k], float):
        amount *= 100
    p.update(currencies=cur, rates=rates, ask=k, way=way, amount=amount)
    return p


def _retry_proportion(p: dict, rng: random.Random) -> dict:
    while True:
        dish, parts = rng.choice(RECIPES)
        serves = rng.choice([2, 4, 5, 6])
        per = [rng.randint(1, 6) * (50 if u == "g" else 25 if u == "ml" else 1) for _, u in parts]
        new = rng.choice([n for n in (3, 6, 8, 9, 10, 12, 15, 20) if n != serves])
        k = rng.randrange(len(parts))
        if (per[k] * new) % serves == 0:
            p.update(dish=dish, serves=serves, amounts=per, new=new, ask=k)
            return p


# --- drawing ------------------------------------------------------------------------------------------------

def frw(v) -> str:
    v = int(v) if float(v).is_integer() else v
    return f"{v:,}".replace(",", " ") + " Frw"


def _brace(ax, x0, x1, y, text, gid):
    ax.plot([x0, x0, x1, x1], [y - 0.12, y, y, y - 0.12], color=INK, linewidth=1.3)
    ax.text((x0 + x1) / 2, y + 0.12, text, ha="center", va="bottom", fontsize=12, gid=gid)


def _draw_share(p: dict):
    a, b = p["parts"]
    n = max(a, b)
    w = 0.9
    fig, ax = new_figure(max(5.6, 0.95 * n + 2.6), 3.4)
    for row, (who, k, colour) in enumerate(((p["name"], a, GOLD), (p["other"], b, BLUE))):
        y = 1.1 - row * 0.9
        ax.text(-0.2, y + 0.3, who, ha="right", va="center", fontsize=12, gid=f"who:{row}")
        for i in range(k):
            ax.add_patch(Rectangle((i * w, y), w, 0.6, facecolor=colour, edgecolor=INK, linewidth=1.5, gid=f"box:{row}:{i}"))
    right = n * w + 0.35
    ax.plot([right, right + 0.15, right + 0.15, right], [1.7, 1.7, 0.2, 0.2], color=INK, linewidth=1.3)
    ax.text(right + 0.3, 0.95, f"Total\n{frw(p['total'])}", ha="left", va="center", fontsize=12, gid="total")
    ax.set_xlim(-1.9, right + 2.2)
    ax.set_ylim(0.0, 1.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _card(ax, w, h, title):
    ax.add_patch(FancyBboxPatch((0, 0), w, h, boxstyle="round,pad=0,rounding_size=0.15", facecolor="#fdf6e3",
                                edgecolor=INK, linewidth=1.6, gid="behind-card"))
    ax.text(w / 2, h - 0.35, title, ha="center", va="center", fontsize=13, fontweight="bold", gid="title")


def _draw_simplify(p: dict):
    (x, y, u), (a, b) = p["mix"], p["amounts"]
    fig, ax = new_figure(4.8, 2.8)
    _card(ax, 4.4, 2.4, "Mixing card")
    for i, (thing, v) in enumerate(((x, a), (y, b))):
        ax.text(0.35, 1.45 - 0.6 * i, thing, ha="left", va="center", fontsize=12, gid=f"thing:{i}")
        ax.text(4.05, 1.45 - 0.6 * i, f"{v} {u}", ha="right", va="center", fontsize=12, gid=f"amount:{i}")
    ax.set_xlim(-0.1, 4.5)
    ax.set_ylim(-0.1, 2.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _qty(v: int, unit: str, thing: str) -> str:
    return f"{v} {unit}" if unit else f"{v}"


def _draw_proportion(p: dict):
    dish, parts = next(r for r in RECIPES if r[0] == p["dish"])
    fig, ax = new_figure(4.8, 3.2)
    _card(ax, 4.4, 2.8, f"{dish.capitalize()} (serves {p['serves']})")
    for i, ((thing, unit), v) in enumerate(zip(parts, p["amounts"])):
        ax.text(0.35, 1.85 - 0.55 * i, thing, ha="left", va="center", fontsize=12, gid=f"thing:{i}")
        ax.text(4.05, 1.85 - 0.55 * i, _qty(v, unit, thing), ha="right", va="center", fontsize=12, gid=f"amount:{i}")
    ax.set_xlim(-0.1, 4.5)
    ax.set_ylim(-0.1, 2.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_percent(p: dict):
    pct, kind = p["pct"], p["kind"]
    tenths = 10 + pct // 10 if kind == "increase" else 10
    new_parts = 10 + pct // 10 if kind == "increase" else 10 - pct // 10
    w = 0.6
    fig, ax = new_figure(max(6.4, 0.65 * tenths + 1.8), 3.0)
    for i in range(tenths):
        shaded = i < new_parts
        ax.add_patch(Rectangle((i * w, 0.6), w, 0.6, facecolor=GOLD if shaded else "white", edgecolor=INK, linewidth=1.3,
                               linestyle="-" if i < 10 or shaded else (0, (3, 2)), gid=f"part:{i}:{'new' if shaded else 'off'}"))
    _brace(ax, 0, 10 * w, 1.42, "original price = 100%", "orig")
    label = f"{'sale' if kind == 'discount' else 'new'} price = {frw(p['new'])}"
    ax.plot([0, 0, new_parts * w, new_parts * w], [0.48, 0.36, 0.36, 0.48], color=INK, linewidth=1.3)
    ax.text(new_parts * w / 2, 0.24, label, ha="center", va="top", fontsize=12, gid="new")
    note = f"{pct}% {'off' if kind == 'discount' else 'increase'}"
    ax.text(tenths * w + 0.25, 0.9, note, ha="left", va="center", fontsize=12, gid="note")
    ax.set_xlim(-0.2, tenths * w + 2.4)
    ax.set_ylim(-0.25, 2.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_exchange(p: dict):
    fig, ax = new_figure(6.2, 3.0)
    ax.add_patch(Rectangle((0, 0), 6.0, 2.8, facecolor="#1f3b57", edgecolor=INK, linewidth=1.6, gid="behind-board"))
    ax.text(3.0, 2.4, "Exchange rates", ha="center", va="center", fontsize=13, fontweight="bold", color="white",
            gid="title")
    for i, (c, r) in enumerate(zip(p["currencies"], p["rates"])):
        y = 1.75 - 0.55 * i
        ax.text(0.3, y, f"1 {c}", ha="left", va="center", fontsize=12, color="white", gid=f"cur:{i}")
        ax.text(5.7, y, f"= {frw(r)}", ha="right", va="center", fontsize=12, color="#ffe08a", gid=f"rate:{i}")
    ax.set_xlim(-0.1, 6.1)
    ax.set_ylim(-0.1, 2.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"share": _draw_share, "simplify": _draw_simplify, "proportion": _draw_proportion, "percent": _draw_percent,
            "exchange": _draw_exchange}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def ratio_forms(a: int, b: int) -> list[str]:
    return [f"{a} : {b}", f"{a}:{b}", f"{a} to {b}", f"{a} :{b}", f"{a}: {b}"]


def questions(p: dict, rng: random.Random) -> list:
    name, sub = p["name"], p["sub"]
    if sub == "share":
        (a, b), total, other = p["parts"], p["total"], p["other"]
        box = total // (a + b)
        lead = rng.choice(SHARE_LEADS).format(a=name, b=other)
        who, k = rng.choice([(name, a), (other, b)])
        q1 = short(f"{lead} How much does {who} get?", str(box * k), money(box * k))
        pool = [short(f"In the bar model, how much more does {name if a > b else other} get than "
                      f"{other if a > b else name}?", str(box * abs(a - b)), money(box * abs(a - b))),
                short("In the bar model, how much is one box worth?", str(box), money(box))]
        return [q1, rng.choice(pool)]
    if sub == "simplify":
        (x, y, u), (a, b) = p["mix"], p["amounts"]
        g = math.gcd(a, b)
        lead = rng.choice(MIX_LEADS).format(n=name, x=x, y=y)
        q1 = short(f"{lead} Write the ratio of {x} to {y} in its simplest form.", f"{a // g} : {b // g}",
                   ratio_forms(a // g, b // g))
        q2 = short(f"On the mixing card, write the ratio of {y} to {x} in its simplest form.", f"{b // g} : {a // g}",
                   ratio_forms(b // g, a // g))
        return [q1, q2]
    if sub == "proportion":
        dish, parts = next(r for r in RECIPES if r[0] == p["dish"])
        k, new, serves = p["ask"], p["new"], p["serves"]
        thing, unit = parts[k]
        v = p["amounts"][k] * new // serves
        lead = rng.choice(RECIPE_LEADS).format(n=name)
        what = f"How many {thing}" if not unit else f"How many {'grams' if unit == 'g' else 'millilitres'} of {thing}"
        forms = [str(v)] + ([f"{v} {unit}", f"{v}{unit}"] if unit else [f"{v} {thing}"])
        return [short(f"{lead} {what} does {name} need to make {dish} for {new} people?", str(v), forms)]
    if sub == "percent":
        pct, kind, new = p["pct"], p["kind"], p["new"]
        orig = new * 100 // (100 + (pct if kind == "increase" else -pct))
        lead = rng.choice(PERCENT_LEADS).format(n=name, i=p["item"])
        q1 = short(f"{lead} What was the original price of the {p['item']}?", str(orig), money(orig))
        change = abs(new - orig)
        q2 = short(f"By how many francs did the price of the {p['item']} {'fall' if kind == 'discount' else 'rise'}?",
                   str(change), money(change))
        return [q1, q2]
    k, cur, rate, amount = p["ask"], p["currencies"][p["ask"]], p["rates"][p["ask"]], p["amount"]
    short_name = cur.split("(")[1].rstrip(")")
    lead = rng.choice(EXCHANGE_LEADS).format(n=name)
    if p["way"] == "to_frw":
        v = round(amount * rate)
        return [short(f"{lead} How many francs does {name} get for {amount:,} {short_name}?".replace(",", " "), str(v),
                      money(v))]
    frw_amount = round(amount * rate)
    return [short(f"{lead} How many {short_name} does {name} get for {frw(frw_amount)}?", str(amount),
                  [str(amount), f"{amount} {short_name}", f"{amount:,}".replace(",", " ")])]
