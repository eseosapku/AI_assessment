"""Cells (P, LS, UP): a plant cell and an animal cell side by side, or four specialised cells.

Plant and animal: "Cell 1" and "Cell 2" (which one is the plant cell varies), the plant cell with its wall, membrane,
cytoplasm, nucleus, a large vacuole and green chloroplasts; the animal cell with its membrane, cytoplasm, nucleus
and (LS, UP) mitochondria. Three (P) or four (LS, UP) parts are lettered, each by a leader line that ends on its
part; exactly one lettered part is one only plant cells have. Lower and upper secondary figures print a table of
what each part does. Asks which letter shows a part (by its job, or by name at Primary), which letter shows a part
only plant cells have, and how many chloroplasts the plant cell has.

Specialised cells (LS, UP): four of a red blood cell, nerve cell, root hair cell, palisade cell, ciliated cell and
muscle cell, lettered A to D, with a table of each drawn cell's job. Asks which letter shows the cell with a job,
which lettered cell has no nucleus (or has chloroplasts), and the job of a lettered cell.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import INK, NAMES, count, mcq, new_figure

ID = "cell_diagram"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("P", "LS", "UP")
CONCEPTS = ("biology.cell-structure", "biology.animal-plant-cells")
# Integrated and Primary Science teach cells too: their cell chapters carry these.
ALSO = ("science.cell-structure", "science.cells-tissues-organs")
NEEDS = r"\bcells?\b|cell structure|organelle|speciali[sz]ed|tissues?|plant and animal"
# Chapters that carry a cell concept but teach something else: the skills strands, division, membranes and
# transport, the senses and muscles, respiration; and the chapters no figure here serves.
AVOID = (r"glossary|science in context|thinking and working|scientific method|science skills|division|mitotic|"
         r"cycle|membrane|transport|respiration|sensory|muscle|sexual|pregnan|hiv|reproduction system|social factors|"
         r"stem cell|cancer|immun|movement into|into and out of")

WALL, CYTO, VAC, NUC, CHLORO, MITO = "#d5ddb4", "#f6f4e6", "#dbe8f4", "#b9b9b9", "#6aa84f", "#e8c9a0"
PLANT_ONLY = ["cell wall", "chloroplast", "vacuole"]
SHARED = ["nucleus", "cytoplasm", "cell membrane", "mitochondrion"]
JOBS = {"nucleus": "controls the activities of the cell", "cell membrane": "controls what enters and leaves the cell",
        "cell wall": "supports the cell and keeps its shape", "cytoplasm": "is where most chemical reactions happen",
        "chloroplast": "absorbs light for photosynthesis", "vacuole": "stores cell sap and keeps the cell firm",
        "mitochondrion": "releases energy by aerobic respiration"}
TABLE_ORDER = ["nucleus", "cytoplasm", "cell membrane", "cell wall", "vacuole", "chloroplast", "mitochondrion"]

CELL_JOBS = {"red blood cell": "carries oxygen around the body",
             "nerve cell": "carries electrical impulses around the body",
             "root hair cell": "takes in water and mineral ions from the soil",
             "palisade cell": "carries out most of the photosynthesis in a leaf",
             "ciliated cell": "moves mucus along the airways",
             "muscle cell": "contracts to move part of the body"}
NO_NUCLEUS = {"red blood cell"}
HAS_CHLOROPLASTS = {"palisade cell"}

# Plant cell geometry, relative to its centre (cx, 3): outer wall, membrane inset, organelles, and the chloroplast
# spots (the first always drawn; it is the one a letter may point to), clear of every leader's path.
PW, PH, INSET = 1.9, 1.8, 0.15
P_NUC = (-1.0, 0.95, 0.38)
P_VAC = (0.35, -0.25, 2.0, 2.0)
CHLORO_SPOTS = [(-1.3, 0.0, 0), (-0.2, 1.35, 0), (0.5, 1.35, 0), (1.3, 1.35, 0), (-0.25, -1.45, 0), (0.95, -1.45, 0),
                (1.55, -0.6, 90), (1.55, 0.2, 90)]
# Where each plant part's letter goes and where its leader ends.
P_SLOTS = {"nucleus": ((-1.0, 2.5), (-1.0, 0.95)), "cell wall": ((1.0, 2.5), (1.0, 1.8 - 0.07)),
           "vacuole": ((0.35, -2.45), (0.35, -0.25)), "cytoplasm": ((-1.2, -2.45), (-1.2, -0.8)),
           "chloroplast": ((-2.45, 0.0), (-1.3, 0.0))}
# Plant mitochondria (LS, UP), clear of the vacuole, the chloroplast spots and every leader.
P_MITO = [(-0.85, -1.0, 60), (1.3, 0.85, 90)]
# Animal cell: a gently uneven outline, its nucleus and three mitochondria.
A_NUC = (-0.35, 0.35, 0.42)
MITO_SPOTS = [(0.8, 0.7, 20), (0.95, -0.55, -30), (-0.9, -0.75, 60)]
A_SLOTS = {"nucleus": ((-0.35, 2.5), (-0.35, 0.35)), "mitochondrion": ((0.8, 2.5), (0.8, 0.7)),
           "cytoplasm": ((0.2, -2.45), (0.2, -1.0))}
MEMBRANE_AT = -60  # degrees round the animal cell where the membrane's leader ends


def stages(p: dict):
    return (4, 6) if p["band"] == "P" else None


def _animal_outline(cx: float, cy: float = 3.0) -> list[tuple[float, float]]:
    pts = []
    for k in range(180):
        t = 2 * math.pi * k / 180
        w = 1 + 0.05 * math.sin(3 * t) + 0.03 * math.cos(5 * t)
        pts.append((cx + 1.8 * w * math.cos(t), cy + 1.45 * w * math.sin(t)))
    return pts


def _membrane_point(cx: float) -> tuple[float, float]:
    pts = _animal_outline(cx)
    return pts[int(round((MEMBRANE_AT % 360) / 2)) % 180]


# --- sampling ----------------------------------------------------------------------------------------------

def _plant_animal(band: str, rng: random.Random) -> dict:
    only = rng.choice(PLANT_ONLY)
    shared = ["nucleus", "cytoplasm", "cell membrane"] + ([] if band == "P" else ["mitochondrion"])
    picks = rng.sample(shared, 2 if band == "P" else 3)
    parts = [["plant", only]]
    for part in picks:
        if part == "cell membrane" or part == "mitochondrion":
            cell = "animal"
        else:
            cell = rng.choice(["plant", "animal"])
        parts.append([cell, part])
    letters = rng.sample("ABCD"[:len(parts)], len(parts))
    n = rng.randint(4, 6) if band == "P" else rng.randint(4, 8)
    spots = [0] + sorted(rng.sample(range(1, len(CHLORO_SPOTS)), n - 1))
    return {"plant_side": rng.choice(["left", "right"]), "letters": dict(sorted(zip(letters, parts))),
            "chloroplasts": n, "spots": spots, "ask": rng.choice(picks)}


def _specialised(rng: random.Random) -> dict:
    second = rng.choice(["no nucleus", "chloroplasts"])
    must = "red blood cell" if second == "no nucleus" else "palisade cell"
    rest = rng.sample([c for c in CELL_JOBS if c != must], 3)
    cells = [must] + rest
    rng.shuffle(cells)
    ask_job = rng.choice([c for c in cells if c != must])
    third = rng.choice([c for c in cells if c not in (must, ask_job)])
    return {"cells": cells, "second": second, "ask_job": ask_job, "ask_third": "ABCD"[cells.index(third)],
            "table": rng.sample(cells, 4)}


def sample(rng: random.Random) -> dict:
    band = rng.choice(list(BANDS))
    kind = "plant_animal" if band == "P" else rng.choice(["plant_animal", "specialised"])
    p = {"band": band, "kind": kind, "name": rng.choice(NAMES)}
    p.update(_plant_animal(band, rng) if kind == "plant_animal" else _specialised(rng))
    return p


# --- drawing: plant and animal -----------------------------------------------------------------------------

def _plant(ax, cx: float, p: dict, lw: float) -> None:
    cy = 3.0
    ax.add_patch(FancyBboxPatch((cx - PW, cy - PH), 2 * PW, 2 * PH, boxstyle="round,pad=0,rounding_size=0.25",
                                facecolor=WALL, edgecolor=INK, linewidth=lw, zorder=1, gid="part:plant:outline"))
    ax.add_patch(FancyBboxPatch((cx - PW + INSET, cy - PH + INSET), 2 * (PW - INSET), 2 * (PH - INSET),
                                boxstyle="round,pad=0,rounding_size=0.18", facecolor=CYTO, edgecolor=INK,
                                linewidth=lw * 0.8, zorder=2, gid="part:plant:inner"))
    vx, vy, vw, vh = P_VAC
    ax.add_patch(Ellipse((cx + vx, cy + vy), vw, vh, facecolor=VAC, edgecolor=INK, linewidth=lw * 0.8, zorder=3,
                         gid="part:plant:vacuole"))
    nx, ny, r = P_NUC
    ax.add_patch(Circle((cx + nx, cy + ny), r, facecolor=NUC, edgecolor=INK, linewidth=lw * 0.8, zorder=4,
                        gid="part:plant:nucleus"))
    if p["band"] != "P":
        for k, (mx, my, ang) in enumerate(P_MITO):
            _mito(ax, cx + mx, cy + my, ang, f"part:plant:mitochondrion:{k}")
    for k in p["spots"]:
        sx, sy, ang = CHLORO_SPOTS[k]
        ax.add_patch(Ellipse((cx + sx, cy + sy), 0.42, 0.22, angle=ang, facecolor=CHLORO, edgecolor=INK,
                             linewidth=0.8, zorder=4, gid=f"part:plant:chloroplast:{k}"))


def _animal(ax, cx: float, p: dict, lw: float) -> None:
    cy = 3.0
    ax.add_patch(Polygon(_animal_outline(cx, cy), closed=True, facecolor=CYTO, edgecolor=INK, linewidth=lw, zorder=2,
                         gid="part:animal:outline"))
    nx, ny, r = A_NUC
    ax.add_patch(Circle((cx + nx, cy + ny), r, facecolor=NUC, edgecolor=INK, linewidth=lw * 0.8, zorder=4,
                        gid="part:animal:nucleus"))
    if p["band"] != "P":
        for k, (mx, my, ang) in enumerate(MITO_SPOTS):
            _mito(ax, cx + mx, cy + my, ang, f"part:animal:mitochondrion:{k}")


def _mito(ax, x: float, y: float, ang: float, gid: str) -> None:
    """A mitochondrion: a small oval with its inner folds as a short zigzag along the long axis."""
    ax.add_patch(Ellipse((x, y), 0.5, 0.24, angle=ang, facecolor=MITO, edgecolor=INK, linewidth=0.8, zorder=4, gid=gid))
    a = math.radians(ang)
    zig = [(-0.16 + 0.08 * i, 0.05 * (1 if i % 2 else -1)) for i in range(5)]
    ax.plot([x + u * math.cos(a) - v * math.sin(a) for u, v in zig],
            [y + u * math.sin(a) + v * math.cos(a) for u, v in zig], color=INK, linewidth=0.6, zorder=5)


def _letter(ax, letter: str, at, end, size: float) -> None:
    (lx, ly), (ex, ey) = at, end
    # the leader starts just clear of the letter, on the side facing its part
    dx, dy = ex - lx, ey - ly
    d = math.hypot(dx, dy)
    gap = 0.22 if size < 13 else 0.26
    ax.plot([lx + dx / d * gap, ex], [ly + dy / d * gap, ey], color=INK, linewidth=1.0, zorder=6, gid=f"leader:{letter}")
    ax.text(lx, ly, letter, ha="center", va="center", fontsize=size, fontweight="bold", zorder=7, gid=f"letter:{letter}")


def _draw_plant_animal(p: dict):
    primary = p["band"] == "P"
    centres = {"plant": 2.6, "animal": 7.6} if p["plant_side"] == "left" else {"plant": 7.6, "animal": 2.6}
    table = not primary
    fig, ax = new_figure(8.6, 7.6 if table else 5.0)
    lw = 1.6 if primary else 1.3
    _plant(ax, centres["plant"], p, lw)
    _animal(ax, centres["animal"], p, lw)
    size = 15 if primary else 12.5
    for letter, (cell, part) in p["letters"].items():
        cx = centres[cell]
        if cell == "plant":
            (lx, ly), (ex, ey) = P_SLOTS[part]
            end = (cx + ex, 3.0 + ey)
        elif part == "cell membrane":
            end = _membrane_point(cx)
            lx, ly = end[0] - cx, -2.45
        else:
            (lx, ly), (ex, ey) = A_SLOTS[part]
            end = (cx + ex, 3.0 + ey)
        _letter(ax, letter, (cx + lx, 3.0 + ly), end, size)
    for cell, cx in centres.items():
        k = 1 if cx < 5 else 2
        ax.text(cx, 6.25, f"Cell {k}", ha="center", va="center", fontsize=14 if primary else 12, fontweight="bold")
    bottom = 0.1
    if table:
        h, w0, w1 = 0.42, 2.6, 7.0
        top = 0.0
        x0 = (10.2 - w0 - w1) / 2
        ax.add_patch(Rectangle((x0, top - h), w0, h, facecolor="#eeeeee", edgecolor=INK, linewidth=1.0))
        ax.add_patch(Rectangle((x0 + w0, top - h), w1, h, facecolor="#eeeeee", edgecolor=INK, linewidth=1.0))
        ax.text(x0 + w0 / 2, top - h / 2, "Part", ha="center", va="center", fontsize=10, fontweight="bold")
        ax.text(x0 + w0 + w1 / 2, top - h / 2, "What it does", ha="center", va="center", fontsize=10, fontweight="bold")
        for i, part in enumerate(TABLE_ORDER):
            y = top - (i + 2) * h
            ax.add_patch(Rectangle((x0, y), w0, h, facecolor="white", edgecolor=INK, linewidth=1.0))
            ax.add_patch(Rectangle((x0 + w0, y), w1, h, facecolor="white", edgecolor=INK, linewidth=1.0))
            ax.text(x0 + 0.12, y + h / 2, part, ha="left", va="center", fontsize=10)
            ax.text(x0 + w0 + 0.12, y + h / 2, JOBS[part], ha="left", va="center", fontsize=10)
        bottom = top - (len(TABLE_ORDER) + 1) * h - 0.05
    ax.set_xlim(-0.2, 10.4)
    ax.set_ylim(bottom, 6.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- drawing: specialised cells ----------------------------------------------------------------------------

def _rbc(ax, x, y):
    ax.add_patch(Circle((x, y), 0.75, facecolor="#e7a1a1", edgecolor=INK, linewidth=1.3, zorder=2, gid="cell:rbc"))
    ax.add_patch(Circle((x, y), 0.34, facecolor="#f4d0d0", edgecolor="#b56b6b", linewidth=0.8, zorder=3))


def _nerve(ax, x, y):
    bx, by = x, y + 1.0
    ax.plot([bx, bx], [by - 0.3, y - 1.25], color=INK, linewidth=2.2, zorder=2)  # the axon
    for dx in (-0.25, 0.0, 0.25):
        ax.plot([x, x + dx], [y - 1.25, y - 1.55], color=INK, linewidth=1.2, zorder=2)
    for ang in (100, 140, 40, 70, 175, 5):
        a = math.radians(ang)
        ex, ey = bx + 0.75 * math.cos(a), by + 0.6 * math.sin(a)
        ax.plot([bx + 0.3 * math.cos(a), ex], [by + 0.3 * math.sin(a), ey], color=INK, linewidth=1.2, zorder=2)
    ax.add_patch(Circle((bx, by), 0.33, facecolor="#e9e3cf", edgecolor=INK, linewidth=1.3, zorder=3))
    ax.add_patch(Circle((bx, by), 0.12, facecolor=NUC, edgecolor=INK, linewidth=0.8, zorder=4, gid="nucleus"))


def _root_hair(ax, x, y):
    pts = [(x - 1.0, y - 0.55), (x + 0.05, y - 0.55), (x + 0.05, y - 0.12), (x + 1.05, y - 0.12), (x + 1.12, y - 0.02),
           (x + 1.05, y + 0.08), (x + 0.05, y + 0.08), (x + 0.05, y + 0.55), (x - 1.0, y + 0.55)]
    ax.add_patch(Polygon(pts, closed=True, facecolor=CYTO, edgecolor=INK, linewidth=1.3, zorder=2))
    ax.add_patch(Ellipse((x - 0.5, y), 0.7, 0.62, facecolor=VAC, edgecolor=INK, linewidth=0.8, zorder=3))
    ax.add_patch(Circle((x - 0.1, y + 0.3), 0.12, facecolor=NUC, edgecolor=INK, linewidth=0.8, zorder=4, gid="nucleus"))


def _palisade(ax, x, y):
    ax.add_patch(FancyBboxPatch((x - 0.45, y - 1.4), 0.9, 2.8, boxstyle="round,pad=0,rounding_size=0.15",
                                facecolor=CYTO, edgecolor=INK, linewidth=1.3, zorder=2))
    ax.add_patch(Ellipse((x, y - 0.2), 0.45, 1.6, facecolor=VAC, edgecolor=INK, linewidth=0.8, zorder=3))
    ax.add_patch(Circle((x, y + 0.95), 0.13, facecolor=NUC, edgecolor=INK, linewidth=0.8, zorder=4, gid="nucleus"))
    for k in range(7):
        for side in (-1, 1):
            ax.add_patch(Ellipse((x + side * 0.33, y - 1.15 + 0.38 * k), 0.12, 0.26, facecolor=CHLORO, edgecolor=INK,
                                 linewidth=0.6, zorder=4, gid="chloroplast"))


def _ciliated(ax, x, y):
    ax.add_patch(Rectangle((x - 0.5, y - 1.2), 1.0, 2.2, facecolor=CYTO, edgecolor=INK, linewidth=1.3, zorder=2))
    for k in range(9):
        cx = x - 0.44 + 0.11 * k
        ax.plot([cx, cx + 0.04, cx], [y + 1.0, y + 1.2, y + 1.38], color=INK, linewidth=1.0, zorder=2)
    ax.add_patch(Ellipse((x, y - 0.6), 0.36, 0.5, facecolor=NUC, edgecolor=INK, linewidth=0.8, zorder=4, gid="nucleus"))


def _muscle(ax, x, y):
    """A smooth muscle cell: a long spindle with one long nucleus."""
    right = [(x + 0.28 * math.sin(math.pi * k / 30), y - 1.5 + 0.1 * k) for k in range(31)]
    left = [(x - 0.28 * math.sin(math.pi * k / 30), y + 1.5 - 0.1 * k) for k in range(31)]
    ax.add_patch(Polygon(right + left, closed=True, facecolor="#efd2d2", edgecolor=INK, linewidth=1.3, zorder=2))
    ax.add_patch(Ellipse((x, y), 0.14, 0.5, facecolor=NUC, edgecolor=INK, linewidth=0.8, zorder=4, gid="nucleus"))


DRAW = {"red blood cell": _rbc, "nerve cell": _nerve, "root hair cell": _root_hair, "palisade cell": _palisade,
        "ciliated cell": _ciliated, "muscle cell": _muscle}


def _draw_specialised(p: dict):
    fig, ax = new_figure(8.6, 6.6)
    for i, cell in enumerate(p["cells"]):
        x = 1.3 + 2.55 * i
        DRAW[cell](ax, x, 3.0)
        ax.text(x, 0.95, "ABCD"[i], ha="center", va="center", fontsize=13, fontweight="bold")
    h, w0, w1 = 0.45, 2.6, 6.9
    x0 = (10.2 - w0 - w1) / 2
    top = 0.45
    ax.add_patch(Rectangle((x0, top - h), w0, h, facecolor="#eeeeee", edgecolor=INK, linewidth=1.0))
    ax.add_patch(Rectangle((x0 + w0, top - h), w1, h, facecolor="#eeeeee", edgecolor=INK, linewidth=1.0))
    ax.text(x0 + w0 / 2, top - h / 2, "Cell", ha="center", va="center", fontsize=10, fontweight="bold")
    ax.text(x0 + w0 + w1 / 2, top - h / 2, "Its job", ha="center", va="center", fontsize=10, fontweight="bold")
    for i, cell in enumerate(p["table"]):
        y = top - (i + 2) * h
        ax.add_patch(Rectangle((x0, y), w0, h, facecolor="white", edgecolor=INK, linewidth=1.0))
        ax.add_patch(Rectangle((x0 + w0, y), w1, h, facecolor="white", edgecolor=INK, linewidth=1.0))
        ax.text(x0 + 0.12, y + h / 2, cell[0].upper() + cell[1:], ha="left", va="center", fontsize=10)
        ax.text(x0 + w0 + 0.12, y + h / 2, CELL_JOBS[cell], ha="left", va="center", fontsize=10)
    ax.text(5.1, 5.0, "Four specialised cells (not drawn to the same scale)", ha="center", va="center", fontsize=11,
            fontweight="bold")
    ax.set_xlim(-0.1, 10.3)
    ax.set_ylim(top - 5 * h - 0.05, 5.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_plant_animal(p) if p["kind"] == "plant_animal" else _draw_specialised(p)


# --- questions ---------------------------------------------------------------------------------------------

VERBS = ["drew", "labelled", "copied", "sketched"]
SETTINGS = ["after a microscope lesson", "in a biology lesson", "for a class poster", "for homework", "in the science club",
            "for revision"]


def questions(p: dict, rng: random.Random) -> list:
    name = p["name"]
    if p["kind"] == "specialised":
        cells, letters = p["cells"], "ABCD"
        ask = p["ask_job"]
        q1 = mcq(f"{name} {rng.choice(VERBS)} these specialised cells {rng.choice(SETTINGS)}. Which letter shows the cell "
                 f"that {CELL_JOBS[ask]}?", letters[cells.index(ask)], [L for L in letters if L != letters[cells.index(ask)]], rng)
        must = "red blood cell" if p["second"] == "no nucleus" else "palisade cell"
        key2 = letters[cells.index(must)]
        q2 = mcq("Which lettered cell has no nucleus?" if p["second"] == "no nucleus" else "Which lettered cell has chloroplasts?",
                 key2, [L for L in letters if L != key2], rng)
        third = p["ask_third"]
        job = CELL_JOBS[cells[letters.index(third)]]
        q3 = mcq(f"What is the job of cell {third}?", job, [CELL_JOBS[c] for c in cells if CELL_JOBS[c] != job], rng)
        return [q1, q2, q3]
    letters = p["letters"]
    order = sorted(letters)
    ask = p["ask"]
    key = next(L for L, (_, part) in letters.items() if part == ask)
    primary = p["band"] == "P"
    if primary:
        stem = f"{name} {rng.choice(['drew', 'made', 'coloured'])} two cells {rng.choice(SETTINGS)}. Which letter shows the {ask}?"
    else:
        stem = (f"{name} {rng.choice(VERBS)} these two cells {rng.choice(SETTINGS)}. Which letter shows the part that "
                f"{JOBS[ask]}?")
    q1 = mcq(stem, key, [L for L in order if L != key], rng)
    only = next(L for L, (_, part) in letters.items() if part in PLANT_ONLY)
    q2 = mcq("Which letter shows a part that only plant cells have?", only, [L for L in order if L != only], rng)
    k = 1 if p["plant_side"] == "left" else 2
    n = p["chloroplasts"]
    q3 = count(f"How many green chloroplasts are in Cell {k}?" if primary else f"How many chloroplasts are drawn in Cell {k}?",
               n, "chloroplasts")
    return [q1, q2, q3]
