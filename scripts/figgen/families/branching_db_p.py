"""Branching databases (P, Cambridge Primary Computing Stages 3 and 4): a tree of yes/no questions that sorts four to six
animals, or four or five shapes (drawn, some shaded), into lettered boxes at its ends. The tree is built from a fixed
table of each thing's true answers (a zebra has stripes and fur, an ostrich has feathers and cannot fly; a square has
4 sides all the same length and a right angle), so every branch tells the truth. "Yes" goes left and "No" right, both
printed on the lines.

Asks in which lettered box a new animal or shape ends -- its answers to the questions on its way are printed in the
stem, so the tree, not knowledge, decides -- which question separates two of the things, and how many questions are
answered to reach a thing.

Questions a thing cannot fairly answer (how many sides a circle has) are never asked of it. Every key is the tree
walked from the params.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle, Wedge

from ..core import INK, NAMES, count, mcq, new_figure

ID = "branching_db_p"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("P",)
CONCEPTS = ("computing.discrete-categorical-data",)
# A topic whose sections the book lists is reached only if its name or a section names a branching database, sorting,
# yes/no questions or keys; the data units listed without sections are judged by their concept and stage.
NEEDS = r"branching|database|yes.?no|sort|classif|\bkeys?\b|data designer|data controller|data boss"
# Units on tally charts, pictograms and data collection forms, and units of other strands.
AVOID = r"collector|detective|tally|pictogram|network|robot|game|animator|storyteller|musician|artist|designer\b(?<!data designer)"

QUESTIONS = {
    "animals": {"feathers": "Does it have feathers?", "fur": "Does it have fur or hair?",
                "legs4": "Does it have four legs?", "fins": "Does it have fins?", "stripes": "Does it have stripes?",
                "horns": "Does it have horns?", "fly": "Can it fly?", "shell": "Does it have a shell?"},
    "shapes": {"curved": "Does it have a curved side?", "four": "Does it have 4 sides?", "three": "Does it have 3 sides?",
               "equal": "Are all its sides the same length?", "right": "Does it have a right angle?",
               "more4": "Does it have more than 4 sides?", "shaded": "Is it shaded?"},
}
SAY = {"feathers": ("It has feathers.", "It has no feathers."), "fur": ("It has fur or hair.", "It has no fur or hair."),
       "legs4": ("It has four legs.", "It does not have four legs."), "fins": ("It has fins.", "It has no fins."),
       "stripes": ("It has stripes.", "It has no stripes."), "horns": ("It has horns.", "It has no horns."),
       "fly": ("It can fly.", "It cannot fly."), "shell": ("It has a shell.", "It has no shell."),
       "curved": ("It has a curved side.", "It has no curved side."), "four": ("It has 4 sides.", "It does not have 4 sides."),
       "three": ("It has 3 sides.", "It does not have 3 sides."),
       "equal": ("All its sides are the same length.", "Its sides are not all the same length."),
       "right": ("It has a right angle.", "It has no right angle."),
       "more4": ("It has more than 4 sides.", "It does not have more than 4 sides."),
       "shaded": ("It is shaded.", "It is not shaded.")}
# Each thing's true answers; a question missing from a shape's row is one it cannot fairly answer.
ANIMALS = {"zebra": {"fur", "legs4", "stripes"}, "cow": {"fur", "legs4", "horns"}, "dog": {"fur", "legs4"},
           "frog": {"legs4"}, "tortoise": {"legs4", "shell"}, "eagle": {"feathers", "fly"}, "ostrich": {"feathers"},
           "fish": {"fins"}, "snake": set(), "snail": {"shell"}}
SHAPES = {"square": {"curved": False, "four": True, "three": False, "equal": True, "right": True, "more4": False},
          "rectangle": {"curved": False, "four": True, "three": False, "equal": False, "right": True, "more4": False},
          "triangle": {"curved": False, "four": False, "three": True, "equal": True, "right": False, "more4": False},
          "right-angled triangle": {"curved": False, "four": False, "three": True, "equal": False, "right": True,
                                    "more4": False},
          "circle": {"curved": True},
          "semicircle": {"curved": True},
          "pentagon": {"curved": False, "four": False, "three": False, "equal": True, "right": False, "more4": True},
          "hexagon": {"curved": False, "four": False, "three": False, "equal": True, "right": False, "more4": True}}


def stages(p: dict) -> tuple[int, int]:
    return (3, 4)


def answers(p: dict, thing: str) -> dict:
    """A thing's answer to each question it can fairly answer."""
    if p["domain"] == "animals":
        return {q: q in ANIMALS[thing] for q in QUESTIONS["animals"]}
    out = dict(SHAPES[thing])
    out["shaded"] = thing in p["shaded"]
    return out


