"""Industry (LS; P6 geography): where to build a factory, and the industries of an invented industrial zone, as the
Rwanda S1 "Economic activities", S2 "Industry in Rwanda" (factors for the location of industries; classification) and
S3 "Industrial Development in Africa" units teach industry.

Two sub-types:
- site: a sketch of the road from a source of raw material (tea estates, a limestone quarry, coffee farms or sugar-cane
  farms) to Market Town M, with four possible factory sites lettered W to Z at marked distances, and a box that
  states how many tonnes of raw material make one tonne of product and the cost of carrying a tonne for a kilometre.
  The transport cost for each tonne of product at a site (cost = raw material carried in + product carried out,
  printed), the cheapest site, and how much more one site costs than another.
- zone: a bar chart of the workers in each industry of Industrial Zone K. The industry with the most workers, the
  workers altogether, the share in food and drink processing (percentage = workers ÷ total × 100, printed), and how
  many more work in one industry than another.

The places, factories and numbers are invented; every key is worked from the printed numbers or the bars.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, mcq, money, new_figure, short
from ._bio_parts import letter_choice
from ._geo_charts import bar_chart, num_forms, pct_forms

ID = "industry_location"
KIND = "geo.map"
SUBJECT = "geography"
BANDS = ("LS",)
MORE = {"site": ("geography.industrial-location",),
        "zone": ("geography.industrial-development", "geography.industry-definition")}
CONCEPTS = ("geography.industrial-location", "geography.industrial-development", "geography.industry-definition")
# A topic whose sections the book lists is reached only if its name or a section names industry or the economic
# activities.
NEEDS = r"industr|economic activit"
# Each raw material: the place it comes from, the product, and the tonnes of raw material for each tonne of product.
SOURCES = {"tea leaves": ("Tea estates", "made tea", (4, 5)), "limestone": ("Limestone quarry", "cement", (2, 3)),
           "coffee cherries": ("Coffee farms", "coffee beans", (5, 6)), "sugar cane": ("Sugar-cane farms", "sugar", (8, 10))}
LETTERS = ["W", "X", "Y", "Z"]
INDUSTRIES = ["Food and drink processing", "Textiles and clothing", "Construction materials", "Furniture",
              "Chemicals and soap", "Printing and paper"]
ZONE = "Industrial Zone K"
TOWN = "Market Town M"


def concepts_for(p: dict) -> tuple[str, ...]:
    return MORE[p["sub"]]


def _site(rng: random.Random) -> dict | None:
    raw = rng.choice(sorted(SOURCES))
    ratio = rng.randint(*SOURCES[raw][2])
    length = 10 * rng.randint(6, 12)
    spots = sorted(rng.sample(range(1, length // 10), 4))
    km = [10 * k for k in spots]
    rate_raw = 10 * rng.randint(5, 12)
    rate_out = rate_raw + 10 * rng.randint(0, 6)
    cost = [ratio * x * rate_raw + (length - x) * rate_out for x in km]
    ranked = sorted(cost)
    if ranked[1] - ranked[0] < 500:
        return None
    letters = LETTERS[:]
    rng.shuffle(letters)
    a, b = rng.sample(range(4), 2)
    if cost[a] < cost[b]:
        a, b = b, a
    return {"band": "LS", "sub": "site", "raw": raw, "ratio": ratio, "length": length, "km": km, "letters": letters,
            "rates": [rate_raw, rate_out], "ask": {"cost": rng.randrange(4), "more": [a, b]}}


def _zone(rng: random.Random) -> dict | None:
    names = rng.sample(INDUSTRIES[1:], rng.randint(3, 4)) + [INDUSTRIES[0]]
    rng.shuffle(names)
    vals = [50 * rng.randint(2, 16) for _ in names]
    ranked = sorted(vals, reverse=True)
    total = sum(vals)
    if ranked[0] - ranked[1] < 100 or len(set(vals)) < len(vals):
        return None
    if vals[names.index(INDUSTRIES[0])] * 100 % total:
        return None
    a, b = rng.sample(range(len(names)), 2)
    if vals[a] < vals[b]:
        a, b = b, a
    return {"band": "LS", "sub": "zone", "names": names, "workers": vals, "ask": {"more": [a, b]}}


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["site", "zone"])
    while True:
        p = (_site if sub == "site" else _zone)(rng)
        if p:
            return p


def _draw_site(p: dict):
    fig, ax = new_figure(10.4, 6.0)
    source, product, _ = SOURCES[p["raw"]]
    L = p["length"]
    x0, x1, y = 0.9, 9.8, 3.0
    sx = lambda km: x0 + (x1 - x0) * km / L  # noqa: E731
    ax.plot([x0, x1], [y, y], color="#7f7f7f", linewidth=5, solid_capstyle="butt", zorder=2, gid="road")
    ax.add_patch(Rectangle((x0 - 0.35, y - 0.35), 0.7, 0.7, facecolor="#6aa84f", edgecolor=INK, linewidth=1.2, zorder=3,
                           gid="source"))
    ax.text(x0, y + 0.95, source, ha="center", va="bottom", fontsize=10.5, fontweight="bold")
    ax.add_patch(Circle((x1, y), 0.35, facecolor="#f6c344", edgecolor=INK, linewidth=1.2, zorder=3, gid="town"))
    ax.text(x1, y + 0.95, TOWN, ha="center", va="bottom", fontsize=10.5, fontweight="bold")
    for km, letter in zip(p["km"], p["letters"]):
        x = sx(km)
        ax.add_patch(Rectangle((x - 0.17, y - 0.17), 0.34, 0.34, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=4,
                               gid=f"site:{letter}"))
        ax.text(x, y + 0.5, letter, ha="center", va="center", fontsize=13, fontweight="bold", zorder=5,
                gid=f"letter:{letter}")
        ax.text(x, y - 0.55, f"{km} km", ha="center", va="center", fontsize=9.5, zorder=5)
    ax.text(x0, y - 0.55, "0 km", ha="center", va="center", fontsize=9.5)
    ax.text(x1, y - 0.55, f"{L} km", ha="center", va="center", fontsize=9.5)
    ax.text(5.4, y - 1.05, f"Distances along the road from the {source.lower()}; □ = a possible factory site",
            ha="center", va="center", fontsize=9.5, style="italic")
    lines = [f"A factory makes {product} from {p['raw']}.",
             f"It needs {p['ratio']} tonnes of {p['raw']} to make 1 tonne of {product}.",
             f"Cost of carrying 1 tonne of {p['raw']} for 1 km: {p['rates'][0]} Frw",
             f"Cost of carrying 1 tonne of {product} for 1 km: {p['rates'][1]} Frw",
             "Transport cost for 1 tonne of product =",
             "   (tonnes of raw material × km from the source × cost of carrying raw material)",
             "   + (km to the market × cost of carrying the product)"]
    for k, line in enumerate(lines):
        ax.text(0.1, 0.9 - 0.42 * k, line, ha="left", va="center", fontsize=10, gid=f"fact:{k}")
    ax.set_xlim(-0.1, 10.9)
    ax.set_ylim(0.9 - 0.42 * 6 - 0.35, 4.6)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(f"Where should the {product} factory be built?", fontsize=12.5, fontweight="bold")
    return fig


def draw(p: dict):
    if p["sub"] == "site":
        return _draw_site(p)
    top = -(-(max(p["workers"]) + 50) // 200) * 200
    fig, _ = bar_chart(p["names"], p["workers"], top=top, major=200, minor=50, ylabel="Number of workers",
                       xlabel="Industry", title=f"Workers in each industry of {ZONE}",
                       notes=["Percentage of workers = workers in the industry ÷ all workers × 100"], color="#8e7cc3",
                       size=(8.4, 5.2), wrap_at=13)
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on industry", "for a class test",
            "at the geography club", "while revising in Kigali", "for a lesson on industrial location",
            "on a revision card", "while revising in Huye", "before a factory visit"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "site":
        _, product, _ = SOURCES[p["raw"]]
        lead = f"{who} {rng.choice(VERBS)} this sketch of possible factory sites {rng.choice(SETTINGS)}."
        km, letters, L = p["km"], p["letters"], p["length"]
        rr, ro = p["rates"]
        cost = [p["ratio"] * x * rr + (L - x) * ro for x in km]
        k = p["ask"]["cost"]
        best = cost.index(min(cost))
        a, b = p["ask"]["more"]
        return [
            short(f"{lead} Using the rule in the box, what is the transport cost for 1 tonne of {product} if the factory "
                  f"is built at site {letters[k]}, in Frw?", cost[k], money(cost[k])),
            letter_choice(f"Using the rule in the box, at which site is the transport cost for 1 tonne of {product} "
                          "lowest?", letters[best], [x for x in LETTERS if x != letters[best]]),
            short(f"How much more is the transport cost for 1 tonne of {product} at site {letters[a]} than at site "
                  f"{letters[b]}, in Frw?", cost[a] - cost[b], money(cost[a] - cost[b])),
        ]
    lead = f"{who} {rng.choice(VERBS)} this bar chart of {ZONE} {rng.choice(SETTINGS)}."
    names, v = p["names"], p["workers"]
    total = sum(v)
    top = names[v.index(max(v))]
    food = v[names.index(INDUSTRIES[0])] * 100 // total
    a, b = p["ask"]["more"]
    return [
        mcq(f"{lead} Which industry in {ZONE} has the most workers?", top, [n for n in names if n != top], rng),
        short(f"How many people work in the industries of {ZONE} altogether?", total, num_forms(total, "workers", "people")),
        short(f"Percentage of workers = workers in the industry ÷ all workers × 100. What percentage of the workers in "
              f"{ZONE} work in food and drink processing?", f"{food}%", pct_forms(food)),
        short(f"How many more people work in {names[a].lower()} than in {names[b].lower()} in {ZONE}?", v[a] - v[b],
              num_forms(v[a] - v[b], "workers", "people")),
    ]
