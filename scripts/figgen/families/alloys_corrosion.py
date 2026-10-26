"""Metals, alloys and rusting (UP): what the IGCSE chapter on metallic elements and alloys draws. Three kinds:

- particles: three lettered diagrams of solids, 20 atoms each: a pure metal, the metal it is alloyed with, and the
  alloy, the added atoms a different size and shade (a key names each); which diagram is the alloy, the percentage of
  the alloy's atoms that are the added metal's, how many atoms of a metal the alloy diagram holds;
- composition: a table of four alloys and their typical composition by mass (brass 70% copper 30% zinc, bronze 90/10,
  solder 60% tin 40% lead, cupronickel 75/25, 18/8 stainless steel); the mass of a metal in an object of stated mass,
  the mass of a piece holding a stated mass of a metal, how many of the alloys contain a metal;
- rusting: four lettered test tubes, each an iron nail under conditions drawn and named under it (tap water open to
  the air, salt water, boiled water under a layer of oil, dry air over calcium chloride, a painted or zinc-coated nail
  in tap water); how many nails rust, which rusts fastest (salt water) or which one rusts, and why a named tube's nail
  does not (no air, no water, or a coat keeps both off).

Iron rusts only with both water and air (oxygen); the drawing decides which tube has which.
"""
from __future__ import annotations

import math
import random
import textwrap

from matplotlib.patches import Circle, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, Question, count, new_figure, short
from ._bio_parts import letter_choice

ID = "alloys_corrosion"
KIND = "chem.particle"
SUBJECT = "chemistry"
BANDS = ("UP",)
CONCEPTS = tuple(f"chemistry.{c}" for c in ("alloys", "corrosion"))
# A topic whose sections the book lists is reached only if one names alloys, metals, rusting or corrosion.
NEEDS = r"alloy|metals?\b|metallic|rust|corros"
AVOID = r"\borganic|polymer|petro|equilibri|\brates?\b|glossary"


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"particles": ("chemistry.alloys",), "composition": ("chemistry.alloys",),
            "rusting": ("chemistry.corrosion",)}[p["kind"]]


def avoid_for(p: dict) -> str:
    """Rusting tubes are no figure for a chapter on the structure of matter, nor alloy diagrams for one on cells."""
    return AVOID + (r"|matter|bonding" if p["kind"] == "rusting" else r"|electrochem")


# alloy: (main metal, added metal, radius of a main atom, radius of an added atom, shade of each)
PARTICLE_ALLOYS = {"brass": ("copper", "zinc", 0.40, 0.47), "bronze": ("copper", "tin", 0.40, 0.49),
                   "magnalium": ("aluminium", "magnesium", 0.40, 0.47), "solder": ("tin", "lead", 0.42, 0.49)}
COMPOSITION = {"brass": [("copper", 70), ("zinc", 30)], "bronze": [("copper", 90), ("tin", 10)],
               "solder": [("tin", 60), ("lead", 40)], "cupronickel": [("copper", 75), ("nickel", 25)],
               "stainless steel": [("iron", 74), ("chromium", 18), ("nickel", 8)]}
OBJECTS = {"brass": ["door handle", "trumpet", "padlock"], "bronze": ["medal", "small statue", "bell"],
           "solder": ["reel of solder wire", "stick of solder"], "cupronickel": ["bag of coins", "coin collection"],
           "stainless steel": ["cooking pot", "set of spoons", "kitchen sink"]}
CONDITIONS = ["tap water", "salt water", "boiled water under oil", "dry air", "painted nail in tap water",
              "zinc-coated nail in tap water"]
RUSTS = {"tap water": True, "salt water": True, "boiled water under oil": False, "dry air": False,
         "painted nail in tap water": False, "zinc-coated nail in tap water": False}
