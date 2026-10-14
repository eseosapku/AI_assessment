"""Potometers (LS, UP, AL): a bubble potometer drawn as the textbooks draw it (a leafy shoot sealed by a bung into a
water-filled tube, a capillary tube with a millimetre scale beside it whose end dips into a beaker, and a reservoir
with a tap on a side arm), with four parts lettered A to D. Beneath it, a results table of how far the air bubble
moved in 5 minutes under four conditions of air movement and light.

One row's distance is a "?": it is read off the scale, where the drawing shows that test's bubble at the start and
after 5 minutes (the bubble moves toward the shoot). How far the bubble moved, the rate of uptake in mm per minute
(the formula in the stem), which test took up water fastest, and why the lettered shoot was cut under water.

Moving air and more light never slow uptake. The four tests always include "fan, dim light" and "still air, bright
light" and never "fan, bright light", so which is fastest comes from the data, not from knowing the factors. Every
distance is whole or a half millimetre, so each rate has one decimal place; the read-off row is whole millimetres.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import INK, NAMES, Question, exact, mcq, measure, short

ID = "potometer"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("transpiration", "transport-systems", "xylem-phloem"))
# Integrated Science teaches transpiration too (P3n): its "Maintaining life" chapter has a section on it.
ALSO = ("science.plant-water-relations",)
AVOID = r"animal|mammal|human|immun|reproduc|circulat|across the cell|cell membrane"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"transpir|potometer|transport of water|uptake of water|water uptake|transport in plants|transport system in plants"

AIR = {"still": "still air", "fan": "fan"}
LIGHT = {"dark": "dark", "dim": "dim light", "bright": "bright light"}
PARTS = ["shoot", "capillary", "reservoir", "tap"]
MINUTES = 5

WATER = "#dcebf5"
LEAF = "#cfe0c3"
GLASS = INK


def label(row: dict) -> str:
    return f"{AIR[row['air']]}, {LIGHT[row['light']]}"


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        # distances in half millimetres, rising with light and with moving air
        still_dark = rng.randint(4, 12)
        fan_dark = still_dark + rng.randint(2, 6)
        still_dim = max(fan_dark, still_dark) + rng.randint(6, 16)
        fan_dim = still_dim + rng.randint(6, 20)
        still_bright = still_dim + rng.randint(6, 20)
        half = {("still", "dark"): still_dark, ("fan", "dark"): fan_dark, ("still", "dim"): still_dim,
                ("fan", "dim"): fan_dim, ("still", "bright"): still_bright}
        combos = [("fan", "dim"), ("still", "bright")] + rng.sample([("still", "dark"), ("fan", "dark"), ("still", "dim")], 2)
        rng.shuffle(combos)
        dist = [half[c] / 2 for c in combos]
        ordered = sorted(dist, reverse=True)
        if ordered[0] - ordered[1] < 2 or any(a - b < 1 for a, b in zip(ordered, ordered[1:])):
            continue
        readable = [i for i, d in enumerate(dist) if d == int(d) and 6 <= d <= 32]
        if len(readable) < 1:
            continue
        drawn = rng.choice(readable)
        start = rng.randint(1, 39 - int(dist[drawn]))
        rate_row = rng.choice([i for i in range(4) if i != drawn])
        letters = dict(sorted(zip(rng.sample("ABCD", 4), PARTS)))
        return {"band": band, "plant": rng.choice(PLANTS), "rows": [{"air": a, "light": li, "dist": d} for (a, li), d in zip(combos, dist)],
                "drawn": drawn, "start": start, "rate_row": rate_row, "letters": letters, "cut": rng.choice(["why", "which"])}


PLANTS = ["bean", "hibiscus", "cassava", "avocado", "coffee", "eucalyptus", "geranium", "sunflower", "tomato"]


# --- drawing ----------------------------------------------------------------------------------------

def _outline(ax, pts, **kw):
    ax.plot([x for x, _ in pts], [y for _, y in pts], color=GLASS, linewidth=1.3, solid_capstyle="butt", **kw)


def _apparatus(ax, p: dict) -> None:
    # the beaker the open end of the capillary tube dips into
    ax.add_patch(Rectangle((-13.0, -14.5), 10.5, 4.5, facecolor=WATER, edgecolor="none", zorder=1))
    _outline(ax, [(-13.0, -7.0), (-13.0, -14.5), (-2.5, -14.5), (-2.5, -7.0)])
    ax.plot([-13.0, -2.5], [-10.0, -10.0], color=GLASS, linewidth=0.7, zorder=2)
    # the capillary tube: down into the beaker, then along the scale to the shoot's tube
    ax.add_patch(Polygon([(-7.6, -12.0), (-6.0, -12.0), (-6.0, -0.8), (50.0, -0.8), (50.0, 0.8), (-7.6, 0.8)], closed=True,
                         facecolor=WATER, edgecolor="none", zorder=2, gid="part:capillary"))
    _outline(ax, [(50.0, 0.8), (-7.6, 0.8), (-7.6, -12.0)], zorder=3)
    _outline(ax, [(-6.0, -12.0), (-6.0, -0.8), (50.0, -0.8)], zorder=3)
    # the wide tube the shoot is sealed into, open to the capillary and the side arm
    ax.add_patch(Rectangle((50.0, -2.5), 5.0, 18.5, facecolor=WATER, edgecolor="none", zorder=2, gid="tube"))
    _outline(ax, [(50.0, 0.8), (50.0, 16.0)], zorder=3)
    _outline(ax, [(50.0, -0.8), (50.0, -2.5), (55.0, -2.5), (55.0, 8.2)], zorder=3)
    _outline(ax, [(55.0, 9.8), (55.0, 16.0)], zorder=3)
    # the side arm, the tap and the reservoir
    ax.add_patch(Polygon([(55.0, 8.2), (61.8, 8.2), (61.8, 15.0), (60.2, 15.0), (60.2, 9.8), (55.0, 9.8)], closed=True,
                         facecolor=WATER, edgecolor="none", zorder=2))
    _outline(ax, [(55.0, 8.2), (61.8, 8.2), (61.8, 15.0)], zorder=3)
    _outline(ax, [(55.0, 9.8), (60.2, 9.8), (60.2, 15.0)], zorder=3)
    ax.add_patch(Circle((61.0, 12.0), 1.25, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=4, gid="part:tap"))
    ax.plot([58.8, 63.2], [12.0, 12.0], color=INK, linewidth=2.2, zorder=5, solid_capstyle="round")
    ax.add_patch(Rectangle((57.5, 15.0), 7.0, 6.5, facecolor=WATER, edgecolor="none", zorder=2, gid="part:reservoir"))
    _outline(ax, [(57.5, 23.5), (57.5, 15.0), (60.2, 15.0)], zorder=3)
    _outline(ax, [(61.8, 15.0), (64.5, 15.0), (64.5, 23.5)], zorder=3)
    ax.plot([57.5, 64.5], [21.5, 21.5], color=GLASS, linewidth=0.7, zorder=3)
    # the bung and the leafy shoot, its cut end under the water in the tube
    ax.add_patch(Rectangle((49.2, 16.0), 6.6, 3.2, facecolor="#6b6b6b", edgecolor=INK, linewidth=1.0, zorder=4))
    ax.add_patch(Polygon([(52.1, 6.0), (52.9, 6.0), (52.9, 33.0), (52.1, 33.0)], closed=True, facecolor="#9bb58a", edgecolor=INK,
                         linewidth=0.9, zorder=5, gid="part:shoot"))
    for k, (y, side) in enumerate([(23.5, -1), (25.5, 1), (28.0, -1), (30.0, 1), (32.3, -1)]):
        size = 1.0 - 0.12 * k
        ax.add_patch(Ellipse((52.5 + side * 3.4 * size, y + 0.9 * size), 6.6 * size, 2.3 * size, angle=side * 28, facecolor=LEAF,
                             edgecolor=INK, linewidth=1.0, zorder=4))
    ax.add_patch(Ellipse((52.5, 34.0), 1.6, 2.6, facecolor=LEAF, edgecolor=INK, linewidth=1.0, zorder=4))


def _scale(ax) -> None:
    ax.add_patch(Rectangle((-1.2, -5.6), 42.4, 4.2, facecolor="white", edgecolor=INK, linewidth=1.0, zorder=2))
    for mm in range(0, 41):
        h = 1.7 if mm % 5 == 0 else 0.9
        ax.plot([mm, mm], [-1.4, -1.4 - h], color=INK, linewidth=1.0 if mm % 5 == 0 else 0.7, zorder=3)
        if mm % 5 == 0:
            ax.text(mm, -4.3, str(mm), ha="center", va="center", fontsize=8.5, zorder=3)
    ax.text(42.2, -3.5, "mm", ha="left", va="center", fontsize=9)


def _bubble(ax, x: float, gid: str, dashed: bool) -> None:
    style = dict(facecolor="none", edgecolor=INK, linewidth=1.0, linestyle=(0, (2, 1.5))) if dashed else \
        dict(facecolor="white", edgecolor=INK, linewidth=1.2)
    ax.add_patch(FancyBboxPatch((x - 2.4, -0.45), 2.4, 0.9, boxstyle="round,pad=0,rounding_size=0.45", zorder=6, gid=gid, **style))
    ax.plot([x, x], [2.0, -1.4], color=INK, linewidth=0.8, linestyle=(0, (3, 2)), zorder=6, gid=gid.replace("bubble", "guide"))


# where each part's letter sits, and the point on the part its leader ends at
SPOTS = {"shoot": ((44.0, 20.6), (52.5, 20.6)), "capillary": ((-12.6, 1.8), (-6.8, -3.5)),
         "reservoir": ((68.5, 18.5), (63.6, 18.5)), "tap": ((68.5, 12.0), (61.6, 12.0))}


def draw(p: dict):
    import matplotlib.pyplot as plt
    fig = plt.figure(figsize=(8.4, 7.4))
    ax = fig.add_axes([0.0, 0.31, 1.0, 0.69])
    _apparatus(ax, p)
    _scale(ax)
    rows, k = p["rows"], p["drawn"]
    start, end = p["start"], p["start"] + int(rows[k]["dist"])
    _bubble(ax, start, "bubble:start", dashed=True)
    _bubble(ax, end, "bubble:end", dashed=False)
    ax.text(start + 0.3, 2.7, "start", ha="right", va="bottom", fontsize=9)
    ax.text(end - 0.3, 2.7, f"after {MINUTES} min", ha="left", va="bottom", fontsize=9)
    ax.text(19.5, -8.2, f'The bubble in the "{label(rows[k])}" test', ha="center", va="center", fontsize=9.5, style="italic")
    for letter, part in p["letters"].items():
        (lx, ly), (px, py) = SPOTS[part]
        ax.plot([lx + (1.0 if lx < px else -1.0), px], [ly, py], color=INK, linewidth=0.9, zorder=7, gid=f"leader:{letter}")
        ax.text(lx, ly, letter, ha="center", va="center", fontsize=13, fontweight="bold", zorder=7, gid=f"letter:{letter}")
    ax.set_xlim(-15.5, 71.0)
    ax.set_ylim(-15.5, 36.0)
    ax.set_aspect("equal")
    ax.axis("off")
    _table(fig.add_axes([0.13, 0.0, 0.74, 0.27]), p)
    return fig


def _table(ax, p: dict) -> None:
    w0, w1, h = 4.6, 4.6, 0.62
    n = len(p["rows"])
    head = (n) * h
    for x, w, words in ((0, w0, "Conditions"), (w0, w1, f"Distance moved by the bubble\nin {MINUTES} minutes / mm")):
        ax.add_patch(Rectangle((x, head), w, 1.2 * h, facecolor="#eef1f3", edgecolor=INK, linewidth=1.0))
        ax.text(x + w / 2, head + 0.6 * h, words, ha="center", va="center", fontsize=9.5, fontweight="bold")
    for i, row in enumerate(p["rows"]):
        y = (n - 1 - i) * h
        ax.add_patch(Rectangle((0, y), w0, h, facecolor="none", edgecolor=INK, linewidth=1.0))
        ax.add_patch(Rectangle((w0, y), w1, h, facecolor="none", edgecolor=INK, linewidth=1.0))
        ax.text(w0 / 2, y + h / 2, label(row), ha="center", va="center", fontsize=10, gid=f"cell:{i}:cond")
        shown = "?" if i == p["drawn"] else f"{row['dist']:.1f}"
        ax.text(w0 + w1 / 2, y + h / 2, shown, ha="center", va="center", fontsize=10.5,
                fontweight="bold" if shown == "?" else "normal", gid=f"cell:{i}:dist")
    ax.set_xlim(-0.05, w0 + w1 + 0.05)
    ax.set_ylim(-0.05, head + 1.2 * h + 0.05)
    ax.axis("off")


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a school lab in Huye", "at a farm school near Musanze", "in a biology practical in Kigali",
            "at the science club in Rubavu", "in a lesson at a school near Lake Kivu", "in a practical at a school in Nyagatare",
            "for a project at a school in Muhanga", "in the biology lab at a school in Rwamagana"]
VERBS = ["set up", "used", "put together"]
FASTEST = ["In which test did the shoot take up water fastest?", "Which conditions made the shoot take up water fastest?",
           "In which test was water taken up fastest?", "Under which conditions did the bubble move fastest?"]
WHY = "to stop air getting into its xylem and blocking the flow of water"
NOT_WHY = ["to stop water getting into its phloem and blocking the flow of sugar", "to keep its stomata open during the test",
           "to wash dust off its leaves so that they can photosynthesise", "to stop its cells taking in water by osmosis"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    rows, k = p["rows"], p["drawn"]
    d = int(rows[k]["dist"])
    r = rows[p["rate_row"]]
    rate = Fraction(str(r["dist"])) / MINUTES
    fast = max(rows, key=lambda row: row["dist"])
    cut = next(L for L, part in p["letters"].items() if part == "shoot")
    rn = exact(rate)
    qs = [short(f"{who} {rng.choice(VERBS)} a potometer with a leafy {p['plant']} shoot {rng.choice(SETTINGS)}. Use the scale beside "
                f'the capillary tube: how far did the bubble move in {MINUTES} minutes in the "{label(rows[k])}" test?', d, measure(d, "mm")),
          short(f'{friend} works out each rate (rate = distance ÷ time). What was the rate of water uptake in the "{label(r)}" test, '
                "in mm per minute?", rn, [rn, f"{rn} mm per minute", f"{rn} mm/min", f"{rn} mm/minute", f"{rn} mm min⁻¹"]),
          mcq(rng.choice(FASTEST), label(fast), [label(row) for row in rows if row is not fast], rng)]
    if p["cut"] == "why":
        qs.append(mcq(f"Part {cut} was cut under water before it was fitted into the potometer. Why?", WHY, rng.sample(NOT_WHY, 3), rng))
    else:
        letters = sorted(p["letters"])
        qs.append(Question("mcq", "Which letter shows the part that was cut under water before the potometer was set up?",
                           str(letters.index(cut)), letters))
    return qs
