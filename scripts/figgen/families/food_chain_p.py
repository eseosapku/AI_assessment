"""Food chains and food webs (P). The lower level: a food chain of three or four boxes, from a place pupils know in
Rwanda (maize -> grasshopper -> bird -> hawk in a school garden in Huye, grass -> zebra -> lion in Akagera), drawn
across the page or up it. The upper level: a small food web of five or six living things. A key under the figure
says what an arrow means: "is eaten by", or "gives energy to".

How many consumers; which is the producer (one of the options is a plant from another chain, so the figure decides
it, not knowing which living things are plants); what eats a living thing (one eater only: a real eater of it from
outside the chain is a wrong option); and, for a chain, what happens to the number of one living thing if the next
one along dies out (only next to it, where the answer is plain), or, for a web, which animal would have nothing left
to eat.

Every link is a real feeding relation a Primary book draws.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, count, mcq, new_figure

ID = "food_chain_p"
KIND = "bio.ecology"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("food-chains-and-webs", "ecosystems", "habitats-and-environments"))
# A topic whose sections the book lists is reached only if one names food chains or living things together.
NEEDS = r"food (?:chain|web)|feeding relation|ecosystem|ecology|producer|consumer|living things and environment"
AVOID = r"\bcells?\b|living and non-living|science in context|technology"
MIN_VARIETY = 30  # built from real chains and webs, so fewer distinct figures than a numeric family

# Food chains: the place, and the living things from the producer up.
CHAINS = [
    ("a field", ["grass", "rabbit", "fox"]),
    ("the school garden in Huye", ["maize", "grasshopper", "bird", "hawk"]),
    ("a wetland near Kigali", ["grass", "grasshopper", "frog", "snake"]),
    ("a farm in Musanze", ["maize", "rat", "snake", "hawk"]),
    ("Akagera National Park", ["grass", "zebra", "lion"]),
    ("Akagera National Park", ["grass", "impala", "leopard"]),
    ("Lake Muhazi", ["algae", "tilapia", "heron"]),
    ("the school garden in Huye", ["cabbage", "caterpillar", "chicken"]),
    ("Nyungwe Forest", ["leaves", "caterpillar", "chameleon", "snake"]),
    ("a farm in Nyagatare", ["grass", "grasshopper", "chicken", "hawk"]),
    ("a farm in Rubavu", ["maize", "rat", "owl"]),
    ("Nyungwe Forest", ["leaves", "monkey", "eagle"]),
    ("Akagera National Park", ["grass", "grasshopper", "lizard", "eagle"]),
]
# Food webs: the place, the links (eaten, eater), and where each box stands: across the page, and its level up it.
WEBS = [
    ("Akagera National Park", [("grass", "zebra"), ("grass", "impala"), ("zebra", "lion"), ("impala", "lion"),
                               ("impala", "leopard")],
     {"grass": (0.5, 0), "zebra": (0.2, 1), "impala": (0.75, 1), "lion": (0.2, 2), "leopard": (0.8, 2)}),
    ("the school garden in Huye", [("maize", "grasshopper"), ("beans", "caterpillar"), ("grasshopper", "bird"),
                                   ("caterpillar", "bird"), ("grasshopper", "frog")],
     {"maize": (0.25, 0), "beans": (0.75, 0), "grasshopper": (0.25, 1), "caterpillar": (0.75, 1), "frog": (0.1, 2),
      "bird": (0.55, 2)}),
    ("a farm in Musanze", [("maize", "rat"), ("maize", "grasshopper"), ("grasshopper", "frog"), ("frog", "snake"),
                           ("rat", "snake"), ("rat", "owl")],
     {"maize": (0.5, 0), "grasshopper": (0.2, 1), "rat": (0.75, 1), "frog": (0.2, 2), "owl": (0.88, 2.5),
      "snake": (0.45, 3)}),
    ("Lake Muhazi", [("algae", "tadpole"), ("algae", "tilapia"), ("tadpole", "heron"), ("tilapia", "heron"),
                     ("tilapia", "kingfisher")],
     {"algae": (0.5, 0), "tadpole": (0.2, 1), "tilapia": (0.75, 1), "heron": (0.25, 2), "kingfisher": (0.82, 2)}),
    ("Nyungwe Forest", [("leaves", "caterpillar"), ("leaves", "monkey"), ("caterpillar", "chameleon"),
                        ("chameleon", "snake"), ("snake", "eagle"), ("monkey", "eagle")],
     {"leaves": (0.5, 0), "caterpillar": (0.2, 1), "monkey": (0.8, 1), "chameleon": (0.2, 2), "snake": (0.2, 3),
      "eagle": (0.65, 4)}),
    ("a farm in Nyagatare", [("grass", "grasshopper"), ("maize", "chicken"), ("grasshopper", "chicken"),
                             ("grasshopper", "lizard"), ("lizard", "hawk"), ("chicken", "hawk")],
     {"grass": (0.2, 0), "maize": (0.8, 0), "grasshopper": (0.2, 1), "lizard": (0.1, 2), "chicken": (0.65, 2),
      "hawk": (0.4, 3)}),
]
PLANTS = ["grass", "maize", "algae", "cabbage", "leaves", "beans"]
# Other animals that really eat each living thing, though not in the chain: a wrong answer the figure rules out.
ALSO_EATEN_BY = {
    "grass": ["goat", "cow"], "maize": ["rat", "grasshopper"], "rabbit": ["eagle", "snake"],
    "grasshopper": ["frog", "chicken", "lizard", "bird"], "bird": ["snake", "eagle"], "rat": ["owl", "snake"],
    "frog": ["heron", "snake"], "snake": ["eagle", "hawk"], "zebra": ["hyena", "lion"], "impala": ["lion", "leopard"],
    "algae": ["tadpole", "tilapia"], "tilapia": ["kingfisher", "heron"], "cabbage": ["goat", "rabbit"],
    "caterpillar": ["bird", "chicken", "chameleon"], "leaves": ["goat", "monkey"], "chameleon": ["bird", "snake"],
    "monkey": ["leopard", "eagle"], "lizard": ["hawk", "snake"], "chicken": ["eagle", "hawk"],
}
# How a stem names many of each.
MANY = {"rabbit": "rabbits", "fox": "foxes", "grasshopper": "grasshoppers", "bird": "birds", "hawk": "hawks",
        "frog": "frogs", "snake": "snakes", "rat": "rats", "zebra": "zebras", "lion": "lions", "impala": "impala",
        "leopard": "leopards", "tilapia": "tilapia", "heron": "herons", "caterpillar": "caterpillars",
        "chicken": "chickens", "chameleon": "chameleons", "owl": "owls", "monkey": "monkeys", "eagle": "eagles",
        "lizard": "lizards", "tadpole": "tadpoles", "kingfisher": "kingfishers", "grass": "grass", "maize": "maize",
        "algae": "algae", "cabbage": "cabbages", "leaves": "leaves", "beans": "beans"}
ARROW = {"eaten": "is eaten by", "energy": "gives energy to"}


def stages(p: dict) -> tuple[int, int] | None:
    return (4, 6) if p["kind"] == "web" else None


def sample(rng: random.Random) -> dict:
    arrow = rng.choice(sorted(ARROW))
    if rng.random() < 0.5:
        place, chain = rng.choice(CHAINS)
        return {"band": "P", "level": "lower", "kind": "chain", "place": place, "links": [list(l) for l in zip(chain, chain[1:])],
                "layout": rng.choice(["across", "up"]), "arrow": arrow}
    i = rng.randrange(len(WEBS))
    place, links, _ = WEBS[i]
    return {"band": "P", "level": "upper", "kind": "web", "place": place, "links": [list(l) for l in links], "web": i,
            "layout": rng.choice(["as drawn", "mirrored"]), "arrow": arrow}


def _places(p: dict) -> dict:
    """Where each box stands, in the axes' own units."""
    if p["kind"] == "web":
        spots = WEBS[p["web"]][2]
        return {n: ((1 - x if p["layout"] == "mirrored" else x) * 8.0, y * 1.5) for n, (x, y) in spots.items()}
    chain = [p["links"][0][0]] + [e for _, e in p["links"]]
    if p["layout"] == "across":
        gap = 8.0 / (len(chain) - 1)
        return {n: (i * gap, 0.0) for i, n in enumerate(chain)}
    return {n: (4.0, i * 1.5) for i, n in enumerate(chain)}


