"""Photographs (LS, UP; P6 geography): reading a landscape photograph by its sections, and telling the types of
photograph apart, as the Rwanda S2 "Types of Photographs", S2 and S6 "Interpretation of Photographs and Video Images"
units teach them. The landscape is a drawing of an invented place, made to stand for a photograph.

Two sub-types:
- sections: a drawn ground photograph of an invented hilly landscape divided by dashed lines into nine sections (left,
  centre and right; foreground, middle ground and background, named round the frame), with five features lettered P
  to T, each wholly in one section (a lake, a forest, a group of houses, a tea plantation, a banana plantation or a
  school), and the photograph's size printed. In which section a lettered feature lies, which letter is in a named
  section, what a lettered feature is, and the width of a sketch of the photograph reduced or enlarged by a stated
  fraction.
- types: three small photographs of the same countryside, lettered, taken from the ground, from the air at an angle
  and from the air looking straight down, beside a table that describes the three types. Which letter is a stated
  type, which type a lettered photograph is, and which letters show the horizon.
"""
from __future__ import annotations

import random
import textwrap
from fractions import Fraction

from matplotlib.patches import Circle, Ellipse, Polygon, Rectangle

from ..core import INK, NAMES, article, mcq, new_figure, short
from ._bio_parts import letter_choice
from ._geo_charts import num_forms

ID = "photo_sketch"
KIND = "diagram.template"
SUBJECT = "geography"
BANDS = ("LS", "UP")
MORE = {"sections": ("geography.photograph-interpretation", "geography.photograph-representation",
                     "geography.map-enlargement-reduction"),
        "types": ("geography.photograph-interpretation", "geography.photograph-representation")}
CONCEPTS = ("geography.photograph-interpretation", "geography.photograph-representation",
            "geography.map-enlargement-reduction")
# A topic whose sections the book lists is reached only if its name or a section names photographs.
NEEDS = r"photograph"
# Practice questions, and map-reading topics listed without sections, share the photograph concept but are judged by
# it alone.
AVOID = r"exam-style|map reading|map skills"
COLS = ["left", "centre", "right"]
ROWS = ["foreground", "middle ground", "background"]
FEATURES = ["lake", "forest", "houses", "tea plantation", "banana plantation", "school"]
SHOWN = {"lake": "A lake", "forest": "A forest", "houses": "A group of houses", "tea plantation": "A tea plantation",
         "banana plantation": "A banana plantation", "school": "A school"}
LETTERS = ["P", "Q", "R", "S", "T"]
TYPES = ["ground", "oblique", "vertical"]
TYPE_NAMED = {"ground": "Ground (horizontal) photograph", "oblique": "Oblique aerial photograph",
              "vertical": "Vertical aerial photograph"}
TYPE_TABLE = [("Ground (horizontal)", "Taken from the ground. Features are seen from the side and the horizon is near "
                                      "the middle."),
              ("Oblique aerial", "Taken from the air at an angle. Features are seen from above and from the side; the "
                                 "horizon is near the top."),
              ("Vertical aerial", "Taken from the air looking straight down. Features are seen from above, like a "
                                  "plan, and there is no horizon.")]
SIZES = [(18, 12), (15, 10), (24, 16), (12, 8)]
CHANGES = [("reduced to half its size", Fraction(1, 2)), ("reduced to two-thirds of its size", Fraction(2, 3)),
           ("reduced to three-quarters of its size", Fraction(3, 4)), ("enlarged to twice its size", Fraction(2)),
           ("enlarged to one and a half times its size", Fraction(3, 2))]
W, H = 9.0, 6.0  # the photograph, in drawing units: each section 3 wide and 2 high


def concepts_for(p: dict) -> tuple[str, ...]:
    return MORE[p["sub"]]


def _sections(rng: random.Random, band: str) -> dict | None:
    cells = rng.sample([[c, r] for c in range(3) for r in range(3)], 5)
    feats = rng.sample(FEATURES, 5)
    letters = LETTERS[:]
    rng.shuffle(letters)
    size = rng.choice(SIZES)
    fits = [k for k, (_, f) in enumerate(CHANGES) if (size[0] * f).denominator == 1]
    a, b, c = rng.sample(range(5), 3)
    return {"band": band, "sub": "sections", "cells": cells, "features": feats, "letters": letters, "size": list(size),
            "change": rng.choice(fits), "ask": {"where": a, "which": b, "what": c}}


