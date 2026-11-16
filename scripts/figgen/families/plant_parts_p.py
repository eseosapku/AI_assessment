"""Plants (P, Science and Elementary Technology), three kinds, one idea each.

- parts (P2 to P4): a bean plant in the soil, drawn big: roots, a stem, 3 to 7 leaves, 1 to 3 flowers and 0 to 2 pods
  (its fruits). Three or four parts are lettered from the left, each by a leader that ends on its part, and a table
  beside it gives every part's job. Which letter shows the part that does a job (from the table), what the part at a
  letter is called, how many leaves or flowers the plant has (counted).
- garden (P1): a farmer's garden inside a fence, with 2 to 6 crops in a row (maize, beans, cabbage, banana), and
  outside the fence 2 to 5 plants that grow on their own (grass, a bush, a weed, a wild tree). Four plants are lettered:
  one of one group, three of the other. The stem says the farmer grows the plants inside the fence, which are
  cultivated plants. How many cultivated plants, or how many grow on their own; which letter shows the one plant of
  its group.
- trees (P4 to P6): a bar chart of the trees planted and the trees cut down in an invented sector over five years, a
  gridline every 10 trees. In exactly one year more trees were cut than planted. How many trees were planted in a year,
  the year more were cut than planted, how many more were planted than cut in a year, or how many were cut in all.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, Polygon, Rectangle

from ..core import FILL, GRID, INK, NAMES, Question, count, mcq, new_figure, short
from ._bio_parts import spline, tube

ID = "plant_parts_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("plant-structure", "growing-plants-cultivation", "plant-types",
                                          "trees-and-forestry", "deforestation"))
# A topic whose sections the book lists is reached only if its name or a section names plants, their parts,
# cultivated plants or trees.
NEEDS = r"^plants$|parts of (?:the|a) plant|plant parts|plants and their parts|cultivated|deforestation|afforestation|trees"
AVOID = (r"\bcells?\b|science in context|glossary|reproduction|writing skills|agricultural tools|soil|sexual|hiv|"
         r"pregnan|social factors")

JOB = {"root": "takes in water from the soil", "stem": "holds the plant up", "leaf": "makes food for the plant",
       "flower": "makes seeds", "fruit": "keeps the seeds safe"}
PARTS = list(JOB)
CROPS = ["maize", "beans", "cabbage", "banana"]
WILD = ["grass", "bush", "weed", "wild tree"]
COLOURS = {"yellow": "#f4d77a", "white": "#fbfbf2", "pink": "#f2a9c4", "purple": "#cdb0ea"}
YEARS = [2019, 2020, 2021, 2022, 2023]


def stages(p: dict) -> tuple[int, int]:
    return {"garden": (1, 1), "parts": (2, 4), "trees": (4, 6)}[p["sub"]]


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"parts": ("science.plant-structure",),
            "garden": ("science.growing-plants-cultivation", "science.plant-types"),
            "trees": ("science.trees-and-forestry", "science.deforestation")}[p["sub"]]


# Where the flowers and pods hang: the top of the stem (always a flower), the left, and two on the right.
SLOTS = [(0.0, 8.1), (-1.3, 7.0), (1.3, 7.0), (1.3, 5.75)]


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["parts", "garden", "trees"])
    if sub == "parts":
        leaves = rng.randint(3, 7)
        flowers = rng.randint(1, 3)
        pods = rng.randint(0, min(2, 4 - flowers))
        # what hangs at each slot: the top is a flower; a pod, if any, on the left, where a letter reaches it clear
        rest = ["flower"] * (flowers - 1) + ["pod"] * max(pods - 1, 0)
        slots = (["flower", "pod"] if pods else ["flower"]) + rest
        slots += [""] * (len(SLOTS) - len(slots))
        n = rng.choice([3, 4])
        pool = [x for x in PARTS if x != "fruit" or pods]
        chosen = rng.sample(pool, min(n, len(pool)))
        # lettered from the top down, as they sit on the page
        height = {"root": 0, "leaf": 1, "stem": 2, "fruit": 3, "flower": 4}
        chosen.sort(key=lambda x: -height[x])
        labels = {chr(65 + i): x for i, x in enumerate(chosen)}
        return {"band": "P", "sub": "parts", "leaves": leaves, "flowers": flowers, "pods": pods, "slots": slots,
                "first": rng.choice([-1, 1]), "colour": rng.choice(sorted(COLOURS)), "labels": labels}
    if sub == "garden":
        inside = [rng.choice(CROPS) for _ in range(rng.randint(2, 6))]
        outside = [rng.choice(WILD) for _ in range(rng.randint(2, 5))]
        single = rng.choice(["in", "out"])
        n_in = 1 if single == "in" else 3
        while n_in > len(inside) or 4 - n_in > len(outside):
            inside.append(rng.choice(CROPS)) if n_in > len(inside) else outside.append(rng.choice(WILD))
        picks = [["in", i] for i in sorted(rng.sample(range(len(inside)), n_in))] + \
                [["out", i] for i in sorted(rng.sample(range(len(outside)), 4 - n_in))]
        labels = {chr(65 + k): v for k, v in enumerate(picks)}
        return {"band": "P", "sub": "garden", "inside": inside, "outside": outside, "labels": labels,
                "ask": rng.choice(["count", "letter"])}
    while True:
        planted = [rng.randint(1, 9) * 10 for _ in YEARS]
        cut = [rng.randint(1, 9) * 10 for _ in YEARS]
        if any(a == b for a, b in zip(planted, cut)):
            continue
        if sum(1 for a, b in zip(planted, cut) if b > a) == 1:
            return {"band": "P", "sub": "trees", "sector": rng.choice("ABCD"), "years": YEARS[:], "planted": planted,
                    "cut": cut}


# --- drawing: the bean plant -------------------------------------------------------------------------

GREEN, DARK, ROOT, SOIL = "#8cc06f", "#4f8a3a", "#e8dcc0", "#c8a675"


def _leaf_shape(bx: float, by: float, side: int, length: float = 1.45, half: float = 0.33) -> list:
    """A pointed oval leaf from its base, rising at 30 degrees on its side."""
    a = math.radians(30)
    ux, uy = side * math.cos(a), math.sin(a)
    nx, ny = -uy, ux
    pts = []
    for k in range(25):
        t = k / 24
        w = half * math.sin(math.pi * t) ** 0.8
        pts.append((bx + ux * length * t + nx * w, by + uy * length * t + ny * w))
    for k in range(24, -1, -1):
        t = k / 24
        w = half * math.sin(math.pi * t) ** 0.8
        pts.append((bx + ux * length * t - nx * w, by + uy * length * t - ny * w))
    return pts


def _flower(ax, x: float, y: float, colour: str) -> None:
    """A five-petalled flower, one shape (so a flower counts once), with its middle."""
    pts = [(x + (0.4 + 0.17 * math.cos(5 * t)) * math.cos(t), y + (0.4 + 0.17 * math.cos(5 * t)) * math.sin(t))
           for t in (2 * math.pi * k / 100 for k in range(100))]
    ax.add_patch(Polygon(pts, closed=True, facecolor=COLOURS[colour], edgecolor=INK, linewidth=1.2, zorder=4,
                         gid="part:flower"))
    ax.add_patch(Circle((x, y), 0.12, facecolor="#e0a93b", edgecolor=INK, linewidth=0.8, zorder=4.1, gid="flower-centre"))


def _pod(ax, x: float, y: float) -> None:
    """A long bean pod hanging from (x, y), the beans inside showing as bumps along it."""
    path = spline([(x, y), (x - 0.09, y - 0.4), (x - 0.06, y - 0.8), (x + 0.1, y - 1.1)], closed=False, per=8)
    ax.add_patch(Polygon(tube(path, 0.3), closed=True, facecolor="#c9d96f", edgecolor=INK, linewidth=1.2, zorder=4,
                         gid="part:fruit"))
    for k in range(1, 4):
        cx, cy = path[len(path) * k // 4]
        ax.plot([cx - 0.09, cx - 0.04, cx + 0.04, cx + 0.09], [cy, cy + 0.07, cy + 0.07, cy], color="#7a8a3a",
                linewidth=0.9, zorder=4.1)


def _plant(p: dict):
    fig, ax = new_figure(10.6, 6.2)
    ax.add_patch(Rectangle((-3.0, -2.4), 6.0, 2.4, facecolor=SOIL, edgecolor="none", zorder=0.5, gid="soil"))
    ax.plot([-3.0, 3.0], [0, 0], color=INK, linewidth=1.2, zorder=0.6)
    ax.text(-2.85, -2.2, "soil", ha="left", va="bottom", fontsize=10.5, style="italic")
    # roots: a main root and four side roots, thin tubes
    roots = [[(0, 0.05), (0.05, -1.0), (0.0, -2.0)], [(0.02, -0.4), (-0.6, -0.9), (-1.25, -1.35)],
             [(0.03, -0.55), (0.6, -1.05), (1.2, -1.5)], [(0.0, -1.1), (-0.45, -1.6), (-0.85, -2.05)],
             [(0.0, -1.2), (0.5, -1.7), (0.95, -2.05)]]
    for k, r in enumerate(roots):
        ax.add_patch(Polygon(tube(r, 0.16 if k == 0 else 0.11), closed=True, facecolor=ROOT, edgecolor=INK,
                             linewidth=1.0, zorder=1, gid="part:root"))
    # the stem
    ax.add_patch(Polygon(tube([(0, -0.05), (0.04, 3.0), (-0.03, 6.0), (0.0, 8.0)], 0.24), closed=True,
                         facecolor=GREEN, edgecolor=INK, linewidth=1.2, zorder=2, gid="part:stem"))
    # the leaves, alternately left and right up the lower stem
    centres = []
    for i in range(p["leaves"]):
        side = p["first"] * (1 if i % 2 == 0 else -1)
        by = 0.5 + 0.45 * i
        ax.plot([0.08 * side, 0.4 * side], [by, by + 0.18], color=DARK, linewidth=1.6, zorder=2.5)  # its stalk
        pts = _leaf_shape(0.4 * side, by + 0.18, side)
        ax.add_patch(Polygon(pts, closed=True, facecolor=GREEN, edgecolor=INK, linewidth=1.1, zorder=3,
                             gid="part:leaf"))
        tip = pts[24]
        ax.plot([0.4 * side, tip[0]], [by + 0.18, tip[1]], color=DARK, linewidth=0.8, zorder=3.1)  # its midrib
        centres.append((side, (0.4 * side + tip[0]) / 2, (by + 0.18 + tip[1]) / 2))
    # flowers and pods at the slots, each on a short stalk from the stem
    for (x, y), what in zip(SLOTS, p["slots"]):
        if not what:
            continue
        if x:
            ax.plot([0, x * 0.85], [y - 0.55, y], color=DARK, linewidth=1.6, zorder=2.5)
        if what == "flower":
            _flower(ax, x, y, p["colour"])
        else:
            _pod(ax, x * 0.85, y)
    # the letters, in a column on the left, each at its part's height; a leader reaches only the left and top slots,
    # ending on a petal's left lobe (never the flower's middle) or a pod's middle
    lobe = (0.45 * math.cos(math.radians(144)), 0.45 * math.sin(math.radians(144)))
    flower = (-1.3 + lobe[0], 7.0 + lobe[1]) if p["slots"][1] == "flower" else (lobe[0], 8.1 + lobe[1])
    leaf = next(c for c in centres if c[0] < 0)
    ends = {"root": (-0.75, -1.0), "stem": (-0.02, 5.2), "leaf": (leaf[1], leaf[2]), "flower": flower,
            "fruit": (-1.3 * 0.85 - 0.03, 6.5)}
    for L, part in p["labels"].items():
        end = ends[part]
        at = (-3.9, end[1])
        ax.plot([at[0] + 0.35, end[0]], [end[1], end[1]], color=INK, linewidth=1.0, zorder=8, gid=f"leader:{L}")
        ax.plot([end[0]], [end[1]], marker="o", markersize=3.5, color=INK, zorder=8)
        ax.text(at[0], at[1], L, ha="center", va="center", fontsize=15, fontweight="bold", zorder=9, gid=f"letter:{L}")
    # the jobs table
    x0, x1, x2, top, rh = 4.0, 6.0, 12.6, 6.6, 0.85
    ax.text((x0 + x2) / 2, top + 0.55, "What each part does", ha="center", va="center", fontsize=12.5, fontweight="bold")
    ax.fill([x0, x2, x2, x0], [top, top, top - rh, top - rh], color="#dbe9f6", zorder=0)
    ax.text((x0 + x1) / 2, top - rh / 2, "Part", ha="center", va="center", fontsize=11.5, fontweight="bold")
    ax.text((x1 + x2) / 2, top - rh / 2, "Its job", ha="center", va="center", fontsize=11.5, fontweight="bold")
    for k, part in enumerate(PARTS):
        y = top - (k + 1.5) * rh
        ax.text(x0 + 0.2, y, part, ha="left", va="center", fontsize=11.5, gid=f"row:{part}")
        ax.text(x1 + 0.2, y, JOB[part], ha="left", va="center", fontsize=11.5)
    bottom = top - (len(PARTS) + 1) * rh
    for k in range(len(PARTS) + 2):
        ax.plot([x0, x2], [top - k * rh] * 2, color=INK, linewidth=1.5 if k in (0, 1, len(PARTS) + 1) else 0.8)
    for x in (x0, x1, x2):
        ax.plot([x, x], [top, bottom], color=INK, linewidth=1.2)
    ax.set_xlim(-4.4, 12.8)
    ax.set_ylim(-2.5, 8.75)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("A bean plant", fontsize=13)
    return fig


# --- drawing: the garden --------------------------------------------------------------------------------

FENCE = (0.0, 7.0)  # the garden's left and right edges
OUT0 = 8.2


def _crop(ax, kind: str, x: float, gid: str) -> tuple[float, float]:
    """A crop at x on the ground; returns its top, and a height on it straight below the top where a leader ends."""
    if kind == "maize":
        ax.add_patch(Polygon(tube([(x, 0), (x, 2.3)], 0.12), closed=True, facecolor=GREEN, edgecolor=INK, linewidth=1.0,
                             zorder=3, gid=gid))
        for k, (h, s) in enumerate([(0.6, -1), (1.0, 1), (1.4, -1), (1.8, 1)]):
            leaf = spline([(x, h), (x + 0.22 * s, h + 0.28), (x + 0.42 * s, h + 0.22), (x + 0.5 * s, h + 0.02)],
                          closed=False, per=8)
            ax.add_patch(Polygon(tube(leaf, 0.1), closed=True,
                                 facecolor=GREEN, edgecolor=INK, linewidth=0.9, zorder=3.1, gid=gid))
        ax.add_patch(Ellipse((x + 0.13, 1.3), 0.2, 0.5, facecolor="#f4d03f", edgecolor=INK, linewidth=0.9, zorder=3.2,
                             gid=gid))
        return 2.3, 2.1
    if kind == "beans":
        for dx, dy in ((-0.22, 0.45), (0.22, 0.5), (0.0, 0.8)):
            ax.add_patch(Circle((x + dx, dy), 0.25, facecolor="#7fb35f", edgecolor=INK, linewidth=1.0, zorder=3, gid=gid))
        ax.add_patch(Polygon(tube([(x, 0), (x, 0.4)], 0.08), closed=True, facecolor=DARK, edgecolor=INK, linewidth=0.8,
                             zorder=2.9, gid=gid))
        return 1.05, 0.85
    if kind == "cabbage":
        ax.add_patch(Circle((x, 0.42), 0.42, facecolor="#a9d18e", edgecolor=INK, linewidth=1.1, zorder=3, gid=gid))
        ax.add_patch(Circle((x, 0.42), 0.22, facecolor="#cde6b4", edgecolor=INK, linewidth=0.9, zorder=3.1, gid=gid))
        return 0.84, 0.6
    # banana
    ax.add_patch(Polygon(tube([(x, 0), (x, 1.6)], 0.22), closed=True, facecolor="#9b7b4a", edgecolor=INK, linewidth=1.0,
                         zorder=3, gid=gid))
    for s, h in ((-1, 2.1), (1, 2.2), (0, 2.5)):
        tipx = x + 0.42 * s
        ax.add_patch(Polygon(tube([(x, 1.55), (x + 0.2 * s, h - 0.1), (tipx, h)], 0.2), closed=True, facecolor=GREEN,
                             edgecolor=INK, linewidth=0.9, zorder=3.1, gid=gid))
    return 2.5, 2.35


def _wild(ax, kind: str, x: float, gid: str) -> tuple[float, float]:
    if kind == "grass":
        for dx, h in ((-0.3, 0.55), (-0.15, 0.8), (0.0, 0.65), (0.15, 0.85), (0.3, 0.5)):
            ax.add_patch(Polygon([(x + dx - 0.05, 0), (x + dx + 0.05, 0), (x + dx * 1.5, h)], closed=True,
                                 facecolor="#9ccc65", edgecolor=INK, linewidth=0.8, zorder=3, gid=gid))
        return 0.85, 0.3
    if kind == "bush":
        for dx, dy, r in ((-0.25, 0.35, 0.3), (0.25, 0.35, 0.3), (0.0, 0.65, 0.33)):
            ax.add_patch(Circle((x + dx, dy), r, facecolor="#4f7f3a", edgecolor=INK, linewidth=1.0, zorder=3, gid=gid))
        return 0.98, 0.8
    if kind == "weed":
        ax.add_patch(Polygon(tube([(x, 0), (x + 0.05, 0.5), (x, 0.95)], 0.05), closed=True, facecolor=DARK,
                             edgecolor=INK, linewidth=0.7, zorder=3, gid=gid))
        ax.add_patch(Ellipse((x - 0.17, 0.4), 0.3, 0.12, angle=30, facecolor="#9ccc65", edgecolor=INK, linewidth=0.8,
                             zorder=3, gid=gid))
        ax.add_patch(Ellipse((x + 0.19, 0.55), 0.3, 0.12, angle=-30, facecolor="#9ccc65", edgecolor=INK, linewidth=0.8,
                             zorder=3, gid=gid))
        ax.add_patch(Circle((x, 1.0), 0.13, facecolor="#f4d03f", edgecolor=INK, linewidth=0.8, zorder=3.1, gid=gid))
        return 1.13, 1.0
    # wild tree
    ax.add_patch(Polygon(tube([(x, 0), (x, 1.5)], 0.2), closed=True, facecolor="#8b6b3d", edgecolor=INK, linewidth=1.0,
                         zorder=3, gid=gid))
    ax.add_patch(Ellipse((x, 1.95), 0.95, 0.9, facecolor="#5d9b45", edgecolor=INK, linewidth=1.0, zorder=3.1, gid=gid))
    return 2.4, 2.2


def _garden(p: dict):
    fig, ax = new_figure(9.6, 4.8)
    ax.add_patch(Rectangle((-0.5, -0.5), OUT0 + 6.3, 0.5, facecolor="#d8c39a", edgecolor="none", zorder=0.5, gid="ground"))
    ax.plot([-0.5, OUT0 + 5.8], [0, 0], color=INK, linewidth=1.2, zorder=0.6)
    # the fence: posts and two rails round the garden
    ax.add_patch(Rectangle((FENCE[0], 0), FENCE[1] - FENCE[0], 1.3, fill=False, edgecolor="#7e5109", linewidth=2.2,
                           zorder=2, gid="fence"))
    for k in range(8):
        x = FENCE[0] + k * (FENCE[1] - FENCE[0]) / 7
        ax.plot([x, x], [0, 1.3], color="#7e5109", linewidth=2.2, zorder=2)
    ax.plot(FENCE, [0.65, 0.65], color="#7e5109", linewidth=1.6, zorder=2)
    ax.text((FENCE[0] + FENCE[1]) / 2, -0.25, "the farmer's garden", ha="center", va="center", fontsize=11, style="italic")
    tops = {}
    n = len(p["inside"])
    for i, kind in enumerate(p["inside"]):
        x = FENCE[0] + (FENCE[1] - FENCE[0]) * (i + 0.5) / n
        tops[("in", i)] = (x, _crop(ax, kind, x, f"plant:in:{i}"))
    for i, kind in enumerate(p["outside"]):
        x = OUT0 + 0.55 + 1.2 * i
        tops[("out", i)] = (x, _wild(ax, kind, x, f"plant:out:{i}"))
    for L, (side, i) in p["labels"].items():
        x, (top, hit) = tops[(side, i)]
        ax.text(x, 3.25, L, ha="center", va="center", fontsize=15, fontweight="bold", zorder=9, gid=f"letter:{L}")
        end = hit
        ax.plot([x, x], [3.0, end], color=INK, linewidth=1.0, zorder=8, gid=f"leader:{L}")
        ax.plot([x], [end], marker="o", markersize=3.5, color=INK, zorder=8)
    ax.set_xlim(-0.6, OUT0 + 5.9)
    ax.set_ylim(-0.55, 3.6)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("A garden with a fence, and the land next to it", fontsize=12.5)
    return fig


# --- drawing: trees planted and cut ---------------------------------------------------------------------

def _trees(p: dict):
    fig, ax = new_figure(7.4, 4.4)
    styles = [("Trees planted", "#7fb35f", "", p["planted"], "planted"), ("Trees cut down", "white", "///", p["cut"], "cut")]
    for k, (label, colour, hatch, row, key) in enumerate(styles):
        bars = ax.bar([j + (k - 0.5) * 0.38 for j in range(len(row))], row, width=0.38, color=colour, hatch=hatch,
                      edgecolor=INK, linewidth=1.0, zorder=3, label=label)
        for j, b in enumerate(bars):
            b.set_gid(f"bar:{key}:{j}")
    ax.set_xticks(range(len(p["years"])), [str(y) for y in p["years"]])
    ax.set_yticks(range(0, 101, 10))
    ax.grid(True, axis="y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_ylim(0, 100)
    ax.set_xlim(-0.6, len(p["years"]) - 0.4)
    ax.tick_params(labelsize=10.5)
    ax.set_ylabel("Number of trees", fontsize=11)
    ax.set_xlabel("Year", fontsize=11)
    ax.set_title(f"Trees planted and trees cut down in Sector {p['sector']}", fontsize=12.5)
    ax.legend(loc="upper left", bbox_to_anchor=(1.02, 1.0), fontsize=10.5, frameon=True, edgecolor="#999999",
              title="Key", title_fontsize=10.5)
    return fig


def draw(p: dict):
    return {"parts": _plant, "garden": _garden, "trees": _trees}[p["sub"]](p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a science lesson", "in the school garden", "at home in Huye", "for a class display", "in Musanze",
            "at the science club", "for homework", "near Rwamagana"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "parts":
        labels = p["labels"]
        at = {v: k for k, v in labels.items()}
        order = sorted(labels)
        part = rng.choice(sorted(at))
        qs = [Question("mcq", f"{who} drew this bean plant {rng.choice(SETTINGS)}. Which letter shows the part that "
                              f"{JOB[part]}?", str(order.index(at[part])), order)]
        other = rng.choice([L for L in order if L != at[part]])
        name = labels[other]
        wrong = [x for x in PARTS if x != name]
        qs.append(mcq(f"What is the part at letter {other} called?", name, rng.sample(wrong, 3), rng))
        what = rng.choice(["leaves", "flowers"])
        qs.append(count(f"How many {what} does the plant have?", p[what], what))
        return qs
    if p["sub"] == "garden":
        inside, outside, labels = p["inside"], p["outside"], p["labels"]
        lead = (f"{who} walked past this garden {rng.choice(SETTINGS[1:])}. The farmer grows the plants inside the fence. "
                f"They are cultivated plants.")
        if rng.random() < 0.5:
            qs = [count(f"{lead} How many cultivated plants can you see?", len(inside), "plants")]
        else:
            qs = [count(f"{lead} How many plants grow on their own outside the fence?", len(outside), "plants")]
        sides = [v[0] for v in labels.values()]
        single = "in" if sides.count("in") == 1 else "out"
        key = next(L for L, v in labels.items() if v[0] == single)
        order = sorted(labels)
        ask = "Which letter shows a cultivated plant?" if single == "in" else "Which letter shows a plant that grows on its own?"
        qs.append(Question("mcq", ask, str(order.index(key)), order))
        return qs
    years, planted, cut = p["years"], p["planted"], p["cut"]
    j = rng.randrange(len(years))
    qs = [short(f"{who} counted trees in Sector {p['sector']} for a school project. "
                f"How many trees were planted in {years[j]}?", planted[j], [f"{planted[j]} trees"])]
    bad = next(y for y, a, b in zip(years, planted, cut) if b > a)
    qs.append(mcq("In which year were more trees cut down than planted?", str(bad),
                  [str(y) for y in years if y != bad], rng))
    if rng.random() < 0.5:
        y = rng.choice([y for y, a, b in zip(years, planted, cut) if a > b])
        k = years.index(y)
        qs.append(short(f"How many more trees were planted than cut down in {y}?", planted[k] - cut[k],
                        [f"{planted[k] - cut[k]} trees"]))
    else:
        qs.append(short("How many trees were cut down altogether in these years?", sum(cut), [f"{sum(cut)} trees"]))
    return qs
