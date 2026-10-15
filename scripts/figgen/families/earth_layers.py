"""Layers of the Earth, of its atmosphere, and of the vegetation up a mountain (LS, UP), lettered in a shuffled order
and never named, with every boundary's depth or height printed. Letters run from P on, so none matches an option's
own letter A to D (P3z review). Three sub-types:

- earth: a quarter of the Earth cut open from the surface to the centre (the crust drawn thicker than it is, and the
  figure says it is not to scale): crust, mantle, outer core and inner core, the depth of each boundary printed on the
  cut edge (crust 30 to 40 km, mantle to 2 890 or 2 900 km, outer core to 5 100 or 5 150 km, centre 6 370 or 6 371 km,
  as textbooks give them);
- atmosphere: a column from the ground to 120 km, to scale, on a height axis: troposphere (top at 8 to 16 km),
  stratosphere (to 48 or 50 km), mesosphere (to 80 or 85 km) and thermosphere, each boundary's height printed beside
  it; a mountain and clouds in the lowest layer;
- mountain: the vegetation zones up a high mountain in East Africa, lowest first: farmland, montane forest, bamboo,
  heath and moorland, alpine (altitude as a factor in where vegetation grows, as Rwanda's S1-S4 Vegetation units
  teach it), each zone drawn with its plants, the foot, every boundary and the peak printed in metres, an altitude
  scale, and a table of the zones' height ranges in a shuffled order (P3z review: plant symbols alone did not tell
  bamboo from grass, so a zone is found by reading its heights).

Which letter shows a layer or zone, by its name in the fixed order or by a fixed description a teacher would agree
with; the thickness of a layer (for the inner core, from its top to the centre) or the height a zone covers; the depth
or height of a boundary.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon

from ..core import INK, NAMES, measure, new_figure, short
from ._bio_parts import letter, letter_choice

ID = "earth_layers"
KIND = "geo.section"
SUBJECT = "geography"
BANDS = ("LS", "UP")
EARTH_CONCEPTS = ("geography.earth-structure",)
AIR_CONCEPTS = ("geography.atmospheric-layers", "geography.atmosphere-composition")
ZONE_CONCEPTS = ("geography.vegetation-distribution", "geography.vegetation-types",
                 "geography.vegetation-climate-relationship")
CONCEPTS = EARTH_CONCEPTS + AIR_CONCEPTS + ZONE_CONCEPTS
# A topic whose sections the book lists is reached only if its name or a section names the Earth's or the
# atmosphere's structure, the processes inside the Earth its layers explain, or vegetation.
NEEDS = (r"structure of the earth|internal structure|earth'?s (?:structure|interior|layers|crust)|\bcrust\b|"
         r"internal landform|tectonic|earthquake|volcan|atmospher|vegetation")

EARTH = ["crust", "mantle", "outer core", "inner core"]
AIR = ["troposphere", "stratosphere", "mesosphere", "thermosphere"]
ZONES = ["farmland", "montane forest", "bamboo", "heath and moorland", "alpine"]
# The fixed descriptions a letter question may ask by.
DESC = {"crust": "the thin, solid, rocky outer layer",
        "mantle": "the thick layer of hot rock in which convection currents flow",
        "outer core": "the layer of liquid iron and nickel",
        "inner core": "the solid ball of iron and nickel at the centre",
        "troposphere": "the layer in which almost all weather happens",
        "stratosphere": "the layer that holds the ozone layer",
        "mesosphere": "the layer in which most meteors burn up",
        "thermosphere": "the highest layer, where auroras are seen"}
FACE = {"crust": "#8c6d4f", "mantle": "#e59a57", "outer core": "#f3c654", "inner core": "#fcefb4",
        "troposphere": "#d9eefa", "stratosphere": "#bcdcf3", "mesosphere": "#a4c9ea", "thermosphere": "#c8c0e6",
        "farmland": "#ece0a8", "montane forest": "#6f9b58", "bamboo": "#b5d08a", "heath and moorland": "#c4ad86",
        "alpine": "#dcd8d0"}
AIR_TOP = 120


def concepts_for(p: dict) -> frozenset[str]:
    return frozenset({"earth": EARTH_CONCEPTS, "atmosphere": AIR_CONCEPTS, "mountain": ZONE_CONCEPTS}[p["kind"]])


def avoid_for(p: dict) -> str:
    """The Earth's layers stay out of weather chapters; the atmosphere's stay out of the Earth's interior; the
    mountain's zones out of chapters that share a vegetation concept but teach forestry, climate, soils, tourism,
    population or map work."""
    if p["kind"] == "earth":
        return r"weather|climate|atmospher|pollution"
    if p["kind"] == "mountain":
        return r"population|tourism|map work|forestry|regional|conservation|climate|soil|hydrograph|agricultur"
    # an ecosystem chapter names the atmosphere only as a part of the environment; IGCSE Geography's themes teach none
    return r"tectonic|earthquake|volcan|rock|ecosystem|geographical themes"


def _zones(rng: random.Random) -> list:
    """Zone boundaries in metres as textbooks give them for East Africa's high mountains, every one a whole hundred."""
    while True:
        foot = rng.choice([1200, 1400, 1500, 1600])
        b1 = rng.choice([2000, 2200, 2400])
        b2 = b1 + rng.choice([600, 700, 800])
        b3 = b2 + rng.choice([400, 500, 600])
        b4 = b3 + rng.choice([500, 600, 700, 800])
        peak = b4 + rng.choice([400, 500, 600])
        if peak <= 4900:
            return [foot, b1, b2, b3, b4, peak]