def _build(p: dict, things: list, rng: random.Random, depth: int) -> dict | None:
    if len(things) == 1:
        return {"item": things[0]}
    if depth == 3:
        return None
    ok = []
    for q in QUESTIONS[p["domain"]]:
        vals = [answers(p, t).get(q) for t in things]
        if None in vals:
            continue
        yes = [t for t, v in zip(things, vals) if v]
        if 0 < len(yes) < len(things):
            ok.append((q, yes, [t for t in things if t not in yes]))
    rng.shuffle(ok)
    ok.sort(key=lambda x: abs(len(x[1]) - len(x[2])))  # the most even split first
    for q, yes, no in ok[:2]:
        a, b = _build(p, yes, rng, depth + 1), _build(p, no, rng, depth + 1)
        if a and b:
            return {"q": q, "yes": a, "no": b}
    return None


def leaves(node: dict, path: tuple = ()) -> list[tuple[str, tuple]]:
    """Each end of the tree left to right: its thing and the answers (q, yes?) that lead to it."""
    if "item" in node:
        return [(node["item"], path)]
    return leaves(node["yes"], path + ((node["q"], True),)) + leaves(node["no"], path + ((node["q"], False),))


def walk(p: dict, answer: dict) -> str:
    node = p["tree"]
    while "q" in node:
        node = node["yes"] if answer[node["q"]] else node["no"]
    return node["item"]


def sample(rng: random.Random) -> dict:
    domain = rng.choice(["animals", "shapes"])
    pool = ANIMALS if domain == "animals" else SHAPES
    while True:
        n = rng.randint(4, 6) if domain == "animals" else rng.randint(4, 5)
        things = rng.sample(sorted(pool), n)
        p = {"band": "P", "domain": domain, "things": things,
             "shaded": sorted(t for t in pool if rng.random() < 0.5) if domain == "shapes" else []}
        tree = _build(p, things, rng, 0)
        if not tree:
            continue
        p["tree"] = tree
        ends = leaves(tree)
        if len(set(_questions(tree))) < 3:  # three different questions, so the one that separates two things has rivals
            continue
        # a new thing whose every question on its way it can answer
        news = []
        for t in sorted(set(pool) - set(things)):
            a = answers(p, t)
            node, fine = tree, True
            while "q" in node:
                if a.get(node["q"]) is None:
                    fine = False
                    break
                node = node["yes"] if a[node["q"]] else node["no"]
            if fine:
                news.append(t)
        if not news:
            continue
        pair = rng.sample([e[0] for e in ends], 2)
        p.update({"letters": list("ABCDEF"[:len(ends)]),
                  "ask": {"new": rng.choice(news), "pair": pair, "depth": rng.choice([e[0] for e in ends])}})
        return p


def _questions(node: dict):
    if "q" in node:
        yield node["q"]
        yield from _questions(node["yes"])
        yield from _questions(node["no"])


# --- drawing -----------------------------------------------------------------------------------------------

def _wrap(text: str, n: int = 18) -> str:
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > n and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    return "\n".join(lines + [cur])


def _shape(ax, name: str, x: float, y: float, shaded: bool) -> None:
    fc = "#9aa4ad" if shaded else "white"
    kw = {"facecolor": fc, "edgecolor": INK, "linewidth": 1.6, "zorder": 4}
    if name == "square":
        ax.add_patch(Rectangle((x - 0.28, y - 0.28), 0.56, 0.56, **kw))
    elif name == "rectangle":
        ax.add_patch(Rectangle((x - 0.45, y - 0.24), 0.9, 0.48, **kw))
    elif name == "triangle":
        ax.add_patch(Polygon([(x - 0.33, y - 0.28), (x + 0.33, y - 0.28), (x, y + 0.29)], closed=True, **kw))
    elif name == "right-angled triangle":
        ax.add_patch(Polygon([(x - 0.3, y - 0.28), (x + 0.32, y - 0.28), (x - 0.3, y + 0.3)], closed=True, **kw))
        ax.add_patch(Rectangle((x - 0.3, y - 0.28), 0.1, 0.1, facecolor="none", edgecolor=INK, linewidth=1.0, zorder=5))
    elif name == "circle":
        ax.add_patch(Circle((x, y), 0.3, **kw))
    elif name == "semicircle":
        ax.add_patch(Wedge((x, y - 0.2), 0.42, 0, 180, **kw))
    else:
        import math
        k = 5 if name == "pentagon" else 6
        ax.add_patch(Polygon([(x + 0.32 * math.sin(2 * math.pi * i / k), y + 0.32 * math.cos(2 * math.pi * i / k))
                              for i in range(k)], closed=True, **kw))


def layout(p: dict) -> dict:
    """Each node's place, by its path from the top ('' is the top): x, y in inches."""
    ends = leaves(p["tree"])
    gap = 2.05 if p["domain"] == "shapes" else 1.95
    order = {path: i for i, (_, path) in enumerate(ends)}
    pos = {}

    def place(node, path, depth):
        key = "".join("Y" if v else "N" for _, v in path)
        if "item" in node:
            x = order[path] * gap
        else:
            a = place(node["yes"], path + ((node["q"], True),), depth + 1)
            b = place(node["no"], path + ((node["q"], False),), depth + 1)
            x = (a + b) / 2
        pos[key] = (x, -depth * 1.45)
        return x

    place(p["tree"], (), 0)
    return pos


