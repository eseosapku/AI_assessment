"""Capacity in litres and mass in kilograms (P, Stage 1 to 2), as Cambridge Stage 1 and 2 "Measures (2)" and Rwanda P2
"Litre, the standard unit of capacity" and "Kilogram, the standard unit of mass" teach them.

Three kinds of figure:
- jugs: three or four jugs lettered A to D, marked in whole litres up to 5 or 10, each holding water or juice up to a
  mark. How many litres are in jug B? Which jug has the most (least)? How many more litres are in A than in C?
- weights: a pan balance with a thing on its left pan and kilogram weights (1 kg, 2 kg, 5 kg, each printed on its
  block) on its right. Level: how many kilograms does the thing weigh? Tilted: how many kilograms of weights are there?
  And which is heavier (lighter), the thing or the weights?
- compare: a pan balance with a thing on each pan, tilted. Which is heavier? Which is lighter?

The side that hangs lower is the heavier; a tilt is 11 degrees, plain to see. Every value is a whole number, and no
two jugs hold the same amount.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Circle, Ellipse, Polygon, Rectangle, Wedge

from ..core import FILL, FILL_2, INK, NAMES, mcq, new_figure, short

ID = "capacity_mass_p"
KIND = "maths.measure"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.litre-capacity-unit", "mathematics.kilogram-mass-unit")
# A topic whose sections the book lists is reached only if its name or a section names capacity, mass or measuring.
NEEDS = r"capacity|litre|liter|\bmass\b|kilogram|weigh|measur"
AVOID = r"length|time|hour|money|currenc|francs?\b|angle|shape|gram to|milli"

LETTERS = "ABCD"
LIQUID = {"water": "#9cc9ec", "juice": "#f6b26b"}
THINGS = ["pumpkin", "cabbage", "pineapple", "watermelon", "parcel", "basket", "sack"]
# What each thing may fairly weigh, in kg: a 7 kg cabbage would be no cabbage. A parcel, a basket and a sack may hold
# anything, so no one can say from what they know which of two things is heavier; the other pairs on a balance are
# ones of about the same mass (typical masses within 2 kg), so the figure decides, not the child's world knowledge.
MASS = {"pumpkin": (2, 10), "cabbage": (2, 4), "pineapple": (2, 3), "watermelon": (3, 10), "parcel": (2, 10),
        "basket": (2, 8), "sack": (2, 10)}
ANY = ("parcel", "basket", "sack")
PAIRS = [(a, b) for a in THINGS for b in THINGS if a != b and
         (a in ANY or b in ANY or abs(sum(MASS[a]) - sum(MASS[b])) / 2 <= 2)]
JUG_LEADS = ["{n} pours {l} into some jugs.", "{n} fills some jugs with {l}.", "{n} puts {l} in some jugs.",
             "{n} shares {l} into some jugs."]
WEIGH_LEADS = ["{n} weighs a {t} on a balance.", "{n} puts a {t} on a balance.", "{n} checks a {t} on a balance.",
               "{n} uses a balance to weigh a {t}."]
COMPARE_LEADS = ["{n} puts a {a} and a {b} on a balance.", "{n} compares a {a} and a {b} on a balance.",
                 "{n} weighs a {a} against a {b}."]
TILT = 11  # degrees


def stages(p: dict) -> tuple[int, int] | None:
    return (1, 2)


def concepts_for(p: dict) -> tuple[str, ...]:
    """A jug teaches litres, a balance kilograms: neither reaches the other's topic."""
    return ("mathematics.litre-capacity-unit",) if p["mode"] == "jugs" else ("mathematics.kilogram-mass-unit",)


# Every way to make a total from at most three blocks of 5, 2 and 1 kg, biggest first.
BLOCKS = sorted({tuple(sorted(c, reverse=True)) for c in
                 [(a,) for a in (5, 2, 1)] + [(a, b) for a in (5, 2, 1) for b in (5, 2, 1)] +
                 [(a, b, c) for a in (5, 2, 1) for b in (5, 2, 1) for c in (5, 2, 1)] if 2 <= sum(c) <= 10})