LABELS = {"tap water": "tap water,\nopen to the air", "salt water": "salt water,\nopen to the air",
          "boiled water under oil": "boiled water\nunder a layer of oil", "dry air": "dry air over\ncalcium chloride",
          "painted nail in tap water": "painted nail in\ntap water", "zinc-coated nail in tap water": "zinc-coated nail\nin tap water"}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["particles", "composition", "rusting"])
    if kind == "particles":
        alloy = rng.choice(sorted(PARTICLE_ALLOYS))
        k = rng.randint(2, 6)
        spots = sorted(rng.sample(range(20), k))
        order = ["main", "added", "alloy"]
        rng.shuffle(order)
        return {"band": "UP", "kind": kind, "alloy": alloy, "spots": spots, "order": order}
    if kind == "composition":
        return {"band": "UP", "kind": kind, "alloys": sorted(rng.sample(sorted(COMPOSITION), 4), key=list(COMPOSITION).index)}
    while True:
        conds = rng.sample(CONDITIONS, 4)
        if "tap water" in conds or "salt water" in conds:
            break
    return {"band": "UP", "kind": kind, "tubes": [[L, c] for L, c in zip("ABCD", conds)]}


# --- drawing ------------------------------------------------------------------------------------------------------

def _box(ax, x0: float, letter: str, atoms: list[tuple[float, float, float, str, str]]) -> None:
    ax.add_patch(Rectangle((x0, 0), 5.6, 4.6, facecolor="white", edgecolor=INK, linewidth=1.2))
    for x, y, r, element, shade in atoms:
        ax.add_patch(Circle((x0 + x, y), r, facecolor=shade, edgecolor=INK, linewidth=0.9, gid=f"atom:{letter}:{element}"))
    ax.text(x0 + 2.8, -0.45, letter, ha="center", va="center", fontsize=14, fontweight="bold")


def _particles(p: dict):
    main, added, rm, ra = PARTICLE_ALLOYS[p["alloy"]]
    shade = {main: FILL, added: "white"}
    fig, ax = new_figure(9.4, 4.4)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    grid = [(0.8 + c, 0.8 + r) for r in range(4) for c in range(5)]
    for k, what in enumerate(p["order"]):
        letter = "ABC"[k]
        if what == "main":
            atoms = [(x, y, rm, main, shade[main]) for x, y in grid]
        elif what == "added":
            atoms = [(x, y, ra, added, shade[added]) for x, y in grid]
        else:
            atoms = [(x, y, ra if i in p["spots"] else rm, added if i in p["spots"] else main,
                      shade[added] if i in p["spots"] else shade[main]) for i, (x, y) in enumerate(grid)]
        _box(ax, 6.4 * k, letter, atoms)
    for k, el in enumerate((main, added)):
        x = 4.0 + 7.0 * k
        ax.add_patch(Circle((x, -1.3), 0.25, facecolor=shade[el], edgecolor=INK, linewidth=0.9))
        ax.text(x + 0.45, -1.3, f"{el} atom", ha="left", va="center", fontsize=11)
    ax.set_xlim(-0.2, 6.4 * 3 - 0.6)
    ax.set_ylim(-1.75, 4.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _composition(p: dict):
    fig, ax = new_figure(7.2, 3.6)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.88, bottom=0.01)
    rows = [("Alloy", "Metals in it (percentage by mass)")] + \
           [(a, ", ".join(f"{m} {v}%" for m, v in COMPOSITION[a])) for a in p["alloys"]]
    h, x0, x1, x2 = 0.75, 0.0, 3.0, 10.4
    for k, (a, b) in enumerate(rows):
        y = (len(rows) - 1 - k) * h
        shade = "#e9edf0" if k == 0 else "white"
        for (u, v), text in (((x0, x1), a), ((x1, x2), b)):
            ax.add_patch(Rectangle((u, y), v - u, h, facecolor=shade, edgecolor=INK, linewidth=0.9))
            ax.text(u + 0.2, y + h / 2, text, ha="left", va="center", fontsize=11, fontweight="bold" if k == 0 else "normal")
    ax.set_title("The composition of some alloys", fontsize=12, fontweight="bold")
    ax.set_xlim(-0.05, x2 + 0.05)
    ax.set_ylim(-0.05, len(rows) * h + 0.05)
    ax.axis("off")
    return fig


