"""Prime factors (P Stage 5–6, LS, UP), as Rwanda P5 "Prime Factorization and Divisibility Tests", P6 "Powers,
Indices, LCM and GCF", Cambridge Primary 6 "Numbers and sequences" (common multiples and factors), Cambridge Lower
Secondary "Factors, multiples and primes" and Cambridge IGCSE "Review of number concepts" teach them.

Four kinds of figure:
- tree: a factor tree, each prime ringed, one box empty. What number goes in the box? Which is the number as a
  product of primes in index form (MCQ; the wrong options miscount the powers of two of its primes)?
- ladder: prime factorisation by repeated division (2 | 360, 2 | 180 ...), one divisor or quotient a box. The box;
  the index form.
- venn: the prime factors of two numbers A and B in a Venn diagram (the common ones in the overlap). What is A? The
  HCF (GCF) of A and B? Their LCM?
- root (LS, UP): the factor tree of a perfect square; its square root from the factors.
Every number is a product of the primes 2, 3, 5, 7 (and 11 at UP).
"""
from __future__ import annotations

import math
import random
from collections import Counter

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "factor_tree"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("P", "LS", "UP")
CONCEPTS = ("mathematics.powers-indices-lcm-gcf", "mathematics.divisibility-tests", "mathematics.special-numbers",
            "mathematics.prime-numbers", "mathematics.square-root-general-method", "mathematics.index-notation")
# A topic whose sections the book lists is reached only if its name or a section is about primes, factors, multiples,
# HCF/LCM or square roots by factors.
NEEDS = r"prime|factors|multiples|highest common|lowest common|\bHCF\b|\bLCM\b|\bGCF\b|square roots?|special numbers|" \
        r"by factori[sz]ation"
AVOID = r"multiplication and division|fraction|place value|number bases|sets of numbers|algebra|quadratic|expression|" \
        r"equation|polynomial|classifying numbers|glossary"

SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")
TREE_LEADS = ["{n} draws a factor tree for a number.", "{n} breaks a number into its prime factors with a factor tree.",
              "{n} makes a factor tree, ringing each prime.", "{n} finds the prime factors of a number with a factor tree."]
LADDER_LEADS = ["{n} divides a number by primes again and again.", "{n} finds the prime factors of a number by repeated "
                "division.", "{n} uses repeated division by primes to factorise a number.",
                "{n} keeps dividing a number by prime numbers until 1 is left."]
VENN_LEADS = ["{n} puts the prime factors of two numbers, A and B, in a Venn diagram.",
              "{n} sorts the prime factors of A and B into a Venn diagram.",
              "{n} shows the prime factors of two numbers, A and B, in a Venn diagram.",
              "{n} draws a Venn diagram of the prime factors of the numbers A and B."]
WHERE = ["in a maths lesson", "for homework", "on the board", "in a group", "for a quiz", "in an exercise book"]
ROOT_LEADS = ["{n} draws a factor tree for a square number.", "{n} factorises a square number with a factor tree.",
              "{n} finds the prime factors of a perfect square.", "{n} breaks a square number into primes."]


def stages(p: dict) -> tuple[int, int] | None:
    return (5, 6) if p["band"] == "P" else None


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["band"] == "P":
        return ("mathematics.powers-indices-lcm-gcf", "mathematics.divisibility-tests", "mathematics.special-numbers")
    if p["band"] == "LS":
        return ("mathematics.divisibility-tests", "mathematics.square-root-general-method", "mathematics.index-notation")
    return ("mathematics.prime-numbers", "mathematics.divisibility-tests")


def factorise(n: int) -> list[int]:
    out, d = [], 2
    while d * d <= n:
        while n % d == 0:
            out.append(d)
            n //= d
        d += 1
    if n > 1:
        out.append(n)
    return out


def index_form(counts: dict) -> str:
    return " × ".join(f"{q}{str(e).translate(SUP)}" if e > 1 else str(q) for q, e in sorted(counts.items()) if e > 0)


def _number(rng: random.Random, band: str, lo: int, hi: int, primes=(2, 3, 5, 7)) -> int:
    while True:
        k = rng.randint(3, 5 if band != "P" else 4)
        fs = [rng.choice(primes) for _ in range(k)]
        n = math.prod(fs)
        if lo <= n <= hi and len(set(fs)) >= 2 and max(Counter(fs).values()) >= 2:
            return n


