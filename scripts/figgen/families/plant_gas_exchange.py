"""Gas exchange in plants (UP), two sub-types:

- indicator: four lettered tubes of hydrogencarbonate indicator, each with a leaf (in bright light, in the dark under
  foil, in dim light under gauze), no leaf, or a small snail, left for two hours; the colour each turned printed under
  it and drawn, with the indicator's key (yellow: more carbon dioxide than air; red: the same; purple: less). Which
  tube's leaf took in more carbon dioxide than it gave out, which gave out more than it took in, and which was
  photosynthesising as fast as it respired;
- stomata: the lower and upper epidermis of a leaf seen under a microscope, two fields of view of a printed area with
  the stomata drawn; how many stomata in the lower field, the stomatal density (number / area, printed), and how many
  more stomata the lower field has.

Every colour is the true result of its tube; each "which tube" has one right letter; densities come out whole.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Rectangle

from ..core import FILL_2, INK, NAMES, Question, new_figure, short

ID = "plant_gas_exchange"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("UP",)
CONCEPTS = tuple(f"biology.{c}" for c in ("gas-exchange", "photosynthesis", "aerobic-respiration",
                                           "stomata-lenticels-roots-structural-adaptations",
                                           "stomata-opening-closure-mechanisms", "leaf-internal-structure-photosynthesis"))
# A topic whose sections the book lists is reached only if one names gas exchange in plants, stomata or the indicator.
NEEDS = r"gas(?:eous)? exchange in plants|stomat|lenticel|hydrogen ?carbonate"
AVOID = (r"human|mammal|animal|insect|fish|enzyme|genetic|inherit|immun|disease|reproduc|ecolog|population|digest|"
         r"glossary|science in context|thinking and working scientifically|scientific method|science skills|sexual|"
         r"\bSTIs?\b|HIV|pregnancy|social factors")

# What each tube holds, and the colour the indicator turns after two hours (it starts red).
COLOUR = {"leaf, bright light": "purple", "leaf, dark": "yellow", "leaf, dim light": "red",
          "no leaf, bright light": "red", "snail, bright light": "yellow"}
LABEL = {"leaf, bright light": ["leaf", "bright light"], "leaf, dark": ["leaf", "dark (foil)"],
         "leaf, dim light": ["leaf", "dim light (gauze)"], "no leaf, bright light": ["no leaf", "bright light"],
         "snail, bright light": ["small snail", "bright light"]}
SHADE = {"purple": "#8e5bb0", "red": "#d65a4f", "yellow": "#efd35a"}
PLANTS = ["bean", "hibiscus", "cassava", "sunflower", "tomato"]
AREAS = [0.2, 0.25, 0.5]


def concepts_for(p: dict) -> tuple:
    if p["kind"] == "indicator":
        return tuple(f"biology.{c}" for c in ("gas-exchange", "photosynthesis", "aerobic-respiration"))
    return tuple(f"biology.{c}" for c in ("gas-exchange", "stomata-lenticels-roots-structural-adaptations",
                                          "stomata-opening-closure-mechanisms", "leaf-internal-structure-photosynthesis"))


def _spots(rng: random.Random, n: int) -> list:
    """n stomata inside the field, 0.3 apart at least (each stoma is 0.2 long), each turned a little."""
    while True:
        pts: list = []
        for _ in range(400):
            if len(pts) == n:
                return pts
            r, t = 0.8 * math.sqrt(rng.random()), rng.uniform(0, 2 * math.pi)
            x, y = round(r * math.cos(t), 3), round(r * math.sin(t), 3)
            if all(math.dist((x, y), q[:2]) >= 0.3 for q in pts):
                pts.append([x, y, rng.randint(-40, 40)])
        if len(pts) == n:
            return pts


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.5:
        extra = rng.sample(["leaf, dim light", "no leaf, bright light", "snail, bright light"], 2)
        conds = ["leaf, bright light", "leaf, dark"] + extra
        rng.shuffle(conds)
        return {"band": "UP", "kind": "indicator", "tubes": dict(zip("ABCD", conds)), "hours": rng.choice([2, 3]),
                "plant": rng.choice(PLANTS)}
    while True:
        low, high = rng.randint(5, 11), rng.randint(0, 5)
        if low - high >= 2:
            break
    return {"band": "UP", "kind": "stomata", "plant": rng.choice(PLANTS), "area": rng.choice(AREAS),
            "lower": _spots(rng, low), "upper": _spots(rng, high)}


# --- drawing -----------------------------------------------------------------------------------------------------

def _leaf(ax, x: float, y: float) -> None:
    ax.add_patch(Ellipse((x, y), 0.42, 0.2, angle=15, facecolor="#8fb07a", edgecolor=INK, linewidth=1.0, zorder=4))
    ax.plot([x - 0.18, x + 0.18], [y - 0.05, y + 0.05], color=INK, linewidth=0.8, zorder=5)


def _snail(ax, x: float, y: float) -> None:
    ax.add_patch(Ellipse((x - 0.02, y - 0.04), 0.4, 0.09, facecolor=FILL_2, edgecolor=INK, linewidth=1.0, zorder=4))
    ax.add_patch(Circle((x + 0.03, y + 0.05), 0.1, facecolor="#c9b48f", edgecolor=INK, linewidth=1.0, zorder=5))
    ax.add_patch(Circle((x + 0.03, y + 0.05), 0.045, facecolor="none", edgecolor=INK, linewidth=0.8, zorder=6))


def _draw_indicator(p: dict):
    fig, ax = new_figure(7.6, 5.4)
    for i, (letter, cond) in enumerate(p["tubes"].items()):
        x = 0.9 + 1.7 * i
        colour = COLOUR[cond]
        # the tube: glass, the indicator at the bottom, a gauze platform, a bung
        ax.add_patch(FancyBboxPatch((x - 0.27, 0.0), 0.54, 2.2, boxstyle="round,pad=0,rounding_size=0.2",
                                    facecolor="white", edgecolor=INK, linewidth=1.4, zorder=2))
        ax.add_patch(FancyBboxPatch((x - 0.25, 0.02), 0.5, 0.75, boxstyle="round,pad=0,rounding_size=0.18",
                                    facecolor=SHADE[colour], edgecolor="none", zorder=3))
        ax.plot([x - 0.27, x + 0.27], [1.05, 1.05], color=INK, linewidth=1.2, linestyle=(0, (1, 1)), zorder=4)
        ax.add_patch(Rectangle((x - 0.32, 2.2), 0.64, 0.25, facecolor="#555555", edgecolor=INK, linewidth=1.0, zorder=4))
        if cond.startswith("leaf"):
            _leaf(ax, x, 1.32)
        elif cond.startswith("snail"):
            _snail(ax, x, 1.22)
        if "dark" in cond:  # wrapped in foil
            ax.add_patch(Rectangle((x - 0.36, -0.05), 0.72, 2.31, facecolor="#3a3a3a", edgecolor=INK, linewidth=1.0,
                                   alpha=0.45, zorder=6, hatch="////"))
        if "dim" in cond:  # covered with gauze
            ax.add_patch(Rectangle((x - 0.36, -0.05), 0.72, 2.31, facecolor="none", edgecolor=INK, linewidth=0.8,
                                   zorder=6, hatch="..."))
        ax.text(x, 2.75, letter, ha="center", va="center", fontsize=15, fontweight="bold")
        what, light = LABEL[cond]
        ax.text(x, -0.3, what, ha="center", va="top", fontsize=10)
        ax.text(x, -0.62, light, ha="center", va="top", fontsize=10)
        ax.text(x, -0.98, f"turned {colour}", ha="center", va="top", fontsize=10, fontweight="bold")
    ax.text(0.45, -1.55, "Hydrogencarbonate indicator (red at the start):", ha="left", va="top", fontsize=10,
            fontweight="bold")
    ax.text(0.45, -1.9, "yellow = more carbon dioxide than in air", ha="left", va="top", fontsize=10)
    ax.text(0.45, -2.2, "red = the same carbon dioxide as in air", ha="left", va="top", fontsize=10)
    ax.text(0.45, -2.5, "purple = less carbon dioxide than in air", ha="left", va="top", fontsize=10)
    ax.set_xlim(0.2, 6.6)
    ax.set_ylim(-2.85, 3.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _stoma(ax, x: float, y: float, angle: float, s: float = 1.0) -> None:
    a = math.radians(angle)
    dx, dy = 0.045 * math.cos(a) * s, 0.045 * math.sin(a) * s
    for sign in (-1, 1):
        ax.add_patch(Ellipse((x + sign * dx, y + sign * dy), 0.075 * s, 0.2 * s, angle=angle, facecolor="#9fbf8a",
                             edgecolor=INK, linewidth=1.0, zorder=3))
    ax.add_patch(Ellipse((x, y), 0.022 * s, 0.13 * s, angle=angle, facecolor=INK, edgecolor="none", zorder=4))


def _draw_stomata(p: dict):
    fig, ax = new_figure(7.4, 4.6)
    for cx, title, pts in ((0.0, "Lower epidermis", p["lower"]), (2.5, "Upper epidermis", p["upper"])):
        ax.add_patch(Circle((cx, 0), 1.0, facecolor="#f2f5ee", edgecolor=INK, linewidth=1.6, zorder=1))
        for x, y, ang in pts:
            _stoma(ax, cx + x, y, ang, 1.2)
        ax.text(cx, 1.18, title, ha="center", va="bottom", fontsize=11, fontweight="bold")
    ax.text(1.25, -1.25, f"Area of each field of view = {p['area']} mm²", ha="center", va="top", fontsize=10)
    ax.text(1.25, -1.55, "stomatal density = number of stomata ÷ area of the field of view", ha="center", va="top",
            fontsize=10)
    _stoma(ax, 3.9, 0.95, 0, 1.2)
    ax.text(4.05, 0.95, "= one stoma", ha="left", va="center", fontsize=10)
    ax.set_xlim(-1.1, 4.95)
    ax.set_ylim(-1.9, 1.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_indicator(p) if p["kind"] == "indicator" else _draw_stomata(p)


# --- questions ---------------------------------------------------------------------------------------------------

SETTINGS = ["in a biology practical", "in the school laboratory", "for a class investigation", "at the science club"]


def _letters(stem: str, key: str, letters: list) -> Question:
    """A letter question with the letters in order, as an exam paper sets them."""
    return Question("mcq", stem, str(letters.index(key)), list(letters))


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "indicator":
        tubes = p["tubes"]
        letters = sorted(tubes)
        took = next(k for k, c in tubes.items() if COLOUR[c] == "purple")
        gave = next(k for k, c in tubes.items() if COLOUR[c] == "yellow" and c.startswith("leaf"))
        qs = [_letters(f"{who} set up four tubes of hydrogencarbonate indicator with pieces of {p['plant']} leaf "
                       f"{rng.choice(SETTINGS)} and left them for {p['hours']} hours. In which tube did the leaf take in "
                       f"more carbon dioxide than it gave out?", took, letters),
              _letters("In which tube did the leaf give out more carbon dioxide than it took in?", gave, letters)]
        same = [k for k, c in tubes.items() if COLOUR[c] == "red" and c.startswith("leaf")]
        if same:
            qs.append(_letters("In which tube were the leaf's photosynthesis and respiration going on at the same rate?",
                               same[0], letters))
        return qs
    low, high = len(p["lower"]), len(p["upper"])
    dens = Fraction(low) / Fraction(str(p["area"]))
    return [short(f"{who} looked at the lower and upper epidermis of a {p['plant']} leaf under a microscope "
                  f"{rng.choice(SETTINGS)}. How many stomata are in the field of view of the lower epidermis?", low,
                  [f"{low} stomata"]),
            short("What is the stomatal density of the lower epidermis, in stomata per mm²?", int(dens),
                  [f"{int(dens)} stomata per mm²", f"{int(dens)} per mm²", f"{int(dens)} stomata/mm²", f"{int(dens)}/mm²"]),
            short("How many more stomata are there in the field of view of the lower epidermis than in that of the "
                  "upper epidermis?", low - high, [f"{low - high} stomata"])]
