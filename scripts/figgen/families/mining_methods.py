"""Mining (LS, UP; P6 geography): the methods of mining drawn as a cross-section, and an invented mining district's
output, as the Rwanda S2 "Mining and Quarrying in Rwanda", S3 "Mining in Africa" and S4 "Mining in Rwanda" units teach
them (methods of mining; minerals and their output).

Two sub-types:
- methods: a cross-section of four sites side by side in a shuffled order, lettered W to Z: a quarry cut into a
  hillside, an open-cast pit dug in steps below the ground, an underground mine (a headframe over a shaft, tunnels to
  a mineral vein, a depth scale from the surface beside the shaft) and alluvial mining (a miner washing river gravel in a pan), with a
  table that describes each method. Which letter shows a stated method, which method a letter shows, and the depth of
  the lowest tunnel, read from the scale.
- output: a grouped bar chart of the tonnes of cassiterite (tin ore), coltan and wolframite (tungsten ore) District M
  produced in two years, with each mineral's price per tonne printed. The rise in one mineral's output, the mineral
  whose output rose the most, the total in the later year, and the value of one mineral's output (value = tonnes ×
  price, printed).

Every key comes from the fixed table of methods or from numbers on gridlines and in the printed prices.
"""
from __future__ import annotations

import random
import textwrap
from fractions import Fraction

from matplotlib.patches import Circle, Ellipse, Polygon, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short
from ._bio_parts import letter_choice
from ._geo_charts import grouped_bars, num_forms

ID = "mining_methods"
KIND = "geo.section"
SUBJECT = "geography"
BANDS = ("LS", "UP")
MORE = {"methods": ("geography.mining-quarrying", "geography.rock-mineral-extraction"),
        "output": ("geography.mining-quarrying", "geography.mineral-distribution")}
CONCEPTS = ("geography.mining-quarrying", "geography.rock-mineral-extraction", "geography.mineral-distribution")
# A topic whose sections the book lists is reached only if its name or a section names mining, minerals, quarrying or
# extraction.
NEEDS = r"mining|mineral|quarr|extraction"
METHODS = ["quarry", "open-cast", "underground", "alluvial"]
NAMED = {"quarry": "Quarrying", "open-cast": "Open-cast mining", "underground": "Underground (shaft) mining",
         "alluvial": "Alluvial mining"}
TABLE = [("Open-cast mining", "A wide pit is dug in steps from the surface to reach a mineral near the surface."),
         ("Underground (shaft) mining", "A shaft and tunnels are dug to reach a mineral deep below the surface."),
         ("Alluvial mining", "Minerals are washed out of the sand and gravel of a river bed."),
         ("Quarrying", "Rock is cut from the face of a hill, for building stone or crushed stone.")]
LETTERS = ["W", "X", "Y", "Z"]
MINERALS = ["Cassiterite (tin ore)", "Coltan", "Wolframite (tungsten ore)"]
PRICES = {"Cassiterite (tin ore)": (10, 20), "Coltan": (30, 50), "Wolframite (tungsten ore)": (8, 16)}  # thousand US$
DISTRICT = "District M"
SURFACE = 6.0
UNIT = 40  # metres of depth for each unit of the drawing


def concepts_for(p: dict) -> tuple[str, ...]:
    return MORE[p["sub"]]


def _methods(rng: random.Random, band: str) -> dict:
    order = METHODS[:]
    rng.shuffle(order)
    letters = LETTERS[:]
    rng.shuffle(letters)
    tunnels = sorted(rng.sample([40, 60, 80, 100, 120, 140, 160], rng.randint(2, 3)))
    asked = rng.sample(METHODS, 2)
    return {"band": band, "sub": "methods", "order": order, "labels": dict(zip(letters, order)), "tunnels": tunnels,
            "ask": {"which": asked[0], "what": asked[1]}}


