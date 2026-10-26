"""Arrangements and selections from a picture (AL), as Cambridge AS & A Level Mathematics (Probability & Statistics 1)
teaches them in its chapter on the factorial function, permutations and combinations.

Four kinds of figure:
- word: letter tiles in a row (a word such as BANANA or RWANDA, or a set of tiles), some letters repeated: arrangements
  of all the tiles n!/(a!b!...), those that begin with a letter, those with all of one repeated letter together, those
  with two named single letters next to each other, those that begin and end with a repeated letter;
- cards: digit cards, some repeated (perhaps a 0, which no number may begin with): how many n-digit numbers, how many of
  them are even, how many begin with a digit;
- beads: coloured beads (each with its colour's letter and a key) to thread in a row: how many colour orders, with all
  the beads of one colour together, with a bead of one colour at each end;
- committee: two groups of people drawn in two boxes: how many committees of r, with exactly j of the first group, with
  at least one of the second, and which expression (nCr notation) counts one kind.
Every count is exact; the figure is needed for what there is to arrange.
"""
from __future__ import annotations

import math
import random
from collections import Counter

from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short, sub, sup

ID = "arrangements"
KIND = "maths.probability"
SUBJECT = "mathematics"
BANDS = ("AL",)
# The AS Level chapter (no sections listed) carries the binomial and generating-function ids its probability chapters
# share; only a chapter named for factorials, permutations or arrangements is reached.
CONCEPTS = tuple(f"mathematics.{c}" for c in ("binomial-distribution", "probability-generating-function", "permutations",
                                                "factorial-notation"))
NEEDS = r"factorial|permutation|arrangement|combination"
AVOID = r"^(?!.*(factorial|permutation|arrangement|combination))"

WORDS = ["BANANA", "RWANDA", "KIGALI", "NYANZA", "GISENYI", "RUBAVU", "KAYONZA", "LETTER", "PEPPER", "ADDRESS", "SUCCESS",
         "COFFEE", "CHEESE", "BALLOON", "TOMATO", "POTATO", "CASSAVA", "PAPAYA", "AVOCADO", "STATS", "LEVEL", "KAYAK",
         "GORILLA", "ELEPHANT", "TEACHER", "MAMMAL", "DIVIDED"]
LETTERS = "ABDEGKMNPRSTU"
COLOURS = {"R": ("red", "#d9534f", "white"), "B": ("blue", "#4a7fd4", "white"), "G": ("green", "#4cae4c", "white"),
           "Y": ("yellow", "#f0c419", INK), "W": ("white", "#ffffff", INK)}
GROUPS = [("teachers", "students", "#7fa7d9", "#e3a857"), ("girls", "boys", "#d98cb3", "#7fbf7f"),
          ("doctors", "nurses", "#8fb3d9", "#d9a38f"), ("women", "men", "#c99bd9", "#9bc9a7"),
          ("farmers", "traders", "#a3c47a", "#d9b46b")]


def multi(items) -> int:
    out = math.factorial(len(items))
    for v in Counter(items).values():
        out //= math.factorial(v)
    return out


def _repeats(items) -> bool:
    return max(Counter(items).values()) >= 2


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["word", "cards", "beads", "committee"])
    p = {"band": "AL", "sub": kind, "name": rng.choice(NAMES)}
    if kind == "word":
        if rng.random() < 0.5:
            w = rng.choice(WORDS)
            p.update(word=w, tiles=list(w))
            return p
        while True:
            n = rng.randint(5, 8)
            tiles = [rng.choice(LETTERS[:rng.randint(4, len(LETTERS))]) for _ in range(n)]
            if _repeats(tiles) and len(set(tiles)) >= 3:
                p.update(word=None, tiles=tiles)
                return p
    if kind == "cards":
        while True:
            n = rng.randint(5, 7)
            cards = [rng.randint(0, 9) for _ in range(n)]
            if _repeats(cards) and len(set(cards)) >= 3 and any(c % 2 == 0 for c in cards) and any(c % 2 for c in cards) \
                    and cards.count(0) <= 1 and any(c != 0 and cards.count(c) for c in cards):
                p["cards"] = cards
                return p
    if kind == "beads":
        while True:
            n = rng.randint(5, 8)
            pool = rng.sample(sorted(COLOURS), rng.randint(2, 4))
            beads = [rng.choice(pool) for _ in range(n)]
            if _repeats(beads) and len(set(beads)) >= 2:
                p["beads"] = beads
                return p
    g = rng.randrange(len(GROUPS))
    a, b = rng.randint(3, 7), rng.randint(3, 7)
    p.update(group=g, groups=[[GROUPS[g][0], a], [GROUPS[g][1], b]], size=rng.randint(3, 5))
    return p