def sample(rng: random.Random) -> dict:
    mode = rng.choice(["jugs", "weights", "compare"])
    p = {"band": "P", "mode": mode, "name": rng.choice(NAMES)}
    if mode == "jugs":
        top = rng.choice([5, 10])
        n = rng.choice([3, 4])
        p.update(top=top, liquid=rng.choice(sorted(LIQUID)),
                 jugs=[[LETTERS[i], v] for i, v in enumerate(rng.sample(range(1, top + 1), n))])
        return p
    if mode == "weights":
        thing, down = rng.choice(THINGS), rng.choice(["level", "left", "right"])
        lo, hi = MASS[thing]
        # level: the thing weighs the weights; down on its side: it weighs more than they do, and still no more than
        # it fairly can; up: less, and still no less than it fairly can.
        total = rng.randint(*{"level": (lo, hi), "left": (2, hi - 1), "right": (lo + 1, 10)}[down])
        ws = list(rng.choice([b for b in BLOCKS if sum(b) == total]))
        p.update(left=thing, weights=ws, down=down)
        return p
    a, b = rng.choice(PAIRS)
    p.update(left=a, right=b, down=rng.choice(["left", "right"]))
    return p


# --- drawing ----------------------------------------------------------------------------------------

def _jug(ax, p: dict, i: int, letter: str, v: int) -> None:
    top = p["top"]
    step = 0.62 if top == 5 else 0.32
    ox, w = 2.9 * i, 1.4
    height = top * step + 0.35
    ax.add_patch(Rectangle((ox, 0), w, v * step, facecolor=LIQUID[p["liquid"]], edgecolor="none", zorder=1,
                           gid=f"water:{letter}"))
    ax.add_patch(Polygon([(ox, height), (ox, 0), (ox + w, 0), (ox + w, height)], closed=False, fill=False,
                         edgecolor=INK, linewidth=2.0, zorder=3))
    ax.plot([ox - 0.12, ox], [height + 0.12, height], color=INK, linewidth=2.0, zorder=3)  # the spout
    ax.plot([ox + w, ox + w + 0.38, ox + w + 0.38, ox + w], [height - 0.35, height - 0.45, 0.6, 0.45], color=INK,
            linewidth=2.0, zorder=3)  # the handle
    for k in range(1, top + 1):
        y = k * step
        labelled = top == 5 or k % 2 == 0
        ax.plot([ox, ox + (0.42 if labelled else 0.25)], [y, y], color=INK, linewidth=1.5 if labelled else 1.0,
                zorder=4, gid=f"mark:{letter}:{k}")
        if labelled:
            ax.text(ox - 0.1, y, f"{k} L", ha="right", va="center", fontsize=11, gid=f"marklabel:{letter}:{k}")
    ax.text(ox + w / 2, -0.45, f"Jug {letter}", ha="center", va="center", fontsize=13, fontweight="bold",
            gid=f"jug:{letter}")