def _shuffled(rng: random.Random, names: list) -> list:
    """The table's rows, never in height order either way, so a zone is found by its heights."""
    while True:
        order = list(names)
        rng.shuffle(order)
        if order not in (names, names[::-1]):
            return order


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["earth", "atmosphere", "mountain"])
    if kind == "mountain":
        h = _zones(rng)
        letters = list("PQRST")
        rng.shuffle(letters)
        return {"band": rng.choice(BANDS), "kind": kind, "layers": [[z, h[i], h[i + 1]] for i, z in enumerate(ZONES)],
                "labels": dict(sorted(zip(letters, ZONES))), "table": _shuffled(rng, ZONES),
                "seed": rng.randint(1, 10 ** 6)}
    if kind == "earth":
        bounds = [rng.choice([30, 35, 40]), rng.choice([2890, 2900]), rng.choice([5100, 5150]), rng.choice([6370, 6371])]
        order = EARTH
    else:
        bounds = [rng.choice([8, 10, 11, 12, 15, 16]), rng.choice([48, 50]), rng.choice([80, 85]), AIR_TOP]
        order = AIR
    layers, top = [], 0
    for n, b in zip(order, bounds):
        layers.append([n, top, b])
        top = b
    letters = list("PQRS")
    rng.shuffle(letters)
    return {"band": rng.choice(BANDS), "kind": kind, "layers": layers, "labels": dict(sorted(zip(letters, order)))}


# --- drawing ----------------------------------------------------------------------------------------

def _km(v: int) -> str:
    return f"{v:,} km".replace(",", " ")


# Drawn radii of the quarter-Earth (radius 5), the crust thickened so it can be seen and lettered.
RADII = {"crust": (4.45, 5.0), "mantle": (2.72, 4.45), "outer core": (0.96, 2.72), "inner core": (0.0, 0.96)}
ANGLE = {"crust": 76, "mantle": 58, "outer core": 38, "inner core": 20}


def _ring(r0: float, r1: float, n: int = 60):
    out = [(r1 * math.cos(math.radians(90 * k / n)), r1 * math.sin(math.radians(90 * k / n))) for k in range(n + 1)]
    if r0 > 0:
        out += [(r0 * math.cos(math.radians(90 * k / n)), r0 * math.sin(math.radians(90 * k / n))) for k in range(n, -1, -1)]
    else:
        out.append((0.0, 0.0))
    return out


