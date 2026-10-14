"""Dichotomous keys (LS, UP): four or five lettered leaves of plants a student in Rwanda knows (maize, banana,
mango, avocado, hibiscus, cassava, bean, neem), drawn with the features a key uses: leaflets or not, deep
lobes, a toothed edge, veins side by side or branching, long and narrow or broad; and a numbered key built
from those features. The plant a lettered leaf comes from, and which leaf has a feature only it shows.

Every leaf, followed through the key, reaches its own name; the key asks only about features drawn.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Ellipse, Polygon

from ..core import INK, NAMES, mcq, new_figure, short

ID = "dichotomous_key"
KIND = "bio.key"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("classification-organisms",))  # the biodiversity concept pulled in every Ecology topic
# Integrated Science teaches this too (P3n): its Lower Secondary topics are reached by these.
ALSO = tuple(f"science.{c}" for c in ('identification-keys', 'organisms-classification'))
AVOID = r"cell|enzyme|genetic|inherit|immun|disease|reproduc|excretion|digest|photosynth|respiration|hormone|virus|glossary|thinking and working scientifically|science in context|scientific method|science skills"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"\bkeys?\b|classif|identif"
FEATURES = ("compound", "parallel", "lobed", "toothed", "narrow")  # the order a couplet is chosen in
PLANTS = {
    "maize": {"compound": False, "lobed": False, "toothed": False, "parallel": True, "narrow": True},
    "banana": {"compound": False, "lobed": False, "toothed": False, "parallel": True, "narrow": False},
    "mango": {"compound": False, "lobed": False, "toothed": False, "parallel": False, "narrow": True},
    "avocado": {"compound": False, "lobed": False, "toothed": False, "parallel": False, "narrow": False},
    "hibiscus": {"compound": False, "lobed": False, "toothed": True, "parallel": False, "narrow": False},
    "cassava": {"compound": False, "lobed": True, "toothed": False, "parallel": False, "narrow": False},
    "bean": {"compound": True, "lobed": False, "toothed": False, "parallel": False, "narrow": False},
    "neem": {"compound": True, "lobed": False, "toothed": True, "parallel": False, "narrow": True},
}
SAYS = {"compound": ("Leaf divided into separate leaflets", "Leaf not divided into leaflets"),
        "parallel": ("Veins run side by side along the leaf", "Veins branch out from a central vein"),
        "lobed": ("Leaf cut into deep lobes", "Leaf not cut into lobes"),
        "toothed": ("Leaf edge toothed (jagged)", "Leaf edge smooth"),
        "narrow": ("Leaf more than three times as long as it is wide", "Leaf less than three times as long as it is wide")}
ASK = {"compound": "is divided into separate leaflets", "parallel": "has veins that run side by side along the leaf",
       "lobed": "is cut into deep lobes", "toothed": "has a toothed (jagged) edge"}


def build_key(names: list[str]) -> list[dict]:
    """Couplets numbered in the order they are read: each splits its leaves on the first feature that divides them."""
    key: list[dict] = []

    def make(group):
        i = len(key)
        key.append({})
        f = next(f for f in FEATURES if 0 < sum(PLANTS[n][f] for n in group) < len(group))
        yes = [n for n in group if PLANTS[n][f]]
        no = [n for n in group if not PLANTS[n][f]]
        c = {"feature": f}
        for side, part in (("yes", yes), ("no", no)):
            c[side] = ["name", part[0]] if len(part) == 1 else ["go", make(part)]
        key[i] = c
        return i + 1

    make(names)
    return key


def sample(rng: random.Random) -> dict:
    names = rng.sample(list(PLANTS), rng.choice([4, 5]))
    letters = "ABCDE"[:len(names)]
    plants = [{"letter": letter, "name": n, "features": dict(PLANTS[n])} for letter, n in zip(letters, names)]
    only = [f for f in ASK if sum(PLANTS[n][f] for n in names) == 1]
    two = rng.sample(letters, 2)
    return {"band": rng.choice(BANDS), "plants": plants, "key": build_key(names), "unique": rng.choice(only) if only else None,
            "ask": two[0], "ask2": two[1]}


def _outline(cx, base, length, width, toothed, n=60):
    pts = []
    for side in (1, -1):
        rng_s = range(n + 1) if side == 1 else range(n, -1, -1)
        for k in rng_s:
            s = k / n
            hw = width / 2 * math.sin(math.pi * s) ** 0.75
            if toothed and 0.08 < s < 0.92:
                hw += max(width * 0.07, 0.035) * (1 if k % 4 < 2 else -0.3)  # big enough to see on a small leaflet
            pts.append((cx + side * hw, base + s * length))
    return pts


def _veins(ax, cx, base, length, width, parallel):
    if parallel:
        for f in (-0.3, -0.1, 0.1, 0.3):
            ys = [base + length * k / 20 for k in range(1, 20)]
            ax.plot([cx + f * width * math.sin(math.pi * (y - base) / length) ** 0.75 for y in ys], ys, color=INK, linewidth=0.6)
    else:
        ax.plot([cx, cx], [base, base + length * 0.96], color=INK, linewidth=0.9)
        for k in range(1, 6):
            y = base + length * k / 6.5
            hw = width / 2 * math.sin(math.pi * (y - base) / length) ** 0.75
            for side in (1, -1):
                ax.plot([cx, cx + side * hw * 0.75], [y, y + length * 0.09], color=INK, linewidth=0.6)


def palmate(cx: float, base: float, size: float) -> list[tuple[float, float]]:
    """A palmately lobed leaf's outline as one shape: five lobes from a palm that joins them near the stalk, the cuts
    between them reaching two-thirds of the way in (P3i review: five free ellipses read as five leaflets)."""
    pts = []
    angles = (-60, -30, 0, 30, 60)
    palm = size * 0.22
    for k, ang in enumerate(angles):
        a = math.radians(ang)
        L = size * (0.75 if ang == 0 else 0.62)
        w = 0.2  # a lobe's half-angle at its widest, in radians
        for t in [j / 12 for j in range(13)]:  # out along one side of the lobe and back along the other
            r = palm + (L - palm) * math.sin(math.pi * t / 2) if t <= 1 else L
            side = a - w * (1 - t)
            pts.append((cx + r * math.sin(side), base + r * math.cos(side)))
        for t in [j / 12 for j in range(12, -1, -1)]:
            r = palm + (L - palm) * math.sin(math.pi * t / 2)
            side = a + w * (1 - t)
            pts.append((cx + r * math.sin(side), base + r * math.cos(side)))
        if k < len(angles) - 1:  # the cut down to the palm, between this lobe and the next
            mid = math.radians((ang + angles[k + 1]) / 2)
            pts.append((cx + palm * math.sin(mid), base + palm * math.cos(mid)))
    pts.append((cx + palm * 0.4 * math.sin(math.radians(80)), base + palm * 0.2))
    pts.append((cx, base))
    pts.append((cx - palm * 0.4 * math.sin(math.radians(80)), base + palm * 0.2))
    return pts


def _leaf(ax, cx, base, f, size=2.4):
    fill = "#dbe7d2"
    ax.plot([cx, cx], [base - 0.35, base], color=INK, linewidth=1.4)  # the stalk
    if f["compound"]:
        if f["narrow"]:  # pinnate: pairs of narrow leaflets along a stalk, one at the tip
            ax.plot([cx, cx], [base, base + size], color=INK, linewidth=1.2)
            for k in range(4):
                y = base + 0.25 + k * 0.48
                for side in (1, -1):
                    pts = _outline(0, 0, 0.75, 0.22, f["toothed"], 30)
                    a = math.radians(-60 * side)
                    rot = [(cx + x * math.cos(a) - yy * math.sin(a), y + x * math.sin(a) + yy * math.cos(a)) for x, yy in pts]
                    ax.add_patch(Polygon(rot, closed=True, facecolor=fill, edgecolor=INK, linewidth=0.9))
            ax.add_patch(Polygon(_outline(cx, base + size - 0.05, 0.6, 0.22, f["toothed"], 30), closed=True, facecolor=fill,
                                 edgecolor=INK, linewidth=0.9))
        else:  # three broad leaflets
            ax.plot([cx, cx], [base, base + 0.7], color=INK, linewidth=1.2)
            for ang in (-55, 0, 55):
                pts = _outline(0, 0, 1.2, 0.8, f["toothed"], 40)
                a = math.radians(-ang)
                rot = [(cx + x * math.cos(a) - y * math.sin(a), base + 0.7 + x * math.sin(a) + y * math.cos(a)) for x, y in pts]
                ax.add_patch(Polygon(rot, closed=True, facecolor=fill, edgecolor=INK, linewidth=0.9))
        return
    if f["lobed"]:  # palmate: one blade cut into deep lobes, joined by a palm near the stalk
        size *= 0.9  # the outer lobes spread wide: kept inside the leaf's column
        ax.add_patch(Polygon(palmate(cx, base, size), closed=True, facecolor=fill, edgecolor=INK, linewidth=1.1))
        for ang in (-60, -30, 0, 30, 60):  # a vein up each lobe from the palm
            a = math.radians(ang)
            L = size * (0.68 if ang == 0 else 0.56)
            ax.plot([cx, cx + math.sin(a) * L], [base, base + math.cos(a) * L], color=INK, linewidth=0.6)
        return
    length, width = (size, size / 4.5) if f["narrow"] else (size * 0.85, size * 0.55)
    ax.add_patch(Polygon(_outline(cx, base, length, width, f["toothed"]), closed=True, facecolor=fill, edgecolor=INK, linewidth=1.1))
    _veins(ax, cx, base, length, width, f["parallel"])


def draw(p: dict):
    n = len(p["plants"])
    fig, ax = new_figure(8.2, 6.2)
    for i, x in enumerate(p["plants"]):
        cx = 1.3 + i * 2.6
        _leaf(ax, cx, 3.0, x["features"])
        ax.text(cx, 2.35, x["letter"], ha="center", va="center", fontsize=14, fontweight="bold")
    y = 1.6
    for k, c in enumerate(p["key"], start=1):
        for side, (word, (kind, value)) in enumerate(zip(SAYS[c["feature"]], (c["yes"], c["no"]))):
            lead = f"{k}" if side == 0 else ""
            ax.text(0.2, y, lead, ha="left", va="center", fontsize=10, fontweight="bold")
            ax.text(0.7, y, word, ha="left", va="center", fontsize=10)
            ax.text(n * 2.6 - 0.1, y, value if kind == "name" else f"go to {value}", ha="right", va="center", fontsize=10,
                    fontweight="bold" if kind == "name" else "normal")
            y -= 0.42
        y -= 0.12
    ax.set_xlim(0, n * 2.6)
    ax.set_ylim(y + 0.1, 6.2)  # a pinnate leaf's tip leaflet reaches 6.0
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a biology lesson", "on a nature walk", "in the school garden", "at the science club", "on a farm visit"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    by = {x["letter"]: x for x in p["plants"]}
    a, b = p["ask"], p["ask2"]
    qs = [short(f"{who} collected leaves {rng.choice(SETTINGS)} and made this key. Use the key to name the plant that leaf {a} comes from.",
                by[a]["name"], [by[a]["name"], by[a]["name"].capitalize(), f"{by[a]['name']} plant"]),
          short(f"{friend} is not sure about leaf {b}. Use the key to name the plant that leaf {b} comes from.",
                by[b]["name"], [by[b]["name"], by[b]["name"].capitalize(), f"{by[b]['name']} plant"])]
    if p["unique"]:
        f = p["unique"]
        key = next(x["letter"] for x in p["plants"] if x["features"][f])
        qs.append(mcq(f"Which leaf {ASK[f]}?", key, [x["letter"] for x in p["plants"] if x["letter"] != key], rng))
    return qs