def _edge(centre, toward, half):
    """Where the line from a box's centre toward a point leaves the box."""
    (cx, cy), (tx, ty), (hw, hh) = centre, toward, half
    dx, dy = tx - cx, ty - cy
    s = min(hw / abs(dx) if dx else float("inf"), hh / abs(dy) if dy else float("inf"))
    return cx + dx * s, cy + dy * s


def draw(p: dict):
    place = _places(p)
    names = list(place)
    ys = [y for _, y in place.values()]
    across = p["kind"] == "chain" and p["layout"] == "across"
    fig, ax = new_figure(7.4, 2.0 if across else 1.0 + 0.95 * (max(ys) / 1.5 + 1))
    fig.subplots_adjust(left=0.02, right=0.98)
    ax.set_xlim(-1.2, 9.2)
    ax.set_ylim(min(ys) - 1.25, max(ys) + 0.6)
    ax.axis("off")
    boxes = {n: ax.text(*place[n], n, ha="center", va="center", fontsize=12, zorder=3, gid=f"box:{n}",
                        bbox={"boxstyle": "round,pad=0.4", "facecolor": "white", "edgecolor": INK, "linewidth": 1.3})
             for n in names}
    fig.canvas.draw()  # a box's size is known only once it is drawn
    renderer = fig.canvas.get_renderer()
    to_data = ax.transData.inverted()
    half = {}
    for n, t in boxes.items():
        b = t.get_bbox_patch().get_window_extent(renderer)
        (x0, y0), (x1, y1) = to_data.transform([(b.x0, b.y0), (b.x1, b.y1)])
        half[n] = ((x1 - x0) / 2, (y1 - y0) / 2)
    for food, eater in p["links"]:
        ax.annotate("", xy=_edge(place[eater], place[food], half[eater]), xytext=_edge(place[food], place[eater], half[food]),
                    zorder=2, gid=f"edge:{food}>{eater}",
                    arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.5, "mutation_scale": 16,
                                "shrinkA": 3, "shrinkB": 3})
    # The key: an arrow and what it means.
    ky = min(ys) - 0.9
    ax.annotate("", xy=(0.9, ky), xytext=(-0.6, ky),
                arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.5, "mutation_scale": 16})
    ax.text(1.2, ky, f"means “{ARROW[p['arrow']]}”", ha="left", va="center", fontsize=11)
    ax.set_title("A food chain" if p["kind"] == "chain" else "A food web", fontsize=12)
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a science lesson", "for homework", "on a nature walk", "at the science club", "for a class poster",
            "after a school trip"]