def _draw_earth(ax, p: dict) -> None:
    for n, (r0, r1) in RADII.items():
        ax.add_patch(Polygon(_ring(r0, r1), closed=True, facecolor=FACE[n], edgecolor=INK, linewidth=1.2, zorder=1,
                             gid=f"part:{n}"))
    # the depth of each boundary, on the cut edge from the surface down to the centre
    depths = [0] + [b for _, _, b in p["layers"]]
    for y, d in zip([5.0, 4.45, 2.72, 0.96, 0.0], depths):
        ax.plot([-0.18, 0.0], [y, y], color=INK, linewidth=1.0, zorder=2)
        ax.text(-0.3, y, _km(d), ha="right", va="center", fontsize=10, zorder=3, gid="depth")
    ax.text(-1.25, 5.75, "Depth below\nthe surface", ha="center", va="bottom", fontsize=9.5, zorder=3)
    ax.text(5.6, -0.42, "Not to scale", ha="right", va="center", fontsize=9, style="italic", zorder=3)
    for L, n in p["labels"].items():
        r0, r1 = RADII[n]
        a = math.radians(ANGLE[n])
        rm = (r0 + r1) / 2 if n != "inner core" else 0.55
        end = (rm * math.cos(a), rm * math.sin(a))
        at = (6.15 * math.cos(a), 6.15 * math.sin(a))
        letter(ax, L, at, end, gap=0.32, size=14, dot=True)
    ax.set_xlim(-2.6, 7.0)
    ax.set_ylim(-0.75, 6.75)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("The Earth cut open from the surface to the centre", fontsize=11)


X0, X1 = 0.7, 5.0  # the atmosphere's column


def _draw_air(ax, p: dict) -> None:
    span = {n: (t, b) for n, t, b in p["layers"]}
    for n, t, b in p["layers"]:
        ax.add_patch(Polygon([(X0, t), (X1, t), (X1, b), (X0, b)], closed=True, facecolor=FACE[n], edgecolor="none",
                             zorder=1, gid=f"part:{n}"))
    tropo = span["troposphere"][1]
    # a mountain and two clouds, low in the lowest layer
    peak = min(8.8, tropo - 1.2)
    ax.add_patch(Polygon([(X0 + 0.15, 0), (X0 + 1.05, peak), (X0 + 1.95, 0)], closed=True, facecolor="#8f8f8f",
                         edgecolor=INK, linewidth=0.8, zorder=1.5, gid="part:troposphere"))
    # km of height that look as long as one unit across, so the clouds' puffs are round on the page
    sp = ax.figure.subplotpars
    stretch = (5.6 * (sp.right - sp.left) / 8.6) / (6.4 * (sp.top - sp.bottom) / (AIR_TOP + 4))
    for cx in (X0 + 2.45, X0 + 3.3):
        cyl = min(4.0, tropo * 0.42)
        for dx, dy, w in ((-0.2, 0, 0.19), (0.0, 0.9, 0.22), (0.2, 0, 0.18)):
            pts = [(cx + dx + w * math.cos(k * math.pi / 12), cyl + dy + w * stretch * math.sin(k * math.pi / 12))
                   for k in range(24)]
            ax.add_patch(Polygon(pts, closed=True, facecolor="white", edgecolor="#777777", linewidth=0.6, zorder=1.6,
                                 gid="part:troposphere"))
    for n, t, b in p["layers"][:-1]:
        ax.plot([X0, X1], [b, b], color=INK, linewidth=1.1, zorder=2, gid="boundary")
        ax.text(X1 + 0.18, b, _km(b), ha="left", va="center", fontsize=10, zorder=3, gid="height")
    ax.plot([X0, X0, X1, X1], [AIR_TOP, 0, 0, AIR_TOP], color=INK, linewidth=1.2, zorder=2)
    for L, n in p["labels"].items():
        t, b = span[n]
        mid = (t + b) / 2
        letter(ax, L, (7.7, mid), (X1 - 0.35, mid), gap=0.32, size=14)
    ax.set_xlim(0, 8.6)
    ax.set_ylim(0, AIR_TOP + 4)
    ax.set_yticks(range(0, AIR_TOP + 1, 10))
    ax.tick_params(axis="y", labelsize=9)
    ax.spines["left"].set_bounds(0, AIR_TOP)
    ax.spines["bottom"].set_visible(False)
    ax.set_xticks([])
    ax.set_ylabel("Height above the ground (km)", fontsize=10)
    ax.set_title("The layers of the atmosphere", fontsize=11)