def _nail(ax, cx: float, bottom: float, top: float, colour: str) -> None:
    ax.add_patch(Polygon([(cx - 0.07, top), (cx - 0.07, bottom + 0.25), (cx, bottom), (cx + 0.07, bottom + 0.25),
                          (cx + 0.07, top)], closed=True, facecolor=colour, edgecolor=INK, linewidth=0.9, zorder=4))
    ax.add_patch(Rectangle((cx - 0.22, top), 0.44, 0.1, facecolor=colour, edgecolor=INK, linewidth=0.9, zorder=4))


def _rust_tube(ax, cx: float, cond: str, L: str) -> None:
    w, bottom, top = 1.2, 0.0, 4.6
    r = w / 2
    arc = [(cx + r * math.cos(math.radians(a)), bottom + r + r * math.sin(math.radians(a))) for a in range(180, 361, 10)]
    water = {"tap water": "#d6e6f2", "salt water": "#cfdfe9", "boiled water under oil": "#d6e6f2",
             "painted nail in tap water": "#d6e6f2", "zinc-coated nail in tap water": "#d6e6f2"}.get(cond)
    if water:
        level = 3.0
        ax.add_patch(Polygon([(cx - r, level)] + arc + [(cx + r, level)], closed=True, facecolor=water, edgecolor="none", zorder=1))
        if cond == "boiled water under oil":
            ax.add_patch(Rectangle((cx - r, level), w, 0.4, facecolor="#f2d27a", edgecolor="none", zorder=1))
            ax.plot([cx - r, cx + r], [level + 0.4, level + 0.4], color=INK, linewidth=0.8, zorder=3)
        ax.plot([cx - r, cx + r], [level, level], color=INK, linewidth=0.8, zorder=3)
        nail_bottom = 0.45
    else:  # dry air: calcium chloride at the bottom under cotton wool, a bung at the top
        ax.add_patch(Polygon([(cx - r, 1.0)] + arc + [(cx + r, 1.0)], closed=True, facecolor="#eeeeee", edgecolor="none", zorder=1))
        rnd = random.Random(int(cx * 10))
        for _ in range(16):
            x, y = cx + (rnd.random() - 0.5) * (w - 0.35), 0.3 + rnd.random() * 0.6
            ax.add_patch(Circle((x, y), 0.07, facecolor="#9a9a9a", edgecolor="none", zorder=2))
        ax.add_patch(Rectangle((cx - r, 1.0), w, 0.35, facecolor="white", edgecolor=INK, linewidth=0.8, hatch="..", zorder=2))
        ax.add_patch(Rectangle((cx - r - 0.06, top - 0.5), w + 0.12, 0.6, facecolor="#7a6a5a", edgecolor=INK, linewidth=1.0, zorder=5))
        nail_bottom = 1.6
    colour = {"painted nail in tap water": "#c0504d", "zinc-coated nail in tap water": "#a9b8c6"}.get(cond, "#6b6b6b")
    _nail(ax, cx, nail_bottom, 3.95 if cond != "dry air" else 3.7, colour)
    ax.plot([cx - r, cx - r] + [q[0] for q in arc] + [cx + r, cx + r], [top, bottom + r] + [q[1] for q in arc] + [bottom + r, top],
            color=INK, linewidth=1.4, zorder=3)
    ax.text(cx, -0.45, L, ha="center", va="center", fontsize=14, fontweight="bold")
    ax.text(cx, -0.85, LABELS[cond], ha="center", va="top", fontsize=10, linespacing=1.2)


def _rusting(p: dict):
    fig, ax = new_figure(8.8, 4.6)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    for k, (L, cond) in enumerate(p["tubes"]):
        _rust_tube(ax, 1.5 + 3.0 * k, cond, L)
    ax.text(6.0, 5.3, "Iron nails left for one week", ha="center", va="center", fontsize=12, fontweight="bold")
    ax.set_xlim(-0.1, 12.1)
    ax.set_ylim(-2.0, 5.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"particles": _particles, "composition": _composition, "rusting": _rusting}[p["kind"]](p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a chemistry lesson", "for homework", "on a revision card", "at the science club in Huye",
            "for a class test in Musanze", "in a lesson on metals in Kigali"]
