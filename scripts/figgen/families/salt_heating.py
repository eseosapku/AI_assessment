"""The action of heat on a salt (LS): a metal carbonate heated in a boiling tube over a Bunsen burner, the gas led
through a delivery tube into limewater (drawn milky), and the class's results table beside it. Two kinds:

- single: the mass of the empty tube, of the tube and salt before heating, and of the tube and solid after heating;
  the mass of salt heated, the mass of gas given off, the mass of solid left;
- repeat: the tube weighed after each of several heatings until its mass stopped changing; the mass once it stopped
  changing, the total mass of gas given off, the mass lost in the first heating.

The masses obey the chemistry: copper(II), zinc and magnesium carbonates (Ar Cu 64, Zn 65, Mg 24, C 12, O 16) lose
exactly 44/124, 44/125 and 44/84 of their mass as carbon dioxide, so the final mass is the oxide's. Every answer is a
subtraction of two printed masses.
"""
from __future__ import annotations

import math
import random
from decimal import Decimal

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "salt_heating"
KIND = "table.data"
SUBJECT = "chemistry"
BANDS = ("LS",)
CONCEPTS = tuple(f"chemistry.{c}" for c in ("salts", "laboratory-techniques"))
# A topic whose sections the book lists is reached only if one names heating salts or carbonates.
NEEDS = r"action of heat|heating|decompos"
AVOID = r"\borganic|petro|polymer|electroly|equilibri|\brates?\b|concentration|titration|glossary"
# carbonate: (formula mass, the oxide's formula mass, colour before heating)
CARBONATES = {"copper(II) carbonate": (124, 80, "#5aa469"), "zinc carbonate": (125, 81, "#f2f2f2"),
              "magnesium carbonate": (84, 40, "#f2f2f2")}
UNITS = {"copper(II) carbonate": (Decimal("1.24"), range(2, 7)), "zinc carbonate": (Decimal("1.25"), range(2, 6)),
         "magnesium carbonate": (Decimal("0.84"), range(3, 9))}


def _g(x: Decimal) -> str:
    return f"{x:.2f}"


def sample(rng: random.Random) -> dict:
    salt = rng.choice(list(CARBONATES))
    M, oxide, _ = CARBONATES[salt]
    unit, ks = UNITS[salt]
    mass = unit * rng.choice(list(ks))  # a whole number of "units", so the gas lost is exact to 0.01 g
    left = mass * oxide / M
    empty = Decimal(rng.randint(1800, 2900)) / 100
    before, final = empty + mass, empty + left
    kind = rng.choice(["single", "repeat"])
    if kind == "single":
        after = [final]
    else:
        n = rng.choice([4, 5])
        stop = rng.randint(2, n - 1)  # the heating whose weighing first shows the final mass
        loss = before - final
        fractions = sorted(rng.sample(range(5, 60, 5), stop - 1), reverse=True)
        after = [final + (loss * f / 100).quantize(Decimal("0.01")) for f in fractions] + [final] * (n - stop + 1)
    return {"band": "LS", "kind": kind, "salt": salt, "empty": _g(empty), "before": _g(before), "after": [_g(a) for a in after]}


# --- drawing ------------------------------------------------------------------------------------------------------

def _tube(ax, colour: str) -> None:
    """The boiling tube lying level, its closed end on the left, the salt along its bottom."""
    y, r, x0, x1 = 3.0, 0.32, 0.4, 3.7
    arc = [(x0 + r - r * math.sin(math.radians(a)), y + r * math.cos(math.radians(a))) for a in range(0, 181, 10)]
    ax.plot([x1, x0 + r] + [p[0] for p in arc] + [x1], [y + r, y + r] + [p[1] for p in arc] + [y - r], color=INK,
            linewidth=1.4, zorder=3)
    salt = [(0.48, y - 0.12), (0.62, y - 0.24), (0.8, y - 0.3), (2.1, y - 0.3), (2.25, y - 0.16), (1.9, y - 0.08), (0.6, y - 0.06)]
    ax.add_patch(Polygon(salt, closed=True, facecolor=colour, edgecolor=INK, linewidth=0.8, zorder=2, gid="salt"))
    ax.add_patch(Rectangle((x1 - 0.05, y - 0.36), 0.42, 0.72, facecolor="#7a6a5a", edgecolor=INK, linewidth=1.0, zorder=4))