def _output(rng: random.Random, band: str) -> dict | None:
    before = [50 * rng.randint(4, 24) for _ in MINERALS]
    after = [b + 50 * rng.randint(-3, 8) for b in before]
    if min(after) <= 0:
        return None
    rise = [a - b for a, b in zip(after, before)]
    ranked = sorted(rise, reverse=True)
    if ranked[0] - ranked[1] < 100 or sum(1 for r in rise if r > 0) < 2:
        return None
    prices = [rng.randint(*PRICES[m]) for m in MINERALS]
    exact = [i for i in range(3) if after[i] * prices[i] % 100 == 0]  # a value in million US$ to one decimal place
    if not exact:
        return None
    y0 = rng.randint(2014, 2018)
    return {"band": band, "sub": "output", "years": [y0, y0 + 4], "before": before, "after": after, "prices": prices,
            "ask": {"rise": rng.choice([i for i in range(3) if rise[i] > 0]), "value": rng.choice(exact)}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.5:
        return _methods(rng, band)
    while True:
        p = _output(rng, band)
        if p:
            return p


# --- the cross-section -----------------------------------------------------------------------------------------------

ROCK = "#d9c8a9"
SOIL = "#a67c52"
WATER = "#5dade2"
VEIN = "#4a4a4a"


def _slot(ax, kind: str, x0: float, p: dict) -> tuple[float, float]:
    """Draws one site in the 4-unit-wide slot starting at x0; returns the point its letter's leader ends on."""
    if kind == "quarry":
        hill = [(x0, SURFACE), (x0 + 0.4, SURFACE + 1.6), (x0 + 1.5, SURFACE + 2.3), (x0 + 2.2, SURFACE + 2.3),
                (x0 + 2.2, SURFACE + 1.6), (x0 + 2.7, SURFACE + 1.6), (x0 + 2.7, SURFACE + 0.8), (x0 + 3.2, SURFACE + 0.8),
                (x0 + 3.2, SURFACE), (x0, SURFACE)]
        ax.add_patch(Polygon(hill, closed=True, facecolor=ROCK, edgecolor=INK, linewidth=1.1, zorder=2,
                             gid="part:quarry"))
        for bx, by in ((x0 + 3.35, SURFACE), (x0 + 3.62, SURFACE)):
            ax.add_patch(Rectangle((bx, by), 0.22, 0.18, facecolor="#bfae8e", edgecolor=INK, linewidth=0.8, zorder=2))
        return (x0 + 2.45, SURFACE + 1.2)
    if kind == "open-cast":
        pit = [(x0 + 0.3, SURFACE), (x0 + 0.8, SURFACE), (x0 + 0.8, SURFACE - 0.5), (x0 + 1.3, SURFACE - 0.5),
               (x0 + 1.3, SURFACE - 1.0), (x0 + 2.7, SURFACE - 1.0), (x0 + 2.7, SURFACE - 0.5), (x0 + 3.2, SURFACE - 0.5),
               (x0 + 3.2, SURFACE), (x0 + 3.7, SURFACE)]
        ax.add_patch(Polygon(pit[1:-1], closed=True, facecolor="#f4ecd8", edgecolor=INK, linewidth=1.1, zorder=3,
                             gid="part:open-cast"))
        ax.add_patch(Rectangle((x0 + 1.3, SURFACE - 1.35), 1.4, 0.35, facecolor=VEIN, edgecolor="none", zorder=2.5))
        return (x0 + 2.0, SURFACE - 0.6)
    if kind == "underground":
        sx = x0 + 1.3
        deepest = max(p["tunnels"])
        bottom = SURFACE - deepest / UNIT
        ax.add_patch(Rectangle((sx - 0.12, bottom), 0.24, SURFACE - bottom, facecolor="#f4ecd8", edgecolor=INK,
                               linewidth=1.0, zorder=3, gid="part:underground"))
        for d in p["tunnels"]:
            y = SURFACE - d / UNIT
            ax.add_patch(Rectangle((sx + 0.12, y - 0.1), 2.18, 0.2, facecolor="#f4ecd8", edgecolor=INK, linewidth=1.0,
                                   zorder=3, gid="part:underground"))
        ax.add_patch(Polygon([(x0 + 3.15, SURFACE - 0.3), (x0 + 3.45, SURFACE - 0.3), (x0 + 3.3, bottom - 0.4),
                              (x0 + 3.0, bottom - 0.4)], closed=True, facecolor=VEIN, edgecolor="none", zorder=2.5,
                             gid="vein"))
        # the headframe over the shaft
        ax.plot([sx - 0.4, sx, sx + 0.4], [SURFACE, SURFACE + 1.3, SURFACE], color=INK, linewidth=1.6, zorder=4,
                gid="headframe")
        ax.add_patch(Circle((sx, SURFACE + 1.3), 0.13, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=4))
        ax.plot([sx, sx], [SURFACE + 1.3, SURFACE], color=INK, linewidth=0.8, zorder=4, gid="cable")
        # the depth scale, to the left of the shaft; the surface is its 0
        x = x0 + 0.7
        ax.plot([x, x], [SURFACE, SURFACE - 200 / UNIT], color=INK, linewidth=1.0, zorder=4, gid="scale")
        for d in range(0, 201, 20):
            y = SURFACE - d / UNIT
            w = 0.12 if d % 40 == 0 else 0.07
            ax.plot([x, x + w], [y, y], color=INK, linewidth=0.9, zorder=4, gid="scale-tick")
            if d % 40 == 0 and d:
                ax.text(x - 0.08, y, f"{d} m", ha="right", va="center", fontsize=8.5, gid=f"depth:{d}")
        return (sx + 1.5, SURFACE - p["tunnels"][0] / UNIT)
    # alluvial: a river in a shallow valley, its gravel bed, a miner's pan of gravel and water
    valley = [(x0, SURFACE), (x0 + 1.1, SURFACE - 0.7), (x0 + 2.9, SURFACE - 0.7), (x0 + 4.0, SURFACE)]
    ax.add_patch(Polygon(valley, closed=True, facecolor=WATER, edgecolor=INK, linewidth=1.0, zorder=3,
                         gid="part:alluvial"))
    for k in range(13):
        gx = x0 + 1.15 + 0.14 * k
        ax.add_patch(Circle((gx, SURFACE - 0.8), 0.06, facecolor="#8d7b68", edgecolor="none", zorder=3.2))
    ax.add_patch(Ellipse((x0 + 2.0, SURFACE - 0.25), 0.9, 0.22, facecolor="#7f8c8d", edgecolor=INK, linewidth=1.0,
                         zorder=4, gid="pan"))
    return (x0 + 2.0, SURFACE - 0.45)


def _draw_methods(p: dict):
    fig, ax = new_figure(10.6, 8.2)
    ax.add_patch(Rectangle((0, 0.6), 16, SURFACE - 0.6, facecolor=ROCK, edgecolor="none", zorder=1, gid="ground"))
    ax.add_patch(Rectangle((0, SURFACE - 0.25), 16, 0.25, facecolor=SOIL, edgecolor="none", zorder=1.5, gid="soil"))
    ax.plot([0, 16], [SURFACE, SURFACE], color=INK, linewidth=1.0, zorder=1.6, gid="surface")
    at = {v: k for k, v in p["labels"].items()}
    for i, kind in enumerate(p["order"]):
        end = _slot(ax, kind, 4.0 * i, p)
        L = at[kind]
        lx, ly = 4.0 * i + 2.0, SURFACE + 2.95
        ax.plot([lx, end[0]], [ly - 0.28, end[1]], color=INK, linewidth=1.0, zorder=8, gid=f"leader:{L}")
        ax.plot([end[0]], [end[1]], marker="o", markersize=3.5, color=INK, zorder=8, gid=f"dot:{L}")
        ax.text(lx, ly, L, ha="center", va="center", fontsize=15, fontweight="bold", zorder=9, gid=f"letter:{L}")
    # the table of methods, under the section
    top = 0.25
    ax.text(0.05, top, "Methods of mining", ha="left", va="center", fontsize=10.5, fontweight="bold")
    for k, (name, words) in enumerate(TABLE):
        y = top - 0.55 - 0.62 * k
        ax.text(0.05, y, name, ha="left", va="center", fontsize=9.8, fontweight="bold")
        ax.text(4.6, y, words, ha="left", va="center", fontsize=9.6)
    ax.set_xlim(-0.3, 16.1)
    ax.set_ylim(top - 0.55 - 0.62 * 3 - 0.4, SURFACE + 3.4)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Four ways of getting minerals out of the ground", fontsize=12.5, fontweight="bold")
    return fig


def draw(p: dict):
    if p["sub"] == "methods":
        return _draw_methods(p)
    y0, y1 = p["years"]
    top = -(-(max(p["before"] + p["after"]) + 50) // 200) * 200
    notes = ["Price per tonne: " + "; ".join(f"{m.split(' (')[0].lower()} {pr} thousand US$"
                                             for m, pr in zip(MINERALS, p["prices"])),
             "Value = tonnes × price per tonne"]
    fig, _ = grouped_bars(MINERALS, {str(y0): p["before"], str(y1): p["after"]}, top=top, major=200, minor=50,
                          ylabel="Output (tonnes)", xlabel="Mineral", title=f"Minerals produced in {DISTRICT}",
                          notes=notes, colors=["#c9c9c9", "#5d6d7e"], size=(8.6, 5.2), wrap_at=14, legend_title="Year")
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on mining", "for a class test",
            "at the geography club", "while revising in Rutsiro", "for a lesson on minerals",
            "on a revision card", "while revising in Muhanga", "before a visit to a quarry"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "methods":
        lead = f"{who} {rng.choice(VERBS)} this cross-section of four mining sites {rng.choice(SETTINGS)}."
        at = {v: k for k, v in p["labels"].items()}
        w, z = p["ask"]["which"], p["ask"]["what"]
        deepest = max(p["tunnels"])
        return [
            letter_choice(f"{lead} Using the table, which letter shows {NAMED[w].lower()}?", at[w],
                          [L for L in LETTERS if L != at[w]]),
            mcq(f"Using the table of methods, which method of mining does letter {at[z]} in the cross-section show?",
                NAMED[z], [NAMED[k] for k in METHODS if k != z], rng),
            short("Using the depth scale beside the shaft, how deep below the surface is the lowest tunnel of the "
                  "underground mine?", f"{deepest} m", num_forms(deepest, "m", "metres")),
        ]
    lead = f"{who} {rng.choice(VERBS)} this bar chart of minerals from {DISTRICT} {rng.choice(SETTINGS)}."
    y0, y1 = p["years"]
    b, a, pr = p["before"], p["after"], p["prices"]
    r = p["ask"]["rise"]
    v = p["ask"]["value"]
    rise = [x - y for x, y in zip(a, b)]
    best = max(range(3), key=lambda i: rise[i])
    value = Fraction(a[v] * pr[v], 1000)
    vtext = str(value.numerator) if value.denominator == 1 else f"{float(value):.1f}".rstrip("0")
    name = lambda i: MINERALS[i].split(" (")[0].lower()  # noqa: E731
    return [
        short(f"{lead} By how many tonnes did {DISTRICT}'s output of {name(r)} rise from {y0} to {y1}?", rise[r],
              num_forms(rise[r], "tonnes", "t")),
        mcq(f"Which mineral's output in {DISTRICT} rose the most from {y0} to {y1}?", MINERALS[best],
            [m for i, m in enumerate(MINERALS) if i != best], rng),
        short(f"How many tonnes of these three minerals did {DISTRICT} produce altogether in {y1}?", sum(a),
              num_forms(sum(a), "tonnes", "t")),
        short(f"Value = tonnes × price per tonne. What was the value of {DISTRICT}'s {name(v)} output in {y1}, in "
              "million US$? (1 000 thousand US$ = 1 million US$)", vtext,
              num_forms(float(vtext) if "." in vtext else int(vtext), "million US$", "million")),
    ]
