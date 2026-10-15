"""Soil profiles (LS, UP), drawn as the side of a pit or cutting with its layers as bands, lettered P to T in a
shuffled order (never by their names), and a depth scale down the side on whose labelled ticks every boundary lies.
Two sub-types:

- soil: a soil pit as geography textbooks draw it, from the plants on the surface down to the bedrock: a layer of
  leaf litter under trees or grass (none on a ploughed field), the dark topsoil full of roots, the paler subsoil with
  a few stones, the weathered parent rock broken into pieces, and the solid bedrock with its joints; in centimetres,
  ticks every 10 cm;
- weathering (UP): the deep weathering profile of the humid tropics, in a road cutting: soil, rock rotted to clay
  and sand by chemical weathering (the thickest layer), partly weathered rock with rounded corestones, and the solid
  bedrock beneath the weathering front; in metres, ticks every 2 m.

A table beside the drawing names every layer and says what it looks like (in a shuffled order, with no letters), so
the names the questions use are the figure's own (P3z review: "topsoil" and "weathering front" were never defined).
The weathering front is drawn as a dashed line and labelled.

Which letter shows a named layer (found by matching the table's description to the drawing); the depth of the
boundary between two lettered layers, or of the weathering front; the thickness of a lettered layer.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, measure, new_figure, short
from ._bio_parts import letter, letter_choice

ID = "soil_profile"
KIND = "geo.section"
SUBJECT = "geography"
BANDS = ("LS", "UP")
SOIL_CONCEPTS = tuple(f"geography.{c}" for c in ("soil-profile-catena", "soil-formation", "soil-properties",
                                                 "soil-definition", "soil-types-distribution"))
WEATHER_CONCEPTS = ("geography.weathering", "geography.weathering-landforms")
CONCEPTS = SOIL_CONCEPTS + WEATHER_CONCEPTS
# A topic whose sections the book lists is reached only if its name or a section names soils or weathering.
NEEDS = r"\bsoils?\b|weathering"
# Topics that share a soil concept but teach farming, conservation or erosion control, not what a profile shows.
AVOID = r"conservation|agricultur|farming|irrigation|land use"


def concepts_for(p: dict) -> frozenset[str]:
    return frozenset(SOIL_CONCEPTS if p["kind"] == "soil" else WEATHER_CONCEPTS)


def avoid_for(p: dict) -> str:
    """A soil pit stays out of the weathering and relief chapters (they name weathering, and share soil formation, but
    teach no soil profile); the deep weathering profile out of the soil, rock and relief chapters, which share the
    weathering concept but teach no regolith."""
    return AVOID + ("|weathering|relief" if p["kind"] == "soil" else r"|soil|\brocks?\b|relief|structure of the earth")

ORDER = ["litter", "topsoil", "subsoil", "parent", "bedrock"]
# The table printed beside the profile: each layer's name and what the drawing shows of it, as a teacher would
# describe the horizon.
# Each row says only what its layer's drawing shows (P3z re-review: the litter was read as topsoil, and a stony
# subsoil as the parent rock): leaves only in the litter, a few small stones only in the subsoil, many larger broken
# pieces only in the parent rock.
TABLE = {
    "litter": ("Leaf litter", "dead leaves and twigs on the surface, no soil"),
    "topsoil": ("Topsoil", "dark soil under the layer of dead leaves, full of roots"),
    "subsoil": ("Subsoil", "paler, reddish soil with a few small stones and fewer roots"),
    "parent": ("Weathered parent rock", "many large, broken pieces of rock"),
    "bedrock": ("Bedrock", "solid grey rock with cracks"),
}
BARE_TOPSOIL = ("Topsoil", "dark soil at the surface, full of roots")  # a ploughed field has no litter above it
FACE = {"litter": "#d2b27a", "topsoil": "#7a5a3c", "subsoil": "#c08a55", "parent": "#ddc6a0", "bedrock": "#9b9b9b"}
# Under trees or grass, leaf litter lies on the surface; a ploughed field has none.
COVERED = ["in a forest near Nyungwe", "under grassland near Nyagatare", "in woodland on a hillside in Karongi",
           "under trees in the school grounds in Rwamagana", "in a eucalyptus wood near Huye",
           "under a banana grove near Rubavu"]
FARMED = ["on a maize farm near Huye", "in a bean field near Musanze", "on a cassava farm near Kayonza",
          "in the school garden in Kigali", "on a sorghum field near Nyanza", "on a potato farm near Nyabihu"]

# The deep weathering profile of the humid tropics, top down; the weathering front is the base of the corestones.
WEATHER_ORDER = ["soil", "rotted rock", "corestones", "bedrock"]
WEATHER_TABLE = {
    "soil": ("Soil", "dark soil with plant roots"),
    "rotted rock": ("Rotted rock", "soft orange clay, with faint lines left from the old rock"),
    "corestones": ("Corestones", "rounded blocks of solid rock in partly weathered rock"),
    "bedrock": ("Bedrock", "solid grey rock with cracks, below the weathering front"),
}
WEATHER_FACE = {"soil": "#7a5a3c", "rotted rock": "#d9a066", "corestones": "#cfb894", "bedrock": "#9b9b9b"}
CUTTINGS = ["in a road cutting near Huye", "in a quarry face near Kigali", "in a road cutting near Rusizi",
            "in a cutting for a new road in Nyamagabe", "in a road cutting near Muhanga", "in a deep cutting near Karongi"]

X0, X1 = 1.0, 6.0  # the pit's face
LETTER_X = 7.4
FIG_W, XLIM = 10.6, (-0.2, 16.8)
TABLE_X = 8.9


def _table_order(rng: random.Random, names: list) -> list:
    """The table's rows: every layer once, never in the profile's own order (so the rows are matched, not counted)."""
    while True:
        order = list(names)
        rng.shuffle(order)
        if order != names:
            return order


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.3:
        thick = {"soil": 2, "rotted rock": rng.choice([10, 12, 14, 16, 18]), "corestones": rng.choice([4, 6, 8]),
                 "bedrock": rng.choice([4, 6])}
        layers, top = [], 0
        for n in WEATHER_ORDER:
            layers.append([n, top, top + thick[n]])
            top += thick[n]
        letters = list("PQRS")
        rng.shuffle(letters)
        return {"band": "UP", "kind": "weathering", "cover": True, "place": rng.choice(CUTTINGS), "layers": layers,
                "labels": dict(sorted(zip(letters, WEATHER_ORDER))), "table": _table_order(rng, WEATHER_ORDER),
                "seed": rng.randint(1, 10 ** 6)}
    cover = rng.random() < 0.5
    thick = {"litter": 10, "topsoil": rng.choice([20, 30, 40]), "subsoil": rng.choice([30, 40, 50, 60]),
             "parent": rng.choice([20, 30, 40, 50]), "bedrock": rng.choice([20, 30])}
    names = ORDER if cover else ORDER[1:]
    layers, top = [], 0
    for n in names:
        layers.append([n, top, top + thick[n]])
        top += thick[n]
    letters = list("PQRST"[:len(names)])
    rng.shuffle(letters)
    labels = dict(sorted(zip(letters, names)))
    place = rng.choice(COVERED if cover else FARMED)
    return {"band": rng.choice(BANDS), "kind": "soil", "cover": cover, "place": place, "layers": layers,
            "labels": labels, "table": _table_order(rng, names), "seed": rng.randint(1, 10 ** 6)}


# --- drawing ----------------------------------------------------------------------------------------

def _blob(cx, cy, r, sx, sy, rng, n=7, jag=0.35):
    """An angular stone about r inches across at (cx, cy), drawn round on the page though the axes are not square."""
    pts = []
    for k in range(n):
        a = 2 * math.pi * (k + rng.uniform(-0.25, 0.25)) / n
        rr = r * (1 + rng.uniform(-jag, jag))
        pts.append((cx + rr * math.cos(a) / sx, cy + rr * math.sin(a) / sy))
    return pts


def _draw_weathering(p: dict):
    """The deep weathering profile, in metres."""
    layers = p["layers"]
    depth = layers[-1][2]
    rng = random.Random(p["seed"])
    fig, ax = new_figure(FIG_W, 6.6)
    top_room, pad = 3.6, 0.6
    ax.set_xlim(*XLIM)
    ax.set_ylim(-depth - pad, top_room)
    sp = fig.subplotpars
    sx = FIG_W * (sp.right - sp.left) / (XLIM[1] - XLIM[0])
    sy = 6.6 * (sp.top - sp.bottom) / (depth + pad + top_room)
    span = {n: (t, b) for n, t, b in layers}
    for n, t, b in layers:
        ax.add_patch(Rectangle((X0, -b), X1 - X0, b - t, facecolor=WEATHER_FACE[n], edgecolor="none", zorder=1,
                               gid=f"part:{n}"))
    t, b = span["soil"]
    xs = [rng.uniform(X0 + 0.1, X1 - 0.1) for _ in range(90)]
    ax.scatter(xs, [-rng.uniform(t + 0.25, b - 0.25) for _ in xs], s=2.5, color="#3a2818", zorder=1.4, linewidths=0)
    # the rotted rock keeps the lines of the rock it was: faint veins running through the clay
    t, b = span["rotted rock"]
    for _ in range(6):
        x = rng.uniform(X0 + 0.3, X1 - 0.9)
        y0 = -rng.uniform(t + 1, t + (b - t) * 0.4)
        y1 = -rng.uniform(t + (b - t) * 0.6, b - 0.6)
        ax.plot([x, x + rng.uniform(0.2, 0.6)], [y0, y1], color="#b97f45", linewidth=1.0, linestyle=(0, (3, 2)),
                zorder=1.3)
    # corestones: rounded blocks of solid rock left in the partly weathered rock
    t, b = span["corestones"]
    placed = []
    for _ in range(400):
        r = rng.uniform(0.09, 0.2)
        rx, ry = r / sx, r / sy
        cx = rng.uniform(X0 + rx + 0.08, X1 - rx - 0.45)
        if b - t < 2 * ry + 0.5:
            continue
        cy = -rng.uniform(t + ry + 0.3, b - ry - 0.15)
        if any(abs(cx - x) < rx + px + 0.08 and abs(cy - y) < ry + py + 0.08 * sx / sy for x, y, px, py in placed):
            continue
        placed.append((cx, cy, rx, ry))
        pts = [(cx + rx * math.cos(2 * math.pi * k / 24) * (1 + 0.06 * math.sin(3 * k)),
                cy + ry * math.sin(2 * math.pi * k / 24)) for k in range(24)]
        ax.add_patch(Polygon(pts, closed=True, facecolor="#a3a09a", edgecolor=INK, linewidth=0.6, zorder=1.5,
                             gid="part:corestones"))
        if len(placed) >= 9:
            break
    t, b = span["bedrock"]
    for _ in range(4):  # joints in the solid rock
        x = rng.uniform(X0 + 0.4, X1 - 0.4)
        ax.plot([x, x + rng.uniform(-0.25, 0.25)], [-t - 0.3, -b], color="#4a4a4a", linewidth=1.0, zorder=1.6)
    for n, t, b in layers[:-2]:
        ax.plot([X0, X1], [-b, -b], color=INK, linewidth=1.1, zorder=2, gid="boundary")
    front = span["corestones"][1]
    ax.plot([X0, X1], [-front, -front], color="#a8322a", linewidth=2.2, linestyle=(0, (5, 3)), zorder=2.3,
            gid="weathering-front")
    ax.text(X1 + 0.15, -front, "weathering front", ha="left", va="center", fontsize=9.5, color="#a8322a", zorder=3,
            gid="front-label")
    ax.plot([X0, X0, X1, X1], [0, -depth, -depth, 0], color=INK, linewidth=1.3, zorder=2, gid="pit")
    ax.plot([X0 - 0.6, X1 + 0.4], [0, 0], color=INK, linewidth=1.3, zorder=2, gid="surface")
    for k in range(3):  # trees and grass on the surface
        x = X0 + 0.8 + k * 1.7
        ax.plot([x, x], [0, 1.6], color="#6b4f2a", linewidth=2.0, zorder=2)
        crown = [(x + 0.42 * math.cos(2 * math.pi * j / 20), 2.3 + 0.75 * math.sin(2 * math.pi * j / 20))
                 for j in range(20)]
        ax.add_patch(Polygon(crown, closed=True, facecolor="#6f9a4a", edgecolor="#3f5f2a", linewidth=0.8, zorder=2))
    for k in range(10):
        x = X0 + 0.2 + k * (X1 - X0 - 0.4) / 9
        ax.plot([x, x + 0.05], [0, 0.55], color="#4f7a3a", linewidth=1.0, zorder=2)
    for L, n in p["labels"].items():
        t, b = span[n]
        mid = (t + b) / 2 if n != "bedrock" else t + min(2, (b - t) / 2)
        letter(ax, L, (LETTER_X, -mid), (X1 - 0.3, -mid), gap=0.32, size=14)
    ax.set_yticks([-d for d in range(0, depth + 1, 2)])
    ax.set_yticklabels([str(d) for d in range(0, depth + 1, 2)], fontsize=9)
    ax.spines["left"].set_bounds(-depth, 0)
    ax.spines["bottom"].set_visible(False)
    ax.set_xticks([])
    ax.set_ylabel("Depth below the surface (m)", fontsize=10)
    ax.set_title(f"Deep weathering {p['place']}", fontsize=11)
    _table(ax, p, top_room, -depth - pad)
    return fig


def _table(ax, p: dict, top: float, bottom: float) -> None:
    """The layers' names and what each looks like, in the table's own order, with no letters."""
    import textwrap
    rows = WEATHER_TABLE if p["kind"] == "weathering" else dict(TABLE, **({} if p["cover"] else {"topsoil": BARE_TOPSOIL}))
    span = top - bottom
    ax.text(TABLE_X, top - 0.02 * span, "The layers in this profile", ha="left", va="top", fontsize=10.5,
            fontweight="bold", gid="table-head")
    step = 0.85 * span / 5.4
    for k, n in enumerate(p["table"]):
        name, words = rows[n]
        y = top - 0.11 * span - k * step
        ax.text(TABLE_X, y, name, ha="left", va="top", fontsize=10, fontweight="bold", gid="table-name")
        ax.text(TABLE_X + 0.25, y - 0.045 * span, "\n".join(textwrap.wrap(words, 34)), ha="left", va="top",
                fontsize=9.5, linespacing=1.15, gid="table-desc")


def draw(p: dict):
    if p["kind"] == "weathering":
        return _draw_weathering(p)
    layers = p["layers"]
    depth = layers[-1][2]
    rng = random.Random(p["seed"])
    fig, ax = new_figure(FIG_W, 6.6)
    top_room = 26
    ax.set_xlim(*XLIM)
    ax.set_ylim(-depth - 4, top_room)
    # inches per data unit (the axes fill the default subplot box), so stones and leaves are drawn round
    sp = fig.subplotpars
    sx = FIG_W * (sp.right - sp.left) / (XLIM[1] - XLIM[0])
    sy = 6.6 * (sp.top - sp.bottom) / (depth + 4 + top_room)
    span = {n: (t, b) for n, t, b in layers}
    for n, t, b in layers:
        ax.add_patch(Rectangle((X0, -b), X1 - X0, b - t, facecolor=FACE[n], edgecolor="none", zorder=1, gid=f"part:{n}"))
    # the texture of each horizon
    if "litter" in span:
        t, b = span["litter"]
        for _ in range(5):  # twigs
            x = rng.uniform(X0 + 0.3, X1 - 0.9)
            y = -rng.uniform(t + 2.5, b - 2.5)
            ax.plot([x, x + rng.uniform(0.35, 0.6)], [y, y + rng.uniform(-1.5, 1.5)], color="#4a3218", linewidth=1.3,
                    zorder=1.45, gid="twig")
        for _ in range(40):
            cx, cy = rng.uniform(X0 + 0.15, X1 - 0.15), -rng.uniform(t + 3.2, b - 3.2)
            w, h = rng.uniform(0.06, 0.09), rng.uniform(0.022, 0.034)
            a = rng.uniform(-0.3, 0.3)
            leaf = [(cx + (w * math.cos(k * math.pi / 6) * math.cos(a) - h * math.sin(k * math.pi / 6) * math.sin(a)) / sx,
                     cy + (w * math.cos(k * math.pi / 6) * math.sin(a) + h * math.sin(k * math.pi / 6) * math.cos(a)) / sy)
                    for k in range(12)]
            ax.add_patch(Polygon(leaf, closed=True, facecolor="#8a5a22", edgecolor="#3b2a18", linewidth=0.5, zorder=1.5,
                                 gid="part:litter"))
    t, b = span["topsoil"]
    xs = [rng.uniform(X0 + 0.1, X1 - 0.1) for _ in range(140)]
    ys = [-rng.uniform(t + 1.5, b - 1.5) for _ in xs]
    ax.scatter(xs, ys, s=2.5, color="#3a2818", zorder=1.4, linewidths=0)
    t, b = span["subsoil"]
    for _ in range(rng.randint(2, 3)):
        cx, cy = rng.uniform(X0 + 0.3, X1 - 1.0), -rng.uniform(t + 4, b - 4)
        ax.add_patch(Polygon(_blob(cx, cy, 0.045, sx, sy, rng, jag=0.25), closed=True, facecolor="#a8a39a",
                             edgecolor=INK, linewidth=0.5, zorder=1.5, gid="part:subsoil"))
    t, b = span["parent"]
    rows = max(1, int((b - t) / 14))
    for i in range(rows):
        y = -(t + (i + 0.5) * (b - t) / rows)
        x = X0 + rng.uniform(0.08, 0.2)
        while x < X1 - 0.35:
            r = rng.uniform(0.1, 0.13)
            cx = x + r / sx
            room = 1.25 * r / sy + 0.8  # the stone stays inside its own band
            cy = min(-(t + room), max(-(b - room), y + rng.uniform(-1.2, 1.2)))
            if cx + r / sx < X1 - 0.08:
                ax.add_patch(Polygon(_blob(cx, cy, r, sx, sy, rng, n=6, jag=0.25), closed=True,
                                     facecolor="#9c968c", edgecolor=INK, linewidth=0.6, zorder=1.5, gid="part:parent"))
            x = cx + r / sx + rng.uniform(0.08, 0.18)
    t, b = span["bedrock"]
    for _ in range(4):  # joints in the solid rock
        x = rng.uniform(X0 + 0.4, X1 - 0.4)
        ax.plot([x, x + rng.uniform(-0.25, 0.25)], [-t - 2, -b], color="#4a4a4a", linewidth=1.0, zorder=1.6)
    y = -(t + b) / 2
    ax.plot([X0, X0 + 1.3, X0 + 2.9, X1], [y, y - 2, y + 1, y - 1], color="#4a4a4a", linewidth=1.0, zorder=1.6)
    # roots: many in the topsoil, a few reaching the subsoil
    start = span["topsoil"][0]
    deep = span["subsoil"][0] + (span["subsoil"][1] - span["subsoil"][0]) * 0.4
    for k in range(9):
        x = X0 + 0.3 + k * (X1 - X0 - 0.6) / 8
        end = deep if k % 3 == 1 else span["topsoil"][1] - rng.uniform(2, 6)
        pts = [(x, -start)]
        yy, xx = start, x
        while yy < end:
            yy = min(end, yy + rng.uniform(4, 7))
            xx = min(X1 - 0.1, max(X0 + 0.1, xx + rng.uniform(-0.12, 0.12)))
            pts.append((xx, -yy))
        ax.plot(*zip(*pts), color="#e8dcc0", linewidth=0.9, zorder=1.7, gid="root")
    # the boundaries and the pit's outline
    for n, t, b in layers[:-1]:
        ax.plot([X0, X1], [-b, -b], color=INK, linewidth=1.1, zorder=2, gid="boundary")
    ax.plot([X0, X0, X1, X1], [0, -depth, -depth, 0], color=INK, linewidth=1.3, zorder=2, gid="pit")
    # the surface and what grows on it
    ax.plot([X0 - 0.6, X1 + 0.4], [0, 0], color=INK, linewidth=1.3, zorder=2, gid="surface")
    if p["cover"]:
        for k in range(14):
            x = X0 + 0.2 + k * (X1 - X0 - 0.4) / 13
            for d in (-0.07, 0, 0.07):
                ax.plot([x, x + d], [0, rng.uniform(5, 8)], color="#4f7a3a", linewidth=1.0, zorder=2)
    else:
        for k in range(4):  # a row of young crop plants
            x = X0 + 0.6 + k * (X1 - X0 - 1.2) / 3
            ax.plot([x, x], [0, 18], color="#4f7a3a", linewidth=1.6, zorder=2)
            for h, side in ((6, 1), (10, -1), (14, 1)):
                ax.plot([x, x + side * 0.42], [h, h + 4], color="#4f7a3a", linewidth=1.4, zorder=2)
    # the letters, beside the face, each leader ending inside its band
    for L, n in p["labels"].items():
        t, b = span[n]
        mid = (t + b) / 2 if n != "bedrock" else t + min(10, (b - t) / 2)
        letter(ax, L, (LETTER_X, -mid), (X1 - 0.35, -mid), gap=0.32, size=14)
    ax.set_yticks([-d for d in range(0, depth + 1, 10)])
    ax.set_yticklabels([str(d) for d in range(0, depth + 1, 10)], fontsize=9)
    ax.spines["left"].set_bounds(-depth, 0)
    ax.spines["bottom"].set_visible(False)
    ax.set_xticks([])
    ax.set_ylabel("Depth below the surface (cm)", fontsize=10)
    ax.set_title(f"Soil profile {p['place']}", fontsize=11)
    _table(ax, p, top_room, -depth - 4)
    return fig


# --- questions --------------------------------------------------------------------------------------

INTROS = ["{name} dug a soil pit {place} and drew this soil profile.",
          "{name} drew this soil profile from a pit dug {place}.",
          "{name} measured the layers in a soil pit {place} and drew this profile.",
          "{name} sketched the side of a soil pit {place}."]
WEATHER_INTROS = ["{name} measured the layers of weathered rock {place} and drew this profile.",
                  "{name} drew this weathering profile from what was seen {place}.",
                  "{name} sketched the layers exposed {place}, where the rock has weathered deeply.",
                  "{name} recorded the layers {place} on a field trip and drew this profile."]


def questions(p: dict, rng: random.Random) -> list:
    layers, labels = p["layers"], p["labels"]
    names = [n for n, _, _ in layers]
    at = {v: k for k, v in labels.items()}
    span = {n: (t, b) for n, t, b in layers}
    deep = p["kind"] == "weathering"
    rows, unit = (WEATHER_TABLE, "m") if deep else (TABLE, "cm")
    intro = rng.choice(WEATHER_INTROS if deep else INTROS).format(name=rng.choice(NAMES), place=p["place"])
    ask = rng.choice(names)
    i = names.index(ask)
    near = [at[names[j]] for j in (i - 1, i + 1) if 0 <= j < len(names)]
    rest = [at[n] for n in names if at[n] != at[ask] and at[n] not in near]
    rng.shuffle(rest)
    qs = [letter_choice(f"{intro} The table describes each layer. Which letter shows the {rows[ask][0].lower()}?",
                        at[ask], near + rest)]
    if deep and rng.random() < 0.5:
        # the weathering front: the base of the weathered rock, where the solid bedrock begins
        upper = "corestones"
        depth = span[upper][1]
        qs.append(short("How deep below the surface is the weathering front?", depth, measure(depth, unit)[1:]))
    else:
        k = rng.randrange(len(names) - 1)
        upper, lower = names[k], names[k + 1]
        depth = span[upper][1]
        qs.append(short(f"How deep below the surface is the boundary between layer {at[upper]} and layer {at[lower]}?",
                        depth, measure(depth, unit)[1:]))
    pool = [n for n in names if n not in ("bedrock", upper)] or [n for n in names if n != "bedrock"]
    n = rng.choice(pool)
    size = span[n][1] - span[n][0]
    qs.append(short(f"How thick is layer {at[n]}?", size, measure(size, unit)[1:]))
    return qs