RUST_SETTINGS = ["in the school laboratory", "for a class investigation in Huye", "at the science club in Rubavu",
                 "for a project on rusting", "in a chemistry practical in Musanze", "in the laboratory at a school in Kigali"]
WHY = ["there is no air in the tube", "there is no water in the tube", "a coat keeps air and water off the iron"]
WHY_KEY = {"boiled water under oil": WHY[0], "dry air": WHY[1], "painted nail in tap water": WHY[2],
           "zinc-coated nail in tap water": WHY[2]}


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "particles":
        main, added, *_ = PARTICLE_ALLOYS[p["alloy"]]
        alloy = "ABC"[p["order"].index("alloy")]
        k = len(p["spots"])
        qs = [letter_choice(f"{who} drew the atoms in three solid metals {rng.choice(SETTINGS)}. Which diagram shows an alloy?",
                            alloy, list("ABC"))]
        qs.append(short(f"What percentage of the atoms in the alloy are {added} atoms?", 5 * k,
                        [str(5 * k), f"{5 * k}%", f"{5 * k} %", f"{5 * k} percent"]))
        el, n = rng.choice([(main, 20 - k), (added, k)])
        qs.append(count(f"How many {el} atoms are drawn in diagram {alloy}?", n, f"{el} atoms", "atoms"))
        return qs
    if p["kind"] == "composition":
        alloys = p["alloys"]
        a = rng.choice(alloys)
        metal, pct = rng.choice(COMPOSITION[a])
        mass = rng.choice([m for m in range(100, 1001, 50) if m * pct % 100 == 0])
        grams = mass * pct // 100
        qs = [short(f"{who} looks at a {rng.choice(OBJECTS[a])} made of {a}, which {rng.choice(['has a mass of', 'weighs'])} "
                    f"{mass} g. What mass of {metal} does it contain?", grams, [str(grams), f"{grams} g", f"{grams}g", f"{grams} grams"])]
        b = rng.choice([x for x in alloys if x != a])
        metal_b, pct_b = rng.choice(COMPOSITION[b])
        whole = rng.choice([m for m in range(100, 1001, 50) if m * pct_b % 100 == 0])
        part = whole * pct_b // 100
        qs.append(short(f"A piece of {b} contains {part} g of {metal_b}. What is the mass of the piece?", whole,
                        [str(whole), f"{whole} g", f"{whole}g", f"{whole} grams"]))
        metals = sorted({m for x in alloys for m, _ in COMPOSITION[x]})
        m = rng.choice(metals)
        qs.append(count(f"How many of the alloys in the table contain {m}?", sum(m in dict(COMPOSITION[x]) for x in alloys),
                        "alloys"))
        return qs
    tubes = dict(p["tubes"])
    letters = list(tubes)
    rusty = [L for L, c in tubes.items() if RUSTS[c]]
    qs = [count(f"{who} set up these four test tubes {rng.choice(RUST_SETTINGS)} and left them for a week. How many of the nails "
                "will rust?", len(rusty), "nails")]
    if "salt water" in tubes.values() and len(rusty) > 1:
        qs.append(letter_choice("In which tube will the nail rust fastest?", next(L for L in letters if tubes[L] == "salt water"),
                                letters))
    elif len(rusty) == 1:
        qs.append(letter_choice("Which nail will rust?", rusty[0], letters))
    safe = [L for L in letters if not RUSTS[tubes[L]]]
    if safe:
        L = rng.choice(safe)
        options = list(WHY)
        rng.shuffle(options)
        qs.append(Question("mcq", f"The nail in tube {L} does not rust. Why not?", str(options.index(WHY_KEY[tubes[L]])),
                           options))
    return qs
