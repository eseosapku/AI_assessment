"""Capacity in litres and millilitres, mass in kilograms and grams (P, Stage 3 to 4), as Rwanda P3 "Capacity
measurements from liter to milliliter" and "Mass measurements from kilogram to gram", P4 "Capacity Measurements" and
"Mass Measurements", and Cambridge Stage 3–4 "Measure" teach them: reading a measuring jug and a kitchen scale, and
changing between units (1 l = 1000 ml and 1 kg = 1000 g, printed on the jug or the scale).

Three kinds of figure:
- jug: a measuring jug marked in millilitres (to 1000 ml, or to 2000 ml at Stage 4), its water at a mark. How many
  millilitres are in the jug? How many more make 1 litre? The amount in litres and millilitres.
- scale: a kitchen scale's dial marked in grams (to 1 kg, or to 2 kg at Stage 4), its pointer on a mark, a thing on
  its pan. How many grams does the thing weigh? How many more grams make 1 kg? The mass in kilograms and grams.
- weights: a level pan balance, a thing on one pan and gram (and kilogram) weights on the other. How many grams does
  the thing weigh? Its mass in kilograms and grams.
Every reading sits on a marked line, and every value is a whole number of millilitres or grams.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Polygon, Rectangle, Wedge

from ..core import FILL, FILL_2, INK, NAMES, mcq, new_figure, short

ID = "measures_p"
KIND = "maths.measure"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.litre-capacity-unit", "mathematics.kilogram-mass-unit")
# A topic whose sections the book lists is reached only if its name or a section names capacity, mass or measuring.
NEEDS = r"capacity|litre|liter|mass|kilogram|gram|weigh|measur"
AVOID = r"length|time|hour|money|currenc|angle|shape|area|perimeter|number"

LIQUIDS = {"water": "#9cc9ec", "milk": "#f4f1e8", "juice": "#f6b26b", "oil": "#f2d36b"}
# What each thing may fairly weigh, in grams: a bag or a packet may hold any amount; a pumpkin is never 200 g.
THINGS = {"bag of rice": (20, 2000), "bag of beans": (20, 2000), "packet of sugar": (20, 2000),
          "bag of flour": (20, 2000), "bag of salt": (20, 2000), "pineapple": (700, 2000), "cabbage": (500, 2000),
          "pumpkin": (1000, 2000), "papaya": (400, 1600), "mango": (150, 600), "avocado": (150, 500)}
JUG_LEADS = ["{n} pours {l} into a measuring jug.", "{n} measures some {l} in a jug.", "{n} fills a measuring jug with {l}.",
             "{n} checks how much {l} is in a measuring jug."]
SCALE_LEADS = ["{n} puts a {t} on a kitchen scale.", "{n} weighs a {t} on a kitchen scale.",
               "{n} checks the mass of a {t} on a scale.", "{n} puts a {t} on the pan of a scale."]
BALANCE_LEADS = ["{n} balances a {t} with weights.", "{n} weighs a {t} on a pan balance.",
                 "{n} puts a {t} on a balance and adds weights until it is level.",
                 "{n} uses weights to find the mass of a {t}."]
WEIGHTS = [1000, 500, 200, 100, 50, 20, 10]


def stages(p: dict) -> tuple[int, int]:
    """Millilitres and grams to 1 litre or 1 kg from Stage 3; to 2 litres or 2 kg, in two units, at Stage 4."""
    return (4, 4) if p["top"] > 1000 else (3, 4)


def concepts_for(p: dict) -> tuple[str, ...]:
    return ("mathematics.litre-capacity-unit",) if p["sub"] == "jug" else ("mathematics.kilogram-mass-unit",)


def _thing_for(v: int, rng: random.Random) -> str:
    return rng.choice([t for t, (lo, hi) in sorted(THINGS.items()) if lo <= v <= hi])


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["jug", "scale", "weights"])
    p = {"band": "P", "sub": sub, "name": rng.choice(NAMES)}
    if sub == "jug":
        top = rng.choice([1000, 1000, 2000])
        label, minor = (200, rng.choice([100, 50])) if top == 1000 else (500, rng.choice([100, 250]))
        v = minor * rng.randint(2, top // minor - 1)
        p.update(top=top, label=label, minor=minor, v=v, liquid=rng.choice(sorted(LIQUIDS)))
        return p
    if sub == "scale":
        top = rng.choice([1000, 1000, 2000])
        label, minor = (100, rng.choice([50, 20])) if top == 1000 else (200, rng.choice([50, 100]))
        v = minor * rng.randint(2, top // minor - 1)
        p.update(top=top, label=label, minor=minor, v=v, thing=_thing_for(v, rng))
        return p
    while True:
        k = rng.randint(2, 4)
        ws = sorted(rng.sample(WEIGHTS, k), reverse=True)
        if 100 <= sum(ws) <= 2000:
            break
    p.update(weights=ws, top=2000 if ws[0] == 1000 else 1000, thing=_thing_for(sum(ws), rng))
    return p


# --- drawing ------------------------------------------------------------------------------------------------

def _draw_jug(p: dict):
    top, label, minor, v = p["top"], p["label"], p["minor"], p["v"]
    fig, ax = new_figure(4.6, 5.4)
    H, W = 5.0, 2.4
    k = H / top  # drawing units per millilitre
    ax.add_patch(Rectangle((0, 0), W, v * k, facecolor=LIQUIDS[p["liquid"]], edgecolor="none", zorder=1, gid="behind-liquid"))
    ax.add_patch(Polygon([(0, H + 0.4), (0, 0), (W, 0), (W, H + 0.4)], closed=False, fill=False, edgecolor=INK,
                         linewidth=2.2, zorder=3, gid="jug"))
    ax.plot([W, W + 0.55, W + 0.55, W], [H - 0.2, H - 0.4, 1.0, 0.8], color=INK, linewidth=2.2, zorder=3, gid="handle")
    for m in range(minor, top + 1, minor):
        y = m * k
        big = m % label == 0
        ax.plot([0, 0.45 if big else 0.25], [y, y], color=INK, linewidth=1.6 if big else 1.0, zorder=4, gid=f"mark:{m}")
        if big:
            ax.text(0.55, y, f"{m} ml", ha="left", va="center", fontsize=11, zorder=5, gid=f"marklabel:{m}",
                    bbox={"boxstyle": "square,pad=0.08", "facecolor": "white", "edgecolor": "none", "alpha": 0.85})
    ax.text(-0.25, H + 0.75, "1 litre = 1000 ml", ha="left", va="center", fontsize=11, gid="rule")
    ax.set_xlim(-0.4, W + 0.9)
    ax.set_ylim(-0.2, H + 1.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def dial_angle(value: float, top: int) -> float:
    """Degrees (anticlockwise from east) of a value on the dial: 0 at the bottom left, the top value at the bottom
    right, 300 degrees round clockwise."""
    return 240 - 300 * value / top


def _draw_scale(p: dict):
    top, label, minor, v = p["top"], p["label"], p["minor"], p["v"]
    fig, ax = new_figure(5.4, 5.8)
    R = 2.0
    cy = 0.0
    ax.add_patch(Rectangle((-1.5, R + 0.15), 3.0, 0.22, facecolor=FILL, edgecolor=INK, linewidth=1.5, gid="pan"))
    ax.plot([0, 0], [R, R + 0.15], color=INK, linewidth=3)
    ax.text(0, R + 0.75, p["thing"], ha="center", va="center", fontsize=12, gid="thing",
            bbox={"boxstyle": "round,pad=0.3", "facecolor": "#e8dcc0", "edgecolor": INK})
    ax.add_patch(Circle((0, cy), R, facecolor="white", edgecolor=INK, linewidth=2.2, gid="dial"))
    for m in range(0, top + 1, minor):
        a = math.radians(dial_angle(m, top))
        big = m % label == 0
        r0 = R - (0.32 if big else 0.18)
        ax.plot([r0 * math.cos(a), R * math.cos(a)], [cy + r0 * math.sin(a), cy + R * math.sin(a)], color=INK,
                linewidth=1.6 if big else 0.9, gid=f"tick:{m}")
        if big and (top == 1000 or m % 400 == 0 or m == top):
            rl = R - 0.62
            ax.text(rl * math.cos(a), cy + rl * math.sin(a), str(m), ha="center", va="center", fontsize=10,
                    gid=f"ticklabel:{m}")
    ax.text(0, cy - 0.75, "grams", ha="center", va="center", fontsize=11, gid="unit")
    ax.text(0, cy - R - 0.4, "1 kg = 1000 g", ha="center", va="center", fontsize=11, gid="rule")
    a = math.radians(dial_angle(v, top))
    ax.annotate("", xy=(1.45 * math.cos(a), cy + 1.45 * math.sin(a)), xytext=(0, cy),
                arrowprops={"arrowstyle": "-|>", "color": "#c0392b", "linewidth": 2.2, "mutation_scale": 14,
                            "shrinkA": 0, "shrinkB": 0}, gid="pointer")
    ax.plot([0, 1.45 * math.cos(a)], [cy, cy + 1.45 * math.sin(a)], alpha=0, gid="behind-pointer")
    ax.add_patch(Circle((0, cy), 0.09, facecolor=INK, zorder=5))
    ax.set_xlim(-R - 0.3, R + 0.3)
    ax.set_ylim(-R - 0.7, R + 1.25)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _weight_label(g: int) -> str:
    return "1 kg" if g == 1000 else f"{g} g"


def _draw_weights(p: dict):
    ws = p["weights"]
    fig, ax = new_figure(8.4, 4.6)
    ax.add_patch(Polygon([(-1.2, 0), (1.2, 0), (0.5, 0.35), (-0.5, 0.35)], closed=True, facecolor=FILL_2, edgecolor=INK,
                         linewidth=1.5))
    ax.plot([0, 0], [0.35, 2.0], color=INK, linewidth=4.5)
    ax.plot([-2.8, 2.8], [2.0, 2.0], color=INK, linewidth=5, solid_capstyle="round", gid="beam")
    ax.add_patch(Circle((0, 2.0), 0.12, facecolor="white", edgecolor=INK, linewidth=1.5, zorder=4))
    for ex in (-2.8, 2.8):
        ax.plot([ex, ex], [2.0, 2.35], color=INK, linewidth=3)
        ax.add_patch(Polygon([(ex - 1.3, 2.55), (ex + 1.3, 2.55), (ex + 0.85, 2.35), (ex - 0.85, 2.35)], closed=True,
                             facecolor="#e0e0e0", edgecolor=INK, linewidth=1.5, zorder=4))
    ax.text(-2.8, 2.95, p["thing"], ha="center", va="center", fontsize=12, gid="thing",
            bbox={"boxstyle": "round,pad=0.35", "facecolor": "#e8dcc0", "edgecolor": INK})
    rows = [ws[:2], ws[2:]] if len(ws) > 3 else [ws]  # four weights stand in two rows, so they stay on the pan
    y, span, i = 2.55, 0.0, 0
    for row in rows:
        widths = [0.95 if g >= 1000 else 0.8 if g >= 200 else 0.66 for g in row]
        gap = 0.08
        width = sum(widths) + gap * (len(row) - 1)
        span = max(span, width)
        x = 2.8 - width / 2
        h = 0.62 if max(row) >= 200 else 0.5
        for g, w in zip(row, widths):
            ax.add_patch(Rectangle((x, y), w, h, facecolor=FILL, edgecolor=INK, linewidth=1.3, zorder=5, gid=f"behind-w:{i}"))
            ax.text(x + w / 2, y + h / 2, _weight_label(g), ha="center", va="center", fontsize=10, fontweight="bold",
                    zorder=6, gid=f"weight:{i}")
            x += w + gap
            i += 1
        y += h
    edge = max(4.3, 2.8 + span / 2 + 0.2)
    ax.set_xlim(-edge, edge)
    ax.set_ylim(-0.1, max(3.5, y + 0.1))
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"jug": _draw_jug, "scale": _draw_scale, "weights": _draw_weights}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def ml_forms(v: int) -> list[str]:
    return [str(v), f"{v} ml", f"{v}ml", f"{v} mL", f"{v}mL", f"{v} millilitres", f"{v} milliliters"]


def g_forms(v: int) -> list[str]:
    return [str(v), f"{v} g", f"{v}g", f"{v} grams", f"{v} gram" if v == 1 else f"{v} gms"]


def two_units(v: int, big: str, small: str, word_big: str, word_small: str) -> tuple[str, list[str]]:
    """1250 as "1 l 250 ml" (or "1 kg 250 g"), with the fair other ways to write it."""
    a, b = divmod(v, 1000)
    key = f"{a} {big} {b} {small}"
    forms = [key, f"{a}{big} {b}{small}", f"{a} {word_big} {b} {word_small}", f"{a} {word_big} and {b} {word_small}",
             f"{a} {big} and {b} {small}", f"{v / 1000:g} {big}", f"{v} {small}"]
    if big == "l":
        forms += [f"{a} L {b} mL", f"{a} L {b} ml", f"{a} liter {b} milliliters", f"{v / 1000:g} L"]
    return key, forms


def questions(p: dict, rng: random.Random) -> list:
    name, sub = p["name"], p["sub"]
    if sub == "jug":
        v = p["v"]
        lead = rng.choice(JUG_LEADS).format(n=name, l=p["liquid"])
        q1 = short(f"{lead} How many millilitres of {p['liquid']} are in the jug?", str(v), ml_forms(v))
        if v < 1000:
            q2 = short(f"How many more millilitres of {p['liquid']} would make 1 litre?", str(1000 - v), ml_forms(1000 - v))
        elif v > 1000:
            key, forms = two_units(v, "l", "ml", "litre", "millilitres")
            q2 = short(f"Write the amount of {p['liquid']} in the jug in litres and millilitres.", key, forms)
        else:
            q2 = short(f"How many litres of {p['liquid']} are in the jug?", "1", ["1 l", "1 L", "1 litre", "1 liter"])
        return [q1, q2]
    if sub == "scale":
        v = p["v"]
        thing = p["thing"]
        lead = rng.choice(SCALE_LEADS).format(n=name, t=thing).replace(" a a", " an a")
        q1 = short(f"{lead} How many grams does the {thing} weigh?", str(v), g_forms(v))
        if v < 1000:
            q2 = short(f"How many more grams would make the {thing} weigh 1 kilogram?", str(1000 - v), g_forms(1000 - v))
        elif v > 1000:
            key, forms = two_units(v, "kg", "g", "kilogram", "grams")
            q2 = short(f"Write the mass of the {thing} in kilograms and grams.", key, forms)
        else:
            q2 = short(f"How many kilograms does the {thing} weigh?", "1", ["1 kg", "1kg", "1 kilogram"])
        return [q1, q2]
    ws, thing = p["weights"], p["thing"]
    v = sum(ws)
    lead = rng.choice(BALANCE_LEADS).format(n=name, t=thing).replace(" a a", " an a")
    q1 = short(f"{lead} How many grams does the {thing} weigh?", str(v), g_forms(v))
    heavy = ws[0]
    q2 = mcq(f"Which weight on the balance is the heaviest?", _weight_label(heavy),
             [_weight_label(g) for g in ws[1:]] + [_weight_label(g) for g in WEIGHTS if g not in ws and g < heavy][:2], rng)
    if v > 1000:
        key, forms = two_units(v, "kg", "g", "kilogram", "grams")
        return [q1, short(f"Write the mass of the {thing} in kilograms and grams.", key, forms)]
    return [q1, short(f"How many more grams would make the {thing} weigh 1 kilogram?", str(1000 - v), g_forms(1000 - v))] \
        if v < 1000 else [q1, q2]
