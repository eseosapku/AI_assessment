"""Food web from a real ecosystem. Arrows point from the food to the animal that eats it."""
from __future__ import annotations

import random

from ..core import NAMES, mcq, new_figure, short

ID = "food_web"
KIND = "bio.ecology"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("energy-flow-ecosystem", "interdependence-organisms-environment",
                                           "ecological-terms-biodiversity-meaning"))
AVOID = r"active transport|photosynthesis"
# Built from real ecosystems, so fewer distinct figures than a numeric family; 30 in 60 still
# fills a family's share of a topic (at most 12 of 50). More real webs add more.
MIN_VARIETY = 30

# Real feeding relations: (eaten, eater). Producers have nothing they eat.
WEBS = {
    "African savanna": [
        ("grass", "zebra"), ("grass", "gazelle"), ("grass", "grasshopper"), ("acacia", "giraffe"),
        ("grasshopper", "lizard"), ("lizard", "eagle"), ("zebra", "lion"), ("gazelle", "lion"),
        ("gazelle", "cheetah"), ("giraffe", "lion"),
    ],
    "Pond": [
        ("algae", "tadpole"), ("algae", "water snail"), ("pondweed", "water snail"), ("tadpole", "dragonfly larva"),
        ("dragonfly larva", "fish"), ("water snail", "fish"), ("fish", "heron"), ("tadpole", "fish"),
    ],
    "Rainforest": [
        ("fruit tree", "monkey"), ("fruit tree", "fruit bat"), ("leaves", "caterpillar"), ("leaves", "gorilla"),
        ("caterpillar", "chameleon"), ("caterpillar", "bird"), ("chameleon", "snake"), ("bird", "snake"),
        ("monkey", "leopard"), ("snake", "eagle"), ("monkey", "eagle"),
    ],
    "Seashore": [
        ("seaweed", "periwinkle"), ("phytoplankton", "mussel"), ("phytoplankton", "zooplankton"),
        ("zooplankton", "small fish"), ("periwinkle", "crab"), ("mussel", "starfish"), ("mussel", "crab"),
        ("small fish", "seagull"), ("crab", "seagull"),
    ],
    "Farmland": [
        ("maize", "rat"), ("maize", "grasshopper"), ("grass", "rabbit"), ("grasshopper", "frog"),
        ("frog", "snake"), ("rat", "snake"), ("rat", "owl"), ("rabbit", "fox"), ("snake", "hawk"),
    ],
}


def _graph(links):
    eats: dict[str, set[str]] = {}
    for food, eater in links:
        eats.setdefault(eater, set()).add(food)
        eats.setdefault(food, set())
    return eats


def chains(links) -> int:
    """Food chains from a producer to a top consumer, counted by path."""
    eats = _graph(links)
    eaten_by: dict[str, set[str]] = {n: set() for n in eats}
    for food, eater in links:
        eaten_by[food].add(eater)
    producers = [n for n, foods in eats.items() if not foods]

    def paths(n: str) -> int:
        return 1 if not eaten_by[n] else sum(paths(m) for m in eaten_by[n])

    return sum(paths(p) for p in producers)


def _producers(links) -> set[str]:
    return {n for n, foods in _graph(links).items() if not foods}


def _valid(links, producers: set[str]) -> bool:
    """Every animal left still eats something, and the producers are the same plants as before."""
    eats = _graph(links)
    names = set(eats)
    return len(names) >= 5 and _producers(links) == producers & names and bool(producers & names)


def sample(rng: random.Random) -> dict:
    name = rng.choice(sorted(WEBS))
    full = list(WEBS[name])
    producers = _producers(full)
    links = full
    # For variety, leave out up to three organisms with their links: a true excerpt of
    # the real web, kept only if every animal left still has something to eat.
    wanted = rng.randint(0, 3)
    for _ in range(12):
        if len({n for l in full for n in l}) - len({n for l in links for n in l}) >= wanted:
            break
        animals = sorted({n for l in links for n in l} - producers)
        gone = rng.choice(animals)
        rest = [l for l in links if gone not in l]
        if _valid(rest, producers):
            links = rest
    return {"name": name, "links": [list(l) for l in links]}