def draw(p: dict):
    pos = layout(p)
    ends = leaves(p["tree"])
    shapes = p["domain"] == "shapes"
    lw, lh = (1.6, 1.15) if shapes else (1.45, 0.5)
    qw, qh = 1.9, 0.66
    fig, ax = new_figure(12, 6)
    ax.set_position([0, 0, 1, 1])

    def node_at(path_key):
        node = p["tree"]
        for c in path_key:
            node = node["yes"] if c == "Y" else node["no"]
        return node

    for key, (x, y) in pos.items():
        node = node_at(key)
        if "q" in node:
            for c, word, side in (("Y", "Yes", -1), ("N", "No", 1)):
                cx, cy = pos[key + c]
                child = node_at(key + c)
                top = cy + (lh / 2 if "item" in child else qh / 2)
                ax.plot([x, cx], [y - qh / 2, top], color=INK, linewidth=1.4, gid=f"edge:{key + c}")
                mx, my = (x + cx) / 2, (y - qh / 2 + top) / 2
                ax.text(mx + side * 0.2, my + 0.08, word, ha="right" if side < 0 else "left", va="center", fontsize=11,
                        fontweight="bold", gid=f"branch:{key + c}")
            ax.add_patch(FancyBboxPatch((x - qw / 2, y - qh / 2), qw, qh, boxstyle="round,pad=0.03", facecolor="#e3e8ec",
                                        edgecolor=INK, linewidth=1.3, zorder=3))
            ax.text(x, y, _wrap(QUESTIONS[p["domain"]][node["q"]]), ha="center", va="center", fontsize=11, zorder=4,
                    linespacing=1.15, gid=f"q:{key}")
    for (thing, path), letter in zip(ends, p["letters"]):
        key = "".join("Y" if v else "N" for _, v in path)
        x, y = pos[key]
        ax.add_patch(Rectangle((x - lw / 2, y - lh / 2), lw, lh, facecolor="white", edgecolor=INK, linewidth=1.3, zorder=3))
        if shapes:
            _shape(ax, thing, x, y + 0.17, thing in p["shaded"])
            ax.text(x, y - 0.38, thing if len(thing) < 14 else "right-angled\ntriangle", ha="center", va="center",
                    fontsize=10 if len(thing) >= 14 else 11, zorder=4, linespacing=1.0, gid=f"leaf:{letter}")
        else:
            ax.text(x, y, thing, ha="center", va="center", fontsize=12, zorder=4, gid=f"leaf:{letter}")
        ax.add_patch(Circle((x - lw / 2 - 0.05, y + lh / 2 + 0.05), 0.17, facecolor="white", edgecolor=INK, linewidth=1.2,
                            zorder=5))
        ax.text(x - lw / 2 - 0.05, y + lh / 2 + 0.05, letter, ha="center", va="center", fontsize=11, fontweight="bold",
                zorder=6, gid=f"letter:{letter}")
    xs = [x for x, _ in pos.values()]
    ys = [y for _, y in pos.values()]
    left, right = min(xs) - 1.15, max(xs) + 1.15
    top = 0.95
    bottom = min(ys) - lh / 2 - 0.25
    ax.text(left + 0.05, top - 0.2, "Branching database: sorting " + p["domain"], ha="left", va="center", fontsize=13,
            fontweight="bold")
    ax.set_xlim(left, right)
    ax.set_ylim(bottom, top)
    fig.set_size_inches(right - left, top - bottom)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ---------------------------------------------------------------------------------------------

SETTINGS = ["at school", "in the computer room", "at the coding club", "in class", "at home"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    ends = leaves(p["tree"])
    letter = {thing: k for (thing, _), k in zip(ends, p["letters"])}
    ask = p["ask"]
    kind = "animal" if p["domain"] == "animals" else "shape"
    new = ask["new"]
    a = answers(p, new)
    node, said = p["tree"], []
    while "q" in node:
        said.append(SAY[node["q"]][0 if a[node["q"]] else 1])
        node = node["yes"] if a[node["q"]] else node["no"]
    end = letter[walk(p, a)]
    shade = (" shaded" if new in p["shaded"] else "") if kind == "shape" else ""
    q1 = mcq(f"{who} sorts a new {kind} with this branching database {rng.choice(SETTINGS)}: a{'n' if new[0] in 'aeiou' and not shade else ''}"
             f"{shade} {new}. {' '.join(said)} In which lettered box does it end?", end,
             rng.sample([k for k in p["letters"] if k != end], 3), rng)
    x, y = ask["pair"]
    px, py = dict(ends)[x], dict(ends)[y]
    k = 0
    while px[k] == py[k]:
        k += 1
    split = QUESTIONS[p["domain"]][px[k][0]]
    others = [QUESTIONS[p["domain"]][q] for q in _questions(p["tree"]) if QUESTIONS[p["domain"]][q] != split]
    q2 = mcq(f"Which question in this branching database separates the {x} from the {y}?", split,
             rng.sample(others, min(3, len(others))), rng)
    d = ask["depth"]
    q3 = count(f"How many questions are answered to reach the {d} in this branching database?", len(dict(ends)[d]),
               "questions")
    return [q1, q2, q3]
