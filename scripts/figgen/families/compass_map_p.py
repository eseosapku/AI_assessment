"""A map of a sector on a light grid (P, Primary Social Studies): 5 to 7 named places, each a simple picture in a
square of its own (a school, a church, a market, a health centre, the sector office, a bank, a football field, a
water tap), a river running down a column or across a row, and a road joining two places, with a compass rose:
N, E, S and W at the lower level, and NE, SE, SW and NW as well at the upper level (P5 to P6). North is up. The
columns are lettered A to H along the bottom and the rows numbered 1 to 6 up the side.

- In which direction is one place from another? Only asked of two places in the same row, the same column or (upper)
  the same diagonal, so the answer is exact. The wrong options are the opposite way (reading it from the second place
  to the first) and the other points.
- Which place is east (north-east, ...) of a place? The answer is exactly that way, on the place's own row, column or
  diagonal, and no other place lies anywhere in that quarter of the map around it. Every wrong option lies in the other
  half of the map, not that way at all even loosely: for west, level with the place or east of it (P3x review: a
  football field west of the water tap but higher up had read as a second answer).
- Which place is the furthest north (south, east, west)? One place only.
- In which square is a place? Its column's letter, then its row's number (P3x review: counting steps along the road
  was read two ways, since the pictures sit inside their squares and the road runs under them).
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon, Rectangle

from ..core import GRID, INK, NAMES, mcq, new_figure, short
from ._map_icons import ROAD, WATER, symbol

ID = "compass_map_p"
KIND = "geo.map"
SUBJECT = "social-studies"
BANDS = ("P",)
CONCEPTS = tuple(f"social-studies.{c}" for c in ("direction-location", "map-elements-importance", "sector-location"))
# A topic whose sections the book lists is reached only if its name or a section names directions, maps or places.
NEEDS = r"direction|location|\bmaps?\b|our sector|our country"
# Never a religious topic, and never a Nigerian civics topic (they list no sections, so only a name keeps them out).
AVOID = (r"\bgod\b|god's|bible|qur'?an|prayer|faith|\bsin\b|creation|commandment|charity|"
         r"democracy and governance|community helpers|rights and responsibilities|historical events")

COLS, ROWS = 8, 6
COLUMNS = "ABCDEFGH"
PLACES = ["school", "church", "market", "health centre", "sector office", "bank", "football field", "water tap"]
LABEL = {"health centre": "health\ncentre", "sector office": "sector\noffice", "football field": "football\nfield",
         "water tap": "water\ntap"}
SECTORS = ["Kabuye", "Rugarama", "Gatare", "Mubuga", "Kigarama", "Nyarutovu", "Rwaza", "Rubona", "Karama", "Ruhanga"]
DIRS = {"north": (0, 1), "north-east": (1, 1), "east": (1, 0), "south-east": (1, -1), "south": (0, -1),
        "south-west": (-1, -1), "west": (-1, 0), "north-west": (-1, 1)}
CARDINAL = ["north", "east", "south", "west"]
SHORT = {"north": "N", "north-east": "NE", "east": "E", "south-east": "SE", "south": "S", "south-west": "SW",
         "west": "W", "north-west": "NW"}


def stages(p: dict) -> tuple[int, int] | None:
    return (4, 6) if p["level"] == "upper" else None  # the in-between points are taught in P5 and P6


def _sign(v: int) -> int:
    return (v > 0) - (v < 0)


def way(a, b) -> str | None:
    """The compass point from square a to square b where b lies exactly on it (same row, column or diagonal)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    if (dx, dy) == (0, 0) or not (dx == 0 or dy == 0 or abs(dx) == abs(dy)):
        return None
    return next(k for k, v in DIRS.items() if v == (_sign(dx), _sign(dy)))