# Where each organism stands: x across the page, y its level from the plants up. Placed by
# hand, as a textbook would, so no arrow runs behind another organism's box (one that did
# made the web read as different links). A web with organisms left out keeps these places.
LAYOUT = {
    "African savanna": {
        "grass": (0.32, 0), "acacia": (0.85, 0), "grasshopper": (0.1, 1), "zebra": (0.33, 1), "gazelle": (0.58, 1),
        "giraffe": (0.85, 1), "lizard": (0.1, 2), "cheetah": (0.58, 2), "lion": (0.82, 2), "eagle": (0.1, 3),
    },
    "Pond": {
        "algae": (0.3, 0), "pondweed": (0.75, 0), "tadpole": (0.25, 1), "water snail": (0.7, 1),
        "dragonfly larva": (0.2, 2), "fish": (0.55, 3), "heron": (0.55, 4),
    },
    "Rainforest": {
        "leaves": (0.25, 0), "fruit tree": (0.75, 0), "gorilla": (0.1, 1), "caterpillar": (0.35, 1), "monkey": (0.62, 1),
        "fruit bat": (0.88, 1), "chameleon": (0.13, 2), "bird": (0.4, 2), "leopard": (0.88, 2), "snake": (0.28, 3),
        "eagle": (0.5, 4),
    },
    "Seashore": {
        "seaweed": (0.18, 0), "phytoplankton": (0.65, 0), "periwinkle": (0.13, 1), "mussel": (0.45, 1),
        "zooplankton": (0.82, 1), "crab": (0.25, 2), "starfish": (0.5, 2), "small fish": (0.82, 2), "seagull": (0.5, 3),
    },
    "Farmland": {
        "maize": (0.35, 0), "grass": (0.8, 0), "grasshopper": (0.12, 1), "rat": (0.45, 1), "rabbit": (0.8, 1),
        "frog": (0.12, 2), "owl": (0.6, 2), "fox": (0.88, 2), "snake": (0.3, 3), "hawk": (0.3, 4),
    },
}


def _edge(centre, toward, half):
    """Where the line from a box's centre toward a point leaves the box."""
    (cx, cy), (tx, ty), (hw, hh) = centre, toward, half
    dx, dy = tx - cx, ty - cy
    s = min(hw / abs(dx) if dx else float("inf"), hh / abs(dy) if dy else float("inf"))
    return cx + dx * s, cy + dy * s


def draw(p: dict):
    links = [tuple(l) for l in p["links"]]
    place = LAYOUT[p["name"]]
    names = sorted({n for l in links for n in l})
    fig, ax = new_figure(6.8, 4.8)
    ax.set_xlim(0, 1)
    ax.set_ylim(-0.5, max(place[n][1] for n in names) + 0.5)
    ax.axis("off")
    ax.set_title(f"Food web: {p['name'].lower()}")
    boxes = {n: ax.text(*place[n], n, ha="center", va="center", fontsize=11, zorder=3,
                        bbox={"boxstyle": "round,pad=0.3", "facecolor": "white", "edgecolor": "#111111"})
             for n in names}
    fig.canvas.draw()  # a box's size is known only once it is drawn
    renderer = fig.canvas.get_renderer()
    to_data = ax.transData.inverted()
    half = {}
    for n, t in boxes.items():
        b = t.get_bbox_patch().get_window_extent(renderer)
        (x0, y0), (x1, y1) = to_data.transform([(b.x0, b.y0), (b.x1, b.y1)])
        half[n] = ((x1 - x0) / 2, (y1 - y0) / 2)
    # Each arrow runs from the edge of one box to the edge of the other, so its head always shows.
    for food, eater in links:
        ax.annotate("", xy=_edge(place[eater], place[food], half[eater]),
                    xytext=_edge(place[food], place[eater], half[food]), zorder=2, gid=f"edge:{food}>{eater}",
                    arrowprops={"arrowstyle": "-|>", "color": "#111111", "linewidth": 1.2, "mutation_scale": 14,
                                "shrinkA": 2, "shrinkB": 2})
    return fig


SETTINGS = ["in a biology lesson", "for homework", "on a field trip", "at the science club", "on a revision card"]
PLACES = {"African savanna": "an African savanna", "Farmland": "a farm"}


def questions(p: dict, rng: random.Random) -> list:
    links = [tuple(l) for l in p["links"]]
    eats = _graph(links)
    producers = sorted(n for n, foods in eats.items() if not foods)
    herbivores = sorted(n for n, foods in eats.items() if foods and foods <= set(producers))
    others = sorted(n for n in eats if n not in producers)
    # Wrong answers for "primary consumer": animals that eat other animals, and producers.
    not_herb = sorted(n for n in eats if n not in herbivores)
    who = rng.choice(NAMES)
    place = PLACES.get(p["name"], "a " + p["name"].lower())
    setting = rng.choice(SETTINGS)
    prod = rng.choice(producers)
    herb = rng.choice(herbivores)
    return [
        mcq(f"{who} drew this food web of {place} {setting}. Which organism in this food web is a producer?",
            prod, rng.sample(others, min(3, len(others))), rng),
        mcq("Which organism is a primary consumer (eats only producers)?", herb,
            rng.sample(not_herb, min(3, len(not_herb))), rng),
        short("A food chain starts with a producer and ends with an animal that nothing in this web eats. "
              "How many food chains are there in this food web?", chains(links)),
    ]
