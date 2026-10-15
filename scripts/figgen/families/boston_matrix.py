"""Boston matrix (AL): four to six products of a Rwandan firm as circles placed by market share (across, high on the
left and low on the right, as the Cambridge AS Level coursebook draws it) and market growth (up), with the two split
lines dashed and the four quadrants named on the chart (Star, Question mark, Cash cow, Dog), so the figure, not
memory, says which corner is which.

Every product sits on a gridline crossing, at least a gridline clear of both split lines and of the quadrant names.
The product in a named quadrant (one product is there), the product with the largest market share (by a gridline at
least; the reversed axis is the trap, so the smallest share is a distractor), and a product's market growth rate.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "boston_matrix"
KIND = "graph.scatter"
SUBJECT = "business"
BANDS = ("AL",)
CONCEPTS = ("business.marketing-mix", "business.marketing-strategy")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"boston|portfolio|marketing mix\W+product|product and pric"
# AS Level chapters listed without sections that share the marketing concepts but teach no product portfolio.
AVOID = r"what is marketing|market research|e-commerce|marketing planning|globalisation|business structure"

FIRMS = [
    ("a dairy in Nyagatare", ["Milk", "Yoghurt", "Cheese", "Butter", "Ghee", "Cream"]),
    ("a juice maker in Rwamagana", ["Mango", "Passion", "Pineapple", "Tamarillo", "Orange", "Lemon"]),
    ("a bakery in Huye", ["Bread", "Cakes", "Doughnuts", "Biscuits", "Samosas", "Chapati"]),
    ("a soap maker in Rubavu", ["Aloe", "Neem", "Honey", "Lemongrass", "Coconut", "Avocado"]),
    ("a flour mill in Kayonza", ["Maize", "Cassava", "Sorghum", "Soya", "Wheat", "Millet"]),
    ("a stationery maker in Muhanga", ["Notebooks", "Pens", "Folders", "Envelopes", "Diaries", "Pencils"]),
]
QUADRANT = {(True, True): "star", (False, True): "question mark", (True, False): "cash cow", (False, False): "dog"}
MIRROR = {"star": "question mark", "question mark": "star", "cash cow": "dog", "dog": "cash cow"}
SCALES = [  # (largest share shown, its split, step), (largest growth shown, its split, step)
    ((50, 25, 5), (20, 10, 2)), ((60, 30, 5), (20, 10, 2)), ((40, 20, 4), (20, 10, 2)),
    ((50, 25, 5), (16, 8, 2)), ((60, 30, 5), (24, 12, 2)), ((40, 20, 4), (24, 12, 3)),
]


def quadrant(p: dict, share: int, growth: int) -> str:
    return QUADRANT[(share > p["share_split"], growth > p["growth_split"])]


def sample(rng: random.Random) -> dict:
    firm, pool = rng.choice(FIRMS)
    (smax, ssplit, sstep), (gmax, gsplit, gstep) = rng.choice(SCALES)
    shares = [s for s in range(3 * sstep, smax, sstep) if abs(s - ssplit) >= sstep]  # room for a name on the right
    growths = [g for g in range(2 * gstep, gmax - gstep, gstep) if abs(g - gsplit) >= gstep]
    while True:
        n = rng.randint(4, 6)
        spots: list[tuple[int, int]] = []
        tries = 0
        while len(spots) < n and tries < 200:
            tries += 1
            s, g = rng.choice(shares), rng.choice(growths)
            # far enough apart that the names never meet: two rows apart, or four columns
            if all(abs(g - g2) >= 2 * gstep or abs(s - s2) >= 4 * sstep for s2, g2 in spots):
                spots.append((s, g))
        if len(spots) < n:
            continue
        ranked = sorted((s for s, _ in spots), reverse=True)
        if ranked[0] - ranked[1] < sstep:
            continue
        p = {"band": "AL", "firm": firm, "share_max": smax, "share_split": ssplit, "share_step": sstep,
             "growth_max": gmax, "growth_split": gsplit, "growth_step": gstep}
        quads = [quadrant(p, s, g) for s, g in spots]
        single = sorted(q for q in set(quads) if quads.count(q) == 1)
        if not single:
            continue
        names = rng.sample(pool, n)
        p["products"] = [[name, s, g] for name, (s, g) in zip(names, spots)]
        p["ask"] = rng.choice(single)
        p["growth_of"] = rng.choice(names)
        return p


def draw(p: dict):
    smax, sstep, gmax, gstep = p["share_max"], p["share_step"], p["growth_max"], p["growth_step"]
    fig, ax = new_figure(6.4, 5.0)
    ax.axvline(p["share_split"], color=INK, linewidth=1.6, linestyle="--")
    ax.axhline(p["growth_split"], color=INK, linewidth=1.6, linestyle="--")
    for name, s, g in p["products"]:
        ax.scatter([s], [g], s=230, facecolor="#c9d1d9", edgecolor=INK, linewidth=1.2, zorder=4)
        ax.annotate(name, (s, g), xytext=(12, 0), textcoords="offset points", ha="left", va="center",
                    fontsize=9.5, fontweight="bold", zorder=5,
                    bbox=dict(boxstyle="square,pad=0.08", facecolor="white", edgecolor="none"))
    pad = 0.35 * sstep
    for name, x, y, ha, va in (("Star", smax - pad, gmax - 0.35 * gstep, "left", "top"),
                               ("Question mark", pad, gmax - 0.35 * gstep, "right", "top"),
                               ("Cash cow", smax - pad, 0.35 * gstep, "left", "bottom"),
                               ("Dog", pad, 0.35 * gstep, "right", "bottom")):
        ax.text(x, y, name, ha=ha, va=va, fontsize=11, fontweight="bold", color="#555555", style="italic")
    ax.set_xticks(range(0, smax + 1, sstep))
    ax.set_yticks(range(0, gmax + 1, gstep))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(smax, 0)  # high market share on the left
    ax.set_ylim(0, gmax)
    ax.tick_params(labelsize=8.5)
    ax.set_xlabel("Market share (%), high to low  →")
    ax.set_ylabel("Market growth (% a year)")
    ax.set_title(f"Boston matrix for the products of {p['firm']}", fontsize=11.5)
    return fig


VERBS = ["studies", "is given", "draws", "looks at", "prepares"]
SETTINGS = ["for a marketing meeting", "for an A Level business lesson", "for homework", "for the firm's managers",
            "before a class test", "for a case study"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    prods = p["products"]
    names = [x[0] for x in prods]
    where = {name: quadrant(p, s, g) for name, s, g in prods}
    ask = p["ask"]
    key = next(n for n in names if where[n] == ask)
    others = [n for n in names if n != key]
    mirror = [n for n in others if where[n] == MIRROR[ask]]
    rest = [n for n in others if n not in mirror]
    rng.shuffle(mirror)
    rng.shuffle(rest)
    a = "an" if ask[0] in "aeiou" else "a"
    biggest = max(prods, key=lambda x: x[1])[0]
    smallest = min(prods, key=lambda x: x[1])[0]
    fastest = max(prods, key=lambda x: x[2])[0]
    near = [n for n in names if n not in (biggest, smallest, fastest)]
    rng.shuffle(near)
    g = next(x[2] for x in prods if x[0] == p["growth_of"])
    return [
        mcq(f"{who} {rng.choice(VERBS)} this Boston matrix for {p['firm']} {rng.choice(SETTINGS)}. "
            f"Which product is {a} {ask}?", key, (mirror + rest)[:3], rng),
        mcq(rng.choice([f"Which product of {p['firm']} has the largest market share?",
                        f"Of the products of {p['firm']}, which has the largest market share?"]),
            biggest, [smallest, fastest] + near, rng),
        short(rng.choice([f"What is the market growth rate for {p['growth_of']}, in %?",
                          f"Read the chart for {p['firm']}: what is the market growth rate for {p['growth_of']}, in %?"]),
              g, [f"{g}%", f"{g} %", f"{g} percent", f"{g}% a year"]),
    ]
