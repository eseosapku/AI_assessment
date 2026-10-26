"""Tools and what they are used for (P3 to P6, Science and Elementary Technology): four tools of one trade drawn in a
row of boxes, lettered A to D (never named under the picture), and under them a table naming each tool and what it is
used for, in alphabetical order (so the table's order says nothing about the letters).

Trades: farm tools (P3 "Agricultural Tools"), carpentry tools and masonry tools (P5), a mechanic's tools and a
blacksmith's tools (P6 "Mechanical and blacksmith tools").

- Which letter shows the tool used for a stated job? (the job read from the table, the tool known by its picture)
- What is tool C used for? (the four jobs in the table are the options)

Every key comes from the fixed table USE below, which a Primary teacher would agree with. Two tools that look alike in
a small picture (a rake and a garden fork, a chisel and a screwdriver) never stand in one figure, nor a saw and a
chisel (both cut wood).
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import INK, NAMES, Question, mcq, new_figure

ID = "tools_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("agricultural-tools", "carpentry-tools", "masonry-tools", "mechanical-tools"))
# A topic whose sections the book lists is reached only if its name or a section names tools.
NEEDS = r"\btools?\b"
# Simple machines teach levers and pulleys, not a trade's tools; ICT tools and crafts are other topics.
AVOID = (r"simple machines?|\bict\b|computer|science in context|objects production|making toys|glossary|programming|"
         r"sexual|reproduction system|hiv")

USE = {
    "farm": {"hoe": "digging the soil", "machete": "cutting bushes", "rake": "gathering dry leaves",
             "watering can": "watering seedlings", "wheelbarrow": "carrying manure", "garden fork": "turning compost"},
    "carpentry": {"saw": "cutting planks", "hammer": "knocking in nails", "plane": "making wood smooth",
                  "chisel": "cutting holes in wood", "screwdriver": "turning screws", "tape measure": "measuring length",
                  "try square": "marking right angles"},
    "masonry": {"trowel": "spreading mortar", "spirit level": "checking a surface is level",
                "plumb bob": "checking a wall is upright", "float": "smoothing plaster",
                "shovel": "mixing sand and cement", "mason's square": "checking corners are square"},
    "mechanic": {"spanner": "tightening nuts and bolts", "pliers": "gripping and bending wire",
                 "screwdriver": "turning screws", "hacksaw": "cutting metal", "tyre pump": "pumping air into tyres",
                 "oil can": "oiling moving parts"},
    "blacksmith": {"anvil": "resting hot metal on while hammering", "tongs": "holding hot metal",
                   "hammer": "beating metal into shape", "bellows": "blowing air into the fire",
                   "bucket of water": "cooling hot metal"},
}
APART = [{"rake", "garden fork"}, {"chisel", "screwdriver"}, {"saw", "chisel"}]
CONCEPT = {"farm": "science.agricultural-tools", "carpentry": "science.carpentry-tools",
           "masonry": "science.masonry-tools", "mechanic": "science.mechanical-tools",
           "blacksmith": "science.mechanical-tools"}
# The other trades' chapters: a mechanic's tools are not masonry tools, though the masonry chapter's map names both.
OTHERS = {"farm": "carpentry|masonry|mechanical|blacksmith", "carpentry": "agricultur|masonry|mechanical|blacksmith",
          "masonry": "agricultur|carpentry|mechanical|blacksmith", "mechanic": "agricultur|carpentry|masonry",
          "blacksmith": "agricultur|carpentry|masonry"}
# A blacksmith's hammer has a flat face at both ends; a carpenter's has a claw for pulling nails.
PICTURE = {("blacksmith", "hammer"): "blacksmith's hammer"}
TITLE = {"farm": "Farm tools", "carpentry": "Carpentry tools", "masonry": "Masonry tools",
         "mechanic": "A mechanic's tools", "blacksmith": "A blacksmith's tools"}
NOUN = {"farm": "farm tools", "carpentry": "carpentry tools", "masonry": "masonry tools",
        "mechanic": "mechanic's tools", "blacksmith": "blacksmith's tools"}


def stages(p: dict) -> tuple[int, int]:
    return (3, 4) if p["set"] == "farm" else (5, 6)


def concepts_for(p: dict) -> tuple:
    return (CONCEPT[p["set"]],)


def avoid_for(p: dict) -> str:
    return AVOID + "|" + OTHERS[p["set"]]


def sample(rng: random.Random) -> dict:
    trade = rng.choice(sorted(USE))
    while True:
        tools = rng.sample(sorted(USE[trade]), 4)
        if not any(pair <= set(tools) for pair in APART):
            break
    ask = rng.randrange(4)
    other = rng.choice([j for j in range(4) if j != ask])
    return {"band": "P", "set": trade, "tools": tools, "ask_use": ask, "ask_letter": other}


# --- the pictures ----------------------------------------------------------------------------------------------

WOOD, LIGHT_WOOD, STEEL, DARK = "#a0522d", "#deb887", "#b3bcc0", "#5d6d7e"


def _tool(ax, kind: str, cx: float, cy: float, gid: str, s: float = 1.0) -> None:
    """A tool centred on (cx, cy), inside x +-0.95 and y +-0.7 at size 1."""
    def P(x, y):
        return (cx + x * s, cy + y * s)

    def poly(pts, face, z=3, lw=1.3):
        ax.add_patch(Polygon([P(*q) for q in pts], closed=True, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z,
                             gid=gid))

    def rect(x, y, w, h, face, z=3, lw=1.3):
        ax.add_patch(Rectangle(P(x, y), w * s, h * s, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z, gid=gid))

    def circ(x, y, r, face, z=3.5, lw=1.2):
        ax.add_patch(Circle(P(x, y), r * s, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z, gid=gid))

    def line(*pts, color=INK, lw=2.0, z=3):
        ax.plot([P(*q)[0] for q in pts], [P(*q)[1] for q in pts], color=color, linewidth=lw, zorder=z,
                solid_capstyle="round", gid=gid)

    def stick(x0, y0, x1, y1, w, face, z=3):
        """A handle as a long thin box from (x0, y0) to (x1, y1), w wide."""
        dx, dy = x1 - x0, y1 - y0
        n = math.hypot(dx, dy)
        ox, oy = -dy / n * w / 2, dx / n * w / 2
        poly([(x0 + ox, y0 + oy), (x1 + ox, y1 + oy), (x1 - ox, y1 - oy), (x0 - ox, y0 - oy)], face, z=z)

    if kind == "hoe":
        stick(-0.2, -0.22, 0.75, 0.6, 0.11, WOOD)
        poly([(-0.55, -0.15), (-0.08, -0.27), (0.1, -0.65), (-0.75, -0.62)], STEEL, z=4)
    elif kind == "machete":
        poly([(-0.32, 0.1), (0.62, 0.12), (0.88, 0.2), (0.8, -0.02), (0.55, -0.2), (-0.32, -0.1)], STEEL)
        rect(-0.88, -0.11, 0.58, 0.22, WOOD, z=3.2)
        for x in (-0.72, -0.48):
            circ(x, 0.0, 0.035, "#f4f6f7", z=3.4, lw=0.8)
    elif kind == "rake":
        stick(0.0, -0.32, 0.0, 0.68, 0.1, WOOD)
        rect(-0.65, -0.4, 1.3, 0.1, STEEL, z=3.2)
        for k in range(9):
            x = -0.6 + 0.15 * k
            line((x, -0.4), (x, -0.65), color=DARK, lw=2.4)
    elif kind == "garden fork":
        stick(0.0, -0.02, 0.0, 0.5, 0.1, WOOD)
        poly([(-0.16, 0.5), (0.16, 0.5), (0.16, 0.68), (-0.16, 0.68)], WOOD, z=3.1)
        poly([(-0.09, 0.54), (0.09, 0.54), (0.09, 0.62), (-0.09, 0.62)], "white", z=3.2, lw=0.8)
        rect(-0.32, -0.1, 0.64, 0.1, STEEL, z=3.2)
        for x in (-0.27, -0.09, 0.09, 0.27):
            poly([(x - 0.035, -0.1), (x + 0.035, -0.1), (x + 0.02, -0.6), (x, -0.68), (x - 0.02, -0.6)], STEEL, z=3.3,
                 lw=1.0)
    elif kind == "watering can":
        poly([(-0.6, -0.55), (0.2, -0.55), (0.15, 0.15), (-0.55, 0.15)], "#58d68d")
        stick(0.12, -0.35, 0.68, 0.32, 0.09, "#58d68d", z=2.9)
        poly([(0.6, 0.28), (0.82, 0.5), (0.9, 0.4), (0.7, 0.2)], "#58d68d", z=3.1)
        for d in ((0.77, 0.38), (0.82, 0.34)):
            circ(*d, 0.015, INK, z=3.3, lw=0.5)
        line((-0.48, 0.15), (-0.42, 0.45), (-0.08, 0.45), (0.05, 0.15), lw=3.5, color="#239b56")
    elif kind == "wheelbarrow":
        line((0.55, -0.4), (-0.92, 0.06), lw=4.0, color=WOOD, z=2.9)
        poly([(-0.5, 0.0), (0.35, 0.0), (0.68, 0.42), (-0.78, 0.42)], "#58d68d")
        line((0.22, 0.0), (0.55, -0.4), lw=3.0, color=DARK)
        circ(0.55, -0.42, 0.22, "#1c1c1c", z=3.4)
        circ(0.55, -0.42, 0.06, STEEL, z=3.5)
        line((-0.4, -0.04), (-0.42, -0.62), lw=3.0, color=DARK)
    elif kind == "saw":
        teeth = [(-0.35 + 0.1 * k + (0.05 if j else 0.0), -0.2 - (0.08 if j else 0.0)) for k in range(12) for j in (0, 1)]
        poly([(-0.35, 0.2), (0.85, 0.06)] + [(0.85, -0.2)] + teeth[::-1][1:] + [(-0.35, -0.2)], "#d5dbdb")
        ax.add_patch(FancyBboxPatch(P(-0.85, -0.32), 0.48 * s, 0.64 * s, boxstyle="round,pad=0,rounding_size=0.12",
                                    facecolor=WOOD, edgecolor=INK, linewidth=1.3, zorder=3.1, gid=gid))
        ax.add_patch(Ellipse(P(-0.6, 0.0), 0.2 * s, 0.32 * s, facecolor="white", edgecolor=INK, linewidth=1.0, zorder=3.2,
                             gid=gid))
    elif kind == "hammer":
        stick(0.0, -0.68, 0.0, 0.28, 0.16, WOOD)
        rect(-0.5, 0.26, 0.62, 0.26, DARK, z=3.2)
        poly([(0.12, 0.52), (0.42, 0.44), (0.62, 0.16), (0.52, 0.12), (0.36, 0.3), (0.12, 0.26)], DARK, z=3.2)
    elif kind == "blacksmith's hammer":
        stick(0.0, -0.68, 0.0, 0.28, 0.16, WOOD)
        poly([(-0.55, 0.22), (-0.42, 0.26), (0.42, 0.26), (0.55, 0.22), (0.55, 0.58), (0.42, 0.54), (-0.42, 0.54),
              (-0.55, 0.58)], "#424949", z=3.2)
    elif kind == "plane":
        poly([(-0.85, -0.4), (0.85, -0.4), (0.85, -0.08), (-0.85, -0.08)], LIGHT_WOOD)
        poly([(-0.12, -0.08), (0.02, -0.08), (0.24, 0.32), (0.1, 0.32)], STEEL, z=3.1)
        poly([(0.35, -0.08), (0.75, -0.08), (0.68, 0.42), (0.45, 0.45)], WOOD, z=3.2)
        ax.add_patch(Ellipse(P(0.57, 0.15), 0.14 * s, 0.26 * s, facecolor="white", edgecolor=INK, linewidth=1.0, zorder=3.3,
                             gid=gid))
        circ(-0.55, 0.08, 0.15, WOOD, z=3.2)
    elif kind == "chisel":
        ax.add_patch(FancyBboxPatch(P(-0.88, -0.12), 0.68 * s, 0.24 * s, boxstyle="round,pad=0,rounding_size=0.1",
                                    facecolor=WOOD, edgecolor=INK, linewidth=1.3, zorder=3.1, gid=gid))
        rect(-0.2, -0.09, 0.08, 0.18, DARK, z=3.2)
        poly([(-0.12, -0.13), (0.88, -0.13), (0.88, 0.13), (-0.12, 0.13)], STEEL)
        poly([(0.66, -0.13), (0.88, -0.13), (0.88, 0.13), (0.66, 0.13)], "#e5e8e8", z=3.1, lw=1.0)
    elif kind == "screwdriver":
        ax.add_patch(FancyBboxPatch(P(-0.88, -0.15), 0.7 * s, 0.3 * s, boxstyle="round,pad=0,rounding_size=0.12",
                                    facecolor="#e74c3c", edgecolor=INK, linewidth=1.3, zorder=3.1, gid=gid))
        for y in (-0.06, 0.06):
            line((-0.78, y), (-0.3, y), lw=1.0, z=3.2)
        rect(-0.18, -0.035, 0.86, 0.07, STEEL)
        poly([(0.68, -0.05), (0.88, -0.03), (0.88, 0.03), (0.68, 0.05)], STEEL, z=3.1)
    elif kind == "tape measure":
        rect(0.1, -0.5, 0.78, 0.16, "#f4d03f", z=2.9)
        for k in range(1, 8):
            line((0.1 + 0.1 * k, -0.34), (0.1 + 0.1 * k, -0.4 if k % 2 else -0.44), lw=1.0, z=3.0)
        rect(0.84, -0.54, 0.05, 0.24, DARK, z=3.0)
        ax.add_patch(FancyBboxPatch(P(-0.75, -0.55), 0.9 * s, 0.9 * s, boxstyle="round,pad=0,rounding_size=0.2",
                                    facecolor="#f4d03f", edgecolor=INK, linewidth=1.4, zorder=3.1, gid=gid))
        circ(-0.3, -0.1, 0.22, "#d4ac0d", z=3.2)
        circ(-0.3, -0.1, 0.07, DARK, z=3.3)
    elif kind == "try square":
        rect(-0.72, -0.62, 0.26, 1.2, WOOD)
        rect(-0.46, 0.34, 1.32, 0.16, STEEL, z=3.1)
        for k in range(1, 12):
            line((-0.46 + 0.11 * k, 0.5), (-0.46 + 0.11 * k, 0.43 if k % 2 else 0.4), lw=0.9, z=3.2)
        for y in (-0.4, 0.0, 0.4):
            circ(-0.59, y, 0.03, "#d4ac0d", z=3.3, lw=0.6)
    elif kind == "mason's square":
        poly([(-0.7, -0.62), (0.85, -0.62), (0.85, -0.48), (-0.56, -0.48), (-0.56, 0.62), (-0.7, 0.62)], STEEL)
        for k in range(1, 13):
            line((-0.56 + 0.11 * k, -0.48), (-0.56 + 0.11 * k, -0.53 if k % 2 else -0.56), lw=0.9, z=3.2)
        for k in range(1, 10):
            line((-0.56, -0.48 + 0.11 * k), (-0.61 if k % 2 else -0.64, -0.48 + 0.11 * k), lw=0.9, z=3.2)
    elif kind == "trowel":
        poly([(-0.88, -0.32), (0.3, -0.6), (0.45, -0.32), (0.3, -0.04)], STEEL)
        line((0.3, -0.32), (0.36, 0.14), lw=3.0, color=DARK)
        ax.add_patch(FancyBboxPatch(P(0.2, 0.12), 0.68 * s, 0.2 * s, boxstyle="round,pad=0,rounding_size=0.09",
                                    facecolor=WOOD, edgecolor=INK, linewidth=1.3, zorder=3.2, gid=gid))
    elif kind == "spirit level":
        rect(-0.9, -0.15, 1.8, 0.3, "#f4d03f")
        rect(-0.22, -0.09, 0.44, 0.18, "#d5f5e3", z=3.1)
        ax.add_patch(Ellipse(P(0.0, 0.0), 0.14 * s, 0.09 * s, facecolor="white", edgecolor=INK, linewidth=0.8, zorder=3.2,
                             gid=gid))
        for x in (-0.1, 0.1):
            line((x, -0.09), (x, 0.09), lw=1.0, z=3.3)
        for x in (-0.72, 0.72):
            circ(x, 0.0, 0.07, "#d5f5e3", z=3.1, lw=0.8)
    elif kind == "plumb bob":
        line((-0.3, 0.66), (0.3, 0.66), lw=4.0, color=WOOD)
        line((0.0, 0.66), (0.0, 0.08), lw=1.4, color=INK)
        poly([(-0.16, 0.08), (0.16, 0.08), (0.16, -0.12), (0.0, -0.62), (-0.16, -0.12)], "#d4ac0d")
    elif kind == "float":
        poly([(-0.35, -0.25), (-0.25, 0.22), (0.25, 0.22), (0.35, -0.25), (0.2, -0.25), (0.14, 0.06), (-0.14, 0.06),
              (-0.2, -0.25)], WOOD, z=3.1)
        rect(-0.88, -0.48, 1.76, 0.23, LIGHT_WOOD, z=3.2)
    elif kind == "shovel":
        stick(0.0, -0.08, 0.0, 0.5, 0.1, WOOD)
        poly([(-0.2, 0.5), (0.2, 0.5), (0.2, 0.68), (-0.2, 0.68)], WOOD, z=3.1)
        poly([(-0.12, 0.54), (0.12, 0.54), (0.12, 0.62), (-0.12, 0.62)], "white", z=3.2, lw=0.8)
        poly([(-0.34, -0.08), (0.34, -0.08), (0.34, -0.42), (0.0, -0.68), (-0.34, -0.42)], STEEL, z=3.2)
    elif kind == "spanner":
        ang = math.radians(25)
        ca, sa = math.cos(ang), math.sin(ang)

        def rot(x, y):
            return (x * ca - y * sa, x * sa + y * ca)

        poly([rot(-0.55, -0.07), rot(0.55, -0.07), rot(0.55, 0.07), rot(-0.55, 0.07)], STEEL)
        for end in (-1, 1):
            x0 = end * 0.62
            jaw = [rot(x0 + end * 0.2 * math.cos(t), 0.2 * math.sin(t)) for t in
                   [math.radians(a) for a in range(-150 if end > 0 else 30, 160 if end > 0 else 340, 10)]]
            poly(jaw, STEEL, z=3.1)
            poly([rot(x0 + end * 0.04, -0.075), rot(x0 + end * 0.25, -0.075), rot(x0 + end * 0.25, 0.075),
                  rot(x0 + end * 0.04, 0.075)], "#fbfcfc", z=3.2, lw=0.0)
    elif kind == "pliers":
        stick(0.02, 0.04, -0.86, 0.32, 0.13, "#e74c3c")
        stick(0.02, -0.04, -0.86, -0.32, 0.13, "#e74c3c")
        poly([(-0.05, 0.1), (0.8, 0.06), (0.86, 0.01), (-0.05, 0.0)], DARK, z=3.2)
        poly([(-0.05, 0.0), (0.86, -0.01), (0.8, -0.06), (-0.05, -0.1)], DARK, z=3.2)
        circ(0.02, 0.0, 0.08, STEEL, z=3.4)
    elif kind == "hacksaw":
        line((-0.5, 0.32), (0.82, 0.32), (0.82, -0.22), lw=4.5, color="#2e86c1")
        line((-0.5, 0.32), (-0.5, -0.05), lw=4.5, color="#2e86c1")
        rect(-0.5, -0.27, 1.32, 0.07, "#d5dbdb", z=3.1, lw=1.0)
        for k in range(13):
            x = -0.48 + 0.1 * k
            line((x, -0.27), (x + 0.05, -0.32), (x + 0.1, -0.27), lw=0.9, z=3.2)
        poly([(-0.48, 0.12), (-0.88, 0.02), (-0.88, -0.48), (-0.66, -0.48), (-0.48, -0.2)], "#1f618d", z=3.3)
    elif kind == "tyre pump":
        rect(-0.13, -0.45, 0.26, 0.82, "#e74c3c")
        line((0.0, 0.37), (0.0, 0.5), lw=2.0, color=DARK)
        rect(-0.42, 0.48, 0.84, 0.12, "#1c1c1c", z=3.2)
        rect(-0.4, -0.62, 0.8, 0.17, DARK, z=3.2)
        line((0.13, -0.3), (0.45, -0.25), (0.66, -0.02), (0.7, 0.3), lw=3.0, color="#1c1c1c")
        rect(0.64, 0.28, 0.12, 0.14, STEEL, z=3.3, lw=1.0)
    elif kind == "oil can":
        poly([(-0.12, 0.06), (0.8, 0.62), (0.82, 0.58), (-0.04, -0.02)], STEEL, z=3.0)
        rect(-0.55, -0.6, 0.8, 0.34, "#d4ac0d", z=3.1)
        poly([(-0.55, -0.26), (0.25, -0.26), (-0.04, 0.04), (-0.26, 0.04)], "#b7950b", z=3.2)
        rect(-0.2, 0.04, 0.12, 0.08, DARK, z=3.3, lw=1.0)
    elif kind == "anvil":
        poly([(-0.92, 0.32), (-0.35, 0.44), (0.66, 0.44), (0.66, 0.18), (0.38, 0.18), (0.24, -0.02), (0.3, -0.22),
              (0.5, -0.28), (0.5, -0.42), (-0.4, -0.42), (-0.4, -0.28), (-0.2, -0.22), (-0.14, -0.02), (-0.3, 0.16),
              (-0.6, 0.22)], "#424949")
        rect(-0.5, -0.66, 1.1, 0.24, WOOD, z=2.9)
    elif kind == "tongs":
        line((-0.88, 0.24), (0.25, 0.0), lw=4.5, color="#424949")
        line((-0.88, -0.24), (0.25, 0.0), lw=4.5, color="#424949")
        rect(0.55, -0.07, 0.38, 0.14, "#e67e22", z=3.0, lw=1.0)
        poly([(0.25, 0.03), (0.5, 0.16), (0.72, 0.1), (0.72, 0.07), (0.5, 0.11), (0.25, -0.03)], "#424949", z=3.2)
        poly([(0.25, -0.03), (0.5, -0.16), (0.72, -0.1), (0.72, -0.07), (0.5, -0.11), (0.25, 0.03)], "#424949", z=3.2)
        circ(0.25, 0.0, 0.06, STEEL, z=3.4)
    elif kind == "bellows":
        poly([(0.38, 0.03), (-0.62, 0.38), (-0.5, 0.0), (-0.62, -0.38), (0.38, -0.03)], "#a04000", z=3.0)
        line((0.4, 0.03), (-0.75, 0.42), lw=5.0, color=WOOD, z=3.1)
        line((0.4, -0.03), (-0.75, -0.42), lw=5.0, color=WOOD, z=3.1)
        rect(0.38, -0.05, 0.5, 0.1, STEEL, z=3.2, lw=1.0)
    elif kind == "bucket of water":
        poly([(-0.42, -0.6), (0.42, -0.6), (0.55, 0.3), (-0.55, 0.3)], STEEL)
        ax.add_patch(Ellipse(P(0.0, 0.22), 1.0 * s, 0.16 * s, facecolor="#5dade2", edgecolor=INK, linewidth=1.0, zorder=3.1,
                             gid=gid))
        ts = [math.pi * k / 20 for k in range(21)]
        line(*[(0.55 * math.cos(t), 0.3 + 0.32 * math.sin(t)) for t in ts], lw=1.8, color=DARK)
    else:
        raise ValueError(kind)


# --- drawing ----------------------------------------------------------------------------------------------------

BOX_W, GAP, BOX_H = 2.35, 0.3, 2.3
ROW = 0.56
WIDTH = 4 * BOX_W + 3 * GAP
SPLIT = 3.3  # where the table's two columns meet


def draw(p: dict):
    rows = sorted(p["tools"])
    table_h = ROW * (len(rows) + 1)
    y_box = table_h + 0.45
    fig, ax = new_figure(10.0, 6.4)
    for i, t in enumerate(p["tools"]):
        x0 = i * (BOX_W + GAP)
        ax.add_patch(FancyBboxPatch((x0, y_box), BOX_W, BOX_H, boxstyle="round,pad=0,rounding_size=0.12",
                                    facecolor="#fbfbf6", edgecolor=INK, linewidth=1.4, zorder=1, gid=f"box:{i}"))
        _tool(ax, PICTURE.get((p["set"], t), t), x0 + BOX_W / 2, y_box + 0.92, f"tool:{i}:{t}", 1.12)
        ax.add_patch(Circle((x0 + 0.36, y_box + BOX_H - 0.34), 0.25, facecolor="white", edgecolor=INK, linewidth=1.6,
                            zorder=6, gid=f"ring:{i}"))
        ax.text(x0 + 0.36, y_box + BOX_H - 0.34, "ABCD"[i], ha="center", va="center", fontsize=15, fontweight="bold",
                zorder=7, gid=f"letter:{'ABCD'[i]}")
    # the table: a header, then one row a tool, alphabetical
    ax.add_patch(Rectangle((0, 0), WIDTH, table_h, facecolor="white", edgecolor=INK, linewidth=1.4, zorder=1))
    ax.add_patch(Rectangle((0, table_h - ROW), WIDTH, ROW, facecolor="#e5e8e8", edgecolor=INK, linewidth=1.2, zorder=1.1))
    for k in range(1, len(rows) + 1):
        ax.plot([0, WIDTH], [table_h - ROW * k] * 2, color=INK, linewidth=1.0, zorder=1.2)
    ax.plot([SPLIT, SPLIT], [0, table_h], color=INK, linewidth=1.0, zorder=1.2)
    ax.text(0.2, table_h - ROW / 2, "Tool", ha="left", va="center", fontsize=12.5, fontweight="bold")
    ax.text(SPLIT + 0.2, table_h - ROW / 2, "Used for", ha="left", va="center", fontsize=12.5, fontweight="bold")
    for k, t in enumerate(rows):
        y = table_h - ROW * (k + 1.5)
        ax.text(0.2, y, t.capitalize(), ha="left", va="center", fontsize=12, gid=f"name:{t}")
        ax.text(SPLIT + 0.2, y, USE[p["set"]][t], ha="left", va="center", fontsize=12, gid=f"use:{t}")
    ax.text(WIDTH / 2, y_box + BOX_H + 0.35, TITLE[p["set"]], ha="center", va="center", fontsize=14, fontweight="bold")
    ax.set_xlim(-0.05, WIDTH + 0.05)
    ax.set_ylim(-0.05, y_box + BOX_H + 0.65)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------------------

VERBS = ["looks at", "studies", "points at", "talks about", "draws"]
SETTINGS = ["in a science lesson", "at school", "in class", "with a friend", "at home", "in the school workshop",
            "for homework"]


def questions(p: dict, rng: random.Random) -> list:
    table, tools = USE[p["set"]], p["tools"]
    who = rng.choice(NAMES)
    i, j = p["ask_use"], p["ask_letter"]
    first = Question("mcq", f"{who} {rng.choice(VERBS)} these {NOUN[p['set']]} {rng.choice(SETTINGS)}. "
                            f"Which letter shows the tool used for {table[tools[i]]}?", str(i), list("ABCD"))
    second = mcq(f"What is tool {'ABCD'[j]} used for?", table[tools[j]], [table[t] for t in tools if t != tools[j]],
                 rng)
    return [first, second]
