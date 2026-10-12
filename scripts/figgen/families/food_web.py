"""Food web from a real ecosystem. Arrows point from the food to the animal that eats it."""
from __future__ import annotations

import random

from ..core import mcq, new_figure, short

ID = "food_web"
KIND = "bio.ecology"
SUBJECT = "biology"
BANDS = ("LS", "UP")
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


def _levels(links):
    eats = _graph(links)
    level: dict[str, int] = {}

    def lv(n: str) -> int:
        if n not in level:
            level[n] = 0 if not eats[n] else 1 + max(lv(f) for f in eats[n])
        return level[n]

    for n in eats:
        lv(n)
    return level


def draw(p: dict):
    links = [tuple(l) for l in p["links"]]
    level = _levels(links)
    rows: dict[int, list[str]] = {}
    for n in sorted(level):
        rows.setdefault(level[n], []).append(n)
    pos = {}
    for lvl, names in rows.items():
        for i, n in enumerate(names):
            pos[n] = ((i + 1) / (len(names) + 1), lvl)
    fig, ax = new_figure(6.8, 4.8)
    for food, eater in links:
        (x1, y1), (x2, y2) = pos[food], pos[eater]
        ax.annotate("", xy=(x2, y2 - 0.12), xytext=(x1, y1 + 0.12),
                    arrowprops={"arrowstyle": "->", "color": "#111111", "linewidth": 1.2})
    for n, (x, y) in pos.items():
        ax.text(x, y, n, ha="center", va="center", fontsize=11,
                bbox={"boxstyle": "round,pad=0.3", "facecolor": "white", "edgecolor": "#111111"})
    ax.set_xlim(0, 1)
    ax.set_ylim(-0.5, max(level.values()) + 0.5)
    ax.axis("off")
    ax.set_title(f"Food web: {p['name'].lower()}")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    links = [tuple(l) for l in p["links"]]
    eats = _graph(links)
    producers = sorted(n for n, foods in eats.items() if not foods)
    herbivores = sorted(n for n, foods in eats.items() if foods and foods <= set(producers))
    others = sorted(n for n in eats if n not in producers)
    # Wrong answers for "primary consumer": animals that eat other animals, and producers.
    not_herb = sorted(n for n in eats if n not in herbivores)
    prod = rng.choice(producers)
    herb = rng.choice(herbivores)
    return [
        mcq("Which organism in this food web is a producer?", prod, rng.sample(others, min(3, len(others))), rng),
        mcq("Which organism is a primary consumer (eats only producers)?", herb,
            rng.sample(not_herb, min(3, len(not_herb))), rng),
        short("How many food chains are there in this food web?", chains(links)),
    ]