def _tree(n: int, rng: random.Random) -> list:
    """A factor tree as nested lists [n, left, right] (a prime is a bare int)."""
    if len(factorise(n)) == 1:
        return n
    pairs = [(a, n // a) for a in range(2, math.isqrt(n) + 1) if n % a == 0]
    a, b = rng.choice(pairs)
    return [n, _tree(a, rng), _tree(b, rng)]


def nodes(t, path="") -> list[tuple[str, int]]:
    """Every node of a tree, by its path ("" the root, "0" its left child ...), with its number."""
    if isinstance(t, int):
        return [(path, t)]
    return [(path, t[0])] + nodes(t[1], path + "0") + nodes(t[2], path + "1")


def sample(rng: random.Random) -> dict:
    band = rng.choice(["P", "LS", "LS", "UP"])
    kind = rng.choice({"P": ["tree", "ladder", "venn"], "LS": ["tree", "venn", "root", "ladder"],
                       "UP": ["tree", "venn", "root"]}[band])
    primes = (2, 3, 5, 7, 11) if band == "UP" else (2, 3, 5, 7)
    hi = 600 if band == "P" else 2000
    p = {"band": band, "sub": kind, "name": rng.choice(NAMES)}
    if kind in ("tree", "root"):
        if kind == "root":
            while True:
                r = _number(rng, band, 12, 60, primes[:4])
                if r * r <= 5000:
                    n = r * r
                    break
        else:
            n = _number(rng, band, 36, hi, primes)
        t = _tree(n, rng)
        paths = [path for path, _ in nodes(t) if path]
        p.update(n=n, tree=t, blank=rng.choice(paths) if kind == "tree" else None)
        return p
    if kind == "ladder":
        n = _number(rng, band, 36, hi, primes)
        steps = factorise(n)
        p.update(n=n, blank=rng.choice(["d", "q"]), row=rng.randrange(len(steps) - 1))
        return p
    while True:
        common = [rng.choice(primes[:4]) for _ in range(rng.randint(1, 2))]
        a_only = [rng.choice(primes[:4]) for _ in range(rng.randint(1, 2))]
        b_only = [rng.choice(primes[:4]) for _ in range(rng.randint(1, 2))]
        if set(a_only) & set(b_only):
            continue  # a prime in both only-parts would belong in the overlap
        a, b = math.prod(common + a_only), math.prod(common + b_only)
        if a != b and a <= hi and b <= hi:
            p.update(common=sorted(common), a_only=sorted(a_only), b_only=sorted(b_only))
            return p


# --- drawing ------------------------------------------------------------------------------------------------

def _width(t) -> int:
    return 1 if isinstance(t, int) else _width(t[1]) + _width(t[2])


def _draw_tree(p: dict):
    t = p["tree"]
    depth = max(len(path) for path, _ in nodes(t))
    leaves = _width(t)
    fig, ax = new_figure(max(4.6, 1.15 * leaves + 1.0), 1.1 * depth + 1.6)
    pos = {}

    def place(node, path, x0, x1, y):
        x = (x0 + x1) / 2
        pos[path] = (x, y)
        if isinstance(node, int):
            return
        wl = _width(node[1])
        mid = x0 + (x1 - x0) * wl / _width(node)
        place(node[1], path + "0", x0, mid, y - 1.1)
        place(node[2], path + "1", mid, x1, y - 1.1)

    place(t, "", 0, leaves * 1.15, 0)
    values = dict(nodes(t))
    for path, (x, y) in pos.items():
        if path:
            px, py = pos[path[:-1]]
            ax.plot([px, x], [py - 0.27, y + 0.27], color=INK, linewidth=1.4, gid=f"edge:{path}")
    for path, (x, y) in pos.items():
        v = values[path]
        prime = len(factorise(v)) == 1
        if path == p.get("blank"):
            ax.add_patch(Rectangle((x - 0.32, y - 0.24), 0.64, 0.48, facecolor="white", edgecolor=INK, linewidth=1.6,
                                   gid="box"))
            continue
        if prime:
            ax.add_patch(Circle((x, y), 0.3, facecolor="white", edgecolor=INK, linewidth=1.5, gid=f"ring:{path}"))
        ax.text(x, y, str(v), ha="center", va="center", fontsize=13, gid=f"node:{path}",
                bbox=None if prime else {"boxstyle": "round,pad=0.15", "facecolor": "white", "edgecolor": "none"})
    xs = [x for x, _ in pos.values()]
    ax.set_xlim(min(xs) - 0.7, max(xs) + 0.7)
    ax.set_ylim(-1.1 * depth - 0.5, 0.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def ladder_rows(n: int) -> list[tuple[int, int]]:
    """(divisor, number) down the ladder; the last row is (None-like 0, 1)."""
    rows = []
    for d in factorise(n):
        rows.append((d, n))
        n //= d
    rows.append((0, 1))
    return rows


def _draw_ladder(p: dict):
    rows = ladder_rows(p["n"])
    h = 0.62
    fig, ax = new_figure(4.2, h * len(rows) + 0.9)
    top = len(rows) * h
    for i, (d, v) in enumerate(rows):
        y = top - i * h
        if d:
            if p["blank"] == "d" and i == p["row"]:
                ax.add_patch(Rectangle((0.2, y - 0.2), 0.45, 0.4, facecolor="white", edgecolor=INK, linewidth=1.4, gid="box"))
            else:
                ax.text(0.55, y, str(d), ha="right", va="center", fontsize=13, gid=f"d:{i}")
            ax.plot([0.75, 0.75], [y - h / 2 + 0.04, y + h / 2 - 0.04], color=INK, linewidth=1.3)
            ax.plot([0.75, 2.3], [y - h / 2 + 0.04, y - h / 2 + 0.04], color=INK, linewidth=1.3)
        if p["blank"] == "q" and i == p["row"] + 1:
            ax.add_patch(Rectangle((1.2, y - 0.2), 0.75, 0.4, facecolor="white", edgecolor=INK, linewidth=1.4, gid="box"))
        else:
            ax.text(1.55, y, str(v), ha="center", va="center", fontsize=13, gid=f"v:{i}")
    ax.set_xlim(0.0, 3.4)
    ax.set_ylim(top - len(rows) * h + 0.15, top + 0.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_venn(p: dict):
    fig, ax = new_figure(6.4, 4.2)
    from matplotlib.patches import Ellipse
    ax.add_patch(Ellipse((-0.85, 0), 3.0, 2.6, fill=False, edgecolor=INK, linewidth=1.8, gid="ringA"))
    ax.add_patch(Ellipse((0.85, 0), 3.0, 2.6, fill=False, edgecolor=INK, linewidth=1.8, gid="ringB"))
    ax.text(-1.9, 1.5, "A", ha="center", va="center", fontsize=15, fontweight="bold", gid="labelA")
    ax.text(1.9, 1.5, "B", ha="center", va="center", fontsize=15, fontweight="bold", gid="labelB")

    def column(items, x, region):
        ys = [0.45 * (len(items) - 1) / 2 - 0.45 * i for i in range(len(items))]
        for i, (q, y) in enumerate(zip(items, ys)):
            ax.text(x, y, str(q), ha="center", va="center", fontsize=14, gid=f"{region}:{i}")

    column(p["a_only"], -1.55, "a")
    column(p["common"], 0.0, "c")
    column(p["b_only"], 1.55, "b")
    ax.set_xlim(-2.6, 2.6)
    ax.set_ylim(-1.5, 1.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"tree": _draw_tree, "root": _draw_tree, "ladder": _draw_ladder, "venn": _draw_venn}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def _index_mcq(stem: str, n: int, rng: random.Random):
    """The index form among three that miscount: the powers of two primes each one too many or too few."""
    counts = Counter(factorise(n))
    two = sorted(counts, key=lambda q: (-counts[q], q))[:2]
    da, db = rng.choice([-1, 1]), rng.choice([-1, 1])
    opts = []
    for ea in (0, da):
        for eb in (0, db):
            c = dict(counts)
            c[two[0]] += ea
            c[two[1]] += eb
            opts.append(index_form(c))
    return mcq(stem, opts[0], opts[1:], rng)


def questions(p: dict, rng: random.Random) -> list:
    name, sub = p["name"], p["sub"]
    if sub in ("tree", "root"):
        n = p["n"]
        if sub == "root":
            lead = rng.choice(ROOT_LEADS).format(n=name)[:-1] + " " + rng.choice(WHERE) + "."
            q1 = short(f"{lead} Use the prime factors to find the square root of the number at the top of the tree.",
                       math.isqrt(n), [f"√{n} = {math.isqrt(n)}"])
            return [q1, _index_mcq("Which shows the number at the top of the factor tree as a product of primes in index "
                                   "form?", n, rng)]
        values = dict(nodes(p["tree"]))
        lead = rng.choice(TREE_LEADS).format(n=name)[:-1] + " " + rng.choice(WHERE) + "."
        q1 = short(f"{lead} What number goes in the empty box?", values[p["blank"]])
        q2 = _index_mcq("Which shows the number at the top of the factor tree as a product of primes in index form?", n, rng)
        return [q1, q2]
    if sub == "ladder":
        n = p["n"]
        rows = ladder_rows(n)
        lead = rng.choice(LADDER_LEADS).format(n=name)[:-1] + " " + rng.choice(WHERE) + "."
        if p["blank"] == "d":
            q1 = short(f"{lead} Which prime goes in the empty box?", rows[p["row"]][0])
        else:
            q1 = short(f"{lead} What number goes in the empty box?", rows[p["row"] + 1][1])
        q2 = _index_mcq(f"Which shows the number at the top of the division as a product of primes in index form?", n, rng)
        return [q1, q2]
    common, a_only, b_only = p["common"], p["a_only"], p["b_only"]
    a, b = math.prod(common + a_only), math.prod(common + b_only)
    hcf, lcm = math.prod(common), math.prod(common + a_only + b_only)
    lead = rng.choice(VENN_LEADS).format(n=name)[:-1] + " " + rng.choice(WHERE) + "."
    word = "GCF" if p["band"] == "P" else "HCF"
    pool = [short(f"{lead} What is the number A?", a), short(f"{lead} What is the number B?", b),
            short(f"{lead} What is the {word} of A and B?", hcf)]
    first = rng.choice(pool)
    rest = [short(f"What is the {word} of A and B, shown in the Venn diagram?", hcf),
            short("What is the LCM of A and B, shown in the Venn diagram?", lcm)]
    return [first] + ([rest[1]] if word in first.stem else rest)