def _apparatus(ax, colour: str) -> None:
    import random as _r
    # clamp stand: base, rod and clamp holding the tube near its mouth
    ax.add_patch(Rectangle((2.65, -0.75), 1.3, 0.18, facecolor="#9a9a9a", edgecolor=INK, linewidth=1.0))
    ax.plot([3.3, 3.3], [-0.57, 2.6], color=INK, linewidth=2.6)
    _tube(ax, colour)
    ax.add_patch(Rectangle((3.12, 2.6), 0.36, 0.8, facecolor="#c8c8c8", edgecolor=INK, linewidth=1.0, zorder=5))
    # Bunsen burner and its flame under the salt
    ax.add_patch(Rectangle((0.75, -0.57), 1.0, 0.16, facecolor="#9a9a9a", edgecolor=INK, linewidth=1.0))
    ax.add_patch(Rectangle((1.1, -0.41), 0.3, 1.75, facecolor="#cfcfcf", edgecolor=INK, linewidth=1.0))
    ax.add_patch(Polygon([(1.08, 1.36), (1.25, 2.5), (1.42, 1.36)], closed=True, facecolor="#7fb2e5", edgecolor="#3f6fa8",
                         linewidth=1.0))
    # delivery tube into the limewater
    ax.plot([4.07, 5.1, 5.1], [3.0, 3.0, 0.75], color=INK, linewidth=2.2, zorder=3)
    tx, w, bottom, top, level = 5.1, 0.85, 0.3, 2.45, 1.75
    r = w / 2
    arc = [(tx + r * math.cos(math.radians(a)), bottom + r + r * math.sin(math.radians(a))) for a in range(180, 361, 10)]
    ax.add_patch(Polygon([(tx - r, level)] + arc + [(tx + r, level)], closed=True, facecolor="#f4f4f0", edgecolor="none", zorder=1))
    dots = _r.Random(7)
    xs, ys = [], []
    while len(xs) < 45:
        x, y = tx - r + dots.random() * w, bottom + dots.random() * (level - bottom)
        if (x - tx) ** 2 + max(0.0, bottom + r - y) ** 2 < (r - 0.08) ** 2 and abs(x - tx) > 0.08:
            xs.append(x)
            ys.append(y)
    ax.scatter(xs, ys, s=4, color="#9a9a9a", zorder=2, gid="milky")
    ax.plot([tx - r, tx - r] + [p[0] for p in arc] + [tx + r, tx + r], [top, bottom + r] + [p[1] for p in arc] + [bottom + r, top],
            color=INK, linewidth=1.4, zorder=3)
    ax.plot([tx - r, tx + r], [level, level], color=INK, linewidth=0.8, zorder=3)


def _label(ax, text: str, xy: tuple, at: tuple, key: str, ha: str = "left") -> None:
    ax.plot([xy[0], at[0]], [xy[1], at[1]], color=INK, linewidth=0.8, gid=f"leader:{key}")
    ax.text(at[0] + (0.08 if ha == "left" else -0.08), at[1], text, ha=ha, va="center", fontsize=10, gid=f"label:{key}")


def draw(p: dict):
    _, _, colour = CARBONATES[p["salt"]]
    fig, ax = new_figure(10.6, 5.2)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    _apparatus(ax, colour)
    _label(ax, p["salt"], (1.4, 2.78), (1.9, 4.75), "salt")
    _label(ax, "Bunsen burner", (1.1, 0.6), (0.65, 0.6), "burner", ha="right")
    _label(ax, "limewater", (5.4, 1.2), (5.85, 1.2), "limewater")
    _label(ax, "delivery tube", (4.6, 3.0), (4.9, 3.85), "delivery")
    # the results table
    rows = [("Mass of the empty boiling tube", p["empty"]), ("Mass of tube + salt before heating", p["before"])]
    if p["kind"] == "single":
        rows.append(("Mass of tube + solid after heating", p["after"][0]))
    else:
        nth = ["first", "second", "third", "fourth", "fifth"]
        rows += [(f"Mass after the {nth[k]} heating", a) for k, a in enumerate(p["after"])]
    x0, x1, x2 = 7.2, 11.6, 12.9
    h = 0.52
    ytop = 4.4
    ax.text((x0 + x2) / 2, ytop + 0.35, "Results", ha="center", va="bottom", fontsize=11, fontweight="bold")
    for k, (what, value) in enumerate(rows):
        y = ytop - h * (k + 1)
        for a, b in ((x0, x1), (x1, x2)):
            ax.add_patch(Rectangle((a, y), b - a, h, facecolor="white", edgecolor=INK, linewidth=0.9))
        ax.text(x0 + 0.12, y + h / 2, what, ha="left", va="center", fontsize=10)
        ax.text((x1 + x2) / 2, y + h / 2, f"{value} g", ha="center", va="center", fontsize=10)
    ax.set_xlim(-1.0, x2 + 0.1)
    ax.set_ylim(-0.85, 5.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in the school laboratory", "during a lesson on salts", "in a chemistry practical in Huye",
            "at the science club in Rubavu", "for a class investigation in Musanze", "in a practical test in Kigali"]
VERBS = ["heated", "strongly heated", "heated a sample of"]


def _grams(x: Decimal) -> tuple[str, list[str]]:
    v = f"{x:.2f}"
    forms = [v, f"{v} g", f"{v}g", f"{v} grams"]
    short_form = format(x.normalize(), "f")
    if short_form != v:
        forms += [short_form, f"{short_form} g"]
    return v, forms


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    empty, before = Decimal(p["empty"]), Decimal(p["before"])
    after = [Decimal(a) for a in p["after"]]
    salt = p["salt"]
    first = f"{who} {rng.choice(VERBS)} {salt} {rng.choice(SETTINGS)} and recorded the results in the table."
    if p["kind"] == "single":
        picks = [("mass", f"What mass of {salt} was heated?", before - empty),
                 ("gas", "What mass of gas was given off?", before - after[0]),
                 ("left", "What mass of solid was left in the tube after heating?", after[0] - empty)]
    else:
        picks = [("mass", f"What mass of {salt} was heated?", before - empty),
                 ("stop", "What was the mass of the tube and its contents once it stopped changing?", after[-1]),
                 ("gas", "What total mass of gas was given off?", before - after[-1]),
                 ("first", "How much mass was lost in the first heating?", before - after[0])]
        picks = [picks[0]] + rng.sample(picks[1:], 2)
    rng.shuffle(picks)
    qs = []
    for k, (_, stem, value) in enumerate(picks):
        key, forms = _grams(value)
        qs.append(short(f"{first} {stem}" if k == 0 else stem, key, forms))
    return qs
