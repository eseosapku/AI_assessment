"""pH scale (LS, UP): a universal-indicator colour chart, pH 0 to 14 in six coloured bands named above it (red 0-2,
orange 3-4, yellow 5-6, green 7, blue 8-10, purple 11-14), and four lettered test tubes below. Three kinds:

- ph: four solutions measured with a pH meter, each tube's pH printed under it; the most acidic or alkaline, the one
  that would turn the indicator a named colour, how many are acidic or alkaline;
- colour: indicator added, each tube drawn in its colour with the colour's name under it; the most acidic or
  alkaline, the pH range of a tube's solution read from the chart, the neutral one or how many are acidic;
- oxides: the oxides of four elements W, X, Y and Z shaken with water, each pH printed; the one basic (or acidic)
  oxide, the most acidic or alkaline solution, the colour the indicator would turn.

The chart decides every colour: each band is one colour, so a pH reads to one colour name and back. No oxide gives
pH 7 (an insoluble oxide does too, and would be argued over), and one oxide is always the odd one out.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, count, new_figure
from ._bio_parts import letter_choice
from ..core import Question

ID = "ph_scale"
KIND = "diagram.template"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("ph-scale", "acid-base-indicators", "acids-and-bases", "oxygen-compounds"))
# Integrated Science teaches acids, alkalis and indicators too.
ALSO = ("science.acid-base-chemistry",)
# A topic whose sections the book lists is reached only if one names pH, acids, alkalis, indicators or analysis.
NEEDS = r"\bpH\b|acid|alkali|\bbases?\b|indicator|oxides|analy"
AVOID = (r"concentration|titration|\borganic|carboxylic|amine|amino|benzene|phenol|buffer|inorganic compounds|electroly|"
         r"equilibri|ester|alcohol|polymer|petro|group|solubility product|glossary")


def concepts_for(p: dict) -> tuple[str, ...]:
    """Oxides only where the tubes hold oxides."""
    return CONCEPTS if p["kind"] == "oxides" else CONCEPTS[:3]


def avoid_for(p: dict) -> str:
    """A chart of household solutions is no figure for a chapter on classifying oxides; one of oxides is."""
    return AVOID if p["kind"] == "oxides" else AVOID + r"|oxides"


UI = [("red", 0, 2), ("orange", 3, 4), ("yellow", 5, 6), ("green", 7, 7), ("blue", 8, 10), ("purple", 11, 14)]
HEX = {"red": "#d7301f", "orange": "#f28e2b", "yellow": "#f2d43d", "green": "#59a14f", "blue": "#4e79a7", "purple": "#7b3f9e"}
CLEAR = "#e4ebf0"  # a solution with no indicator in it
NEIGHBOURS = {"red": ["orange", "yellow", "purple"], "orange": ["red", "yellow", "green"], "yellow": ["orange", "green", "red"],
              "green": ["yellow", "blue", "orange"], "blue": ["purple", "green", "yellow"], "purple": ["blue", "red", "green"]}


def colour_of(ph: int) -> str:
    return next(n for n, lo, hi in UI if lo <= ph <= hi)


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["ph", "colour", "oxides"])
    if kind == "ph":
        while True:
            phs = rng.sample(range(15), 4)
            bands = [colour_of(v) for v in phs]
            if any(bands.count(b) == 1 for b in bands):
                break
        tubes = [[L, v] for L, v in zip("ABCD", phs)]
    elif kind == "colour":
        tubes = [[L, rng.randint(lo, hi)] for L, (_, lo, hi) in zip("ABCD", rng.sample(UI, 4))]
    else:
        acids = rng.choice([1, 3])
        phs = rng.sample(range(0, 7), acids) + rng.sample(range(8, 15), 4 - acids)
        rng.shuffle(phs)
        tubes = [[L, v] for L, v in zip("WXYZ", phs)]
    return {"band": rng.choice(BANDS), "kind": kind, "tubes": tubes}


# --- drawing ------------------------------------------------------------------------------------------

CELL = 0.9
BAR_Y = 7.0


def _tube(ax, cx: float, liquid: str, L: str) -> None:
    w, bottom, top, level = 0.9, 1.25, 5.0, 3.4
    r = w / 2
    import math
    arc = [(cx + r * math.cos(math.radians(a)), bottom + r + r * math.sin(math.radians(a))) for a in range(180, 361, 10)]
    fill = [(cx - r, level)] + arc + [(cx + r, level)]
    ax.add_patch(Polygon(fill, closed=True, facecolor=liquid, edgecolor="none", zorder=2, gid=f"liquid:{L}"))
    outline = [(cx - r, top)] + arc + [(cx + r, top)]
    xs, ys = zip(*outline)
    ax.plot(xs, ys, color=INK, linewidth=1.4, zorder=3, gid=f"tube:{L}")
    ax.plot([cx - r, cx + r], [level, level], color=INK, linewidth=0.8, zorder=3)  # the liquid's surface


def draw(p: dict):
    fig, ax = new_figure(7.2, 6.0)
    fig.subplots_adjust(left=0.02, right=0.98, top=0.98, bottom=0.02)
    total = 15 * CELL
    ax.text(total / 2, 9.45, "Universal indicator colour chart", ha="center", va="center", fontsize=12, fontweight="bold")
    for name, lo, hi in UI:
        for v in range(lo, hi + 1):
            ax.add_patch(Rectangle((v * CELL, BAR_Y), CELL, 0.9, facecolor=HEX[name], edgecolor=INK, linewidth=0.8,
                                   zorder=2, gid=f"cell:{v}"))
        x0, x1 = lo * CELL + 0.08, (hi + 1) * CELL - 0.08
        ax.plot([x0, x0, x1, x1], [8.02, 8.17, 8.17, 8.02], color=INK, linewidth=0.9)
        ax.text((x0 + x1) / 2, 8.55, name, ha="center", va="center", fontsize=10, gid=f"band:{name}")
    for v in range(15):
        ax.text((v + 0.5) * CELL, 6.68, str(v), ha="center", va="center", fontsize=10, gid=f"num:{v}")
    ax.text(0.0, 6.12, "← more acidic", ha="left", va="center", fontsize=9.5)
    ax.text(7.5 * CELL, 6.12, "neutral", ha="center", va="center", fontsize=9.5)
    ax.text(total, 6.12, "more alkaline →", ha="right", va="center", fontsize=9.5)
    ax.text(-0.15, 6.68, "pH", ha="right", va="center", fontsize=10, fontweight="bold")
    # the rack: a plank the tubes stand through, on two legs
    ax.add_patch(Rectangle((0.55, 3.95), total - 1.1, 0.3, facecolor="#d9c7a3", edgecolor=INK, linewidth=0.9, zorder=1))
    for x in (0.55, total - 0.85):
        ax.add_patch(Rectangle((x, 0.95), 0.3, 3.0, facecolor="#d9c7a3", edgecolor=INK, linewidth=0.9, zorder=1))
    for k, (L, v) in enumerate(p["tubes"]):
        cx = total / 2 + (k - 1.5) * 3.2
        _tube(ax, cx, HEX[colour_of(v)] if p["kind"] == "colour" else CLEAR, L)
        ax.text(cx, 0.72, f"oxide of {L}" if p["kind"] == "oxides" else L, ha="center", va="center", fontsize=13,
                fontweight="bold", gid=f"tubeletter:{L}")
        ax.text(cx, 0.15, colour_of(v) if p["kind"] == "colour" else f"pH {v}", ha="center", va="center", fontsize=10.5,
                gid=f"tubetag:{L}")
    ax.set_xlim(-0.9, total + 0.2)
    ax.set_ylim(-0.25, 9.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ----------------------------------------------------------------------------------------

SETTINGS = ["in the school laboratory", "during a lesson on acids and alkalis", "at the science club in Rubavu",
            "for a class practical in Huye", "in a chemistry practical in Musanze", "in the laboratory at a school in Rusizi",
            "for a project on everyday chemicals", "in a practical test in Kigali"]
WHAT = ["four solutions", "four household solutions", "four solutions from the kitchen", "four laboratory solutions"]


def _letters(tubes) -> list[str]:
    return [t[0] for t in tubes]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    tubes = dict(p["tubes"])
    letters = _letters(p["tubes"])
    setting = rng.choice(SETTINGS)
    acidic = sum(v < 7 for v in tubes.values())
    alkaline = sum(v > 7 for v in tubes.values())
    word = rng.choice(["acidic", "alkaline"])
    extreme = (min if word == "acidic" else max)(tubes, key=tubes.get)
    if p["kind"] == "ph":
        qs = [letter_choice(f"{who} measured the pH of {rng.choice(WHAT)} with a pH meter {setting}. "
                            f"Which tube holds the most {word} solution?", extreme, letters)]
        bands = [colour_of(v) for v in tubes.values()]
        colour = rng.choice(sorted({b for b in bands if bands.count(b) == 1}))
        key = next(L for L, v in tubes.items() if colour_of(v) == colour)
        qs.append(letter_choice(f"Which tube's solution would turn universal indicator {colour}, according to the colour chart?",
                                key, letters))
        ask = "alkaline" if word == "acidic" else "acidic"
        if (alkaline if ask == "alkaline" else acidic) == 0:
            ask = word
        qs.append(count(f"How many of the four solutions are {ask}?", alkaline if ask == "alkaline" else acidic, "solutions"))
        return qs
    if p["kind"] == "colour":
        qs = [letter_choice(f"{who} added universal indicator to {rng.choice(WHAT)} {setting}. Each tube is labelled with the "
                            f"colour it turned. Which tube holds the most {word} solution?", extreme, letters)]
        L = rng.choice([k for k, v in tubes.items() if v != 7])
        mine = colour_of(tubes[L])
        others = [colour_of(v) for k, v in tubes.items() if k != L] + [n for n, *_ in UI]
        ranges = {n: f"pH {lo} to {hi}" for n, lo, hi in UI}
        options = [ranges[mine]]
        for n in others:
            if n != "green" and ranges[n] not in options and len(options) < 4:
                options.append(ranges[n])
        rng.shuffle(options)
        qs.append(Question("mcq", f"Between which pH values is the solution in tube {L}, according to the colour chart?",
                           str(options.index(ranges[mine])), options))
        if 7 in tubes.values():
            key = next(k for k, v in tubes.items() if v == 7)
            qs.append(letter_choice("Which tube holds a neutral solution?", key, letters))
        else:
            ask = "acidic" if acidic else "alkaline"
            qs.append(count(f"How many of the tubes hold {ask} solutions?", acidic if ask == "acidic" else alkaline, "tubes"))
        return qs
    odd = "basic" if alkaline == 1 else "acidic"
    key = next(k for k, v in tubes.items() if (v > 7) == (odd == "basic"))
    qs = [letter_choice(f"{who} shook the oxides of four elements, W, X, Y and Z, with water {setting} and measured the pH of "
                        f"each solution. Which element's oxide is {'a basic' if odd == 'basic' else 'an acidic'} oxide?", key, letters)]
    most = "acidic" if odd == "basic" else "alkaline"
    qs.append(letter_choice(f"Which element's oxide gave the most {most} solution?",
                            (min if most == "acidic" else max)(tubes, key=tubes.get), letters))
    L = rng.choice(letters)
    mine = colour_of(tubes[L])
    options = [mine] + NEIGHBOURS[mine]
    rng.shuffle(options)
    qs.append(Question("mcq", f"What colour would universal indicator turn in the solution of the oxide of {L}?",
                       str(options.index(mine)), options))
    return qs
