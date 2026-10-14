"""Fertiliser calculations (LS, UP): a fertiliser bag's label as sold by Rwandan agro-dealers (DAP 18-46-0, urea 46-0-0,
NPK 17-17-17 or NPK 20-10-10, in 50 kg or 25 kg bags) beside the plan of a field (its length and width in metres,
split into equal plots) and the recommended rate in kilograms per hectare, with 1 ha = 10 000 m² printed.

The kilograms of N, P₂O₅ or K₂O in one bag (the grade's meaning is in the stem), the number of bags for the whole
field, the kilograms of fertiliser for each plot, and the kilograms of a nutrient the whole field receives. Every key
is exact by choice of field, rate and bag: whole bags, and kilograms whole or to one decimal place.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, article, count, exact, mcq, measure, new_figure, short

ID = "fertiliser_calc"
KIND = "diagram.template"
SUBJECT = "agriculture"
BANDS = ("UP", "LS")
CONCEPTS = ("agriculture.inorganic-fertilisers", "agriculture.plant-nutrients", "agriculture.soil-fertility")
# A topic whose sections the book lists is reached only if one names fertilisers, nutrients or a crop's cultural
# practices (fertiliser application is one, in the cereals, legumes and fodder units).
NEEDS = r"fertili[sz]|nutrient|cultural practices"
# Topics listed without sections that share a concept but teach no fertiliser sums.
AVOID = r"feed|econom|management|record"

GRADES = {"DAP": [18, 46, 0], "Urea": [46, 0, 0], "NPK 17-17-17": [17, 17, 17], "NPK 20-10-10": [20, 10, 10]}
NUTRIENTS = ["N", "P₂O₅", "K₂O"]
# crop: (as an adjective, [(fertiliser, rates in kg/ha)], places)
CROPS = {
    "maize": ("maize", [("DAP", [100, 150]), ("Urea", [50, 100]), ("NPK 17-17-17", [200, 250, 300])],
              ["Huye", "Nyagatare", "Kayonza", "Kirehe", "Ngoma"]),
    "Irish potatoes": ("Irish potato", [("NPK 17-17-17", [200, 250, 300, 400]), ("DAP", [100, 150])],
                       ["Musanze", "Nyabihu", "Burera", "Rubavu"]),
    "beans": ("bean", [("DAP", [100, 150]), ("NPK 17-17-17", [100, 150])], ["Huye", "Muhanga", "Kamonyi", "Ruhango"]),
    "rice": ("rice", [("NPK 17-17-17", [200, 250, 300]), ("Urea", [100, 150])], ["Bugesera", "Rusizi", "Gisagara", "Rwamagana"]),
    "wheat": ("wheat", [("DAP", [100, 150]), ("Urea", [100, 150])], ["Gicumbi", "Burera", "Musanze"]),
    "Napier grass": ("Napier grass", [("NPK 20-10-10", [150, 200, 250]), ("Urea", [100, 150])], ["Nyagatare", "Gicumbi", "Musanze"]),
    "soya beans": ("soya bean", [("DAP", [100, 150])], ["Nyagatare", "Kirehe", "Kayonza"]),
    "cabbages": ("cabbage", [("NPK 20-10-10", [200, 250, 300]), ("Urea", [100, 150])], ["Rubavu", "Musanze", "Kamonyi"]),
}
# Smallholder plots of a tenth of a hectare up to a cooperative's block of two.
LENGTHS = [30, 40, 50, 60, 75, 80, 100, 120, 125, 150, 200]
WIDTHS = [20, 25, 30, 40, 50, 60, 75, 80, 100]


def said(fert: str) -> str:
    """The fertiliser as a sentence names it: "urea", "DAP", "NPK 17-17-17"."""
    return fert.lower() if fert == "Urea" else fert


def sample(rng: random.Random) -> dict:
    crop = rng.choice(sorted(CROPS))
    _, ferts, places = CROPS[crop]
    fert, rates = rng.choice(ferts)
    grade = GRADES[fert]
    while True:
        length, width, rate = rng.choice(LENGTHS), rng.choice(WIDTHS), rng.choice(rates)
        bag = rng.choice([50, 50, 25])
        if not width < length <= 3 * width:
            continue
        total = Fraction(rate * length * width, 10000)
        if total.denominator != 1 or total % bag or not 1 <= total / bag <= 40:
            continue
        rows, cols = rng.choice([1, 2, 2, 3]), rng.choice([2, 3, 4])
        if rows == 3 and length < 2 * width:
            rows = 2
        if (10 * total) % (rows * cols):
            continue
        n = [i for i in range(3) if grade[i] and (bag * grade[i]) % 10 == 0]
        m = [i for i in range(3) if grade[i] and (total * grade[i]) % 10 == 0]
        if not n or not m:
            continue
        return {"band": rng.choice(BANDS), "crop": crop, "place": rng.choice(places), "fert": fert, "grade": grade,
                "bag": bag, "length": length, "width": width, "rate": rate, "rows": rows, "cols": cols,
                "nutrient": rng.choice(n), "field_nutrient": rng.choice(m), "kind": rng.choice(["short", "mcq"])}


def _bag(ax, p: dict) -> None:
    ax.add_patch(Polygon([(0.2, 0), (3.0, 0), (3.2, 0.3), (3.2, 4.0), (2.9, 4.45), (0.3, 4.45), (0, 4.0), (0, 0.3)],
                         closed=True, facecolor="#f4f1e6", edgecolor=INK, linewidth=1.6))
    ax.add_patch(Rectangle((0.25, 2.62), 2.7, 0.62, facecolor="white", edgecolor=INK, linewidth=0.9))
    name = p["fert"].split()[0].upper()
    grade = "-".join(map(str, p["grade"]))
    ax.text(1.6, 3.7, name, ha="center", va="center", fontsize=16, fontweight="bold")
    ax.text(1.6, 2.93, grade, ha="center", va="center", fontsize=13, fontweight="bold", gid="grade")
    for i, (nut, pct) in enumerate(zip(NUTRIENTS, p["grade"])):
        y = 2.2 - 0.42 * i
        ax.text(0.45, y, nut, ha="left", va="center", fontsize=10.5)
        ax.text(2.75, y, f"{pct}%", ha="right", va="center", fontsize=10.5)
    ax.text(1.6, 0.55, f"Net weight: {p['bag']} kg", ha="center", va="center", fontsize=10, fontweight="bold", gid="bag")


def draw(p: dict):
    fig, ax = new_figure(8.6, 4.9)
    _bag(ax, p)
    length, width = p["length"], p["width"]
    scale = min(5.6 / length, 3.4 / width)
    w, h = length * scale, width * scale
    x0, y0 = 4.4 + (5.6 - w) / 2, 0.5 + (3.4 - h) / 2
    ax.add_patch(Rectangle((x0, y0), w, h, facecolor="#e7efdc", edgecolor=INK, linewidth=1.6))
    rows, cols = p["rows"], p["cols"]
    for i in range(1, cols):
        ax.plot([x0 + w * i / cols] * 2, [y0, y0 + h], color=INK, linewidth=1.0, linestyle="--", gid=f"plot-line-v{i}")
    for j in range(1, rows):
        ax.plot([x0, x0 + w], [y0 + h * j / rows] * 2, color=INK, linewidth=1.0, linestyle="--", gid=f"plot-line-h{j}")
    k = 0
    for j in range(rows):
        for i in range(cols):
            k += 1
            ax.text(x0 + w * (i + 0.5) / cols, y0 + h * (rows - j - 0.5) / rows, f"Plot {k}" if w / cols >= 1.3 else str(k),
                    ha="center", va="center", fontsize=9, color="#333333")
    ax.text(x0 + w / 2, y0 - 0.28, f"{length} m", ha="center", va="top", fontsize=10.5, gid="length")
    ax.text(x0 + w + 0.15, y0 + h / 2, f"{width} m", ha="left", va="center", fontsize=10.5, gid="width")
    adjective = CROPS[p["crop"]][0]
    ax.text(7.2, 4.35, f"{adjective[0].upper() + adjective[1:]} field in {p['place']}", ha="center", va="center", fontsize=11.5,
            fontweight="bold")
    ax.text(5.4, -0.75, f"Recommended rate: {p['rate']} kg of {said(p['fert'])} per hectare", ha="center", va="center", fontsize=10.5,
            gid="rate")
    ax.text(5.4, -1.25, "1 hectare (ha) = 10 000 m²", ha="center", va="center", fontsize=10.5)
    ax.set_xlim(-0.3, 11.2)
    ax.set_ylim(-1.6, 4.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["buys", "orders", "collects", "carries home"]
SHOPS = ["from an agro-dealer", "from the cooperative store", "at the market", "from the district input shop"]
SPREAD = ["{friend} spreads {fert} over the whole field at the recommended rate.",
          "The whole field is to get {fert} at the recommended rate.",
          "{friend} plans to treat the whole field at the recommended rate."]


WHOLE = ["Every plot gets fertiliser at the recommended rate.", "Think about the nutrient, not the fertiliser.",
         "Use the bag's label and the rate.", "The field is fertilised at the recommended rate."]


def _kg(x) -> str:
    return f"{exact(x)} kg"


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    grade, bag, fert = p["grade"], p["bag"], said(p["fert"])
    shown = "-".join(map(str, grade))
    adjective = CROPS[p["crop"]][0]
    total = Fraction(p["rate"] * p["length"] * p["width"], 10000)
    plots = p["rows"] * p["cols"]
    nut, pct = NUTRIENTS[p["nutrient"]], grade[p["nutrient"]]
    key = Fraction(bag * pct, 100)
    stem = (f"{who} {rng.choice(VERBS)} {article(str(bag))} {bag} kg bag of {fert} {rng.choice(SHOPS)} for {article(adjective)} "
            f"{adjective} field in {p['place']}. The grade {shown} on the bag gives the percentages of N, P₂O₅ and K₂O by mass. "
            f"How many kilograms of {nut} are in one bag?")
    if p["kind"] == "mcq":
        wrong = [Fraction(pct), bag - key, key / 10, key * 2]  # the percentage as kilograms, the rest of the bag, slips
        first = mcq(stem, _kg(key), [_kg(w) for w in wrong if w != key and w < bag and (w * 100).denominator == 1], rng)
        if len(first.options) < 3:
            first = short(stem, exact(key), measure(key, "kg"))
    else:
        first = short(stem, exact(key), measure(key, "kg"))
    bags = int(total / bag)
    nut2 = NUTRIENTS[p["field_nutrient"]]
    field = total * grade[p["field_nutrient"]] / 100
    per = total / plots
    return [
        first,
        count(f"{rng.choice(SPREAD).format(friend=friend, fert=fert)} How many {bag} kg bags are needed?", bags, "bags"),
        short(f"The field is split into {plots} equal plots, as drawn. At the same rate, how many kilograms of {fert} "
              f"does each plot get?", exact(per), measure(per, "kg")),
        short(f"{rng.choice(WHOLE)} How many kilograms of {nut2} does the whole field receive?", exact(field),
              measure(field, "kg")),
    ]
