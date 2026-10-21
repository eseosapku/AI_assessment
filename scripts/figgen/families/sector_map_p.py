"""A map of an invented sector on a lettered grid (P3 to P6, Primary Social Studies): squares lettered A to H along the
bottom and numbered 1 to 6 up the side, a lake over a block of squares, a river running down a column (or along a
row) from the map's edge into the lake, hills and forests, schools, one health centre, one market and one community
hall, each a picture in a square of its own, and a straight road joining two of the buildings along a row or column.
A key names every picture and line; a compass rose shows north up (N, E, S, W at the lower level; the in-between
points too at the upper level, P5 to P6), and at the upper level a scale says how many kilometres one square's side is.

- What is in a square? The square holds one picture and nothing else; the wrong options are the pictures in the square
  read the other way round (row for column) and in the squares next to it.
- In which direction is one place from another? Only of two places in the same row or column (or, upper, the same
  diagonal), so the answer is exact.
- How many schools (hills, forests) are on the map? Counted from the pictures.
- (upper) Which place is nearest the lake? Measured from the middle of each building's square to the lake's edge as
  drawn: one place, at least a whole square nearer than every other building.
- (upper) How long is the straight road between two buildings? The squares from the middle of one building's square to
  the middle of the other's, times the scale's kilometres.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Polygon, Rectangle

from ..core import GRID, INK, NAMES, count, mcq, new_figure, short
from ._map_icons import LEAF, ROAD, TRUNK, WATER, symbol

ID = "sector_map_p"
KIND = "geo.map"
SUBJECT = "social-studies"
BANDS = ("P",)
CONCEPTS = tuple(f"social-studies.{c}" for c in ("infrastructure", "physical-features", "environment-natural-resources",
                                                  "sector-location", "map-elements-importance", "direction-location"))
# A topic whose sections the book lists is reached only if its name or a section names infrastructure, natural
# resources, physical features, maps or directions.
NEEDS = r"infrastructure|natural resources|physical features|\bmaps?\b|direction"
# Never a religious, values or behaviour topic; nor the sector's history, the NERDC civics topics (they list no
# sections, so only a name keeps them out), the district's economic activities, or Rwanda's own administrative map.
AVOID = (r"\bgod\b|god's|bible|qur'?an|prayer|faith|\bsin\b|creation|commandment|charity|"
         r"democracy and governance|community helpers|rights|historical events|conflict|genocide|values|behaviour|"
         r"peace|harmony|environmental responsibility|socio-economic|national unity|rules and fairness|"
         r"our country")

COLS, ROWS = 8, 6
COLUMNS = "ABCDEFGH"
BUILDINGS = ["school", "health centre", "market", "community hall"]
UNIQUE = ["health centre", "market", "community hall"]
NATURE = ["hill", "forest"]
PLURAL = {"school": "schools", "hill": "hills", "forest": "forests"}
KEY_ORDER = ["school", "health centre", "market", "community hall", "hill", "forest", "lake", "river", "road"]
SECTORS = ["Green Hills", "Lakeside", "Sunrise", "Riverside", "Twin Hills", "Blue Lake", "Valley View", "Hilltop",
           "Morning Star", "Rainbow"]
DIRS = {"north": (0, 1), "north-east": (1, 1), "east": (1, 0), "south-east": (1, -1), "south": (0, -1),
        "south-west": (-1, -1), "west": (-1, 0), "north-west": (-1, 1)}
CARDINAL = ["north", "east", "south", "west"]
SHORT = {"north": "N", "north-east": "NE", "east": "E", "south-east": "SE", "south": "S", "south-west": "SW",
         "west": "W", "north-west": "NW"}
INSET = 0.15  # the lake's edge stands this far inside its block of squares
SIZE = 1.15  # the map draws its pictures this size; none reaches more than 0.4 from its square's middle


def stages(p: dict) -> tuple[int, int]:
    return (5, 6) if p["level"] == "upper" else (3, 4)


def _sign(v: int) -> int:
    return (v > 0) - (v < 0)


def way(a, b) -> str | None:
    dx, dy = b[0] - a[0], b[1] - a[1]
    if (dx, dy) == (0, 0) or not (dx == 0 or dy == 0 or abs(dx) == abs(dy)):
        return None
    return next(k for k, v in DIRS.items() if v == (_sign(dx), _sign(dy)))


def _point(ux: int, uy: int) -> str:
    return next(k for k, v in DIRS.items() if v == (ux, uy))


def lake_ring(lake, n: int = 240) -> list:
    c0, r0, w, h = lake
    cx, cy, a, b = c0 + w / 2, r0 + h / 2, w / 2 - INSET, h / 2 - INSET
    return [(cx + a * math.cos(2 * math.pi * i / n), cy + b * math.sin(2 * math.pi * i / n)) for i in range(n)]


def lake_gap(lake, cell) -> float:
    centre = (cell[0] + 0.5, cell[1] + 0.5)
    return min(math.dist(centre, q) for q in lake_ring(lake))


def river_cells(river, lake) -> set:
    along, k, side = river
    c0, r0, w, h = lake
    if along == "col":
        rows = range(r0 + h, ROWS) if side == "top" else range(0, r0)
        return {(k, r) for r in rows}
    cols = range(c0 + w, COLS) if side == "right" else range(0, c0)
    return {(c, k) for c in cols}


def _try(rng: random.Random, level: str) -> dict | None:
    w, h = rng.choice([(2, 2), (3, 2), (2, 3)])
    c0, r0 = rng.randrange(0, COLS - w + 1), rng.randrange(0, ROWS - h + 1)
    lake = [c0, r0, w, h]
    rivers = []
    if r0 + h < ROWS:
        rivers += [["col", k, "top"] for k in range(c0, c0 + w)]
    if r0 > 0:
        rivers += [["col", k, "bottom"] for k in range(c0, c0 + w)]
    if c0 + w < COLS:
        rivers += [["row", k, "right"] for k in range(r0, r0 + h)]
    if c0 > 0:
        rivers += [["row", k, "left"] for k in range(r0, r0 + h)]
    river = rng.choice(rivers)
    taken = {(c, r) for c in range(c0, c0 + w) for r in range(r0, r0 + h)} | river_cells(river, lake)
    free = [(c, r) for c in range(COLS) for r in range(ROWS) if (c, r) not in taken]
    if len(free) < 22:
        return None
    # the road first: two of the buildings in one row or column, 2 to 5 squares apart, nothing between them
    a, b = rng.sample(UNIQUE, 2)
    ca = rng.choice(free)
    ends = []
    for d in (2, 3, 4, 5):
        for ux, uy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            cb = (ca[0] + ux * d, ca[1] + uy * d)
            path = [(ca[0] + ux * t, ca[1] + uy * t) for t in range(d + 1)]
            if all(q in free for q in path):
                ends.append((cb, path))
    if not ends:
        return None
    cb, path = rng.choice(ends)
    cells = {a: ca, b: cb}
    used = set(path)
    n_school = rng.randint(2, 3) if level == "lower" else rng.randint(1, 3)
    bag = [k for k in UNIQUE if k not in cells] + ["school"] * n_school + ["hill"] * rng.randint(1, 2) + \
        ["forest"] * rng.randint(1, 2)
    symbols = [[a, ca[0], ca[1]], [b, cb[0], cb[1]]]
    rest = [q for q in free if q not in used]
    rng.shuffle(rest)
    for kind in bag:
        if not rest:
            return None
        q = rest.pop()
        symbols.append([kind, q[0], q[1]])
    rng.shuffle(symbols)
    kinds = [s[0] for s in symbols]
    where = {s[0]: (s[1], s[2]) for s in symbols if kinds.count(s[0]) == 1}
    named = [k for k in where if k in BUILDINGS]
    allowed = CARDINAL if level == "lower" else list(DIRS)
    pairs = [(x, y) for x in named for y in named if x != y and way(where[x], where[y]) in allowed]
    if level == "upper" and rng.random() < 0.6:
        pairs = [pr for pr in pairs if way(where[pr[0]], where[pr[1]]) not in CARDINAL] or pairs
    if not pairs:
        return None
    near = None
    if level == "upper":
        gap = {}
        for kind, c, r in symbols:
            if kind in BUILDINGS:
                gap[kind] = min(gap.get(kind, 99.0), lake_gap(lake, (c, r)))
        best = min(gap, key=gap.get)
        if any(gap[k] < gap[best] + 1.0 for k in gap if k != best) or len(gap) < 4:
            return None
        near = best
    counts = [k for k in ("school", "hill", "forest") if kinds.count(k) >= 2]
    if not counts:
        return None
    ends_cells = {ca, cb}
    askable = [s for s in symbols if (s[1], s[2]) not in ends_cells]
    sq = rng.choice(askable)
    return {"band": "P", "level": level, "sector": rng.choice(SECTORS), "cols": COLS, "rows": ROWS,
            "symbols": symbols, "lake": lake, "river": river, "road": [a, b], "km": rng.choice([1, 2]) if level == "upper" else 1,
            "ask": {"square": [sq[1], sq[2]], "dir": list(rng.choice(sorted(pairs))), "count": rng.choice(counts),
                    "near": near}}


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    while True:
        p = _try(rng, level)
        if p:
            return p


# --- drawing ----------------------------------------------------------------------------------------

def _hall(ax, cx, cy, s, gid=None, z=3):
    """A community hall: a long low building with a wide roof, two windows and a double door."""
    ax.add_patch(Rectangle((cx - 0.3 * s, cy - 0.27 * s), 0.6 * s, 0.3 * s, facecolor="#e8daef", edgecolor=INK,
                           linewidth=1.0, zorder=z, gid=gid))
    ax.add_patch(Polygon([(cx - 0.34 * s, cy + 0.03 * s), (cx + 0.34 * s, cy + 0.03 * s), (cx + 0.22 * s, cy + 0.2 * s),
                          (cx - 0.22 * s, cy + 0.2 * s)], closed=True, facecolor="#7d3c98", edgecolor=INK, linewidth=1.0,
                         zorder=z + 0.1))
    for dx in (-0.22, 0.12):
        ax.add_patch(Rectangle((cx + dx * s, cy - 0.12 * s), 0.1 * s, 0.08 * s, facecolor="#aed6f1", edgecolor=INK,
                               linewidth=0.6, zorder=z + 0.1))
    ax.add_patch(Rectangle((cx - 0.07 * s, cy - 0.27 * s), 0.14 * s, 0.17 * s, facecolor="#5d4037", edgecolor=INK,
                           linewidth=0.6, zorder=z + 0.1))


def _hill(ax, cx, cy, s, gid=None, z=3):
    """A hill: a brown slope with a green top."""
    pts = [(cx - 0.34 * s, cy - 0.24 * s)]
    pts += [(cx + 0.34 * s * math.cos(t), cy - 0.24 * s + 0.48 * s * math.sin(t))
            for t in [math.pi - k * math.pi / 20 for k in range(21)]]
    ax.add_patch(Polygon(pts, closed=True, facecolor="#a0522d", edgecolor=INK, linewidth=1.0, zorder=z, gid=gid))
    cap = [(cx + 0.34 * s * math.cos(t), cy - 0.24 * s + 0.48 * s * math.sin(t))
           for t in [math.pi * 0.7 - k * math.pi * 0.4 / 12 for k in range(13)]]
    ax.add_patch(Polygon(cap, closed=True, facecolor="#6aa84f", edgecolor=INK, linewidth=0.8, zorder=z + 0.1))


def _forest(ax, cx, cy, s, gid=None, z=3):
    """A forest: three trees close together."""
    first = True
    for dx, dy, r in ((-0.17, -0.02, 0.14), (0.17, -0.02, 0.14), (0.0, 0.12, 0.16)):
        ax.add_patch(Circle((cx + dx * s, cy + dy * s), r * s, facecolor=LEAF, edgecolor=INK, linewidth=1.0,
                            zorder=z + 0.1, gid=gid if first else None))
        first = False
        ax.add_patch(Rectangle((cx + (dx - 0.03) * s, cy + (dy - r - 0.12) * s), 0.06 * s, 0.13 * s, facecolor=TRUNK,
                               edgecolor=INK, linewidth=0.6, zorder=z))


def picture(ax, kind: str, cx: float, cy: float, s: float, gid: str | None = None, z: float = 3) -> None:
    if kind == "community hall":
        _hall(ax, cx, cy, s, gid, z)
    elif kind == "hill":
        _hill(ax, cx, cy, s, gid, z)
    elif kind == "forest":
        _forest(ax, cx, cy, s, gid, z)
    else:
        symbol(ax, kind, cx, cy, s=s, gid=gid, z=z)


def _river_points(p: dict) -> tuple[list, list]:
    along, k, side = p["river"]
    c0, r0, w, h = p["lake"]
    if along == "col":
        start, end = (ROWS, r0 + h / 2) if side == "top" else (0, r0 + h / 2)
    else:
        start, end = (COLS, c0 + w / 2) if side == "right" else (0, c0 + w / 2)
    n = 60
    t = [start + (end - start) * i / n for i in range(n + 1)]
    wobble = [k + 0.5 + 0.16 * math.sin(2 * math.pi * (v - start) / 1.6) for v in t]
    return (wobble, t) if along == "col" else (t, wobble)


def _compass(ax, cx: float, cy: float, upper: bool) -> None:
    r = 0.62
    for d in (list(DIRS) if upper else CARDINAL):
        ux, uy = DIRS[d]
        n = math.hypot(ux, uy)
        ux, uy = ux / n, uy / n
        length = r if d in CARDINAL else 0.55 * r
        w = 0.11
        px, py = -uy * w, ux * w
        tip = (cx + ux * length, cy + uy * length)
        ax.add_patch(Polygon([tip, (cx + px, cy + py), (cx, cy)], closed=True, facecolor=INK, edgecolor=INK,
                             linewidth=0.8, zorder=3))
        ax.add_patch(Polygon([tip, (cx - px, cy - py), (cx, cy)], closed=True, facecolor="white", edgecolor=INK,
                             linewidth=0.8, zorder=3))
        gap = 0.2 if d in CARDINAL else 0.24
        ax.text(cx + ux * (length + gap), cy + uy * (length + gap), SHORT[d], ha="center", va="center",
                fontsize=12 if d in CARDINAL else 10, fontweight="bold")


def _road(ax, xs, ys, gid=None):
    ax.plot(xs, ys, color="#6d6d6d", linewidth=10, solid_capstyle="butt", zorder=1.5)
    ax.plot(xs, ys, color=ROAD, linewidth=7, solid_capstyle="butt", zorder=1.6, gid=gid)


def draw(p: dict):
    cols, rows = p["cols"], p["rows"]
    fig, ax = new_figure(10.6, 6.8)
    ax.add_patch(Rectangle((0, 0), cols, rows, facecolor="#f4f7ee", edgecolor="none", zorder=0))
    for x in range(1, cols):
        ax.plot([x, x], [0, rows], color=GRID, linewidth=0.8, zorder=0.5)
    for y in range(1, rows):
        ax.plot([0, cols], [y, y], color=GRID, linewidth=0.8, zorder=0.5)
    ax.add_patch(Rectangle((0, 0), cols, rows, facecolor="none", edgecolor=INK, linewidth=1.4, zorder=5))
    xs, ys = _river_points(p)
    ax.plot(xs, ys, color=WATER, linewidth=5, solid_capstyle="butt", zorder=1, gid="river")
    ax.add_patch(Polygon(lake_ring(p["lake"]), closed=True, facecolor="#7fb3e0", edgecolor="#2e6da4", linewidth=1.6,
                         zorder=2, gid="lake"))
    where = {s[0]: (s[1], s[2]) for s in p["symbols"]}
    (xa, ya), (xb, yb) = where[p["road"][0]], where[p["road"][1]]
    _road(ax, [xa + 0.5, xb + 0.5], [ya + 0.5, yb + 0.5], gid="road")
    for i, (kind, c, r) in enumerate(p["symbols"]):
        picture(ax, kind, c + 0.5, r + 0.5, SIZE, gid=f"sym:{i}:{kind}", z=3)
    for i in range(cols):
        ax.text(i + 0.5, -0.3, COLUMNS[i], ha="center", va="center", fontsize=12, fontweight="bold")
    for j in range(rows):
        ax.text(-0.3, j + 0.5, str(j + 1), ha="center", va="center", fontsize=12, fontweight="bold")
    ax.text(cols / 2, rows + 0.4, f"Map of {p['sector']} Sector", ha="center", va="center", fontsize=14,
            fontweight="bold")
    # the compass rose, then the key
    kx = cols + 0.5
    _compass(ax, kx + 1.75, rows - 0.25, p["level"] == "upper")
    ax.add_patch(Rectangle((kx, -0.75), 3.5, 5.6, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=0))
    ax.text(kx + 1.75, 4.55, "Key", ha="center", va="center", fontsize=13, fontweight="bold")
    for k, kind in enumerate(KEY_ORDER):
        y = 4.0 - k * 0.55
        if kind == "lake":
            ax.add_patch(Polygon([(kx + 0.55 + 0.32 * math.cos(t / 12 * math.pi), y + 0.17 * math.sin(t / 12 * math.pi))
                                  for t in range(24)], closed=True, facecolor="#7fb3e0", edgecolor="#2e6da4",
                                 linewidth=1.2, zorder=2))
        elif kind == "river":
            wx = [kx + 0.25 + 0.6 * i / 24 for i in range(25)]
            ax.plot(wx, [y + 0.07 * math.sin(2 * math.pi * (v - wx[0]) / 0.3) for v in wx], color=WATER, linewidth=4,
                    zorder=1)
        elif kind == "road":
            _road(ax, [kx + 0.25, kx + 0.85], [y, y])
        else:
            picture(ax, kind, kx + 0.55, y, 0.8)
        ax.text(kx + 1.15, y, kind, ha="left", va="center", fontsize=12)
    if p["level"] == "upper":
        ax.text(0.0, -0.95, "Scale:", ha="left", va="center", fontsize=12, fontweight="bold")
        ax.add_patch(Rectangle((1.0, -1.03), 1, 0.16, facecolor=INK, edgecolor=INK, linewidth=1.0))
        ax.text(2.2, -0.95, f"1 square = {p['km']} km", ha="left", va="center", fontsize=12)
    ax.set_xlim(-0.6, kx + 3.6)
    ax.set_ylim(-1.5, rows + 0.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a Social Studies lesson", "for homework", "before a class walk", "in the school library",
            "at home", "for a class test", "with a friend", "in class"]
VERBS = ["looks at", "studies", "reads", "is using"]


def square(cell) -> str:
    return f"{COLUMNS[cell[0]]}{cell[1] + 1}"


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    syms = p["symbols"]
    at = {(c, r): kind for kind, c, r in syms}
    kinds = [s[0] for s in syms]
    lead = f"{who} {rng.choice(VERBS)} this map of {p['sector']} Sector {rng.choice(SETTINGS)}."
    ask = p["ask"]
    # 1. what is in a square; wrong options: the square read the other way round, then its neighbours, then the rest
    c, r = ask["square"]
    key = at[(c, r)]
    near = [(r, c)] + [(c + dx, r + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
    slips = [at[q] for q in near if q in at and at[q] != key]
    rest = [k for k in BUILDINGS + NATURE if k != key and k not in slips]
    rng.shuffle(rest)
    out = [mcq(f"{lead} What is in square {square((c, r))}? Use the key.", key, slips + rest, rng)]
    # 2. the direction from one place to another
    a, b = ask["dir"]
    where = {s[0]: (s[1], s[2]) for s in syms if kinds.count(s[0]) == 1}
    d = way(where[a], where[b])
    if d in CARDINAL:
        others = [_point(-DIRS[d][0], -DIRS[d][1])] + [x for x in CARDINAL if x not in (d, _point(-DIRS[d][0], -DIRS[d][1]))]
    else:
        ux, uy = DIRS[d]
        others = [_point(-ux, -uy), _point(-ux, uy), _point(ux, -uy)]
    out.append(mcq(f"In which direction is the {b} from the {a}?", d, others, rng))
    # 3. a count
    k = ask["count"]
    out.append(count(f"How many {PLURAL[k]} are on the map?", kinds.count(k), PLURAL[k]))
    if p["level"] == "upper":
        gap = {}
        for kind, cc, rr in syms:
            if kind in BUILDINGS:
                gap[kind] = min(gap.get(kind, 99.0), lake_gap(p["lake"], (cc, rr)))
        out.append(mcq("Which place is nearest the lake?", ask["near"], sorted(gap, key=gap.get), rng))
        x, y = p["road"]
        n = (abs(where[x][0] - where[y][0]) + abs(where[x][1] - where[y][1])) * p["km"]
        out.append(short(f"A straight road joins the {x} and the {y}. Count from the middle of one square to the middle "
                         f"of the other. How long is the road? Use the scale.",
                         f"{n} km", [str(n), f"{n} kilometres", f"{n}km"]))
    return out