# --- drawing -------------------------------------------------------------------------------------------------------

def _row(fig_w: float, n: int, w: float, gap: float):
    total = n * w + (n - 1) * gap
    return [(fig_w - total) / 2 + i * (w + gap) for i in range(n)]


def draw(p: dict):
    kind = p["sub"]
    if kind == "committee":
        return _draw_committee(p)
    items = p["tiles"] if kind == "word" else p["cards"] if kind == "cards" else p["beads"]
    n = len(items)
    width = max(6.0, n * 1.0 + 1.0)
    height = 2.4 if kind == "beads" else 1.9
    fig, ax = new_figure(width, height)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    if kind == "word":
        for i, (x, ch) in enumerate(zip(_row(width, n, 0.8, 0.18), items)):
            ax.add_patch(FancyBboxPatch((x, 0.55), 0.8, 0.8, boxstyle="round,pad=0,rounding_size=0.08", facecolor="#f3e2bf",
                                        edgecolor=INK, linewidth=1.5))
            ax.text(x + 0.4, 0.95, ch, ha="center", va="center", fontsize=22, fontweight="bold", gid=f"item:{i}")
    elif kind == "cards":
        for i, (x, d) in enumerate(zip(_row(width, n, 0.72, 0.2), items)):
            ax.add_patch(FancyBboxPatch((x, 0.35), 0.72, 1.1, boxstyle="round,pad=0,rounding_size=0.08", facecolor="white",
                                        edgecolor=INK, linewidth=1.5))
            ax.text(x + 0.36, 0.9, str(d), ha="center", va="center", fontsize=24, fontweight="bold", gid=f"item:{i}")
    else:
        xs = _row(width, n, 0.76, 0.12)
        ax.plot([xs[0] - 0.4, xs[-1] + 1.16], [1.4, 1.4], color=INK, linewidth=1.4, zorder=1)
        for i, (x, c) in enumerate(zip(xs, items)):
            _, face, ink = COLOURS[c]
            ax.add_patch(Circle((x + 0.38, 1.4), 0.38, facecolor=face, edgecolor=INK, linewidth=1.5, zorder=2))
            ax.text(x + 0.38, 1.4, c, ha="center", va="center", fontsize=14, fontweight="bold", color=ink, zorder=3,
                    gid=f"item:{i}")
        key = ",   ".join(f"{c} = {COLOURS[c][0]}" for c in sorted(set(items)))
        ax.text(width / 2, 0.45, key, ha="center", va="center", fontsize=11)
    ax.set_xlim(0, width)
    ax.set_ylim(0, height)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _person(ax, x: float, y: float, colour: str, gid: str) -> None:
    ax.add_patch(Circle((x, y + 0.62), 0.16, facecolor=colour, edgecolor=INK, linewidth=1.2, gid=gid))
    ax.add_patch(FancyBboxPatch((x - 0.2, y), 0.4, 0.42, boxstyle="round,pad=0,rounding_size=0.1", facecolor=colour,
                                edgecolor=INK, linewidth=1.2))


