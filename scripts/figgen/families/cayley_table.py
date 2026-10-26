"""A Cayley table for a binary operation * on a small set (UP), as Rwanda Core Mathematics S4 "Binary operations"
draws it: the elements across the top and down the side, and x * y in row x, column y (the convention is printed).

Four kinds of table, the rule never printed, so every answer is read from the table:
- cyclic: a cyclic group of order 3 to 6, its elements renamed with letters and listed in a shuffled order;
- klein: the Klein four-group, renamed the same way;
- modular: a set of numbers under addition or multiplication modulo n (the rule kept back), listed in order;
- skew: a four-element table with an identity in which exactly one pair of elements does not commute.
Questions: an entry x * y, a bracketed (x * y) * z, the identity element, an element's inverse, the x with x * b = c,
how many elements are their own inverse; for a skew table, the pair that does not commute (four pairs offered, each
letter in exactly two of them, so no option stands out).
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, NAMES, count, mcq, new_figure, short

ID = "cayley_table"
KIND = "table.data"
SUBJECT = "mathematics"
BANDS = ("UP",)
CONCEPTS = ("mathematics.cayley-tables", "mathematics.fields-integral-domains", "mathematics.operations-properties-numbers")
# A topic whose sections the book lists is reached only if a section is about binary operations or their tables.
NEEDS = r"cayley|binary operation|groups and rings"
AVOID = r"number and numeration|complex|logic|real numbers|basic concepts of algebra"

POOL = list("abcdfghkmnpqrstuvwyz")  # no e (an identity's usual name), no i, l, o, and no x (the unknown)
MODULAR = [("+", 4), ("+", 5), ("+", 6), ("×", 5), ("×", 7), ("×8", 8)]


def _cyclic(n: int) -> list[list[int]]:
    return [[(i + j) % n for j in range(n)] for i in range(n)]


def _klein() -> list[list[int]]:
    return [[i ^ j for j in range(4)] for i in range(4)]


def _relabel(table: list[list[int]], rng: random.Random) -> tuple[list[str], list[list[str]]]:
    """The group's elements renamed with letters, and listed (rows and columns alike) in a shuffled order."""
    n = len(table)
    names = rng.sample(POOL, n)
    order = list(range(n))
    rng.shuffle(order)
    els = [names[i] for i in order]
    return els, [[names[table[i][j]] for j in order] for i in order]


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["cyclic", "klein", "modular", "skew"])
    p = {"band": "UP", "name": rng.choice(NAMES), "kind": kind}
    if kind == "cyclic":
        els, table = _relabel(_cyclic(rng.choice([3, 4, 4, 5, 5, 6])), rng)
    elif kind == "klein":
        els, table = _relabel(_klein(), rng)
    elif kind == "modular":
        rule, n = rng.choice(MODULAR)
        if rule == "+":
            nums = list(range(n))
            f = lambda a, b: (a + b) % n  # noqa: E731
        elif rule == "×":
            nums = list(range(1, n))
            f = lambda a, b: (a * b) % n  # noqa: E731
        else:
            nums = [1, 3, 5, 7]
            f = lambda a, b: (a * b) % 8  # noqa: E731
        els = [str(v) for v in nums]
        table = [[str(f(a, b)) for b in nums] for a in nums]
    else:
        base = _cyclic(4) if rng.random() < 0.5 else _klein()
        els, table = _relabel(base, rng)
        e = next(x for i, x in enumerate(els) if all(table[i][j] == els[j] for j in range(4)))
        x, y = rng.sample([v for v in els if v != e], 2)
        i, j = els.index(x), els.index(y)
        table[i][j] = rng.choice([v for v in els if v != table[i][j]])  # now x * y differs from y * x
    p.update(elements=els, table=table)
    p["ask"] = _asks(p, rng)
    return p


def _op(p: dict) -> dict:
    els = p["elements"]
    return {(x, y): p["table"][i][j] for i, x in enumerate(els) for j, y in enumerate(els)}


def _identity(p: dict) -> str:
    op, els = _op(p), p["elements"]
    return next(e for e in els if all(op[(e, v)] == v and op[(v, e)] == v for v in els))


def _asks(p: dict, rng: random.Random) -> dict:
    """Which elements each question is about, chosen with the figure so the questions read off different cells."""
    els = p["elements"]
    e = _identity(p)
    op = _op(p)
    others = [v for v in els if v != e]
    a, b = rng.choice(others), rng.choice(others)
    trio = [rng.choice(els), rng.choice(others), rng.choice(others)]
    ask = {"read": [a, b], "bracket": trio}
    if p["kind"] != "skew":
        # The inverse is asked of an element that is not its own inverse (none is, in a Klein table: then it is not asked).
        movers = [v for v in others if op[(v, v)] != e]
        ask["inverse"] = rng.choice(movers) if movers else None
        bb = rng.choice(others)  # never the identity: x * e = c gives x = c without the table
        ask["solve"] = [bb, rng.choice([v for v in els if v != bb])]
    else:
        ask["pair"] = sorted(next((x, y) for x in els for y in els if op[(x, y)] != op[(y, x)]))
    return ask


