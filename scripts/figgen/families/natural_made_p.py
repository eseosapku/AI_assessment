"""Natural things and things made by people (P1 to P3, Science and Elementary Technology): eight picture cards in two
rows, each a simple drawing with its name under it and a letter (A to H) in its corner. Three to five are natural
(a stone, a leaf, a feather, a snail shell, a flower, a stick) and the rest are made by people (a cup, a chair, a ball,
a pencil, a bottle, a spoon, a bucket, a book), by the fixed table below, which a Primary teacher agrees with.

Which letter shows a thing made by people (or a natural thing): one card of that group among three of the other; and
how many of the things are natural (or made by people), counted from the cards.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import INK, NAMES, Question, count, new_figure
from ._bio_parts import tube

ID = "natural_made_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.natural-and-artificial-materials",)
# A topic whose sections the book lists is reached only if its name or a section names natural or artificial things.
NEEDS = r"natural (?:and artificial|things)|artificial|made by people|man-?made"
AVOID = (r"\bcells?\b|science in context|glossary|toys|objects production|waste|rocks|sexual|hiv|pregnan|"
         r"social factors|reproduction system")

NATURAL = ["stone", "leaf", "feather", "snail shell", "flower", "stick"]
MADE = ["cup", "chair", "ball", "pencil", "bottle", "spoon", "bucket", "book"]


def stages(p: dict) -> tuple[int, int]:
    return (1, 3)


def sample(rng: random.Random) -> dict:
    n = rng.randint(3, 5)
    things = rng.sample(NATURAL, n) + rng.sample(MADE, 8 - n)
    rng.shuffle(things)
    return {"band": "P", "things": things, "ask": rng.choice(["made", "natural"]), "count": rng.choice(["made", "natural"])}


# --- the pictures: each drawn about (x, y), about 1.6 wide and 1.3 tall ----------------------------------

def _poly(ax, pts, face, gid, z=3, lw=1.2):
    ax.add_patch(Polygon(pts, closed=True, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z, gid=gid))


def _stone(ax, x, y, gid):
    pts = [(-0.7, -0.35), (-0.45, 0.3), (0.0, 0.5), (0.5, 0.38), (0.75, -0.05), (0.55, -0.45), (-0.1, -0.55)]
    _poly(ax, [(x + a, y + b) for a, b in pts], "#a6a6a6", gid)
    _poly(ax, [(x - 0.25, y + 0.2), (x + 0.05, y + 0.33), (x + 0.2, y + 0.2), (x - 0.05, y + 0.1)], "#cfcfcf", gid, z=3.1,
          lw=0.6)


def _leaf(ax, x, y, gid):
    a = math.radians(35)
    ux, uy = math.cos(a), math.sin(a)
    nx, ny = -uy, ux
    bx, by = x - 0.6 * ux, y - 0.6 * uy
    side = [(bx + ux * 1.3 * t + nx * 0.36 * math.sin(math.pi * t) ** 0.8,
             by + uy * 1.3 * t + ny * 0.36 * math.sin(math.pi * t) ** 0.8) for t in (k / 20 for k in range(21))]
    other = [(bx + ux * 1.3 * t - nx * 0.36 * math.sin(math.pi * t) ** 0.8,
              by + uy * 1.3 * t - ny * 0.36 * math.sin(math.pi * t) ** 0.8) for t in (k / 20 for k in range(20, -1, -1))]
    _poly(ax, side + other, "#7fb35f", gid)
    ax.plot([bx - 0.2 * ux, bx + 1.3 * ux], [by - 0.2 * uy, by + 1.3 * uy], color="#3e6b2c", linewidth=1.2, zorder=3.1,
            gid=gid)


def _feather(ax, x, y, gid):
    ax.add_patch(Ellipse((x, y), 1.5, 0.42, angle=30, facecolor="#f2f2f2", edgecolor=INK, linewidth=1.1, zorder=3, gid=gid))
    a = math.radians(30)
    ux, uy = math.cos(a), math.sin(a)
    ax.plot([x - 0.85 * ux, x + 0.72 * ux], [y - 0.85 * uy, y + 0.72 * uy], color=INK, linewidth=1.2, zorder=3.1, gid=gid)
    for t in (-0.45, -0.15, 0.15, 0.45):
        cx, cy = x + t * ux, y + t * uy
        for s in (1, -1):
            ax.plot([cx, cx + 0.12 * ux - s * 0.15 * uy], [cy, cy + 0.12 * uy + s * 0.15 * ux], color="#888888",
                    linewidth=0.8, zorder=3.1, gid=gid)


def _shell(ax, x, y, gid):
    ax.add_patch(Circle((x, y), 0.55, facecolor="#d9b27c", edgecolor=INK, linewidth=1.2, zorder=3, gid=gid))
    pts = [(x + 0.5 * (t / 15) * math.cos(t), y + 0.5 * (t / 15) * math.sin(t)) for t in (k / 10 for k in range(0, 151))]
    ax.plot([a for a, _ in pts], [b for _, b in pts], color="#7a5428", linewidth=1.2, zorder=3.1, gid=gid)


def _flower(ax, x, y, gid):
    ax.plot([x, x], [y - 0.6, y + 0.05], color="#3e6b2c", linewidth=2.0, zorder=2.9, gid=gid)
    pts = [(x + (0.3 + 0.13 * math.cos(5 * t)) * math.cos(t), y + 0.2 + (0.3 + 0.13 * math.cos(5 * t)) * math.sin(t))
           for t in (2 * math.pi * k / 80 for k in range(80))]
    _poly(ax, pts, "#f2a9c4", gid)
    ax.add_patch(Circle((x, y + 0.2), 0.1, facecolor="#f4d03f", edgecolor=INK, linewidth=0.8, zorder=3.1, gid=gid))


def _stick(ax, x, y, gid):
    _poly(ax, tube([(x - 0.75, y - 0.3), (x, y - 0.05), (x + 0.75, y + 0.3)], 0.14), "#9b7240", gid)
    _poly(ax, tube([(x + 0.1, y - 0.01), (x + 0.3, y + 0.35)], 0.08), "#9b7240", gid, z=2.9)


def _cup(ax, x, y, gid):
    _poly(ax, [(x - 0.45, y + 0.4), (x + 0.35, y + 0.4), (x + 0.28, y - 0.45), (x - 0.38, y - 0.45)], "#5dade2", gid)
    ring = [(x + 0.32 + 0.28 * math.cos(t), y + 0.02 + 0.22 * math.sin(t)) for t in
            (math.radians(d) for d in range(-90, 91, 10))]
    inner = [(x + 0.32 + 0.16 * math.cos(t), y + 0.02 + 0.11 * math.sin(t)) for t in
             (math.radians(d) for d in range(90, -91, -10))]
    _poly(ax, ring + inner, "#5dade2", gid, z=2.9)


def _chair(ax, x, y, gid):
    face = "#b9770e"
    ax.add_patch(Rectangle((x - 0.45, y - 0.05), 0.9, 0.15, facecolor=face, edgecolor=INK, linewidth=1.1, zorder=3, gid=gid))
    ax.add_patch(Rectangle((x - 0.45, y + 0.1), 0.13, 0.55, facecolor=face, edgecolor=INK, linewidth=1.1, zorder=3, gid=gid))
    ax.add_patch(Rectangle((x - 0.45, y + 0.5), 0.6, 0.12, facecolor=face, edgecolor=INK, linewidth=1.1, zorder=3, gid=gid))
    for lx in (x - 0.43, x + 0.32):
        ax.add_patch(Rectangle((lx, y - 0.6), 0.11, 0.55, facecolor=face, edgecolor=INK, linewidth=1.1, zorder=3, gid=gid))


def _ball(ax, x, y, gid):
    ax.add_patch(Circle((x, y), 0.5, facecolor="#f5b041", edgecolor=INK, linewidth=1.2, zorder=3, gid=gid))
    for s in (-1, 1):
        pts = [(x + s * 0.18 + 0.12 * s * math.cos(t), y + 0.46 * math.sin(t)) for t in
               (math.radians(d) for d in range(-75, 76, 5))]
        ax.plot([a for a, _ in pts], [b for _, b in pts], color=INK, linewidth=1.0, zorder=3.1, gid=gid)
    ax.plot([x - 0.5, x + 0.5], [y, y], color=INK, linewidth=1.0, zorder=3.1, gid=gid)


def _pencil(ax, x, y, gid):
    a = math.radians(25)
    ux, uy = math.cos(a), math.sin(a)
    nx, ny = -uy, ux
    w = 0.13

    def at(t, s):
        return (x + ux * t + nx * w * s, y + uy * t + ny * w * s)

    _poly(ax, [at(-0.8, -1), at(0.45, -1), at(0.45, 1), at(-0.8, 1)], "#f4d03f", gid)
    _poly(ax, [at(0.45, -1), at(0.78, 0), at(0.45, 1)], "#f0d9b5", gid)
    _poly(ax, [at(0.68, -0.3), at(0.78, 0), at(0.68, 0.3)], "#333333", gid, z=3.1, lw=0.6)
    _poly(ax, [at(-0.98, -1), at(-0.8, -1), at(-0.8, 1), at(-0.98, 1)], "#f1948a", gid)


def _bottle(ax, x, y, gid):
    _poly(ax, [(x - 0.28, y - 0.62), (x + 0.28, y - 0.62), (x + 0.28, y + 0.15), (x + 0.12, y + 0.35), (x + 0.12, y + 0.5),
               (x - 0.12, y + 0.5), (x - 0.12, y + 0.35), (x - 0.28, y + 0.15)], "#aed6f1", gid)
    ax.add_patch(Rectangle((x - 0.14, y + 0.5), 0.28, 0.14, facecolor="#2e86c1", edgecolor=INK, linewidth=1.0, zorder=3.1,
                           gid=gid))
    ax.add_patch(Rectangle((x - 0.28, y - 0.25), 0.56, 0.22, facecolor="#f5f5f5", edgecolor=INK, linewidth=0.8, zorder=3.1,
                           gid=gid))


def _spoon(ax, x, y, gid):
    a = math.radians(-30)
    ux, uy = math.cos(a), math.sin(a)
    ax.add_patch(Ellipse((x + 0.45 * ux, y + 0.45 * uy), 0.55, 0.36, angle=-30, facecolor="#cfd8dc", edgecolor=INK,
                         linewidth=1.1, zorder=3, gid=gid))
    _poly(ax, tube([(x - 0.8 * ux, y - 0.8 * uy), (x + 0.2 * ux, y + 0.2 * uy)], 0.1), "#cfd8dc", gid, z=2.9)


def _bucket(ax, x, y, gid):
    _poly(ax, [(x - 0.5, y + 0.35), (x + 0.5, y + 0.35), (x + 0.38, y - 0.55), (x - 0.38, y - 0.55)], "#58d68d", gid)
    ax.add_patch(Ellipse((x, y + 0.35), 1.0, 0.18, facecolor="#2e8b57", edgecolor=INK, linewidth=1.0, zorder=3.1, gid=gid))
    pts = [(x + 0.5 * math.cos(t), y + 0.35 + 0.35 * math.sin(t)) for t in (math.radians(d) for d in range(0, 181, 10))]
    ax.plot([a for a, _ in pts], [b for _, b in pts], color=INK, linewidth=1.3, zorder=3.2, gid=gid)


def _book(ax, x, y, gid):
    ax.add_patch(Rectangle((x - 0.45, y - 0.55), 0.9, 1.1, facecolor="#c0392b", edgecolor=INK, linewidth=1.2, zorder=3,
                           gid=gid))
    ax.add_patch(Rectangle((x - 0.45, y - 0.55), 0.14, 1.1, facecolor="#922b21", edgecolor=INK, linewidth=1.0, zorder=3.1,
                           gid=gid))
    ax.add_patch(Rectangle((x - 0.15, y + 0.1), 0.48, 0.25, facecolor="#fdebd0", edgecolor=INK, linewidth=0.8, zorder=3.1,
                           gid=gid))


DRAW = {"stone": _stone, "leaf": _leaf, "feather": _feather, "snail shell": _shell, "flower": _flower, "stick": _stick,
        "cup": _cup, "chair": _chair, "ball": _ball, "pencil": _pencil, "bottle": _bottle, "spoon": _spoon,
        "bucket": _bucket, "book": _book}

W, H, GAP = 2.4, 2.5, 0.3


def draw(p: dict):
    fig, ax = new_figure(9.0, 5.6)
    for i, thing in enumerate(p["things"]):
        L = chr(65 + i)
        col, row = i % 4, i // 4
        x0, y0 = col * (W + GAP), -row * (H + GAP)
        ax.add_patch(FancyBboxPatch((x0, y0), W, H, boxstyle="round,pad=0,rounding_size=0.15", facecolor="white",
                                    edgecolor=INK, linewidth=1.3, zorder=1, gid=f"card:{L}"))
        ax.text(x0 + 0.25, y0 + H - 0.27, L, ha="center", va="center", fontsize=14, fontweight="bold", zorder=5,
                gid=f"letter:{L}")
        DRAW[thing](ax, x0 + W / 2 + 0.1, y0 + 1.42, f"pic:{L}:{thing}")
        ax.text(x0 + W / 2, y0 + 0.3, thing, ha="center", va="center", fontsize=12, zorder=5, gid=f"name:{L}")
    ax.set_xlim(-0.1, 4 * W + 3 * GAP + 0.1)
    ax.set_ylim(-H - GAP - 0.1, H + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Things around us", fontsize=13)
    return fig


# --- questions --------------------------------------------------------------------------------------

VERBS = ["looked at", "sorted", "drew", "cut out", "talked about"]
SETTINGS = ["in a science lesson", "at school in Huye", "at home in Musanze", "in class", "for homework",
            "at the science club", "in Kigali", "near Lake Kivu"]
GROUP = {"made": ("a thing made by people", "How many things in the picture are made by people?"),
         "natural": ("a natural thing", "How many natural things are in the picture?")}


def questions(p: dict, rng: random.Random) -> list:
    things = p["things"]
    letters = [chr(65 + i) for i in range(len(things))]
    made = [L for L, t in zip(letters, things) if t in MADE]
    natural = [L for L, t in zip(letters, things) if t in NATURAL]
    right, wrong = (made, natural) if p["ask"] == "made" else (natural, made)
    key = rng.choice(right)
    options = sorted([key] + rng.sample(wrong, 3))
    qs = [Question("mcq", f"{rng.choice(NAMES)} {rng.choice(VERBS)} these pictures {rng.choice(SETTINGS)}. "
                          f"Which letter shows {GROUP[p['ask']][0]}?", str(options.index(key)), options)]
    n = len(made) if p["count"] == "made" else len(natural)
    qs.append(count(GROUP[p["count"]][1], n, "things"))
    return qs
