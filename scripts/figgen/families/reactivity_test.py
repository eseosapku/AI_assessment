"""Reactivity of metals (LS, UP): metals known only by letters, as exam papers name them, so the figure and not the
reactivity series a student has learnt decides every answer. Two kinds:

- acid: equal pieces of four metals W, X, Y and Z in the same volume of the same dilute acid, the bubbles of hydrogen
  drawn (at least twice as many from each metal as from the one below it; sometimes one metal gives none); the most
  or least reactive, the order of reactivity, the metal that did not react;
- displacement: three or four metals P, Q, R (S) each added to solutions of the others' nitrates, sulfates or
  chlorides, a ✓ where a coating formed and a ✗ where nothing changed. One result is missing: metal X added to Y's
  salt, for any pair, and as often a metal that displaces as one that does not, so where the "?" sits gives nothing
  away. For neighbours in the order only that cell is missing, and the reverse test decides it; for a pair further
  apart the reverse may be missing too, and the metals between decide it. The most or least reactive, the order,
  what the missing test would show, and the word equation for a reaction the table shows.

A metal displaces another from a solution of its salt when it is the more reactive of the two.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Polygon, Rectangle

from ..core import INK, NAMES, Question, new_figure
from ._bio_parts import letter_choice

ID = "reactivity_test"
KIND = "diagram.template"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("redox-reactions", "acids-and-bases", "chemical-equations", "metal-extraction"))
# Integrated Science teaches the reactivity of metals and displacement too.
ALSO = ("science.chemical-reactivity",)
# A topic whose sections the book lists is reached only if one names reactivity, displacement, the reactions of metals
# or acids, types of reaction, or equations.
NEEDS = r"reactiv|displac|reactions of acids|reactions of metals|types of reactions|equations"
AVOID = (r"alloy|introduction|radioactiv|nuclear|stoichiometr|redox|industrial|\borganic|electroly|electrochem|\brates?\b|kinetic|equilibri|enthalpy|"
         r"energetic|bonding|atomic|periodic|transition|group|polymer|petro|glossary")


def concepts_for(p: dict) -> tuple[str, ...]:
    """Acids where the metals are in acid; equations and extraction where they displace each other."""
    if p["kind"] == "acid":
        return CONCEPTS[:2]
    return (CONCEPTS[0],) + CONCEPTS[2:]


def avoid_for(p: dict) -> str:
    """Metals in acid write no displacement equation; a displacement table shows nothing about acids."""
    if p["kind"] == "acid":
        return AVOID + r"|equation"
    return AVOID + r"|acids and bases|acids, bases|^8 chemical reactions$"


ACIDS = ["dilute hydrochloric acid", "dilute sulfuric acid"]
SALTS = ["nitrate", "sulfate", "chloride"]


def _ladder(rng: random.Random) -> list[int]:
    """Four bubble counts, each at least twice the one below it (and one may be none)."""
    if rng.random() < 0.5:
        base = rng.choice([3, 4])
        mid = 2 * base + rng.randint(0, 2)
        return [0, base, mid, 2 * mid + rng.randint(0, 2)]
    a = rng.randint(6, 7)
    b = 2 * a + rng.randint(0, 1)
    return [3, a, b, 2 * b + rng.randint(0, 1)]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.5:
        counts = _ladder(rng)
        rng.shuffle(counts)
        return {"band": band, "kind": "acid", "tubes": [[L, n] for L, n in zip("WXYZ", counts)], "acid": rng.choice(ACIDS)}
    metals = list("PQRS"[:rng.choice([3, 4])])
    order = metals[:]
    rng.shuffle(order)
    i, j = sorted(rng.sample(range(len(order)), 2))  # any pair: i is the more reactive
    displaces = rng.random() < 0.5  # the missing test as often a reaction as none
    hidden = [order[i], order[j]] if displaces else [order[j], order[i]]  # metal added, and the metal whose salt it meets
    both = j - i >= 2 and rng.random() < 0.5  # neighbours keep their reverse result, or the order would be left open
    return {"band": band, "kind": "displacement", "metals": metals, "order": order, "salt": rng.choice(SALTS), "hidden": hidden,
            "both": both}


# --- drawing ------------------------------------------------------------------------------------------

def _bubbles(n: int, cx: float, L: str) -> list[tuple[float, float]]:
    """Where n bubbles sit in the acid above the metal: slots on a grid, chosen the same way for the same figure."""
    slots = [(cx + dx * 0.21, 1.75 + dy * 0.23) for dy in range(12) for dx in (-2, -1, 0, 1, 2)]
    pick = random.Random(f"{L}:{n}")
    chosen = []
    for _ in range(n):  # most near the metal, where the bubbles form, fewer as they rise
        weights = [math.exp(-(y - 1.75) / 1.6) * (1.0 if abs(x - cx) < 0.3 else 0.6) for x, y in slots]
        k = pick.choices(range(len(slots)), weights)[0]
        chosen.append(slots.pop(k))
    return [(x + pick.uniform(-0.04, 0.04), y + pick.uniform(-0.04, 0.04)) for x, y in chosen]


def _acid(p: dict):
    fig, ax = new_figure(7.0, 5.2)
    fig.subplots_adjust(left=0.02, right=0.98, top=0.98, bottom=0.02)
    r, bottom, top, level = 0.6, 1.0, 5.6, 4.7
    for k, (L, n) in enumerate(p["tubes"]):
        cx = 2.0 + 3.0 * k
        arc = [(cx + r * math.cos(math.radians(a)), bottom + r + r * math.sin(math.radians(a))) for a in range(180, 361, 10)]
        ax.add_patch(Polygon([(cx - r, level)] + arc + [(cx + r, level)], closed=True, facecolor="#e4ebf0", edgecolor="none",
                             zorder=1, gid=f"acid:{L}"))
        xs, ys = zip(*([(cx - r, top)] + arc + [(cx + r, top)]))
        ax.plot(xs, ys, color=INK, linewidth=1.4, zorder=4, gid=f"tube:{L}")
        ax.plot([cx - r, cx + r], [level, level], color=INK, linewidth=0.8, zorder=4)
        ax.add_patch(Rectangle((cx - 0.3, 1.13), 0.6, 0.3, facecolor="#6b6b6b", edgecolor=INK, linewidth=0.9, zorder=3,
                               gid=f"metal:{L}"))
        for x, y in _bubbles(n, cx, L):
            ax.add_patch(Circle((x, y), 0.075, facecolor="white", edgecolor=INK, linewidth=0.8, zorder=2, gid=f"bubble:{L}"))
        ax.text(cx, 0.5, L, ha="center", va="center", fontsize=14, fontweight="bold", gid=f"tubeletter:{L}")
    ax.text(6.5, -0.2, f"Each tube: a piece of metal the same size in 10 cm³ of {p['acid']}", ha="center", va="center",
            fontsize=10)
    ax.set_xlim(0.4, 12.6)
    ax.set_ylim(-0.55, 6.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def results(p: dict) -> dict[tuple[str, str], str]:
    """What each cell shows: the metal added (row) in a solution of the other's salt (column)."""
    order, (x, y) = p["order"], p["hidden"]
    missing = {(x, y), (y, x)} if p["both"] else {(x, y)}
    out = {}
    for r in p["metals"]:
        for c in p["metals"]:
            if r == c:
                out[(r, c)] = "—"
            elif (r, c) in missing:
                out[(r, c)] = "?"
            else:
                out[(r, c)] = "✓" if order.index(r) < order.index(c) else "✗"
    return out