# --- drawing --------------------------------------------------------------------------------------------

def draw(p: dict):
    els, table = p["elements"], p["table"]
    n = len(els)
    c = 0.8
    fig, ax = new_figure(1.0 + 0.62 * (n + 1), 1.6 + 0.62 * (n + 1))
    top = (n + 1) * c
    for k in range(n + 1):  # the header row and column, shaded
        ax.add_patch(Rectangle((k * c, top - c), c, c, facecolor=FILL_2, edgecolor="none", gid="behind-head"))
        ax.add_patch(Rectangle((0, top - (k + 1) * c), c, c, facecolor=FILL_2, edgecolor="none", gid="behind-head"))
    for k in range(n + 2):
        lw = 1.8 if k in (0, 1, n + 1) else 0.9
        ax.plot([0, (n + 1) * c], [top - k * c, top - k * c], color=INK, linewidth=lw, gid="grid-row")
        ax.plot([k * c, k * c], [0, top], color=INK, linewidth=lw, gid="grid-col")
    ax.text(c / 2, top - c / 2, "*", ha="center", va="center", fontsize=15, fontweight="bold")
    for i, x in enumerate(els):
        ax.text((i + 1.5) * c, top - c / 2, x, ha="center", va="center", fontsize=13, fontweight="bold", gid=f"col:{x}")
        ax.text(c / 2, top - (i + 1.5) * c, x, ha="center", va="center", fontsize=13, fontweight="bold", gid=f"row:{x}")
        for j, _ in enumerate(els):
            ax.text((j + 1.5) * c, top - (i + 1.5) * c, table[i][j], ha="center", va="center", fontsize=13,
                    gid=f"cell:{i}:{j}")
    ax.text((n + 1) * c / 2, top + 0.42, f"The operation * on S = {{{', '.join(els)}}}", ha="center", va="bottom",
            fontsize=11)
    ax.text((n + 1) * c / 2, -0.3, "x * y is the entry in row x, column y", ha="center", va="top", fontsize=10)
    ax.set_xlim(-0.1, (n + 1) * c + 0.1)
    ax.set_ylim(-0.75, top + 0.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ------------------------------------------------------------------------------------------

def questions(p: dict, rng: random.Random) -> list:
    els = p["elements"]
    op = _op(p)
    e = _identity(p)
    ask = p["ask"]
    s = "{" + ", ".join(els) + "}"
    a, b = ask["read"]
    lead = rng.choice([f"{p['name']} studies the operation * on the set S = {s} in the table.",
                       f"{p['name']} is given a Cayley table for * on S = {s}.",
                       f"{p['name']} reads the Cayley table of * on S = {s}."])
    qs = [short(f"{lead} Use the table to find {a} * {b}.", op[(a, b)])]
    x, y, z = ask["bracket"]
    qs.append(short(f"Use the Cayley table of * on {s} to find ({x} * {y}) * {z}.", op[(op[(x, y)], z)]))
    pool = [v for v in els if v != e]
    rng.shuffle(pool)
    qs.append(mcq(f"Which element of {s} is the identity element for *?", e, pool[:3], rng))
    if p["kind"] == "skew":
        u, v = ask["pair"]
        w, t = [k for k in els if k not in (u, v)][:2] if len(els) == 4 else rng.sample([k for k in els if k not in (u, v)], 2)
        opts = [f"{u} and {v}", f"{u} and {w}", f"{v} and {t}", f"{w} and {t}"]
        qs.append(mcq(f"For the operation * on {s}, which pair of elements does not commute?", opts[0], opts[1:], rng))
        return qs
    g = ask["inverse"]
    if g is not None:
        inv = next(v for v in els if op[(g, v)] == e)
        wrong = [v for v in els if v != inv]
        rng.shuffle(wrong)
        wrong.sort(key=lambda v: v not in (g, e))  # the element itself and the identity: the likely slips
        qs.append(mcq(f"Under the operation * on {s}, which element is the inverse of {g}?", inv, wrong[:3], rng))
    bb, cc = ask["solve"]
    sol = next(v for v in els if op[(v, bb)] == cc)
    if g is None or rng.random() < 0.5:  # every element its own inverse: a count would always be the whole set
        qs.append(short(f"Find the element x of {s} such that x * {bb} = {cc}.", sol))
    else:
        n = sum(1 for v in els if op[(v, v)] == e)
        qs.append(count(f"How many elements of {s} are their own inverse under *?", n, "elements"))
    return qs
