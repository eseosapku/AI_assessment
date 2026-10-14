"""Farm records (LS, UP): a production record as a Rwandan farm keeps it, ruled as a table with a blank Total row and the
selling price in francs beneath. Six sub-types: a layer unit's daily egg collection over a week, a dairy farm's
morning and evening milk over a week, a maize harvest per plot, a tilapia harvest per pond (or per cage on Lake
Kivu), a honey harvest per hive, and a potato cooperative's deliveries per member.

The total, the mean per day (or plot, pond, hive, member), the income at the price shown, and the best day or row.
Every key is exact: the total always divides by the number of rows, and the best row beats the next by at least 2.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, count, mcq, measure, money, new_figure, short

ID = "farm_record"
KIND = "business.document"
SUBJECT = "agriculture"
BANDS = ("UP", "LS")
CONCEPTS = tuple(f"agriculture.{c}" for c in ("farm-records", "farm-management", "poultry-production", "animal-production",
                                              "livestock-management", "crop-production", "fish-farming", "bee-keeping",
                                              "cooperatives-farming"))
# A topic whose sections the book lists is reached only if one names records or what the record is of.
NEEDS = r"record|co-?operative|poultry|fish|\bbee|dairy|milk|egg"
# Topics listed without sections that share a concept but teach no records.
AVOID = r"soil|breed|mechani|health|feed"
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# kind: (bands, the record's own concepts, topics a record of crops or of animals does not suit)
KINDS = {
    "eggs": (("UP", "LS"), ("poultry-production",), "crop"),
    "milk": (("UP",), ("animal-production", "livestock-management"), "crop"),
    "maize": (("UP",), ("crop-production",), "animal|livestock|husbandry|fish"),
    "fish": (("UP", "LS"), ("fish-farming",), "crop"),
    "honey": (("UP", "LS"), ("bee-keeping",), "crop"),
    "coop": (("UP", "LS"), ("cooperatives-farming",), "animal|livestock|husbandry|fish"),
}
PLACES = {
    "eggs": ["Rwamagana", "Nyagatare", "Bugesera", "Kicukiro", "Huye"],
    "milk": ["Nyagatare", "Gicumbi", "Musanze", "Rubavu", "Kayonza"],
    "maize": ["Huye", "Nyagatare", "Kayonza", "Kirehe", "Ngoma"],
    "fish": ["Rwamagana", "Huye", "Muhanga", "Karongi, Lake Kivu", "Rubavu, Lake Kivu"],
    "honey": ["Nyamagabe", "Huye", "Kayonza", "Bugesera", "Gicumbi"],
    "coop": ["Musanze", "Nyabihu", "Burera", "Rubavu"],
}


def concepts_for(p: dict) -> frozenset[str]:
    return frozenset(f"agriculture.{c}" for c in ("farm-records", "farm-management") + KINDS[p["kind"]][1])


def avoid_for(p: dict) -> str:
    return f"{AVOID}|{KINDS[p['kind']][2]}"


def _table(rng: random.Random, kind: str, place: str) -> dict:
    if kind == "eggs":
        hens = rng.choice([200, 250, 300, 400])
        return {"title": "Daily egg record", "sub": f"Layer unit, {place} ({hens} hens)", "heads": ["Day", "Eggs collected"],
                "rows": DAYS, "values": [[rng.randint(int(0.78 * hens), int(0.92 * hens))] for _ in DAYS],
                "price": rng.choice(range(100, 151, 10)), "per": "egg"}
    if kind == "milk":
        cows = rng.randint(3, 6)
        return {"title": "Milk record", "sub": f"Dairy farm, {place} ({cows} cows)", "heads": ["Day", "Morning (litres)", "Evening (litres)"],
                "rows": DAYS, "values": [[rng.randint(6 * cows, 9 * cows), rng.randint(4 * cows, 7 * cows)] for _ in DAYS],
                "price": rng.choice([300, 350, 400, 450]), "per": "litre"}
    if kind == "maize":
        n = rng.randint(5, 6)
        return {"title": "Maize harvest record", "sub": f"Season A, {place}", "heads": ["Plot", "Maize harvested (kg)"],
                "rows": [f"Plot {c}" for c in "ABCDEF"[:n]], "values": [[rng.randint(250, 600)] for _ in range(n)],
                "price": rng.choice([350, 400, 450, 500]), "per": "kg"}
    if kind == "fish":
        n = rng.randint(4, 6)
        unit = "Cage" if "Kivu" in place else "Pond"
        return {"title": "Fish harvest record", "sub": f"Tilapia {unit.lower()}s, {place}", "heads": [unit, "Tilapia harvested (kg)"],
                "rows": [f"{unit} {i}" for i in range(1, n + 1)], "values": [[rng.randint(80, 300)] for _ in range(n)],
                "price": rng.choice([2500, 3000, 3500, 4000]), "per": "kg"}
    if kind == "honey":
        n = rng.randint(5, 8)
        return {"title": "Honey harvest record", "sub": f"Apiary, {place}", "heads": ["Hive", "Honey harvested (kg)"],
                "rows": [f"Hive {i}" for i in range(1, n + 1)], "values": [[rng.randint(6, 24)] for _ in range(n)],
                "price": rng.choice([6000, 7000, 8000, 9000, 10000]), "per": "kg"}
    n = rng.randint(5, 6)
    return {"title": "Potato delivery record", "sub": f"Potato cooperative, {place}", "heads": ["Member", "Potatoes delivered (kg)"],
            "rows": rng.sample(NAMES, n), "values": [[rng.randint(300, 1200)] for _ in range(n)],
            "price": rng.choice([250, 300, 350, 400]), "per": "kg"}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(sorted(KINDS))
    place = rng.choice(PLACES[kind])
    while True:
        t = _table(rng, kind, place)
        sums = sorted((sum(v) for v in t["values"]), reverse=True)
        if sum(sums) % len(sums) or sums[0] - sums[1] < 2:
            continue
        return {"band": rng.choice(KINDS[kind][0]), "kind": kind, "place": place, **t}


def fr(n: int) -> str:
    """Francs as a record prints them: a space for thousands ("3 500")."""
    return f"{n:,}".replace(",", " ")


def draw(p: dict):
    heads, rows, vals = p["heads"], p["rows"], p["values"]
    widths = [2.6] + [3.0] * (len(heads) - 1)
    rh, hh = 0.55, 0.8  # a row's height and the heading row's
    width = sum(widths)
    top = hh + rh * (len(rows) + 1)
    k = 0.62  # inches per unit
    fig, ax = new_figure((width + 0.4) * k, (top + 2.3) * k)
    ax.set_position([0, 0, 1, 1])
    ax.text(width / 2, top + 1.05, p["title"], ha="center", va="center", fontsize=12.5, fontweight="bold", gid="title")
    ax.text(width / 2, top + 0.45, p["sub"], ha="center", va="center", fontsize=10)
    x = 0.0
    for c, (h, w) in enumerate(zip(heads, widths)):
        ax.add_patch(Rectangle((x, top - hh), w, hh, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        words = h.split(" (")
        label = words[0] + (f"\n({words[1]}" if len(words) > 1 else "")
        ax.text(x + w / 2, top - hh / 2, label, ha="center", va="center", fontsize=9.5, fontweight="bold", linespacing=1.1)
        for i, row in enumerate(rows + ["Total"]):
            y = top - hh - rh * (i + 1)
            total = i == len(rows)
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="#fff6cc" if total and c else "white", edgecolor=INK,
                                   linewidth=1.3 if total else 0.8))
            if c == 0:
                ax.text(x + 0.15, y + rh / 2, row, ha="left", va="center", fontsize=10, fontweight="bold" if total else "normal",
                        gid=None if total else f"cell:{i}:label")
            elif not total:
                ax.text(x + w / 2, y + rh / 2, str(vals[i][c - 1]), ha="center", va="center", fontsize=10.5, gid=f"cell:{i}:{c - 1}")
        x += w
    ax.text(0, -0.45, f"Selling price: {fr(p['price'])} Frw per {p['per']}", ha="left", va="center", fontsize=10.5, gid="price")
    ax.set_xlim(-0.2, width + 0.2)
    ax.set_ylim(-0.9, top + 1.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["keeps", "fills in", "checks", "updates", "copies out"]
SETTINGS = ["this week", "for the farm manager", "in the farm office", "for the monthly meeting", "for the farm's accounts",
            "on the notice board"]
# kind: (what the record is, total, mean, income, best) as questions put them
WORDS = {
    "eggs": ("egg record", "How many eggs were collected in total that week?",
             "What is the mean number of eggs collected per day? (mean = total ÷ number of days)",
             "{friend} sells every egg at the price shown. What is the income from the week's eggs, in Frw?",
             "On which day were the most eggs collected?"),
    "milk": ("milk record", "How many litres of milk did the cows give in total that week, morning and evening?",
             "What is the mean milk yield per day, in litres? (mean = total ÷ number of days)",
             "All the milk goes to the collection centre at the price shown. What is the income for the week, in Frw?",
             "On which day did the cows give the most milk, morning and evening together?"),
    "maize": ("harvest record", "How many kilograms of maize were harvested in total?",
              "What is the mean harvest per plot, in kg? (mean = total ÷ number of plots)",
              "The whole harvest is sold at the price shown. What is the income, in Frw?",
              "Which plot gave the biggest harvest?"),
    "fish": ("harvest record", "How many kilograms of tilapia were harvested in total?",
             "What is the mean harvest per {unit}, in kg? (mean = total ÷ number of {unit}s)",
             "{friend} sells all the fish at the price shown. What is the income, in Frw?",
             "Which {unit} gave the biggest harvest?"),
    "honey": ("honey record", "How many kilograms of honey were harvested in total?",
              "What is the mean harvest per hive, in kg? (mean = total ÷ number of hives)",
              "All the honey is sold at the price shown. What is the income, in Frw?",
              "Which hive gave the most honey?"),
    "coop": ("delivery record", "How many kilograms of potatoes did the members deliver in total?",
             "What is the mean delivery per member, in kg? (mean = total ÷ number of members)",
             "The cooperative sells all the potatoes at the price shown. What is the income, in Frw?",
             "Which member delivered the most potatoes?"),
}


def _amount(stem: str, n: int, kind: str):
    if kind == "eggs":
        return count(stem, n, "eggs")
    if kind == "milk":
        return short(stem, n, [f"{n} litres", f"{n} L", f"{n}L", f"{n} l"])
    return short(stem, n, measure(n, "kg"))


def questions(p: dict, rng: random.Random) -> list:
    kind, rows = p["kind"], p["rows"]
    who, friend = rng.sample([n for n in NAMES if n not in rows], 2)
    record, q_total, q_mean, q_income, q_best = WORDS[kind]
    unit = p["heads"][0].lower()
    sums = [sum(v) for v in p["values"]]
    total = sum(sums)
    mean = total // len(rows)
    income = total * p["price"]
    order = sorted(range(len(rows)), key=lambda i: -sums[i])
    best = rows[order[0]]
    wrong = [rows[order[1]]]
    if kind == "milk":  # read off the morning column alone
        wrong.append(rows[max(range(len(rows)), key=lambda i: p["values"][i][0])])
    wrong += [rows[i] for i in rng.sample(order[2:], len(order) - 2)]
    return [
        _amount(f"{who} {rng.choice(VERBS)} the {record} at {p['place']} {rng.choice(SETTINGS)}. {q_total}", total, kind),
        _amount(q_mean.format(unit=unit), mean, kind),
        short(q_income.format(friend=friend, unit=unit), income, money(income)),
        mcq(q_best.format(unit=unit), best, wrong, rng),
    ]
