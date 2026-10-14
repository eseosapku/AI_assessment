"""The soil texture triangle (LS, UP): sand, silt and clay on a triangle with 10% gridlines, as the geography family
ternary_graph draws it (clay at the top, sand bottom left, silt bottom right, each read along its own gridlines and
numbered on its own side), with four lettered samples on gridline crossings and a table of one more sample's
particle-size analysis in grams. Two sub-types: the plain triangle, where the table's sample is one of the lettered
ones, and the textbook triangle with the twelve USDA texture classes drawn and named, where the table's sample is
plotted by the student and named by its class.

The % of sand, silt or clay at a lettered sample (the three always add to 100), which sample has the most clay, and
either which lettered sample the table describes or the table sample's texture class. A sample whose class is asked
sits well inside it: at least 4.5 (of 100 along a side) from every class boundary.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "soil_texture"
KIND = "graph.line"
SUBJECT = "agriculture"
BANDS = ("UP", "LS")
CONCEPTS = ("agriculture.soil-science", "agriculture.soil-fertility")
# A topic whose sections the book lists is reached only if one names soil or texture.
NEEDS = r"soil|texture"
# Topics listed without sections that share soil fertility but teach no texture.
AVOID = r"crop|econom|management|mechani"
PARTS = ["sand", "silt", "clay"]
H = math.sqrt(3) / 2

# The USDA classes as (sand %, clay %) corners, from the Soil Survey Manual's rules.
CLASSES = {
    "Clay": [(0, 100), (45, 55), (45, 40), (20, 40), (0, 60)],
    "Silty clay": [(0, 60), (20, 40), (0, 40)],
    "Sandy clay": [(45, 55), (65, 35), (45, 35)],
    "Clay loam": [(45, 40), (45, 27), (20, 27), (20, 40)],
    "Silty clay loam": [(20, 40), (20, 27), (0, 27), (0, 40)],
    "Sandy clay loam": [(45, 35), (65, 35), (80, 20), (52, 20), (45, 27)],
    "Loam": [(45, 27), (52, 20), (52, 7), (43, 7), (23, 27)],
    "Silt loam": [(23, 27), (50, 0), (20, 0), (8, 12), (0, 12), (0, 27)],
    "Silt": [(20, 0), (0, 0), (0, 12), (8, 12)],
    "Sandy loam": [(43, 7), (52, 7), (52, 20), (80, 20), (85, 15), (70, 0), (50, 0)],
    "Loamy sand": [(70, 0), (85, 15), (90, 10), (85, 0)],
    "Sand": [(85, 0), (90, 10), (100, 0)],
}
# Where each class is named, on the drawing (x, y), its lines, and its rotation.
LABELS = {
    "Clay": ((50, 75), "Clay", 0), "Silty clay": ((71, 41), "Silty\nclay", 0), "Sandy clay": ((27.5, 35.5), "Sandy\nclay", 0),
    "Clay loam": ((50.5, 29), "Clay loam", 0), "Silty clay loam": ((73.5, 29), "Silty clay\nloam", 0),
    "Sandy clay loam": ((26.5, 23.5), "Sandy clay\nloam", 0), "Loam": ((50, 11.5), "Loam", 0),
    "Silt loam": ((72, 12), "Silt loam", 0), "Silt": ((91.5, 4.3), "Silt", 0), "Sandy loam": ((31, 8.5), "Sandy loam", 0),
    "Loamy sand": ((15.6, 4.8), "Loamy sand", -34.7), "Sand": ((5.2, 2.6), "Sand", 0),
}
NEIGHBOURS = {
    "Clay": ["Clay loam", "Silty clay", "Sandy clay"], "Silty clay": ["Silty clay loam", "Clay", "Silt loam"],
    "Sandy clay": ["Sandy clay loam", "Clay", "Clay loam"], "Clay loam": ["Silty clay loam", "Sandy clay loam", "Loam"],
    "Silty clay loam": ["Clay loam", "Silty clay", "Silt loam"], "Sandy clay loam": ["Sandy loam", "Clay loam", "Loam"],
    "Loam": ["Silt loam", "Sandy loam", "Clay loam"], "Silt loam": ["Loam", "Silt", "Silty clay loam"],
    "Silt": ["Silt loam", "Loam", "Silty clay loam"], "Sandy loam": ["Loamy sand", "Loam", "Sandy clay loam"],
    "Loamy sand": ["Sand", "Sandy loam", "Loam"], "Sand": ["Loamy sand", "Sandy loam", "Silt"],
}
PLACES = ["a maize field in Huye", "a potato farm in Musanze", "a banana plantation in Muhanga", "a rice marshland in Bugesera",
          "a coffee farm in Nyamasheke", "a bean field in Ruhango", "a tea estate in Nyaruguru", "a school garden in Kayonza"]


def xy(v) -> tuple[float, float]:
    """(sand, silt, clay) in % to a place on the triangle, sides 100 long."""
    sand, silt, clay = v
    return silt + clay / 2, clay * H


def _corner(sand: float, clay: float) -> tuple[float, float]:
    return xy((sand, 100 - sand - clay, clay))


def _seg_dist(p, a, b) -> float:
    (px, py), (ax_, ay), (bx, by) = p, a, b
    dx, dy = bx - ax_, by - ay
    t = max(0.0, min(1.0, ((px - ax_) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax_ - t * dx, py - ay - t * dy)


def classify(v) -> tuple[str, float]:
    """The drawn class a sample lies in, and how far it is from that class's inner boundaries (not the triangle's edge)."""
    from matplotlib.path import Path
    pt = xy(v)
    for name, corners in CLASSES.items():
        poly = [_corner(s, c) for s, c in corners]
        if Path(poly + [poly[0]]).contains_point(pt):
            d = math.inf
            for (s1, c1), (s2, c2) in zip(corners, corners[1:] + corners[:1]):
                a, b = (s1, 100 - s1 - c1, c1), (s2, 100 - s2 - c2, c2)
                if any(a[i] == b[i] == 0 for i in range(3)):
                    continue  # along the triangle's own edge
                d = min(d, _seg_dist(pt, _corner(s1, c1), _corner(s2, c2)))
            return name, d
    return "", 0.0


def _boxes(text: str, at, rotation: float):
    """A box, in drawing units (about 0.048 in each), round a class name (8 pt) as the figure prints it, with a margin."""
    lines = text.split("\n")
    w, h = 1.3 * max(len(s) for s in lines) + 1.2, 2.75 * len(lines) + 1.0
    if rotation:
        r = math.radians(abs(rotation))
        w, h = w * math.cos(r) + h * math.sin(r), w * math.sin(r) + h * math.cos(r)
    return at[0] - w / 2, at[1] - h / 2, at[0] + w / 2, at[1] + h / 2


# Where a sample's letter goes from its dot: (dx, dy, ha, va), first choice first.
SIDES = {"ur": (1.8, 1.8, "left", "bottom"), "ul": (-1.8, 1.8, "right", "bottom"), "lr": (1.8, -1.8, "left", "top"),
         "ll": (-1.8, -1.8, "right", "top")}


def _letter_box(v, side: str):
    x, y = xy(v)
    dx, dy, ha, va = SIDES[side]
    x0 = x + dx - (0.3 if ha == "left" else 2.9)
    y0 = y + dy - (0.3 if va == "bottom" else 3.7)
    return x0, y0, x0 + 3.2, y0 + 4.0


def _hits(box, boxes) -> bool:
    return any(box[0] < b[2] and b[0] < box[2] and box[1] < b[3] and b[1] < box[3] for b in boxes)


NAMED = [_boxes(text, at, rot) for at, text, rot in LABELS.values()]


def _side(v) -> str | None:
    """The first side of a dot its letter can go without touching a class name; None if the dot itself touches one."""
    x, y = xy(v)
    if _hits((x - 1.4, y - 1.4, x + 1.4, y + 1.4), NAMED):
        return None
    return next((k for k in SIDES if not _hits(_letter_box(v, k), NAMED)), None)


def sample(rng: random.Random) -> dict:
    mode = rng.choice(["point", "class"])
    crossings = [[a, b, 100 - a - b] for a in range(10, 90, 10) for b in range(10, 90, 10) if 100 - a - b >= 10]
    if mode == "class":
        # clear of the class names, and of every class line: a bold USDA line 2-3% off a gridline reads as one (P3t review)
        crossings = [v for v in crossings if _side(v) and classify(v)[1] >= 4.5]
    while True:
        pts = rng.sample(crossings, 4)
        if mode == "point":
            target = pts[0]
            swap = rng.sample(range(3), 2)
            decoy = list(target)
            decoy[swap[0]], decoy[swap[1]] = decoy[swap[1]], decoy[swap[0]]
            if decoy != target and decoy not in pts[1:] and _apart([target, decoy]) and rng.random() < 0.7:
                pts[1] = decoy  # the same numbers read on the wrong sides
            rng.shuffle(pts)
            pct = target
            total = rng.choice([50, 100, 200])
        else:
            total = rng.choice([100, 200])
            while True:
                sand, clay = 5 * rng.randint(1, 18), 5 * rng.randint(1, 18)
                pct = [sand, 100 - sand - clay, clay]
                if pct[1] >= 5:
                    name, d = classify(pct)
                    if name and d >= 4.5:
                        break
        clays = [v[2] for v in pts]
        if clays.count(max(clays)) > 1 or len({tuple(v) for v in pts}) < 4 or not _apart(pts):
            continue
        # sand or clay is read along its gridlines; silt, the hard direction (P3t review), only as 100 - sand - clay
        first = rng.choice([0, 2])
        second = rng.choice([2 - first, 1])
        letters = "ABCD"
        return {"band": rng.choice(BANDS), "mode": mode, "place": rng.choice(PLACES),
                "points": {k: v for k, v in zip(letters, pts)},
                "sides": {k: (_side(v) if mode == "class" else "ur") for k, v in zip(letters, pts)},
                "sample": {"total": total, "grams": [x * total // 100 for x in pct]},
                "ask": [rng.choice(letters), first, rng.choice(letters), second]}


def _apart(pts) -> bool:
    """No two samples on neighbouring crossings: a gridline crossing at least between any two."""
    return all(math.dist(xy(a), xy(b)) > 10.5 for i, a in enumerate(pts) for b in pts[i + 1:])


def _triangle(ax, p: dict) -> None:
    ax.add_patch(Polygon([(0, 0), (100, 0), (50, 100 * H)], closed=True, facecolor="#f7f8f4", edgecolor=INK, linewidth=1.5))
    for k in range(10, 100, 10):
        # constant clay (horizontal), constant silt (parallel to the left side), constant sand (parallel to the right)
        for a, b in (((0, 100 - k, k), (100 - k, 0, k)), ((100 - k, k, 0), (0, k, 100 - k)), ((k, 100 - k, 0), (k, 0, 100 - k))):
            (x1, y1), (x2, y2) = xy(a), xy(b)
            ax.plot([x1, x2], [y1, y2], color="#b9c2ca", linewidth=0.7, zorder=1, gid="grid")
    # each number at the end of a short tick that carries on its own part's gridline beyond the edge (ternary_graph's way)
    # Each part's ticks point outward along its own gridlines: clay to the left, silt up and right, sand down and right.
    # The direction is the part's, not each tick's: at 100 a gridline shrinks to its corner and has none (the 100s were
    # printed on the vertices, P3t review).
    outward = {"clay": (-1.0, 0.0), "silt": (0.5, H), "sand": (0.5, -H)}
    for k in range(10, 101, 10):  # no 0: at each corner it met the other side's 100 (P3t review); the 100 names the corner
        for part, edge in (("clay", (100 - k, 0, k)),   # horizontal lines, numbered on the left side
                           ("silt", (0, k, 100 - k)),   # parallel to the left side, numbered on the right
                           ("sand", (k, 100 - k, 0))):  # parallel to the right side, numbered below
            (x0, y0), (ux, uy) = xy(edge), outward[part]
            (line,) = ax.plot([x0, x0 + 3.5 * ux], [y0, y0 + 3.5 * uy], color=INK, linewidth=0.9)
            line.set_gid("tick")
            ax.text(x0 + 5.5 * ux, y0 + 5.5 * uy, str(k), ha="center", va="center", fontsize=8, gid=f"tick:{part}:{k}")
    ax.text(3.0, 56.0, "% clay", ha="center", va="center", fontsize=10.5, fontweight="bold", rotation=60)
    ax.text(99.0, 58.0, "% silt", ha="center", va="center", fontsize=10.5, fontweight="bold", rotation=-60)
    ax.text(50, -16, "% sand", ha="center", va="center", fontsize=10.5, fontweight="bold")


def draw(p: dict):
    fig, ax = new_figure(10.6, 6.4)
    ax.set_position([0.0, 0.0, 0.66, 1.0])
    _triangle(ax, p)
    if p["mode"] == "class":
        for name, corners in CLASSES.items():
            ax.add_patch(Polygon([_corner(s, c) for s, c in corners], closed=True, fill=False, edgecolor=INK, linewidth=1.5,
                                 zorder=2, gid=f"class:{name}"))
            at, text, rot = LABELS[name]
            ax.text(*at, text, ha="center", va="center", fontsize=8, style="italic", color="#333333", rotation=rot,
                    rotation_mode="anchor", linespacing=1.05, zorder=3, gid=f"label:{name}")
    for name, v in p["points"].items():
        x, y = xy(v)
        ax.plot([x], [y], marker="o", markersize=7, color="#c0392b", markeredgecolor=INK, zorder=4, gid=f"dot:{name}")
        dx, dy, ha, va = SIDES[p["sides"][name]]
        ax.text(x + dx, y + dy, name, ha=ha, va=va, fontsize=11.5, fontweight="bold", zorder=5, gid=f"point:{name}",
                bbox=dict(boxstyle="square,pad=0.05", facecolor="white", edgecolor="none", alpha=0.85))
    ax.set_title("Soil texture triangle" + (" (USDA classes)" if p["mode"] == "class" else ""), fontsize=12)
    ax.set_xlim(-22, 124)
    ax.set_ylim(-20, 100 * H + 8)
    ax.set_aspect("equal")
    ax.axis("off")
    _table(fig.add_axes([0.68, 0.22, 0.31, 0.56]), p)
    return fig


def _table(ax, p: dict) -> None:
    grams, total = p["sample"]["grams"], p["sample"]["total"]
    rows = [("Sand", "2–0.05 mm", grams[0], "sand"), ("Silt", "0.05–0.002 mm", grams[1], "silt"),
            ("Clay", "below 0.002 mm", grams[2], "clay"), ("Total", "", total, "total")]
    ax.text(3.0, 6.55, "Particle-size analysis", ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text(3.0, 5.95, f"Sample from {p['place']}", ha="center", va="center", fontsize=9)
    widths, rh = (3.6, 2.4), 0.95
    y = 5.4
    for c, (head, w) in enumerate(zip(("Fraction", "Mass (g)"), widths)):
        x = sum(widths[:c])
        ax.add_patch(Rectangle((x, y - rh), w, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        ax.text(x + w / 2, y - rh / 2, head, ha="center", va="center", fontsize=10, fontweight="bold")
    for i, (name, size, g, key) in enumerate(rows):
        top = y - rh * (i + 1)
        last = key == "total"
        for c, w in enumerate(widths):
            ax.add_patch(Rectangle((sum(widths[:c]), top - rh), w, rh, facecolor="white", edgecolor=INK, linewidth=1.3 if last else 0.8))
        if size:
            ax.text(0.15, top - rh * 0.32, name, ha="left", va="center", fontsize=10)
            ax.text(0.15, top - rh * 0.74, f"({size})", ha="left", va="center", fontsize=8, color="#333333")
        else:
            ax.text(0.15, top - rh / 2, name, ha="left", va="center", fontsize=10, fontweight="bold")
        ax.text(widths[0] + widths[1] / 2, top - rh / 2, str(g), ha="center", va="center", fontsize=10.5,
                fontweight="bold" if last else "normal", gid=f"grams:{key}")
    ax.set_xlim(-0.1, sum(widths) + 0.1)
    ax.set_ylim(y - rh * 5 - 0.1, 7.0)
    ax.axis("off")


SETTINGS = ["in an agriculture lesson", "after a field trip", "for a soil survey", "for the school farm", "in the soil lab",
            "before planting"]
VERBS = ["plots", "marks", "records", "shows"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    pts = p["points"]
    x, i, y, j = p["ask"]
    top = max(pts, key=lambda k: pts[k][2])
    grams, total = p["sample"]["grams"], p["sample"]["total"]
    pct = [g * 100 // total for g in grams]
    if j == 1:  # silt from the other two, each read along its own gridlines
        second = short(f"{friend} works out silt for another sample: silt = 100 − sand − clay. Read sand and clay for sample {y} "
                       f"along their gridlines. What percentage of silt is in sample {y}?", pts[y][1],
                       [f"{pts[y][1]}%", f"{pts[y][1]} %"])
    else:
        second = short(f"{friend} reads another sample along the gridlines. What percentage of {PARTS[j]} is in sample {y}?",
                       pts[y][j], [f"{pts[y][j]}%", f"{pts[y][j]} %"])
    qs = [short(f"{who} {rng.choice(VERBS)} soil samples on this texture triangle {rng.choice(SETTINGS)}. Reading along the "
                f"{PARTS[i]} gridlines, what percentage of {PARTS[i]} is in sample {x}?", pts[x][i], [f"{pts[x][i]}%", f"{pts[x][i]} %"]),
          second,
          mcq("Which sample has the most clay?", f"Sample {top}", [f"Sample {k}" for k in "ABCD" if k != top], rng)]
    if p["mode"] == "point":
        match = next(k for k, v in pts.items() if v == pct)
        qs.append(mcq(f"The table gives the mass of sand, silt and clay in a sample from {p['place']}. Which lettered sample on "
                      f"the triangle has the same percentages of sand and clay? (% = mass ÷ total mass × 100)", f"Sample {match}",
                      [f"Sample {k}" for k in "ABCD" if k != match], rng))
    else:
        name = classify(pct)[0]
        qs.append(mcq(f"The table gives the mass of sand, silt and clay in a sample from {p['place']}. Work out each "
                      f"percentage (% = mass ÷ total mass × 100) and plot it by its sand and clay. What is its texture class?", name,
                      NEIGHBOURS[name], rng))
    return qs