def _draw_committee(p: dict):
    (g1, a), (g2, b) = p["groups"]
    c1, c2 = GROUPS[p["group"]][2:]
    per = 4
    rows = max(math.ceil(a / per), math.ceil(b / per))
    box_w, box_h = per * 0.62 + 0.4, rows * 1.0 + 0.75
    width = 2 * box_w + 0.8
    fig, ax = new_figure(width, box_h + 0.2)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    for k, (g, cnt, col) in enumerate(((g1, a, c1), (g2, b, c2))):
        x0 = 0.2 + k * (box_w + 0.4)
        ax.add_patch(Rectangle((x0, 0.1), box_w, box_h, facecolor="none", edgecolor=INK, linewidth=1.3))
        ax.text(x0 + box_w / 2, box_h - 0.12, g.capitalize(), ha="center", va="center", fontsize=12, fontweight="bold",
                gid=f"group:{k}")
        for i in range(cnt):
            r, c = divmod(i, per)
            _person(ax, x0 + 0.51 + c * 0.62, box_h - 1.15 - r * 1.0, col, f"person:{g}:{i}")
    ax.set_xlim(0, width)
    ax.set_ylim(0, box_h + 0.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -----------------------------------------------------------------------------------------------------

def _less(items, *drop):
    rest = list(items)
    for x in drop:
        rest.remove(x)
    return rest


def _word_qs(p: dict, rng: random.Random) -> list:
    tiles = p["tiles"]
    n = len(tiles)
    cnt = Counter(tiles)
    lead = f"{p['name']} has the {n} letter tiles shown{' (the letters of ' + p['word'] + ')' if p['word'] else ''}."
    qs = [short(f"{lead} Tiles with the same letter are identical. How many different arrangements of all {n} tiles in a "
                "row are there?", multi(tiles))]
    pool = []
    x = rng.choice(sorted(cnt))
    pool.append(short(f"The {n} letter tiles shown are arranged in a row. How many different arrangements of the {n} tiles "
                      f"begin with {x}?", multi(_less(tiles, x))))
    reps = sorted(k for k, v in cnt.items() if v >= 2)
    y = rng.choice(reps)
    block = [v for v in tiles if v != y] + ["#"]
    pool.append(short(f"The {n} letter tiles shown are arranged in a row. How many different arrangements of the {n} tiles "
                      f"have all the {y}s next to each other?", multi(block)))
    pool.append(short(f"The {n} letter tiles shown are arranged in a row. How many different arrangements of the {n} tiles "
                      f"begin and end with {y}?", multi(_less(tiles, y, y))))
    singles = sorted(k for k, v in cnt.items() if v == 1)
    if len(singles) >= 2:
        u, v = rng.sample(singles, 2)
        joined = [t for t in tiles if t not in (u, v)] + ["#"]
        pool.append(short(f"The {n} letter tiles shown are arranged in a row. How many different arrangements of the {n} "
                          f"tiles have the {u} and the {v} next to each other?", 2 * multi(joined)))
    return qs + rng.sample(pool, 2)


def _cards_qs(p: dict, rng: random.Random) -> list:
    cards = p["cards"]
    n = len(cards)
    zero = 0 in cards
    note = " A number cannot begin with 0." if zero else ""

    def numbers(items):
        lead0 = multi(_less(items, 0)) if 0 in items else 0
        return multi(items) - lead0

    total = numbers(cards)
    even = 0
    for e in sorted({c for c in cards if c % 2 == 0}):
        rest = _less(cards, e)
        even += numbers(rest) if rest else 1
    starts = sorted({c for c in cards if c != 0})
    d = rng.choice(starts)
    q1 = short(f"{p['name']} has the {n} digit cards shown.{note} How many different {n}-digit numbers can be made using all "
               f"{n} cards?", total)
    q2 = short(f"The {n} digit cards shown are used to make {n}-digit numbers.{note} How many of the different {n}-digit "
               f"numbers made from all {n} cards are even?", even)
    q3 = short(f"The {n} digit cards shown are used to make {n}-digit numbers. How many of the different {n}-digit numbers "
               f"made from all {n} cards begin with {d}?", multi(_less(cards, d)))
    return [q1, q2, q3]


def _beads_qs(p: dict, rng: random.Random) -> list:
    beads = p["beads"]
    n = len(beads)
    reps = sorted(k for k, v in Counter(beads).items() if v >= 2)
    x, y = rng.choice(reps), rng.choice(reps)
    q1 = short(f"{p['name']} threads the {n} beads shown onto a string in a row. Beads of the same colour are identical. "
               f"How many different orders of the {n} beads are there?", multi(beads))
    block = [v for v in beads if v != x] + ["#"]
    q2 = short(f"The {n} beads shown are threaded onto a string in a row. How many different orders of the {n} beads have "
               f"all the {COLOURS[x][0]} beads next to each other?", multi(block))
    q3 = short(f"The {n} beads shown are threaded onto a string in a row. How many different orders of the {n} beads have a "
               f"{COLOURS[y][0]} bead at each end?", multi(_less(beads, y, y)))
    return [q1, q2, q3]


def _committee_qs(p: dict, rng: random.Random) -> list:
    (g1, a), (g2, b) = p["groups"]
    r = p["size"]
    q1 = short(f"{p['name']} chooses a committee of {r} from the people shown. How many different committees of {r} are "
               "possible?", math.comb(a + b, r))
    js = [j for j in range(1, r) if j <= a and r - j <= b]
    j = rng.choice(js)
    q2 = short(f"A committee of {r} is chosen from the people shown. How many different committees of {r} have exactly {j} "
               f"{g1}?", math.comb(a, j) * math.comb(b, r - j))
    # Which expression: multiply or add, and the right or swapped sizes; each wrong option has another value.
    good = [jj for jj in js if 2 * jj != r and r - jj <= a and jj <= b]
    if good and rng.random() < 0.5:
        j = rng.choice(good)
        want = math.comb(a, j) * math.comb(b, r - j)
        opts = {f"{sup(str(a))}C{sub(str(j))} × {sup(str(b))}C{sub(str(r - j))}": want,
                f"{sup(str(a))}C{sub(str(j))} + {sup(str(b))}C{sub(str(r - j))}": math.comb(a, j) + math.comb(b, r - j),
                f"{sup(str(a))}C{sub(str(r - j))} × {sup(str(b))}C{sub(str(j))}": math.comb(a, r - j) * math.comb(b, j),
                f"{sup(str(a))}C{sub(str(r - j))} + {sup(str(b))}C{sub(str(j))}": math.comb(a, r - j) + math.comb(b, j)}
        if list(opts.values()).count(want) == 1:
            key = next(iter(opts))
            q3 = mcq(f"A committee of {r} is chosen from the people shown. Which expression gives the number of committees "
                     f"of {r} with exactly {j} {g1}?", key, [o for o in opts if o != key], rng)
            return [q1, q2, q3]
    q3 = short(f"A committee of {r} is chosen from the people shown. How many different committees of {r} include at least "
               f"one of the {g2}?", math.comb(a + b, r) - math.comb(a, r))
    return [q1, q2, q3]


# What a student writes after the number: "20 numbers", "20 ways".
NOUNS = {"word": "arrangements", "cards": "numbers", "beads": "orders", "committee": "committees"}


def _with_noun(q, noun: str):
    if q.kind == "short" and "How many" in q.stem and q.answer.isdigit():
        for form in (f"{q.answer} {noun}", f"{q.answer} ways"):
            if form not in q.accepted:
                q.accepted.append(form)
    return q


def questions(p: dict, rng: random.Random) -> list:
    qs = {"word": _word_qs, "cards": _cards_qs, "beads": _beads_qs, "committee": _committee_qs}[p["sub"]](p, rng)
    return [_with_noun(q, NOUNS[p["sub"]]) for q in qs]
