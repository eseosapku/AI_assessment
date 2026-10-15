"""Product life cycle (UP, AL): a Rwandan product's yearly sales over 12 to 16 years from its launch, as a line with a
point for each year, every point on a gridline. Four stages, always from launch, marked off by dotted lines halfway
between two years (so every yearly point sits inside one stage) and numbered I to IV, never named: I introduction,
II growth, III maturity, IV decline. Roman numerals, not letters, which a reviewer read against option "A. Decline";
no development stage of zero sales, which left reviewers unsure whether II was introduction or growth (P3y review).

Each stage's shape is unmistakable: introduction rises one gridline a year; growth at least three a year (at least
twice introduction's rise); maturity moves one gridline a year at most (at most half growth's rise), peaking once;
decline falls at least two a year. In maturity, sales are flat or falling up to the year an extension strategy is
launched, marked as a dashed vertical line exactly on that year and labelled at its top; they rise in the year after.
An arrow at a data point had been read as the strategy's effect, a year late (P3y re-review).

The stage the product was in at a given year (an MCQ of stage names), the year sales peaked, the year the extension
strategy was launched or the sales in the year after it, and how many yearly points lie in the growth stage (stage
II, named in the stem).
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, count, mcq, new_figure, short

ID = "product_life_cycle"
KIND = "graph.line"
SUBJECT = "business"
BANDS = ("UP", "AL")
CONCEPTS = ("business.marketing-mix", "business.marketing-strategy")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"product life|life cycle|marketing mix\W+product|product and pric"
# Listed without sections and sharing the marketing mix: the other Ps, research, e-commerce and planning.
AVOID = (r"promotion|distribution|digital|e-commerce|market research|what is marketing|marketing planning|"
         r"globalisation|marketing introduction|^marketing$|business structure")

# (the product, its short name in a question, the maker, the unit sales are counted in)
PRODUCTS = [
    ("a passion fruit juice", "passion fruit juice", "a juice maker in Rwamagana", "thousand bottles"),
    ("a strawberry yoghurt", "strawberry yoghurt", "a dairy in Nyagatare", "thousand cups"),
    ("a solar lamp", "solar lamp", "a solar company in Kigali", "thousand lamps"),
    ("an avocado soap", "avocado soap", "a soap maker in Rubavu", "thousand bars"),
    ("a banana biscuit", "banana biscuit", "a bakery in Huye", "thousand packets"),
    ("a smartphone", "smartphone", "a phone assembler in Kigali", "thousand phones"),
    ("an instant coffee", "instant coffee", "a coffee roaster in Huye", "thousand jars"),
    ("a bottled mineral water", "mineral water", "a water company in Musanze", "thousand crates"),
    ("a maize flour", "maize flour", "a mill in Kayonza", "thousand bags"),
]
STAGES = ["Introduction", "Growth", "Maturity", "Decline"]
NUMERALS = ["I", "II", "III", "IV"]


def sample(rng: random.Random) -> dict:
    product, short_name, maker, unit = rng.choice(PRODUCTS)
    while True:
        units: list[int] = []  # sales, in gridline steps
        intro = rng.randint(2, 3)
        first = rng.randint(1, 2)
        units += [first + k for k in range(intro)]  # a slow start: one gridline a year
        growth = rng.randint(3, 4)
        for _ in range(growth):
            units.append(units[-1] + rng.randint(3, 4))  # steep: three or four gridlines a year
        peak = units[-1] + 1  # the rise slows to one gridline: maturity begins at the peak
        # flat or falling, a gridline a year at most, until the strategy is launched two gridlines below the peak
        run = rng.choice([[-1, -1], [-1, 0, -1], [-1, -1, 0]])  # never flat at once: one peak
        mature = [peak]
        for d in run:
            mature.append(mature[-1] + d)
        if mature[-1] > peak - 2:
            continue
        launch_at = len(mature) - 1  # the launch year's place in maturity
        mature.append(mature[-1] + 1)  # sales rise in the year after the launch
        mature.append(mature[-1] - rng.randint(0, 1))  # and one more year of maturity: room for the launch's label
        units += mature
        decline = rng.randint(2, 4)
        for _ in range(decline):
            units.append(units[-1] - rng.randint(2, 4))
        if units[-1] < 1 or not 12 <= len(units) <= 16:
            continue
        spans, stages, at = [intro, growth, len(mature), decline], [], 0
        for k, n in enumerate(spans):
            stages.append([NUMERALS[k], at, at + n - 1])
            at += n
        step = rng.choice([5, 10, 20])
        return {"band": rng.choice(BANDS), "product": product, "short": short_name, "maker": maker, "unit": unit,
                "start": rng.randint(2006, 2010), "sales": [u * step for u in units], "step": step,
                "stages": stages, "ext": stages[2][1] + launch_at}


def draw(p: dict):
    sales, step, start = p["sales"], p["step"], p["start"]
    n = len(sales)
    years = [start + i for i in range(n)]
    top = max(sales) + 5 * step
    fig, ax = new_figure(7.6, 4.8)
    ax.plot(years, sales, color=INK, linewidth=2.0, marker="o", markersize=4, gid="sales")
    for k, st in enumerate(p["stages"]):
        a, b = start + st[1] - 0.5, start + st[2] + 0.5  # halfway between two years
        if k:
            ax.plot([a, a], [0, top], color=INK, linewidth=1.0, linestyle=":", gid=f"boundary{k}")
        ax.text((a + b) / 2, top - step, st[0], ha="center", va="center", fontsize=13, fontweight="bold",
                family="DejaVu Serif")
    e = start + p["ext"]
    # the launch: a dashed line on the year, its label at the top, right of it and left of the decline's boundary
    ax.plot([e, e], [0, top - 1.75 * step], color=INK, linewidth=1.5, linestyle="--", gid="extension")
    ax.text(e + 0.12, top - 1.75 * step, "Extension\nstrategy\nlaunched", ha="left", va="top", fontsize=8.5,
            fontweight="bold", linespacing=1.15)
    ax.set_xticks(years)
    ax.tick_params(axis="x", labelsize=8)
    ax.tick_params(axis="y", labelsize=8.5)
    labels = 2 if top // step <= 24 else 4
    ax.set_yticks(range(0, top + 1, step * labels))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.tick_params(which="minor", length=0)
    ax.grid(True, which="both", axis="y", color=GRID, linewidth=0.6)
    ax.grid(True, which="major", axis="x", color=GRID, linewidth=0.4)
    ax.set_axisbelow(True)
    ax.set_xlim(start - 0.6, start + n - 0.4)
    ax.set_ylim(0, top)
    ax.set_xlabel("Year")
    ax.set_ylabel(f"Sales ({p['unit']})")
    ax.set_title(f"Sales of {p['product']} made by {p['maker']}", fontsize=11.5)
    return fig


VERBS = ["studies", "is given", "draws", "looks at", "plots"]
SETTINGS = ["in a business studies lesson", "for homework", "for a marketing report", "for a class test",
            "for the firm's managers", "on a revision card"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    sales, start, stages, ext = p["sales"], p["start"], p["stages"], p["ext"]
    thing, unit = p["short"], p["unit"]
    k = rng.randrange(4)
    i = rng.choice([i for i in range(stages[k][1], stages[k][2] + 1) if i != ext])
    others = [x for x in STAGES if x != STAGES[k]]
    growth = stages[1][2] - stages[1][1] + 1
    if rng.random() < 0.5:
        launch = short(rng.choice([f"In which year was the extension strategy for the {thing} launched?",
                                   f"The dashed line marks the extension strategy for the {thing}. In which year was "
                                   f"the extension strategy launched?"]), start + ext)
    else:
        after = sales[ext + 1]
        launch = short(f"What were the sales of the {thing} in the year after the extension strategy was launched, "
                       f"in {unit}?", after, [f"{after} {unit}", f"{after} thousand", str(after * 1000),
                                              f"{after * 1000:,}", f"{after * 1000:,}".replace(",", " ")])
    return [
        mcq(f"{who} {rng.choice(VERBS)} this chart of the sales of {p['product']} {rng.choice(SETTINGS)}. The stages of "
            f"its product life cycle are numbered I to IV. Which stage of the product life cycle was the {thing} in "
            f"during {start + i}?", STAGES[k], others, rng),
        short(rng.choice([f"In which year did sales of the {thing} reach their peak?",
                          f"In which year were sales of the {thing} at their peak?"]),
              start + sales.index(max(sales))),
        launch,
        count(f"How many of the yearly sales points lie in the growth stage (stage II) of the {thing}'s life cycle?",
              growth, "points", "years"),
    ]