def _types(rng: random.Random, band: str) -> dict:
    order = TYPES[:]
    rng.shuffle(order)
    asked = rng.sample(TYPES, 2)
    return {"band": band, "sub": "types", "order": order, "seed": rng.randint(1, 10 ** 6),
            "ask": {"which": asked[0], "what": asked[1]}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.6:
        while True:
            p = _sections(rng, band)
            if p:
                return p
    return _types(rng, band)


# --- the landscape -----------------------------------------------------------------------------------------------------

GREEN = "#a8cf8e"
HILL = "#7fa36a"
SKY = "#dceefb"


def _tree(ax, x, y, s, z=3):
    ax.add_patch(Rectangle((x - 0.04 * s, y), 0.08 * s, 0.25 * s, facecolor="#7a5230", edgecolor="none", zorder=z))
    ax.add_patch(Circle((x, y + 0.38 * s), 0.2 * s, facecolor="#2e7d32", edgecolor=INK, linewidth=0.6, zorder=z + 0.1))


def _house(ax, x, y, s, z=3, wall="#f6ead0", roof="#c0634a", w=0.36):
    ax.add_patch(Rectangle((x - w / 2 * s, y), w * s, 0.24 * s, facecolor=wall, edgecolor=INK, linewidth=0.7, zorder=z))
    ax.add_patch(Polygon([(x - (w / 2 + 0.05) * s, y + 0.24 * s), (x + (w / 2 + 0.05) * s, y + 0.24 * s),
                          (x, y + 0.42 * s)], closed=True, facecolor=roof, edgecolor=INK, linewidth=0.7, zorder=z + 0.1))


def _feature(ax, kind, cx, cy, s, gid):
    """One feature centred on (cx, cy) at scale s (smaller further away); its first patch carries the gid."""
    if kind == "lake":
        ax.add_patch(Ellipse((cx, cy), 2.0 * s, 0.6 * s, facecolor="#5dade2", edgecolor=INK, linewidth=0.8, zorder=3,
                             gid=gid))
    elif kind == "forest":
        ax.add_patch(Rectangle((cx - 0.9 * s, cy - 0.35 * s), 1.8 * s, 0.05 * s, facecolor="none", edgecolor="none",
                               gid=gid))
        for dx, dy in ((-0.7, -0.3), (-0.35, -0.2), (0.0, -0.3), (0.35, -0.2), (0.7, -0.3), (-0.5, 0.0), (0.2, 0.0),
                       (0.55, 0.05), (-0.15, 0.05)):
            _tree(ax, cx + dx * s, cy + dy * s, s)
    elif kind == "houses":
        ax.add_patch(Rectangle((cx - 0.9 * s, cy - 0.3 * s), 1.8 * s, 0.05 * s, facecolor="none", edgecolor="none",
                               gid=gid))
        for dx, dy in ((-0.6, -0.3), (0.0, -0.25), (0.6, -0.3), (-0.3, 0.1), (0.35, 0.12)):
            _house(ax, cx + dx * s, cy + dy * s, s)
    elif kind == "tea plantation":
        ax.add_patch(Rectangle((cx - 1.0 * s, cy - 0.4 * s), 2.0 * s, 0.8 * s, facecolor="#cde6b5", edgecolor="none",
                               zorder=2.8, gid=gid))
        for r in range(4):
            for k in range(7):
                ax.add_patch(Ellipse((cx + (-0.85 + 0.283 * k) * s, cy + (-0.3 + 0.2 * r) * s), 0.22 * s, 0.11 * s,
                                     facecolor="#3f8f3f", edgecolor="none", zorder=3))
    elif kind == "banana plantation":
        ax.add_patch(Rectangle((cx - 0.8 * s, cy - 0.35 * s), 1.6 * s, 0.05 * s, facecolor="none", edgecolor="none",
                               gid=gid))
        for dx in (-0.55, 0.0, 0.55):
            x0, y0 = cx + dx * s, cy - 0.38 * s
            ax.add_patch(Rectangle((x0 - 0.035 * s, y0), 0.07 * s, 0.45 * s, facecolor="#6b8e23", edgecolor=INK,
                                   linewidth=0.5, zorder=3))
            for ang, ox, oy in ((35, -0.16, 0.5), (-35, 0.16, 0.5), (75, -0.08, 0.6), (-75, 0.08, 0.6), (8, -0.2, 0.4),
                                (-8, 0.2, 0.4)):
                ax.add_patch(Ellipse((x0 + ox * s, y0 + oy * s), 0.34 * s, 0.11 * s, angle=ang, facecolor="#4caf50",
                                     edgecolor="#2e7d32", linewidth=0.6, zorder=3.1))
    else:  # school: a long building with a flag
        ax.add_patch(Rectangle((cx - 0.75 * s, cy - 0.3 * s), 1.5 * s, 0.32 * s, facecolor="#f6ead0", edgecolor=INK,
                               linewidth=0.8, zorder=3, gid=gid))
        ax.add_patch(Polygon([(cx - 0.82 * s, cy + 0.02 * s), (cx + 0.82 * s, cy + 0.02 * s), (cx + 0.7 * s, cy + 0.2 * s),
                              (cx - 0.7 * s, cy + 0.2 * s)], closed=True, facecolor="#8d6e63", edgecolor=INK,
                             linewidth=0.8, zorder=3.1))
        for k in range(5):
            ax.add_patch(Rectangle((cx + (-0.6 + 0.28 * k) * s, cy - 0.2 * s), 0.14 * s, 0.12 * s, facecolor="#5d9cec",
                                   edgecolor=INK, linewidth=0.5, zorder=3.2))
        ax.plot([cx + 0.95 * s, cx + 0.95 * s], [cy - 0.3 * s, cy + 0.5 * s], color=INK, linewidth=1.0, zorder=3,
                gid="flagpole")
        ax.add_patch(Rectangle((cx + 0.95 * s, cy + 0.32 * s), 0.25 * s, 0.16 * s, facecolor="#2e7d32", edgecolor=INK,
                               linewidth=0.5, zorder=3))


SCALE = [1.0, 0.85, 0.7]  # foreground, middle ground, background


def feature_centre(cell) -> tuple[float, float]:
    c, r = cell
    return 1.5 + 3 * c, 2 * r + (0.75 if r < 2 else 0.6)


def _draw_sections(p: dict):
    fig, ax = new_figure(10.2, 7.4)
    ax.add_patch(Rectangle((0, 0), W, H, facecolor=SKY, edgecolor="none", zorder=0.5))
    ax.add_patch(Polygon([(0, 4.0), (0, 5.0), (1.4, 5.6), (2.8, 5.1), (4.5, 5.75), (6.2, 5.2), (7.6, 5.65), (9, 5.0),
                          (9, 4.0)], closed=True, facecolor=HILL, edgecolor="none", zorder=1, gid="hills"))
    ax.add_patch(Rectangle((0, 0), W, 4.0, facecolor=GREEN, edgecolor="none", zorder=1, gid="ground"))
    for k, (cell, kind) in enumerate(zip(p["cells"], p["features"])):
        cx, cy = feature_centre(cell)
        _feature(ax, kind, cx, cy, SCALE[cell[1]], f"feature:{k}")
        ax.text(cx, 2 * cell[1] + 1.68, p["letters"][k], ha="center", va="center", fontsize=13, fontweight="bold",
                zorder=9, gid=f"letter:{p['letters'][k]}",
                bbox=dict(boxstyle="circle,pad=0.18", facecolor="white", edgecolor=INK, linewidth=1.0))
    for x in (3, 6):
        ax.plot([x, x], [0, H], color=INK, linewidth=1.0, linestyle="--", zorder=6, gid=f"grid:v{x}")
    for y in (2, 4):
        ax.plot([0, W], [y, y], color=INK, linewidth=1.0, linestyle="--", zorder=6, gid=f"grid:h{y}")
    ax.add_patch(Rectangle((0, 0), W, H, facecolor="none", edgecolor=INK, linewidth=1.6, zorder=7, gid="frame"))
    for c, name in enumerate(COLS):
        ax.text(1.5 + 3 * c, -0.3, name.capitalize(), ha="center", va="center", fontsize=10.5)
    for r, name in enumerate(ROWS):
        ax.text(W + 0.15, 2 * r + 1, name.capitalize(), ha="left", va="center", fontsize=10.5)
    w, h = p["size"]
    ax.text(0, -0.85, f"Size of the photograph: {w} cm wide × {h} cm high", ha="left", va="center", fontsize=10.5,
            gid="size")
    ax.set_xlim(-0.1, W + 1.75)
    ax.set_ylim(-1.15, H + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("A photograph of a hilly area, divided into sections", fontsize=12, fontweight="bold")
    return fig


def _thumb(ax, kind, x0, rng):
    """One small photograph, 3.4 wide and 2.6 high, from x0."""
    w, h = 3.4, 2.6
    if kind == "ground":
        ax.add_patch(Rectangle((x0, 0), w, h, facecolor=SKY, edgecolor="none", zorder=1))
        ax.add_patch(Rectangle((x0, 0), w, 1.3, facecolor=GREEN, edgecolor="none", zorder=1.1))
        ax.plot([x0, x0 + w], [1.3, 1.3], color="#4d6b3c", linewidth=1.0, zorder=1.2, gid="horizon")
        for k in range(3):
            _house(ax, x0 + 0.6 + 0.9 * k + rng.uniform(-0.1, 0.1), 0.35, 1.3, z=2)
        for k in range(4):
            _tree(ax, x0 + 0.35 + 0.85 * k + rng.uniform(-0.1, 0.1), 1.2, 0.8, z=1.5)
    elif kind == "oblique":
        ax.add_patch(Rectangle((x0, 0), w, h, facecolor=SKY, edgecolor="none", zorder=1))
        ax.add_patch(Rectangle((x0, 0), w, 2.25, facecolor=GREEN, edgecolor="none", zorder=1.1))
        ax.plot([x0, x0 + w], [2.25, 2.25], color="#4d6b3c", linewidth=1.0, zorder=1.2, gid="horizon")
        for k, shade in enumerate(["#c5e1a5", "#dcedc8", "#aed581", "#c5e1a5"]):
            bl, br = x0 + 0.85 * k, x0 + 0.85 * (k + 1)
            tl, tr = x0 + w / 2 + (bl - x0 - w / 2) * 0.45, x0 + w / 2 + (br - x0 - w / 2) * 0.45
            ax.add_patch(Polygon([(bl, 0), (br, 0), (tr, 2.2), (tl, 2.2)], closed=True, facecolor=shade, edgecolor="#6b8e23",
                                 linewidth=0.6, zorder=1.3))
        for k in range(3):  # roofs seen from above and the front
            hx, hy = x0 + 0.8 + 0.9 * k, 0.5 + 0.3 * (k % 2)
            ax.add_patch(Polygon([(hx - 0.25, hy), (hx + 0.25, hy), (hx + 0.18, hy + 0.3), (hx - 0.18, hy + 0.3)],
                                 closed=True, facecolor="#c0634a", edgecolor=INK, linewidth=0.6, zorder=2))
            ax.add_patch(Rectangle((hx - 0.25, hy - 0.15), 0.5, 0.15, facecolor="#f6ead0", edgecolor=INK, linewidth=0.6,
                                   zorder=2))
    else:  # vertical: a plan of fields, a road and roofs, with no sky
        ax.add_patch(Rectangle((x0, 0), w, h, facecolor=GREEN, edgecolor="none", zorder=1))
        xs = sorted(rng.sample([0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7], 3))
        for k, (a, b) in enumerate(zip([0.0] + xs, xs + [w])):
            for j, (c, d) in enumerate(((0, 1.2), (1.2, h))):
                ax.add_patch(Rectangle((x0 + a, c), b - a, d - c, facecolor=["#c5e1a5", "#dcedc8", "#aed581"][(k + j) % 3],
                                       edgecolor="#6b8e23", linewidth=0.6, zorder=1.1))
        ax.add_patch(Rectangle((x0, 1.12), w, 0.16, facecolor="#bdbdbd", edgecolor="none", zorder=1.2))
        for k in range(4):
            ax.add_patch(Rectangle((x0 + 0.4 + 0.75 * k, 1.42), 0.26, 0.26, facecolor="#c0634a", edgecolor=INK,
                                   linewidth=0.6, zorder=2))
    ax.add_patch(Rectangle((x0, 0), w, h, facecolor="none", edgecolor=INK, linewidth=1.4, zorder=5, gid="photo"))


def _draw_types(p: dict):
    fig, ax = new_figure(10.6, 6.0)
    rng = random.Random(p["seed"])
    for k, kind in enumerate(p["order"]):
        x0 = 3.8 * k
        _thumb(ax, kind, x0, rng)
        ax.text(x0 + 1.7, 2.85, f"Photograph {LETTERS[k]}", ha="center", va="center", fontsize=11, fontweight="bold")
    top = -0.45
    ax.text(0, top, "Types of photograph", ha="left", va="center", fontsize=10.5, fontweight="bold")
    for k, (name, words) in enumerate(TYPE_TABLE):
        y = top - 0.6 - 0.75 * k
        ax.text(0, y, name, ha="left", va="center", fontsize=9.8, fontweight="bold")
        ax.text(3.0, y, "\n".join(textwrap.wrap(words, 78)), ha="left", va="center", fontsize=9.4)
    ax.set_xlim(-0.1, 11.1)
    ax.set_ylim(top - 0.6 - 0.75 * 2 - 0.5, 3.15)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_sections(p) if p["sub"] == "sections" else _draw_types(p)


VERBS = ["studies", "looks at", "is given", "copies"]
SETTINGS = ["in a geography lesson", "for homework", "for a lesson on photographs", "for a class test",
            "at the geography club", "while revising in Huye", "before a fieldwork visit", "while revising in Kigali"]


def _place(c: int, r: int) -> str:
    return f"{COLS[c].capitalize()} {ROWS[r]}"


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "sections":
        lead = f"{who} {rng.choice(VERBS)} this photograph {rng.choice(SETTINGS)}."
        cells, feats, letters = p["cells"], p["features"], p["letters"]
        a, b, c = p["ask"]["where"], p["ask"]["which"], p["ask"]["what"]
        ca, ra = cells[a]
        oc = rng.choice([k for k in range(3) if k != ca])
        orow = rng.choice([k for k in range(3) if k != ra])
        cb, rb = cells[b]
        text, f = CHANGES[p["change"]]
        width = p["size"][0] * f
        return [
            mcq(f"{lead} In which section of the photograph is feature {letters[a]}?", _place(ca, ra),
                [_place(oc, ra), _place(ca, orow), _place(oc, orow)], rng),
            letter_choice(f"Which letter in the photograph is in the {COLS[cb]} {ROWS[rb]}?", letters[b],
                          [L for L in LETTERS if L != letters[b]]),
            mcq(f"What does letter {letters[c]} show in the photograph?", SHOWN[feats[c]],
                [SHOWN[k] for k in feats if k != feats[c]], rng),
            short(f"A sketch of this photograph is {text}. How wide is the sketch's frame, in cm?", f"{width} cm",
                  num_forms(int(width), "cm", "centimetres")),
        ]
    lead = f"{who} {rng.choice(VERBS)} these three photographs of the same countryside {rng.choice(SETTINGS)}."
    at = {kind: LETTERS[k] for k, kind in enumerate(p["order"])}
    x, y = p["ask"]["which"], p["ask"]["what"]
    shown = ["P", "Q", "R"]
    return [
        letter_choice(f"{lead} Using the table, which letter shows {article(TYPE_NAMED[x].lower())} "
                      f"{TYPE_NAMED[x].lower()}?", at[x],
                      [L for L in shown if L != at[x]]),
        mcq(f"Using the table of types, what type of photograph is photograph {at[y]}?", TYPE_NAMED[y],
            [TYPE_NAMED[k] for k in TYPES if k != y], rng),
        mcq("Which of the three photographs show the horizon?",
            " and ".join(sorted(at[k] for k in ("ground", "oblique"))),
            [" and ".join(sorted(at[k] for k in pair)) for pair in (("ground", "vertical"), ("oblique", "vertical"))]
            + [f"{at['vertical']} only"], rng),
    ]
