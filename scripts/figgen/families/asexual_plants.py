"""Asexual reproduction in plants (LS, UP), two sub-types:

- organs: four organs that grow into new plants, drawn simply and lettered A to D in a random order: an onion bulb
  cut through, a potato stem tuber with its eyes, a strawberry runner with its plantlets, a ginger rhizome under the
  soil, with a printed table of what each one is. Which letter shows a named organ, what organ a letter shows, and
  how many eyes the stem tuber has or how many plantlets the runner has (counted on the drawing);
- cuttings: a bar chart of how many of a group of stem cuttings grew roots at each concentration of rooting hormone;
  the concentration that rooted the most, the percentage of a group that rooted, and how many more rooted with a
  concentration than with none.

The four drawings are told apart by their shapes and the printed table; counts are drawn one by one, apart; the most
cuttings rooted at one concentration only, and every percentage is whole.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Ellipse, Polygon, Rectangle

from ..core import FILL, GRID, INK, NAMES, Question, mcq, new_figure, short

ID = "asexual_plants"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("asexual-reproduction", "artificial-propagation-plant-varieties"))
# A topic whose sections the book lists is reached only if one names asexual reproduction or propagation.
NEEDS = r"asexual|vegetative|propagat|cuttings?\b|grafting|tubers?\b|rhizome|runner"
AVOID = (r"human|mammal|animal|genetic engineering|gene technology|enzyme|immun|disease|digest|glossary|"
         r"science in context|thinking and working scientifically|scientific method|science skills|sexual behaviour|"
         r"sexual relationships|\bSTIs?\b|HIV|pregnancy|social factors")

TYPES = ["bulb", "stem tuber", "runner", "rhizome"]
TABLE = {"bulb": "a short stem with thick, fleshy leaves wrapped round a bud",
         "stem tuber": "a swollen tip of an underground stem, with buds called eyes",
         "runner": "a side stem that grows along the ground and forms new plants",
         "rhizome": "a thick stem that grows sideways under the ground"}
PLANTS = ["cassava", "sweet potato", "rose", "hibiscus", "bougainvillea"]
LEVELS = [0, 10, 20, 40, 80]
SOIL = "#d9cdb8"
LEAF = "#9fbf8a"


def _sample_organs(rng: random.Random) -> dict:
    order = TYPES[:]
    rng.shuffle(order)
    ask = rng.choice(TYPES)
    # the letter whose organ is asked is never the one the first question's key names
    name_at = rng.choice([letter for letter, t in zip("ABCD", order) if t != ask])
    return {"band": rng.choice(BANDS), "kind": "organs", "organs": dict(zip("ABCD", order)), "eyes": rng.randint(3, 6),
            "plantlets": rng.randint(1, 3), "ask": ask, "name_at": name_at, "count": rng.choice(["eyes", "plantlets"])}


def _sample_cuttings(rng: random.Random) -> dict:
    n = rng.choice([20, 25])
    while True:
        peak = rng.randint(1, 3)
        base = rng.randint(3, 8)
        top = rng.randint(base + 6, n - 1)
        rooted = []
        for i in range(len(LEVELS)):
            if i <= peak:
                rooted.append(round(base + (top - base) * i / peak))
            else:
                rooted.append(max(1, top - rng.randint(2, 5) * (i - peak)))
        rooted = [min(v, n) for v in rooted]
        if rooted.count(max(rooted)) == 1:
            break
    more = [c for c, r in zip(LEVELS, rooted) if c and r > rooted[0]]
    return {"band": rng.choice(BANDS), "kind": "cuttings", "plant": rng.choice(PLANTS), "levels": LEVELS, "rooted": rooted,
            "per_group": n, "pct_at": rng.choice(LEVELS), "more_at": rng.choice(more)}


def sample(rng: random.Random) -> dict:
    return _sample_organs(rng) if rng.random() < 0.55 else _sample_cuttings(rng)


# --- drawing -----------------------------------------------------------------------------------------------------

def _onion(ax, cx: float, base: float) -> None:
    """A bulb cut through: fleshy leaves round a central bud, on a flat stem with roots below."""
    def shape(w, h):
        pts = []
        for k in range(41):
            t = math.pi * k / 40
            x = w * math.sin(t) * (1 - 0.25 * math.cos(t))
            y = h * (1 - math.cos(t)) / 2
            pts.append((x, y))
        # the pointed top
        right = [(cx + x, base + 0.15 + y) for x, y in pts]
        left = [(cx - x, base + 0.15 + y) for x, y in reversed(pts)]
        return right + [(cx, base + 0.15 + h + 0.35)] + left
    for w, h, z in ((0.75, 1.3, 2), (0.55, 1.1, 3), (0.36, 0.9, 4)):
        ax.add_patch(Polygon(shape(w, h), closed=True, facecolor="#f1ead8", edgecolor=INK, linewidth=1.1, zorder=z))
    ax.add_patch(Ellipse((cx, base + 0.6), 0.22, 0.55, facecolor=LEAF, edgecolor=INK, linewidth=1.0, zorder=5))
    ax.add_patch(Rectangle((cx - 0.45, base + 0.02), 0.9, 0.16, facecolor="#c8b28a", edgecolor=INK, linewidth=1.0, zorder=5))
    for dx in (-0.35, -0.18, 0.0, 0.18, 0.35):
        ax.plot([cx + dx, cx + dx * 1.3], [base + 0.02, base - 0.45], color=INK, linewidth=1.0, zorder=1)


def _tuber(ax, cx: float, cy: float, eyes: int) -> None:
    pts = [(cx + 0.95 * math.cos(t) * (1 + 0.06 * math.sin(3 * t)), cy + 0.6 * math.sin(t) * (1 + 0.05 * math.cos(2 * t)))
           for t in (2 * math.pi * k / 60 for k in range(60))]
    ax.add_patch(Polygon(pts, closed=True, facecolor="#e2cf9c", edgecolor=INK, linewidth=1.4, zorder=2))
    for k in range(eyes):
        t = 2 * math.pi * (k + 0.3) / eyes
        x, y = cx + 0.55 * math.cos(t), cy + 0.32 * math.sin(t)
        ax.add_patch(Ellipse((x, y), 0.16, 0.08, angle=math.degrees(t), facecolor=INK, edgecolor=INK, zorder=3))
        if k == 0:  # one eye has begun to sprout
            ax.plot([x, x + 0.12 * math.cos(t), x + 0.2 * math.cos(t) + 0.04], [y, y + 0.22, y + 0.38], color=INK,
                    linewidth=1.3, zorder=3)


def _tuft(ax, x: float, ground: float, size: float, roots: bool = True) -> None:
    """A small plant: two or three leaves on stalks above the ground and roots below."""
    for ang in (-35, 0, 35):
        a = math.radians(90 + ang)
        tx, ty = x + 0.45 * size * math.cos(a), ground + 0.45 * size * math.sin(a)
        ax.plot([x, tx], [ground, ty], color=INK, linewidth=1.0, zorder=3)
        ax.add_patch(Ellipse((tx, ty + 0.1 * size), 0.22 * size, 0.3 * size, angle=ang, facecolor=LEAF, edgecolor=INK,
                             linewidth=1.0, zorder=4))
    if roots:
        for dx in (-0.08, 0.0, 0.08):
            ax.plot([x, x + dx * 1.8], [ground, ground - 0.3 * size], color=INK, linewidth=0.9, zorder=3)


def _runner(ax, x0: float, x1: float, ground: float, plantlets: int) -> None:
    ax.add_patch(Rectangle((x0, ground - 0.6), x1 - x0, 0.6, facecolor=SOIL, edgecolor="none", zorder=0))
    ax.plot([x0, x1], [ground, ground], color=INK, linewidth=1.2, zorder=1)
    start = x0 + 0.55
    _tuft(ax, start, ground, 1.4)
    end = x1 - 0.35
    ax.plot([start, end], [ground + 0.05, ground + 0.05], color=INK, linewidth=1.6, zorder=2)
    gap = (end - start) / plantlets
    for k in range(1, plantlets + 1):
        _tuft(ax, start + gap * k, ground + 0.05, 0.8)


def _rhizome(ax, x0: float, x1: float, ground: float) -> None:
    ax.add_patch(Rectangle((x0, ground - 1.2), x1 - x0, 1.2, facecolor=SOIL, edgecolor="none", zorder=0))
    ax.plot([x0, x1], [ground, ground], color=INK, linewidth=1.2, zorder=1)
    y = ground - 0.6
    xs = [x0 + 0.3 + k * (x1 - x0 - 0.6) / 4 for k in range(5)]
    for x in xs:
        ax.add_patch(Ellipse((x, y), 0.55, 0.36, facecolor="#e6c98f", edgecolor=INK, linewidth=1.2, zorder=2))
        ax.plot([x, x - 0.05], [y - 0.18, y - 0.5], color=INK, linewidth=0.9, zorder=1)
    for x in (xs[1], xs[3]):  # shoots up through the soil
        ax.plot([x, x], [y + 0.18, ground + 0.9], color=INK, linewidth=1.4, zorder=3)
        for dy, side in ((0.45, 1), (0.75, -1)):
            ax.add_patch(Ellipse((x + side * 0.16, ground + dy), 0.34, 0.11, angle=side * 25, facecolor=LEAF,
                                 edgecolor=INK, linewidth=1.0, zorder=4))


def _draw_organs(p: dict):
    fig, ax = new_figure(8.6, 6.4)
    w = 2.6
    for i, (letter, kind) in enumerate(p["organs"].items()):
        x0 = i * w
        cx = x0 + w / 2
        ax.text(cx, 3.35, letter, ha="center", va="center", fontsize=15, fontweight="bold")
        if kind == "bulb":
            _onion(ax, cx, 0.75)
        elif kind == "stem tuber":
            _tuber(ax, cx, 1.5, p["eyes"])
        elif kind == "runner":
            _runner(ax, x0 + 0.1, x0 + w - 0.1, 1.2, p["plantlets"])
        else:
            _rhizome(ax, x0 + 0.1, x0 + w - 0.1, 1.85)
    # the table of what each organ is, in a fixed order
    top = -0.25
    ax.text(0.1, top, "Organ", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(2.2, top, "What it is", ha="left", va="center", fontsize=10, fontweight="bold")
    for j, kind in enumerate(TYPES):
        y = top - 0.45 * (j + 1)
        ax.text(0.1, y, kind, ha="left", va="center", fontsize=10)
        ax.text(2.2, y, TABLE[kind], ha="left", va="center", fontsize=10)
    ax.set_xlim(-0.05, 4 * w + 0.05)
    ax.set_ylim(top - 0.45 * len(TYPES) - 0.35, 3.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_cuttings(p: dict):
    fig, ax = new_figure(6.6, 4.3)
    xs = range(len(p["levels"]))
    ax.bar(list(xs), p["rooted"], width=0.6, color=FILL, edgecolor=INK, linewidth=1.0, zorder=3)
    ax.set_xticks(list(xs))
    ax.set_xticklabels([str(c) for c in p["levels"]], fontsize=10)
    ax.set_yticks(range(0, p["per_group"] + 1, 5))
    ax.set_yticks(range(0, p["per_group"] + 1), minor=True)
    ax.set_ylim(0, p["per_group"])
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(axis="y", labelsize=9)
    ax.set_xlabel("Concentration of rooting hormone (mg/dm³)")
    ax.set_ylabel("Number of cuttings that grew roots")
    ax.set_title(f"{p['per_group']} {p['plant']} stem cuttings at each concentration", fontsize=10.5)
    return fig


def draw(p: dict):
    return _draw_organs(p) if p["kind"] == "organs" else _draw_cuttings(p)


# --- questions ---------------------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson", "for the school garden", "for a class project", "at the agriculture club",
            "for revision"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "organs":
        organs = p["organs"]
        letters = sorted(organs)
        t = p["ask"]
        key = next(k for k, v in organs.items() if v == t)
        x = p["name_at"]
        art = "an" if t[0] in "aeiou" else "a"
        qs = [Question("mcq", f"{who} drew four plant organs that can grow into new plants {rng.choice(SETTINGS)}. "
                              f"Which letter shows {art} {t}?", str(letters.index(key)), letters),
              mcq(f"What kind of organ is drawn at letter {x}?", organs[x], [k for k in TYPES if k != organs[x]], rng)]
        if p["count"] == "eyes":
            qs.append(short("How many eyes (buds) can you see on the stem tuber?", p["eyes"], [f"{p['eyes']} eyes"]))
        else:
            n = p["plantlets"]
            qs.append(short("How many new plantlets are growing along the runner?", n, [f"{n} plantlets"]))
        return qs
    lv, rooted, n = p["levels"], p["rooted"], p["per_group"]
    best = lv[rooted.index(max(rooted))]
    c = p["pct_at"]
    pc = rooted[lv.index(c)] * 100 // n
    d = p["more_at"]
    more = rooted[lv.index(d)] - rooted[0]
    return [short(f"{who} planted {n} {p['plant']} cuttings at each concentration of rooting hormone "
                  f"{rng.choice(SETTINGS)}. Which concentration gave the most cuttings with roots, in mg/dm³?", best,
                  [f"{best} mg/dm³", f"{best}mg/dm³"]),
            short(f"What percentage of the cuttings given {c} mg/dm³ grew roots?", f"{pc}%", [str(pc), f"{pc} %"]),
            short(f"How many more cuttings grew roots with {d} mg/dm³ of hormone than with none?", more,
                  [f"{more} cuttings"])]
