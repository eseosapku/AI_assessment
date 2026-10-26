"""Looking after farm animals (P, Science and Elementary Technology): a farmer's own records, of three kinds.

- eggs (P3 to P5): a bar chart of the eggs collected from a family's hens each day, Monday to Saturday, a gridline on
  every egg. How many eggs on a day, which day the most (one day only), how many altogether, or how many more on one
  day than another.
- milk (P5, P6): a bar chart of the milk two cows gave each day, Monday to Friday: a Friesian cow and an Ankole cow,
  a gridline on every litre. The Friesian gives far more, as a farmer in Rwanda knows (8 to 15 litres a day against 1
  to 6), but every amount asked is read off the chart. How many litres one cow gave on a day, the two together, how
  many more the Friesian gave, or the day a cow gave the most.
- feed (P4 small farm: rabbits and hens; P6 big farm: goats and cows): a table of the animals, how many there are, and
  the food ONE animal eats each day. How much food all of one kind eat in a day, in a week (7 days, said in the stem),
  or each day after more animals come.

The amounts are a family's own, never a real farm's figures, and whole numbers a child can work with.
"""
from __future__ import annotations

import random

from ..core import FILL, GRID, INK, NAMES, mcq, new_figure, short

ID = "animal_care_p"
KIND = "graph.bar"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("animal-farming-rabbits", "animal-farming-chickens", "animal-farming-cattle"))
# A topic whose sections the book lists is reached only if its name or a section names the animals kept or feeding.
NEEDS = r"rabbit|chicken|poultry|\bhens?\b|cattle|\bcows?\b|\bgoats?\b|livestock|feeding of|^animals$"
AVOID = (r"\bcells?\b|science in context|glossary|reproduction system|sexual|hiv|pregnan|wild animals|"
         r"classification|human")

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
BREEDS = ["Friesian", "Ankole"]
# Food for ONE animal each day: its unit, and the amounts a farmer gives (a family's own, kept small).
FEED = {"rabbits": ("bundles of grass", [1, 2]), "hens": ("cups of grain", [1]), "goats": ("kg of grass", [3, 4, 5]),
        "cows": ("kg of grass", [20, 30, 40])}
HOW_MANY = {"rabbits": (3, 8), "hens": (4, 9), "goats": (3, 8), "cows": (2, 5)}
FARMS = {"small": ["rabbits", "hens"], "big": ["goats", "cows"]}


def stages(p: dict) -> tuple[int, int]:
    if p["sub"] == "eggs" or (p["sub"] == "feed" and p["farm"] == "small"):
        return (3, 5)
    return (5, 6)


def concepts_for(p: dict) -> tuple[str, ...]:
    """Hens' eggs are about chickens, the cows' milk about cattle; the feed table about the animals in it."""
    if p["sub"] == "eggs":
        return ("science.animal-farming-chickens",)
    if p["sub"] == "milk" or p["farm"] == "big":
        return ("science.animal-farming-cattle",)
    return ("science.animal-farming-rabbits", "science.animal-farming-chickens")


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["eggs", "milk", "feed"])
    if sub == "eggs":
        while True:
            eggs = [rng.randint(2, 12) for _ in DAYS]
            if eggs.count(max(eggs)) == 1 and len(set(eggs)) >= 4:
                return {"band": "P", "sub": "eggs", "days": DAYS[:], "eggs": eggs}
    if sub == "milk":
        while True:
            fr = [rng.randint(8, 15) for _ in range(5)]
            an = [rng.randint(1, 6) for _ in range(5)]
            if fr.count(max(fr)) == 1 and an.count(max(an)) == 1:
                return {"band": "P", "sub": "milk", "days": DAYS[:5], "cows": BREEDS[:], "litres": [fr, an]}
    farm = rng.choice(sorted(FARMS))
    rows = []
    for animal in FARMS[farm]:
        unit, amounts = FEED[animal]
        rows.append([animal, rng.randint(*HOW_MANY[animal]), rng.choice(amounts), unit])
    rng.shuffle(rows)
    return {"band": "P", "sub": "feed", "farm": farm, "rows": rows}