MID, HALF = 4.6, 4.0  # the mountain's centre and half its width, in drawing units


def _ground(x: float, foot: float, peak: float) -> float:
    u = min(1.0, abs(x - MID) / HALF)
    return foot + (peak - foot) * math.cos(math.pi / 2 * u) ** 1.3


def _side(h: float, foot: float, peak: float, sign: int) -> float:
    """Where the mountain's slope reaches height h, on the left (sign -1) or the right (+1)."""
    if h >= peak:
        return MID
    u = 2 / math.pi * math.acos(((h - foot) / (peak - foot)) ** (1 / 1.3))
    return MID + sign * u * HALF


MTN_W, MTN_H, MTN_X = 10.6, 5.8, (-2.4, 18.6)


def _draw_mountain(ax, p: dict) -> None:
    layers = p["layers"]
    foot, peak = layers[0][1], layers[-1][2]
    rng = random.Random(p["seed"])
    span = {n: (lo, hi) for n, lo, hi in layers}
    # metres that look one unit long on the page
    m_per_unit = (peak + 450 - (foot - 250)) / (MTN_H * 0.77) * (MTN_W * 0.775 / (MTN_X[1] - MTN_X[0]))
    for n, lo, hi in layers:
        xs = [_side(lo, foot, peak, -1) + (_side(lo, foot, peak, 1) - _side(lo, foot, peak, -1)) * k / 120
              for k in range(121)]
        top = [(x, min(hi, _ground(x, foot, peak))) for x in xs]
        ax.add_patch(Polygon(top + [(xs[-1], lo), (xs[0], lo)], closed=True, facecolor=FACE[n], edgecolor="none",
                             zorder=1, gid=f"part:{n}"))
    # each zone's plants, on its left side (the letters' leaders end on the right)
    for n, lo, hi in layers:
        band = hi - lo
        for _ in range(int(14 * band / 600) + 3):
            y = rng.uniform(lo + 0.22 * band, hi - 0.3 * band)
            x0, x1 = _side(y, foot, peak, -1) + 0.25, MID - 0.15
            if x1 - x0 < 0.3:
                continue
            x = rng.uniform(x0, x1)
            s = m_per_unit
            if n == "farmland":
                for d in (-0.12, 0, 0.12):
                    ax.plot([x + d, x + d], [y, y + 0.22 * s], color="#7a8a3a", linewidth=1.0, zorder=1.5)
            elif n == "montane forest":
                ax.plot([x, x], [y, y + 0.18 * s], color="#4a3520", linewidth=1.0, zorder=1.5)
                crown = [(x + 0.14 * math.cos(2 * math.pi * k / 16), y + 0.3 * s + 0.14 * s * math.sin(2 * math.pi * k / 16))
                         for k in range(16)]
                ax.add_patch(Polygon(crown, closed=True, facecolor="#3f6e34", edgecolor="#26401f", linewidth=0.5,
                                     zorder=1.5, gid=f"part:{n}"))
            elif n == "bamboo":
                for d in (-0.06, 0.04):
                    ax.plot([x + d, x + d], [y, y + 0.42 * s], color="#5f8a2f", linewidth=1.1, zorder=1.5)
                    for k in (1, 2):
                        ax.plot([x + d - 0.03, x + d + 0.03], [y + 0.14 * k * s] * 2, color="#3f6a1f", linewidth=0.8,
                                zorder=1.5)
            elif n == "heath and moorland":
                bush = [(x + 0.12 * math.cos(math.pi * k / 10), y + 0.1 * s * math.sin(math.pi * k / 10)) for k in range(11)]
                ax.add_patch(Polygon(bush, closed=True, facecolor="#7d6a3e", edgecolor="#4d3f22", linewidth=0.5,
                                     zorder=1.5, gid=f"part:{n}"))
            else:
                ax.plot([x], [y], marker="o", markersize=2.5, color="#77736a", zorder=1.5)
    # the boundaries, and every height printed beside the left slope
    for n, lo, hi in layers[:-1]:
        ax.plot([_side(hi, foot, peak, -1), _side(hi, foot, peak, 1)], [hi, hi], color=INK, linewidth=1.0, zorder=2,
                gid="boundary")
    outline = [(MID - HALF + 2 * HALF * k / 200, _ground(MID - HALF + 2 * HALF * k / 200, foot, peak)) for k in range(201)]
    ax.plot(*zip(*outline), color=INK, linewidth=1.4, zorder=2.5, gid="outline")
    ax.plot([MID - HALF - 0.4, MID + HALF + 0.4], [foot, foot], color=INK, linewidth=1.2, zorder=2.5, gid="plain")
    for h in [foot] + [hi for _, _, hi in layers[:-1]]:
        x = _side(h, foot, peak, -1) - 0.18 if h > foot else MID - HALF - 0.6
        ax.text(x, h, f"{h:,} m".replace(",", " "), ha="right", va="center", fontsize=10, zorder=3, gid="height")
    ax.text(MID, peak + 90, f"Peak {peak:,} m".replace(",", " "), ha="center", va="bottom", fontsize=10, zorder=3,
            gid="height")
    for L, n in p["labels"].items():
        lo, hi = span[n]
        mid = (lo + hi) / 2
        end = _side(mid, foot, peak, 1) - (0.3 if n != "alpine" else 0.12)
        letter(ax, L, (MID + HALF + 1.2, mid), (end, mid), gap=0.3, size=14)
    # the table of zones and their heights, in its own order: a compact framed box, so no row reads as a label
    # beside a letter
    m_per_inch = (peak + 450 - (foot - 250)) / (MTN_H * 0.77)
    step = 0.27 * m_per_inch
    tx, top = 11.15, (foot + peak) / 2 + 3.4 * step
    ax.add_patch(Polygon([(tx - 0.3, top + 0.35 * step), (MTN_X[1] - 0.15, top + 0.35 * step),
                          (MTN_X[1] - 0.15, top - 6.55 * step), (tx - 0.3, top - 6.55 * step)], closed=True,
                         facecolor="#f7f7f2", edgecolor=INK, linewidth=1.0, zorder=0.5, gid="table-box"))
    ax.text(tx, top, "Vegetation zones", ha="left", va="top", fontsize=10.5, fontweight="bold", gid="table-head")
    for k, n in enumerate(p["table"]):
        lo, hi = span[n]
        ax.text(tx, top - (k + 1.25) * step, f"{n.capitalize()}: {lo:,}–{hi:,} m".replace(",", " "), ha="left",
                va="top", fontsize=10, gid="table-row")
    # the altitude scale
    ticks = list(range(-(-foot // 500) * 500, peak + 1, 500))
    ax.set_yticks(ticks)
    ax.set_yticklabels([f"{t:,}".replace(",", " ") for t in ticks], fontsize=9)
    ax.spines["left"].set_bounds(foot, peak)
    ax.spines["bottom"].set_visible(False)
    ax.set_xticks([])
    ax.set_ylabel("Height above sea level (m)", fontsize=10)
    ax.set_xlim(*MTN_X)
    ax.set_ylim(foot - 250, peak + 450)
    ax.set_title("Vegetation zones on a high mountain in East Africa", fontsize=11)


def draw(p: dict):
    if p["kind"] == "mountain":
        fig, ax = new_figure(MTN_W, MTN_H)
        _draw_mountain(ax, p)
    elif p["kind"] == "earth":
        fig, ax = new_figure(6.6, 5.4)
        _draw_earth(ax, p)
    else:
        fig, ax = new_figure(5.6, 6.4)
        _draw_air(ax, p)
    return fig


# --- questions --------------------------------------------------------------------------------------

EARTH_INTROS = ["{name} drew this diagram of the inside of the Earth {setting}.",
                "{name} labelled the layers of the Earth on this diagram {setting}.",
                "{name} copied this cut-away diagram of the Earth {setting}.",
                "{name} made this drawing of the Earth's layers {setting}."]
AIR_INTROS = ["{name} drew this diagram of the layers of the atmosphere {setting}.",
              "{name} labelled the atmosphere's layers on this diagram {setting}.",
              "{name} copied this diagram of the atmosphere {setting}.",
              "{name} made this drawing of the layers of air above the Earth {setting}."]
ZONE_INTROS = ["{name} drew the vegetation zones on a high mountain {setting}.",
               "{name} copied this diagram of vegetation up a mountainside {setting}.",
               "{name} sketched how the vegetation changes with height on a mountain {setting}.",
               "{name} made this drawing of a mountain's vegetation zones {setting}."]
SETTINGS = ["for a geography lesson", "after a lesson in Huye", "for a revision card", "for the geography club in Musanze",
            "for homework", "for a class display in Kigali", "while revising for a test", "for a science fair in Rubavu"]


def questions(p: dict, rng: random.Random) -> list:
    layers, labels, kind = p["layers"], p["labels"], p["kind"]
    names = [n for n, _, _ in layers]
    at = {v: k for k, v in labels.items()}
    span = {n: (t, b) for n, t, b in layers}
    intros = {"earth": EARTH_INTROS, "atmosphere": AIR_INTROS, "mountain": ZONE_INTROS}[kind]
    intro = rng.choice(intros).format(name=rng.choice(NAMES), setting=rng.choice(SETTINGS))
    ask = rng.choice(names)
    i = names.index(ask)
    near = [at[names[j]] for j in (i - 1, i + 1) if 0 <= j < len(names)]
    rest = [at[n] for n in names if at[n] != at[ask] and at[n] not in near]
    rng.shuffle(rest)
    if kind == "mountain":
        qs = [letter_choice(f"{intro} The table gives each zone's heights. Which letter shows the {ask} zone?",
                            at[ask], near + rest)]
        n = rng.choice(names)
        size = span[n][1] - span[n][0]
        qs.append(short(f"How many metres of height does zone {at[n]} cover?", size, measure(size, "m")[1:]))
        k = rng.randrange(len(names) - 1)
        upper, lower = names[k], names[k + 1]
        height = span[upper][1]
        qs.append(short(f"At what height above sea level is the boundary between zone {at[upper]} and zone "
                        f"{at[lower]}?", height, measure(height, "m")[1:]))
        return qs
    what = f"the {ask}" if rng.random() < 0.5 else DESC[ask]
    qs = [letter_choice(f"{intro} Which letter shows {what}?", at[ask], near + rest)]
    n = rng.choice(names[:3] + (["inner core"] if kind == "earth" else []))
    size = span[n][1] - span[n][0]
    if n == "inner core":
        stem = f"How far is it from the top of layer {at[n]} to the centre of the Earth?"
    else:
        stem = f"How thick is layer {at[n]}?"
    qs.append(short(stem, size, measure(size, "km")[1:]))
    # the top layer's thickness is its lower boundary's depth: never ask both of one figure
    k = rng.choice([j for j in range(3) if not (j == 0 and n == names[0])])
    upper, lower = names[k], names[k + 1]
    where = "How deep below the surface" if kind == "earth" else "At what height above the ground"
    depth = span[upper][1]
    qs.append(short(f"{where} is the boundary between layer {at[upper]} and layer {at[lower]}?", depth,
                    measure(depth, "km")[1:]))
    return qs