def _displacement(p: dict):
    metals, salt = p["metals"], p["salt"]
    n = len(metals)
    first, col = 2.4, 2.5
    width = first + n * col
    fig, ax = new_figure(width * 0.55 + 0.4, 4.6)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    head_h, row_h = 1.1, 0.75
    ys = [0.0, -head_h] + [-head_h - row_h * (k + 1) for k in range(n)]
    xs = [0.0, first] + [first + col * (k + 1) for k in range(n)]
    for y in ys:
        ax.plot([0, width], [y, y], color=INK, linewidth=1.2 if y in (ys[0], ys[1], ys[-1]) else 0.7)
    for x in xs:
        ax.plot([x, x], [ys[0], ys[-1]], color=INK, linewidth=0.8)
    ax.text(first / 2, -head_h / 2, "Metal\nadded", ha="center", va="center", fontsize=10, fontweight="bold")
    for k, m in enumerate(metals):
        ax.text(first + col * (k + 0.5), -head_h / 2, f"{m} {salt}\nsolution", ha="center", va="center", fontsize=10,
                fontweight="bold")
    cells = results(p)
    for i, r in enumerate(metals):
        y = -head_h - row_h * (i + 0.5)
        ax.text(first / 2, y, r, ha="center", va="center", fontsize=12, fontweight="bold")
        for k, c in enumerate(metals):
            ax.text(first + col * (k + 0.5), y, cells[(r, c)], ha="center", va="center", fontsize=13, gid=f"cell:{r}:{c}")
    notes = ["✓  a coating formed on the metal: a reaction happened", "✗  no change: no reaction",
             "—  not tested (the same metal)", "?  no result recorded"]
    y = ys[-1] - 0.5
    for note in notes:
        ax.text(0.05, y, note, ha="left", va="center", fontsize=10)
        y -= 0.42
    ax.set_xlim(-0.2, width + 0.2)
    ax.set_ylim(y - 0.05, 0.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _acid(p) if p["kind"] == "acid" else _displacement(p)


# --- questions ----------------------------------------------------------------------------------------

SETTINGS = ["in the school laboratory", "in a chemistry practical in Huye", "at the science club in Musanze",
            "for a class investigation in Kigali", "in a practical test in Rubavu", "in the laboratory at a school in Nyagatare",
            "during a lesson on metals"]


def _orders(order: list[str]) -> list[str]:
    """The order and the slips a student makes with it: reversed, two neighbours swapped, the letters in turn."""
    swaps = []
    for i in range(len(order) - 1):
        o = order[:]
        o[i], o[i + 1] = o[i + 1], o[i]
        swaps.append(o)
    out = []
    for o in [order[::-1]] + swaps + [sorted(order)]:
        s = ", ".join(o)
        if s != ", ".join(order) and s not in out:
            out.append(s)
    return out


def _order_question(stem: str, order: list[str], rng: random.Random) -> Question:
    key = ", ".join(order)
    slips = _orders(order)
    options = [key] + [slips[0]] + rng.sample(slips[1:], min(2, len(slips) - 1))
    rng.shuffle(options)
    return Question("mcq", stem, str(options.index(key)), options)


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    most = rng.random() < 0.5
    if p["kind"] == "acid":
        bubbles = dict(p["tubes"])
        order = sorted(bubbles, key=bubbles.get, reverse=True)
        letters = list(bubbles)
        qs = [letter_choice(f"{who} put equal-sized pieces of four metals, W, X, Y and Z, into the same volume of {p['acid']} "
                            f"{setting}. Which metal is the {'most' if most else 'least'} reactive?",
                            order[0] if most else order[-1], letters)]
        qs.append(_order_question("What is the order of reactivity of the four metals, most reactive first?", order, rng))
        if 0 in bubbles.values():
            qs.append(letter_choice("Which metal did not react with the acid?", order[-1], letters))
        else:
            qs.append(letter_choice(f"Which metal is the {'least' if most else 'most'} reactive?",
                                    order[-1] if most else order[0], letters))
        return qs
    metals, order, salt = p["metals"], p["order"], p["salt"]
    names = ", ".join(metals[:-1]) + " and " + metals[-1]
    qs = [letter_choice(f"{who} added pieces of metals {names} to solutions of each other's {salt}s {setting}. "
                        f"Which metal is the {'most' if most else 'least'} reactive?", order[0] if most else order[-1], metals)]
    qs.append(_order_question("What is the order of reactivity of the metals, most reactive first?", order, rng))
    x, y = p["hidden"]
    reacts = order.index(x) < order.index(y)
    grid = [f"A reaction happens, because {x} is more reactive than {y}", f"No reaction happens, because {x} is less reactive than {y}",
            f"A reaction happens, because {x} is less reactive than {y}", f"No reaction happens, because {x} is more reactive than {y}"]
    key = grid[0] if reacts else grid[1]
    rng.shuffle(grid)
    qs.append(Question("mcq", f"The table has no result for metal {x} in {y} {salt} solution. What would happen?",
                       str(grid.index(key)), grid))
    cells = results(p)
    a, b = rng.choice(sorted(k for k, v in cells.items() if v == "✓"))
    eqs = [f"{a} + {b} {salt} → {a} {salt} + {b}", f"{b} + {a} {salt} → {b} {salt} + {a}",
           f"{a} + {b} {salt} → {b} {salt} + {a}", f"{b} + {a} {salt} → {a} {salt} + {b}"]
    key = eqs[0]
    rng.shuffle(eqs)
    qs.append(Question("mcq", "Which word equation shows one of the reactions in the table?", str(eqs.index(key)), eqs))
    return qs