def quarter(d: str, a, b) -> bool:
    """Whether b lies anywhere in the quarter of the map around point d, seen from a (its edges included)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    if (dx, dy) == (0, 0):
        return False
    ux, uy = DIRS[d]
    if d in CARDINAL:
        along = dx * ux + dy * uy
        return along > 0 and abs(dx * uy - dy * ux) <= along
    return dx * ux >= 0 and dy * uy >= 0


def other_half(d: str, a, b) -> bool:
    """Whether b lies in the half of the map facing away from point d, seen from a (the dividing line included): not
    that way at all, even loosely."""
    ux, uy = DIRS[d]
    return (b[0] - a[0]) * ux + (b[1] - a[1]) * uy <= 0


def square(cell) -> str:
    """A square as a Primary map names it: its column's letter, then its row's number counted from the bottom."""
    return f"{COLUMNS[cell[0]]}{cell[1] + 1}"


def _point(ux: int, uy: int) -> str:
    return next(k for k, v in DIRS.items() if v == (ux, uy))


def opposite(d: str) -> str:
    ux, uy = DIRS[d]
    return _point(-ux, -uy)


def road_path(a, corner, b) -> list[tuple[int, int]]:
    """Every square the road passes through, from a to b by the corner."""
    path, cur = [tuple(a)], tuple(a)
    for target in (tuple(corner), tuple(b)):
        while cur != target:
            cur = (cur[0] + _sign(target[0] - cur[0]), cur[1] + _sign(target[1] - cur[1]))
            path.append(cur)
    return path


def _try(rng: random.Random, level: str) -> dict | None:
    n = rng.randint(5, 6) if level == "lower" else rng.randint(6, 7)
    along = rng.choice(["col", "row"])
    k = rng.randrange(1, COLS - 1) if along == "col" else rng.randrange(1, ROWS - 1)
    free = [(x, y) for x in range(COLS) for y in range(ROWS) if (x if along == "col" else y) != k]
    rng.shuffle(free)
    cells: list[tuple[int, int]] = []
    for c in free:
        if all(max(abs(c[0] - o[0]), abs(c[1] - o[1])) >= 2 for o in cells):
            cells.append(c)
        if len(cells) == n:
            break
    if len(cells) < n:
        return None
    names = rng.sample(PLACES, n)
    places = dict(zip(names, cells))
    allowed = CARDINAL if level == "lower" else list(DIRS)

    pairs = [(a, b) for a in names for b in names if a != b and way(places[a], places[b]) in allowed]
    if level == "upper" and rng.random() < 0.6:
        pairs = [pr for pr in pairs if way(places[pr[0]], places[pr[1]]) not in CARDINAL] or pairs
    whiches = []
    for x in names:
        for d in allowed:
            inside = [o for o in names if o != x and quarter(d, places[x], places[o])]
            away = [o for o in names if o != x and other_half(d, places[x], places[o])]
            if len(inside) == 1 and way(places[x], places[inside[0]]) == d and len(away) >= 2:
                whiches.append((x, d))  # one answer, and two wrong options not that way at all
    if level == "upper" and rng.random() < 0.5:
        whiches = [w for w in whiches if w[1] not in CARDINAL] or whiches
    fars = []
    for d in CARDINAL:
        ux, uy = DIRS[d]
        score = sorted((places[o][0] * ux + places[o][1] * uy for o in names), reverse=True)
        if score[0] > score[1]:
            fars.append(d)
    roads = []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            pa, pb = places[a], places[b]
            if not 3 <= abs(pa[0] - pb[0]) + abs(pa[1] - pb[1]) <= 9:
                continue
            for corner in {(pb[0], pa[1]), (pa[0], pb[1])}:
                path = road_path(pa, corner, pb)
                if set(path[1:-1]) & set(cells):
                    continue
                if along == "col" and any(u[0] == v[0] == k for u, v in zip(path, path[1:])):
                    continue
                if along == "row" and any(u[1] == v[1] == k for u, v in zip(path, path[1:])):
                    continue
                roads.append((a, b, corner))
    if not (pairs and whiches and fars and roads):
        return None
    a, b, corner = rng.choice(sorted(roads))
    if rng.random() < 0.5:
        a, b = b, a
    return {"band": "P", "level": level, "sector": rng.choice(SECTORS), "cols": COLS, "rows": ROWS,
            "places": {nm: list(places[nm]) for nm in sorted(names)}, "river": [along, k],
            "road": [a, b, list(corner)], "dir_pair": list(rng.choice(sorted(pairs))),
            "which": list(rng.choice(sorted(whiches))), "far": rng.choice(fars), "square": rng.choice(sorted(names))}


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    while True:
        p = _try(rng, level)
        if p:
            return p


# --- drawing ----------------------------------------------------------------------------------------

def _river_points(along: str, k: int, length: int, phase: float) -> tuple[list[float], list[float]]:
    steps = 12 * length
    t = [length * i / steps for i in range(steps + 1)]
    wobble = [k + 0.5 + 0.2 * math.sin(2 * math.pi * v / 2.5 + phase) for v in t]
    return (wobble, t) if along == "col" else (t, wobble)


def _compass(ax, cx: float, cy: float, upper: bool) -> None:
    r = 0.78
    points = list(DIRS) if upper else CARDINAL
    for d in points:
        ux, uy = DIRS[d]
        n = math.hypot(ux, uy)
        ux, uy = ux / n, uy / n
        length = r if d in CARDINAL else 0.55 * r
        w = 0.13
        px, py = -uy * w, ux * w
        tip = (cx + ux * length, cy + uy * length)
        ax.add_patch(Polygon([tip, (cx + px, cy + py), (cx, cy)], closed=True, facecolor=INK, edgecolor=INK,
                             linewidth=0.8, zorder=3))
        ax.add_patch(Polygon([tip, (cx - px, cy - py), (cx, cy)], closed=True, facecolor="white", edgecolor=INK,
                             linewidth=0.8, zorder=3))
        gap = 0.2 if d in CARDINAL else 0.24
        ax.text(cx + ux * (length + gap), cy + uy * (length + gap), SHORT[d], ha="center", va="center",
                fontsize=12 if d in CARDINAL else 10, fontweight="bold", gid=f"compass:{SHORT[d]}")


def draw(p: dict):
    cols, rows = p["cols"], p["rows"]
    fig, ax = new_figure(10.0, 6.4)
    ax.add_patch(Rectangle((0, 0), cols, rows, facecolor="#f4f7ee", edgecolor="none", zorder=0))
    for x in range(1, cols):
        ax.plot([x, x], [0, rows], color=GRID, linewidth=0.8, zorder=0.5)
    for y in range(1, rows):
        ax.plot([0, cols], [y, y], color=GRID, linewidth=0.8, zorder=0.5)
    ax.add_patch(Rectangle((0, 0), cols, rows, facecolor="none", edgecolor=INK, linewidth=1.4, zorder=5))
    along, k = p["river"]
    xs, ys = _river_points(along, k, rows if along == "col" else cols, phase=(k * 1.7) % 6.28)
    ax.plot(xs, ys, color=WATER, linewidth=5, solid_capstyle="butt", zorder=1, gid="river")
    places = p["places"]
    a, b, corner = p["road"]
    pts = [(places[a][0] + 0.5, places[a][1] + 0.5), (corner[0] + 0.5, corner[1] + 0.5),
           (places[b][0] + 0.5, places[b][1] + 0.5)]
    rx, ry = [q[0] for q in pts], [q[1] for q in pts]
    ax.plot(rx, ry, color="#6d6d6d", linewidth=11, solid_capstyle="butt", solid_joinstyle="miter", zorder=1.5)
    ax.plot(rx, ry, color=ROAD, linewidth=8, solid_capstyle="butt", solid_joinstyle="miter", zorder=1.6, gid="road")
    for name, (x, y) in places.items():
        symbol(ax, name, x + 0.5, y + 0.66, s=0.95, z=3)
        ax.text(x + 0.5, y + 0.2, LABEL.get(name, name), ha="center", va="center", fontsize=10, linespacing=1.0,
                zorder=6, gid=f"place:{name}",
                bbox=dict(boxstyle="round,pad=0.08", facecolor="white", edgecolor="none", alpha=0.85))
    ax.text(cols / 2, rows + 0.35, f"Map of {p['sector']} Sector", ha="center", va="center", fontsize=13,
            fontweight="bold")
    # the compass rose, and a small key for the two lines
    cx = cols + 1.55
    _compass(ax, cx, rows - 1.35, p["level"] == "upper")
    ky = 1.75
    ax.text(cols + 0.45, ky + 0.55, "Key", ha="left", va="center", fontsize=11, fontweight="bold")
    ax.plot([cols + 0.45, cols + 1.25], [ky, ky], color="#6d6d6d", linewidth=11, solid_capstyle="butt", zorder=1.5)
    ax.plot([cols + 0.45, cols + 1.25], [ky, ky], color=ROAD, linewidth=8, solid_capstyle="butt", zorder=1.6)
    ax.text(cols + 1.45, ky, "road", ha="left", va="center", fontsize=10)
    wx = [cols + 0.45 + 0.8 * i / 24 for i in range(25)]
    ax.plot(wx, [ky - 0.6 + 0.08 * math.sin(2 * math.pi * (v - wx[0]) / 0.4) for v in wx], color=WATER, linewidth=4,
            zorder=1)
    ax.text(cols + 1.45, ky - 0.6, "river", ha="left", va="center", fontsize=10)
    for i in range(cols):
        ax.text(i + 0.5, -0.3, COLUMNS[i], ha="center", va="center", fontsize=11, fontweight="bold", gid=f"col:{COLUMNS[i]}")
    for j in range(rows):
        ax.text(-0.3, j + 0.5, str(j + 1), ha="center", va="center", fontsize=11, fontweight="bold", gid=f"row:{j + 1}")
    ax.set_xlim(-0.6, cols + 3.0)
    ax.set_ylim(-0.6, rows + 0.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a Social Studies lesson", "for homework", "before a class walk", "in the school library",
            "at home in Musanze", "for a class test", "on a visit to the sector", "in a lesson in Huye"]
VERBS = ["looks at", "studies", "reads", "is using"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    places = {k: tuple(v) for k, v in p["places"].items()}
    names = sorted(places)
    setting = rng.choice(SETTINGS)
    qs = []

    # 1. the direction from one place to another
    a, b = p["dir_pair"]
    key = way(places[a], places[b])
    if key in CARDINAL:
        others = [opposite(key)] + [d for d in CARDINAL if d not in (key, opposite(key))]
    else:
        ux, uy = DIRS[key]
        others = [opposite(key), _point(-ux, uy), _point(ux, -uy)]  # the way back, then east and west mixed up
    qs.append(mcq(f"{who} {rng.choice(VERBS)} this map of {p['sector']} Sector {setting}. In which direction is the {b} "
                  f"from the {a}?", key, others, rng))

    # 2. which place lies that way; the wrong options all lie in the other half of the map
    x, d = p["which"]
    key = next(o for o in names if o != x and quarter(d, places[x], places[o]))
    away = [o for o in names if o not in (x, key) and other_half(d, places[x], places[o])]
    back = [o for o in away if way(places[x], places[o]) == opposite(d)]  # exactly the other way: east for west
    rest = [o for o in away if o not in back]
    rng.shuffle(rest)
    qs.append(mcq(f"Which place is {d} of the {x}?", key, back + rest, rng))

    # 3. the furthest one way
    d = p["far"]
    ux, uy = DIRS[d]
    order = sorted(names, key=lambda o: -(places[o][0] * ux + places[o][1] * uy))
    back = order[-1]
    qs.append(mcq(f"Which place is the furthest {d} on the map?", order[0], [back, order[1]] + order[2:-1], rng))

    # 4. a grid reference: the column's letter, then the row's number
    key = square(places[p["square"]])
    forms = [key.lower(), f"{key[0]} {key[1:]}", f"{key[0].lower()} {key[1:]}", f"{key[0]}, {key[1:]}", f"{key[0]},{key[1:]}"]
    qs.append(short(f"In which square is the {p['square']}? Give the letter, then the number.", key, forms))
    return qs