# --- drawing ----------------------------------------------------------------------------------------

def _bars(p: dict):
    fig, ax = new_figure(7.0, 4.4)
    if p["sub"] == "eggs":
        values = p["eggs"]
        bars = ax.bar(range(len(values)), values, width=0.6, color=FILL, edgecolor=INK, linewidth=1.0, zorder=3)
        for j, b in enumerate(bars):
            b.set_gid(f"bar:eggs:{j}")
        top, label = 14, 2
        ax.set_ylabel("Number of eggs", fontsize=11)
        ax.set_title("Eggs collected from our hens", fontsize=12.5)
        ax.set_xticks(range(len(values)), p["days"])
    else:
        styles = [(FILL, ""), ("white", "///")]
        for k, (breed, row) in enumerate(zip(p["cows"], p["litres"])):
            colour, hatch = styles[k]
            bars = ax.bar([j + (k - 0.5) * 0.38 for j in range(len(row))], row, width=0.38, color=colour, hatch=hatch,
                          edgecolor=INK, linewidth=1.0, zorder=3, label=f"{breed} cow")
            for j, b in enumerate(bars):
                b.set_gid(f"bar:{breed}:{j}")
        top, label = 16, 2
        ax.set_ylabel("Milk (litres)", fontsize=11)
        ax.set_title("Milk from our two cows", fontsize=12.5)
        ax.set_xticks(range(len(p["days"])), p["days"])
        ax.legend(loc="upper left", bbox_to_anchor=(1.02, 1.0), fontsize=10.5, frameon=True, edgecolor="#999999",
                  title="Key", title_fontsize=10.5)
    ax.set_yticks(range(0, top + 1, label))
    ax.set_yticks(range(0, top + 1), minor=True)
    ax.grid(True, which="both", axis="y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_ylim(0, top)
    ax.set_xlim(-0.6, len(p["days"]) - 0.4)
    ax.tick_params(labelsize=10.5)
    ax.tick_params(axis="y", which="minor", length=0)
    return fig


TITLES = {"small": "Food for our rabbits and hens", "big": "Food for our goats and cows"}


def food(amount: int, unit: str) -> str:
    """"2 bundles of grass", and "1 bundle of grass" for one."""
    if amount == 1:
        unit = unit.replace("bundles", "bundle").replace("cups", "cup")
    return f"{amount} {unit}"


def _table(p: dict):
    fig, ax = new_figure(7.8, 2.9)
    cols = [0.0, 2.6, 5.2, 11.0]
    heads = ["Animals", "How many", "Food for ONE animal each day"]
    rh = 0.8
    top = 0.0
    ax.fill([cols[0], cols[-1], cols[-1], cols[0]], [top, top, top - rh, top - rh], color="#dbe9f6", zorder=0)
    for c, h in enumerate(heads):
        ax.text((cols[c] + cols[c + 1]) / 2, top - rh / 2, h, ha="center", va="center", fontsize=11.5, fontweight="bold")
    for r, (animal, n, amount, unit) in enumerate(p["rows"]):
        y = top - (r + 1.5) * rh
        ax.text(cols[0] + 0.25, y, animal.capitalize(), ha="left", va="center", fontsize=12, gid=f"animal:{animal}")
        ax.text((cols[1] + cols[2]) / 2, y, str(n), ha="center", va="center", fontsize=12, gid=f"number:{animal}")
        ax.text((cols[2] + cols[3]) / 2, y, food(amount, unit), ha="center", va="center", fontsize=12,
                gid=f"food:{animal}")
    bottom = top - (len(p["rows"]) + 1) * rh
    for k in range(len(p["rows"]) + 2):
        ax.plot([cols[0], cols[-1]], [top - k * rh] * 2, color=INK, linewidth=1.6 if k in (0, 1) or k == len(p["rows"]) + 1 else 0.9)
    for x in cols:
        ax.plot([x, x], [top, bottom], color=INK, linewidth=1.2)
    ax.text(cols[-1] / 2, top + 0.5, TITLES[p["farm"]], ha="center", va="center", fontsize=13, fontweight="bold")
    ax.set_xlim(-0.1, cols[-1] + 0.1)
    ax.set_ylim(bottom - 0.1, top + 0.95)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _table(p) if p["sub"] == "feed" else _bars(p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["at home in Musanze", "on the family farm in Huye", "near Nyagatare", "in Rubavu", "at home in Kamonyi",
            "on the farm near Rwamagana", "in Gicumbi", "at home in Nyanza"]


def _litres(n: int) -> list[str]:
    return [f"{n} litres", f"{n} litre" if n == 1 else f"{n}litres", f"{n} L", f"{n}L", f"{n} l"]


def questions(p: dict, rng: random.Random) -> list:
    who, where = rng.choice(NAMES), rng.choice(SETTINGS)
    if p["sub"] == "eggs":
        days, eggs = p["days"], p["eggs"]
        d = rng.randrange(len(days))
        out = [short(f"{who}'s family keeps hens {where}. {who} counts the eggs every day. "
                     f"How many eggs were collected on {days[d]}?", eggs[d], [f"{eggs[d]} eggs"])]
        out.append(mcq("On which day were the most eggs collected?", days[eggs.index(max(eggs))],
                       sorted(days, key=lambda x: -eggs[days.index(x)]), rng))
        if rng.random() < 0.5:
            out.append(short("How many eggs were collected altogether in the six days?", sum(eggs), [f"{sum(eggs)} eggs"]))
        else:
            a, b = rng.choice([(i, j) for i in range(len(days)) for j in range(len(days)) if eggs[i] > eggs[j]])
            out.append(short(f"How many more eggs were collected on {days[a]} than on {days[b]}?", eggs[a] - eggs[b],
                             [f"{eggs[a] - eggs[b]} eggs"]))
        return out
    if p["sub"] == "milk":
        days, (fr, an) = p["days"], p["litres"]
        k, d = rng.randrange(2), rng.randrange(len(days))
        row = p["litres"][k]
        out = [short(f"{who}'s family keeps two cows {where}. {who} writes down their milk every day. "
                     f"How many litres of milk did the {BREEDS[k]} cow give on {days[d]}?", row[d], _litres(row[d]))]
        d2 = rng.choice([j for j in range(len(days)) if j != d])
        out.append(short(f"How many litres did the two cows give together on {days[d2]}?", fr[d2] + an[d2],
                         _litres(fr[d2] + an[d2])))
        if rng.random() < 0.5:
            d3 = rng.randrange(len(days))
            out.append(short(f"How many more litres did the Friesian cow give than the Ankole cow on {days[d3]}?",
                             fr[d3] - an[d3], _litres(fr[d3] - an[d3])))
        else:
            k2 = rng.randrange(2)
            row = p["litres"][k2]
            out.append(mcq(f"On which day did the {BREEDS[k2]} cow give the most milk?", days[row.index(max(row))],
                           sorted(days, key=lambda x: -row[days.index(x)]), rng))
        return out
    rows = p["rows"]
    first, second = rng.sample(rows, 2)
    animal, n, amount, unit = first
    out = [short(f"{who} helps to look after the animals {where}. How many {unit} do all the {animal} eat in one day?",
                 n * amount, [f"{n * amount} {unit}"])]
    animal, n, amount, unit = second
    out.append(short(f"There are 7 days in a week. How many {unit} do all the {animal} eat in one week?", n * amount * 7,
                     [f"{n * amount * 7} {unit}"]))
    animal, n, amount, unit = rng.choice(rows)
    more = rng.randint(2, 4)
    out.append(short(f"The farm gets {more} more {animal}. How many {unit} will all the {animal} eat each day?",
                     (n + more) * amount, [f"{(n + more) * amount} {unit}"]))
    return out