def _draw_jugs(p: dict):
    n = len(p["jugs"])
    fig, ax = new_figure(2.6 * n + 1.0, 5.2)
    for i, (letter, v) in enumerate(p["jugs"]):
        _jug(ax, p, i, letter, v)
    height = p["top"] * (0.62 if p["top"] == 5 else 0.32) + 0.35
    ax.set_xlim(-1.0, 2.9 * (n - 1) + 2.0)
    ax.set_ylim(-0.8, height + 0.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _thing(ax, kind: str, cx: float, y: float) -> float:
    """A thing sitting on a pan at height y, centred on cx; returns its top."""
    lw = 1.5
    if kind == "pumpkin":
        ax.add_patch(Ellipse((cx, y + 0.4), 1.15, 0.8, facecolor="#f0a04b", edgecolor=INK, linewidth=lw, zorder=5))
        for dx in (-0.22, 0.22):
            ax.add_patch(Ellipse((cx + dx, y + 0.4), 0.42, 0.78, fill=False, edgecolor=INK, linewidth=0.9, zorder=5))
        ax.plot([cx, cx + 0.06], [y + 0.8, y + 0.95], color=INK, linewidth=2.4, zorder=5)
        return y + 0.95
    if kind == "cabbage":
        ax.add_patch(Circle((cx, y + 0.43), 0.43, facecolor="#9ccc65", edgecolor=INK, linewidth=lw, zorder=5))
        for r in (0.3, 0.17):
            ax.add_patch(Arc((cx, y + 0.43), 2 * r, 2 * r, theta1=20, theta2=160, edgecolor=INK, linewidth=0.9, zorder=5))
        return y + 0.86
    if kind == "pineapple":
        ax.add_patch(Ellipse((cx, y + 0.36), 0.6, 0.72, facecolor="#f2c94c", edgecolor=INK, linewidth=lw, zorder=5))
        for dx in (-0.14, 0, 0.14):
            ax.add_patch(Polygon([(cx + dx - 0.06, y + 0.68), (cx + dx + 1.2 * dx, y + 1.0), (cx + dx + 0.06, y + 0.68)],
                                 closed=True, facecolor="#5a9e4b", edgecolor=INK, linewidth=0.9, zorder=4))
        return y + 1.0
    if kind == "watermelon":
        ax.add_patch(Ellipse((cx, y + 0.34), 1.25, 0.68, facecolor="#5a9e4b", edgecolor=INK, linewidth=lw, zorder=5))
        for dx in (-0.3, 0, 0.3):
            ax.add_patch(Ellipse((cx + dx, y + 0.34), 0.16, 0.6, facecolor="#2e6b2a", edgecolor="none", zorder=5))
        return y + 0.68
    if kind == "parcel":
        ax.add_patch(Rectangle((cx - 0.55, y), 1.1, 0.72, facecolor="#c9a26b", edgecolor=INK, linewidth=lw, zorder=5))
        ax.plot([cx, cx], [y, y + 0.72], color=INK, linewidth=1.2, zorder=6)
        ax.plot([cx - 0.55, cx + 0.55], [y + 0.36, y + 0.36], color=INK, linewidth=1.2, zorder=6)
        return y + 0.72
    if kind == "basket":
        ax.add_patch(Polygon([(cx - 0.6, y + 0.55), (cx + 0.6, y + 0.55), (cx + 0.42, y), (cx - 0.42, y)], closed=True,
                             facecolor="#d9b77e", edgecolor=INK, linewidth=lw, zorder=5))
        ax.add_patch(Wedge((cx, y + 0.55), 0.4, 0, 180, width=0.05, facecolor=INK, edgecolor=INK, linewidth=0.8,
                           zorder=5))
        return y + 0.95
    ax.add_patch(Polygon([(cx - 0.45, y), (cx + 0.45, y), (cx + 0.5, y + 0.6), (cx + 0.2, y + 0.85), (cx - 0.2, y + 0.85),
                          (cx - 0.5, y + 0.6)], closed=True, facecolor="#e8dcc0", edgecolor=INK, linewidth=lw, zorder=5))
    ax.plot([cx - 0.22, cx + 0.22], [y + 0.78, y + 0.78], color=INK, linewidth=1.4, zorder=6)
    return y + 0.85  # a sack


def _block(ax, cx: float, y: float, kg: int, i: int) -> None:
    w, h = 0.7, 0.5
    ax.add_patch(Rectangle((cx - w / 2, y), w, h, facecolor=FILL, edgecolor=INK, linewidth=1.4, zorder=5))
    ax.add_patch(Wedge((cx, y + h), 0.13, 0, 180, width=0.04, facecolor=INK, edgecolor=INK, linewidth=0.8, zorder=5))
    ax.text(cx, y + h / 2, f"{kg} kg", ha="center", va="center", fontsize=11, fontweight="bold", zorder=6,
            gid=f"weight:{i}")


def _draw_balance(p: dict):
    fig, ax = new_figure(8.4, 5.2)
    half = 2.8
    pivot = (0.0, 2.0)
    a = {"level": 0, "left": TILT, "right": -TILT}[p["down"]]
    dy = half * math.sin(math.radians(a))
    dx = half * math.cos(math.radians(a))
    ends = {"left": (pivot[0] - dx, pivot[1] - dy), "right": (pivot[0] + dx, pivot[1] + dy)}
    ax.add_patch(Polygon([(-1.2, 0), (1.2, 0), (0.5, 0.35), (-0.5, 0.35)], closed=True, facecolor=FILL_2, edgecolor=INK,
                         linewidth=1.5))
    ax.plot([0, 0], [0.35, pivot[1]], color=INK, linewidth=4.5)
    ax.plot([ends["left"][0], ends["right"][0]], [ends["left"][1], ends["right"][1]], color=INK, linewidth=5,
            solid_capstyle="round", gid="beam", zorder=3)
    ax.add_patch(Circle(pivot, 0.12, facecolor="white", edgecolor=INK, linewidth=1.5, zorder=4))
    tops = []
    for side in ("left", "right"):
        ex, ey = ends[side]
        ax.plot([ex, ex], [ey, ey + 0.35], color=INK, linewidth=3, zorder=3)
        ax.add_patch(Polygon([(ex - 1.25, ey + 0.55), (ex + 1.25, ey + 0.55), (ex + 0.8, ey + 0.35), (ex - 0.8, ey + 0.35)],
                             closed=True, facecolor="#e0e0e0", edgecolor=INK, linewidth=1.5, gid=f"pan:{side}", zorder=4))
        y = ey + 0.55
        if side == "right" and p["mode"] == "weights":
            ws = p["weights"]
            span = 0.8 * (len(ws) - 1)
            for i, kg in enumerate(ws):
                _block(ax, ex - span / 2 + 0.8 * i, y, kg, i)
            tops.append(y + 0.65)
        else:
            name = p[side]
            top = _thing(ax, name, ex, y)
            ax.text(ex, top + 0.3, name, ha="center", va="center", fontsize=13, gid=f"item:{name}")
            tops.append(top + 0.5)
    ax.set_xlim(-4.3, 4.3)
    ax.set_ylim(-0.1, max(tops) + 0.15)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_jugs(p) if p["mode"] == "jugs" else _draw_balance(p)


# --- questions --------------------------------------------------------------------------------------

def _litres(v: int) -> list[str]:
    word = "litre" if v == 1 else "litres"
    return [f"{v} {word}", f"{v} L", f"{v}L", f"{v} l", f"{v} liters" if v != 1 else "1 liter"]


def _kilos(v: int) -> list[str]:
    word = "kilogram" if v == 1 else "kilograms"
    return [f"{v} kg", f"{v}kg", f"{v} {word}", f"{v} kgs"]


def _which(word: str, a: str, b: str, low: str | None, rng: random.Random):
    """Which of two is heavier (lighter): the one on the side that hangs lower is the heavier."""
    if low is None:
        key = "they weigh the same"
    else:
        high = b if low == a else a
        key = f"the {low if word == 'heavier' else high}"
    opts = [f"the {a}", f"the {b}", "they weigh the same"]
    return mcq(f"Which is {word}, the {a} or the {b}?", key, [o for o in opts if o != key], rng)


def questions(p: dict, rng: random.Random) -> list:
    name = p["name"]
    if p["mode"] == "jugs":
        jugs = {L: v for L, v in p["jugs"]}
        liquid = p["liquid"]
        lead = rng.choice(JUG_LEADS).format(n=name, l=liquid)
        L = rng.choice(sorted(jugs))
        q1 = short(f"{lead} How many litres of {liquid} are in jug {L}?", str(jugs[L]), _litres(jugs[L]))
        most = rng.choice(["most", "least"])
        order = sorted(jugs, key=jugs.get, reverse=most == "most")
        q2 = mcq(f"Which jug has the {most} {liquid}?", f"Jug {order[0]}", [f"Jug {x}" for x in order[1:]], rng)
        a, b = rng.sample(sorted(jugs), 2)
        if jugs[a] < jugs[b]:
            a, b = b, a
        d = jugs[a] - jugs[b]
        q3 = short(f"How many more litres are in jug {a} than in jug {b}?", str(d), _litres(d))
        return [q1, q2, q3]
    down = p["down"]
    if p["mode"] == "weights":
        thing = p["left"]
        lead = rng.choice(WEIGH_LEADS).format(n=name, t=thing)
        total = sum(p["weights"])
        if down == "level":
            q1 = short(f"{lead} How many kilograms does the {thing} weigh?", str(total), _kilos(total))
        else:
            q1 = short(f"{lead} How many kilograms of weights are on the balance?", str(total), _kilos(total))
        low = None if down == "level" else thing if down == "left" else "weights"
        a, b = (thing, "weights") if rng.random() < 0.5 else ("weights", thing)
        q2 = _which("heavier" if down == "level" or rng.random() < 0.5 else "lighter", a, b, low, rng)
        return [q1, q2]
    a, b = p["left"], p["right"]
    lead = rng.choice(COMPARE_LEADS).format(n=name, a=a, b=b)
    low = a if down == "left" else b
    first, second = rng.sample(["heavier", "lighter"], 2)
    q1 = _which(first, a, b, low, rng)
    q1.stem = f"{lead} {q1.stem}"
    q2 = _which(second, b, a, low, rng)
    return [q1, q2]