VERBS = ["drew", "made", "copied"]


def _amount(n: str) -> str:
    return f"the amount of {n}" if n in ("grass", "maize", "algae", "leaves") else f"the number of {MANY[n]}"


def questions(p: dict, rng: random.Random) -> list:
    links = [tuple(l) for l in p["links"]]
    names = sorted({n for l in links for n in l})
    foods = {n: sorted(f for f, e in links if e == n) for n in names}
    eaters = {n: sorted(e for f, e in links if f == n) for n in names}
    producers = [n for n in names if not foods[n]]
    consumers = [n for n in names if foods[n]]
    what = "food chain" if p["kind"] == "chain" else "food web"
    who = rng.choice(NAMES)
    qs = [count(f"{who} {rng.choice(VERBS)} this {what} of living things in {p['place']} {rng.choice(SETTINGS)}. "
                f"How many consumers are in this {what}?", len(consumers), "consumers")]
    # The producer, beside a plant that is not in this one, and the animals at each end.
    producer = rng.choice(producers)
    outside = [x for x in PLANTS if x not in names]
    first = [n for n in consumers if set(foods[n]) & set(producers)]  # eats the plant: "it eats, so it makes food"
    top = [n for n in consumers if not eaters[n]]  # at the arrow's end: "the chain ends there"
    wrong = [rng.choice(outside), rng.choice(first), rng.choice(top)]
    qs.append(mcq(f"Which living thing is a producer in this {what}?" if len(producers) > 1 else
                  f"Which living thing is the producer in this {what}?", producer, wrong + consumers, rng))
    # What eats a living thing that only one other eats here.
    x = rng.choice([n for n in names if len(eaters[n]) == 1])
    eater = eaters[x][0]
    slips = foods[x] + eaters[eater]  # the arrow read backwards; a step too far up
    real = [a for a in ALSO_EATEN_BY.get(x, []) if a not in names]
    others = [n for n in names if n not in (x, eater) and n not in slips and n not in producers]
    qs.append(mcq(f"In this {what}, what eats the {x}?", eater, slips[:2] + real[:1] + others, rng))
    if p["kind"] == "chain":
        z = rng.choice([n for n in names if eaters[n]])  # something eats it, so something is next along
        up = [eaters[z][0]]
        down = foods[z] if foods[z] else []
        y, key = rng.choice([(n, "It would go down.") for n in up] + [(n, "It would go up.") for n in down])
        qs.append(mcq(f"If all the {MANY[z]} died, what would happen to {_amount(y)}?", key,
                      ["It would go up.", "It would go down.", "It would stay the same."], rng))
    else:
        starve = [z for z in names if sum(1 for n in names if foods[n] == [z]) == 1]
        if starve:
            z = rng.choice(starve)
            gone = next(n for n in names if foods[n] == [z])
            near = [n for n in eaters[z] if n != gone] + foods[z]
            rest = [n for n in consumers if n not in near and n not in (gone, z)]
            qs.append(mcq(f"If all the {MANY[z]} in this food web died, which animal would have nothing left to eat?",
                          gone, [n for n in near if n not in producers] + rest, rng))
        else:
            y = rng.choice([n for n in names if len(foods[n]) >= 2])
            qs.append(count(f"How many different living things does the {y} eat in this food web?", len(foods[y])))
    return qs
