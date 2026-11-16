"""Diet tables (LS, UP): what is in food, read from a table.

- Nutrients: four foods, lettered, with the protein, vitamin C, iron and calcium in 100 g of each, a row of the daily
  need, and a table of the deficiency disease a lack of each causes (kwashiorkor, scurvy, anaemia, rickets). Asks which
  food is the best source of a nutrient, how many grams of a food give the daily need (a whole number), and which
  deficiency disease a diet of only two of the foods risks (exactly one nutrient is missing from both).
- DCPIP: the vitamin C test. The mass of vitamin C that decolourises 1 cm3 of DCPIP is printed with the formula
  vitamin C in the juice (mg per cm3) = that mass / volume of juice needed, and a table of the volume of each of four
  juices needed. Asks which juice has the most vitamin C, one juice's concentration, and how many times more vitamin C
  one juice has than another (or which has the least).
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, exact, mcq, new_figure, short

ID = "diet_table"
KIND = "table.data"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("vitamin-deficiency", "mineral-nutrients-classification",
                                           "food-components-identification"))
ALSO = ("science.nutrients-and-diet",)
# A topic whose sections the book lists is reached only if one names vitamins, minerals, diet or food components.
NEEDS = (r"vitamin|mineral nutrient|\bdiet|balanced|deficienc|nutrients in humans|food components|components of food|"
         r"human nutrition")
AVOID = (r"plant|photosynth|sexual|STIs|HIV|glossary|science in context|social factors|reproduction system|"
         r"rabbits|chickens|animals$")

NUTRIENTS = [("protein", "protein", "g"), ("vitc", "vitamin C", "mg"), ("iron", "iron", "mg"), ("calcium", "calcium", "mg")]
DISEASE = {"protein": "kwashiorkor", "vitc": "scurvy", "iron": "anaemia", "calcium": "rickets"}
SIGN = {"protein": "swollen belly, slow growth", "vitc": "bleeding gums", "iron": "tiredness, pale skin",
        "calcium": "soft, weak bones"}
NEED = {"protein": [40, 45, 50], "vitc": [30, 40, 50], "iron": [10, 12, 15], "calcium": [800, 1000]}
RANGE = {"protein": (3, 26), "vitc": (5, 90), "iron": (1, 15), "calcium": (20, 260)}
VOLUMES = [0.5, 1.0, 2.0, 2.5, 4.0, 5.0]


def concepts_for(p: dict) -> tuple:
    if p["kind"] == "dcpip":
        return ("biology.food-components-identification", "biology.vitamin-deficiency")
    return CONCEPTS


def avoid_for(p: dict) -> str:
    # a nutrient table is no food test, and the DCPIP test is no lesson on diet
    return AVOID + (r"|human nutrition" if p["kind"] == "dcpip" else r"|testing for|tests? for")


def _contents(key: str, need: int) -> list[int]:
    """Amounts per 100 g that give the daily need in a whole number of grams."""
    lo, hi = RANGE[key]
    return [v for v in range(lo, hi + 1) if need * 100 % v == 0]


def _nutrients(rng: random.Random) -> dict:
    need = {k: rng.choice(v) for k, v in NEED.items()}
    lacking = rng.choice([k for k, _, _ in NUTRIENTS])
    letters = ["P", "Q", "R", "S"]
    pair = rng.sample(letters, 2)
    foods = []
    for L in letters:
        f = {"letter": L}
        for k, _, _ in NUTRIENTS:
            if L in pair and k == lacking:
                f[k] = 0
            elif rng.random() < 0.25 and L not in pair:
                f[k] = 0
            else:
                f[k] = rng.choice(_contents(k, need[k]))
        foods.append(f)
    # every other nutrient is in at least one food of the pair; the lacking one in at least one other food
    for k, _, _ in NUTRIENTS:
        if k != lacking and all(f[k] == 0 for f in foods if f["letter"] in pair):
            return _nutrients(rng)
    if all(f[lacking] == 0 for f in foods):
        return _nutrients(rng)
    for k, _, _ in NUTRIENTS:  # one clear best source of each nutrient
        vals = sorted((f[k] for f in foods), reverse=True)
        if vals[0] == vals[1]:
            return _nutrients(rng)
    return {"kind": "nutrients", "foods": foods, "need": need, "pair": sorted(pair)}


def _dcpip(rng: random.Random) -> dict:
    vols = rng.sample(VOLUMES, 4)
    return {"kind": "dcpip", "mass": rng.choice([0.05, 0.1]),
            "juices": [{"letter": L, "volume": v} for L, v in zip("ABCD", vols)]}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    p = _nutrients(rng) if rng.random() < 0.55 else _dcpip(rng)
    return {"band": band, **p}


# --- drawing ----------------------------------------------------------------------------------------

def _draw_nutrients(p: dict):
    fig, ax = new_figure(8.6, 4.9)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8.4)
    ax.axis("off")
    xs = [0.3, 2.6, 4.9, 7.2, 9.5]
    heads = ["Food", "Protein\n(g)", "Vitamin C\n(mg)", "Iron\n(mg)", "Calcium\n(mg)"]
    for x, h in zip(xs, heads):
        ax.text(x + (0 if x == xs[0] else 0.9), 7.85, h, ha="left" if x == xs[0] else "center", va="center", fontsize=10,
                fontweight="bold")
    ax.plot([0.2, 11.2], [7.25, 7.25], color=INK, linewidth=1.0)
    rows = [(f"Food {f['letter']}", [f[k] for k, _, _ in NUTRIENTS], "normal") for f in p["foods"]]
    rows.append(("Daily need", [p["need"][k] for k, _, _ in NUTRIENTS], "bold"))
    for i, (name, vals, weight) in enumerate(rows):
        y = 6.8 - 0.55 * i - (0.15 if weight == "bold" else 0)
        if weight == "bold":
            ax.plot([0.2, 11.2], [y + 0.36, y + 0.36], color=INK, linewidth=0.8)
        ax.text(xs[0], y, name, ha="left", va="center", fontsize=10, fontweight=weight)
        for x, v in zip(xs[1:], vals):
            ax.text(x + 0.9, y, str(v), ha="center", va="center", fontsize=10, fontweight=weight)
    ax.text(0.3, 3.55, "Food amounts are in 100 g of each food; the daily need is for one person for one day.", ha="left", va="center", fontsize=9, style="italic")
    ax.text(0.3, 2.85, "A lack of ...", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(3.0, 2.85, "causes", ha="left", va="center", fontsize=10, fontweight="bold")
    for j, (k, name, _) in enumerate(NUTRIENTS):
        y = 2.3 - 0.52 * j
        ax.text(0.3, y, name, ha="left", va="center", fontsize=10)
        ax.text(3.0, y, f"{DISEASE[k]} ({SIGN[k]})", ha="left", va="center", fontsize=10)
    ax.set_title("Nutrients in four foods, and the deficiency disease a lack of each causes", fontsize=11)
    return fig


def _draw_dcpip(p: dict):
    fig, ax = new_figure(7.8, 4.4)
    ax.set_xlim(0, 11)
    ax.set_ylim(0.6, 7.6)
    ax.axis("off")
    ax.text(0.3, 7.05, f"{exact(p['mass'])} mg of vitamin C decolourises 1 cm³ of blue DCPIP solution.", ha="left",
            va="center", fontsize=10)
    ax.text(0.3, 6.45, "Each juice was added drop by drop to 1 cm³ of DCPIP until the blue colour disappeared.", ha="left",
            va="center", fontsize=10)
    ax.text(0.8, 5.65, "Juice", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(5.6, 5.65, "Volume of juice needed to\ndecolourise 1 cm³ of DCPIP (cm³)", ha="center", va="center",
            fontsize=10, fontweight="bold")
    ax.plot([0.6, 8.2], [5.0, 5.0], color=INK, linewidth=1.0)
    for i, j in enumerate(p["juices"]):
        y = 4.5 - 0.55 * i
        ax.text(0.9, y, f"Juice {j['letter']}", ha="left", va="center", fontsize=10)
        ax.text(5.6, y, f"{j['volume']:.1f}", ha="center", va="center", fontsize=10)
    ax.plot([0.6, 8.2], [2.4, 2.4], color=INK, linewidth=1.0)
    ax.text(0.3, 1.6, "vitamin C in the juice (mg per cm³) = mass of vitamin C that decolourises 1 cm³ of DCPIP",
            ha="left", va="center", fontsize=9.5)
    ax.text(5.2, 1.0, "÷ volume of juice needed (cm³)", ha="left", va="center", fontsize=9.5)
    ax.set_title("The DCPIP test for vitamin C in four fruit juices", fontsize=11)
    return fig


def draw(p: dict):
    return _draw_dcpip(p) if p["kind"] == "dcpip" else _draw_nutrients(p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson in Huye", "for a school health club poster", "for a project on school meals in Musanze",
            "before a test on nutrition", "for homework", "at the science club in Rubavu", "in a lesson on diet",
            "for a class display in Nyagatare"]


def _q_nutrients(p: dict, rng: random.Random) -> list:
    foods = {f["letter"]: f for f in p["foods"]}
    who = rng.choice(NAMES)
    k, name, unit = rng.choice(NUTRIENTS)
    best = max(foods, key=lambda L: foods[L][k])
    qs = [mcq(f"{who} compared four foods {rng.choice(SETTINGS)}. Which food is the best source of {name} per 100 g?",
              f"food {best}", [f"food {L}" for L in sorted(foods) if L != best], rng)]
    k, name, unit = rng.choice(NUTRIENTS)
    X = rng.choice([L for L in sorted(foods) if foods[L][k] > 0])
    g = p["need"][k] * 100 // foods[X][k]
    qs.append(short(f"How many grams of food {X} would give the daily need of {name} shown in the table?", g,
                    [f"{g} g", f"{g} grams"]))
    a, b = p["pair"]
    lacking = next(k for k, _, _ in NUTRIENTS if foods[a][k] == 0 and foods[b][k] == 0)
    who2 = rng.choice([n for n in NAMES if n != who])
    qs.append(mcq(f"{who2} eats only foods {a} and {b}. Using the tables, which deficiency disease is {who2} most at risk of?",
                  DISEASE[lacking], [DISEASE[k] for k, _, _ in NUTRIENTS if k != lacking], rng))
    return qs


def _q_dcpip(p: dict, rng: random.Random) -> list:
    vol = {j["letter"]: j["volume"] for j in p["juices"]}
    who = rng.choice(NAMES)
    most = min(vol, key=vol.get)
    qs = [mcq(f"{who} tested four fruit juices for vitamin C {rng.choice(SETTINGS)}. Which juice contained the most vitamin C?",
              f"juice {most}", [f"juice {L}" for L in sorted(vol) if L != most], rng)]
    X = rng.choice(sorted(vol))
    c = exact(round(p["mass"] / vol[X], 6))
    qs.append(short(f"Using the formula, how many mg of vitamin C are in each cm³ of juice {X}?", c,
                    [f"{c} mg", f"{c} mg per cm³", f"{c} mg/cm³"]))
    pairs = [(x, y) for x in sorted(vol) for y in sorted(vol) if vol[y] > vol[x] and (vol[y] / vol[x]).is_integer()]
    if pairs and rng.random() < 0.6:
        x, y = rng.choice(pairs)
        r = int(vol[y] / vol[x])
        qs.append(short(f"How many times more vitamin C per cm³ does juice {x} contain than juice {y}?", r,
                        [f"{r} times"]))
    else:
        least = max(vol, key=vol.get)
        qs.append(mcq("Which juice contained the least vitamin C?", f"juice {least}",
                      [f"juice {L}" for L in sorted(vol) if L != least], rng))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    return _q_dcpip(p, rng) if p["kind"] == "dcpip" else _q_nutrients(p, rng)
