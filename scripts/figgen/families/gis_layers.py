"""GIS layers (LS): an invented Rwandan district's map built from three layers, drawn as a GIS book draws them -- a point
layer (schools), a line layer (roads and a river) and a polygon layer (land use) stacked one above another, and beside
them the combined map on a 1 km grid with a scale bar, a north arrow and a legend, and under it the land-use layer's
attribute table (FID, land use, area in hectares, each area the polygon's own in whole grid squares x 100 ha).

Four features are lettered on the map: a school, a road and two land-use polygons. Asks which layer type a lettered
feature belongs to (point, line or polygon), how many schools lie inside a named land-use polygon (found by its
legend colour), which row (FID) of the attribute table describes a lettered polygon, and how long a named road is by
the scale bar (roads run along the grid, so their length is whole kilometres).

Schools sit at the middle of grid squares, at least 0.3 km from every polygon edge, so inside and outside are never
close calls. Every key is worked from the params.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Polygon, Rectangle

from ..core import INK, NAMES, count, mcq, new_figure, short

ID = "gis_layers"
KIND = "geo.map"
SUBJECT = "computing"
BANDS = ("LS",)
CONCEPTS = tuple(f"computing.{c}" for c in ("maps-layers", "gis-terminology", "attribute-tables", "gis-layer-properties",
                                            "measurement-gis", "arcgis-mapping", "gis-feature-selection"))
# A topic whose sections the book lists is reached only if its name or a section names GIS, maps, layers, attribute
# tables, queries or measuring.
NEEDS = r"\bgis\b|arcgis|arcmap|\bmaps?\b|layer|attribute|query|querying|measure|features?"
AVOID = r"spreadsheet|database management|presentation|word processing|email|network|security|programming"
W, H = 10, 7  # the map, in km
DISTRICTS = ["Isoko", "Umucyo", "Amahoro", "Urumuri", "Imena"]
LANDUSE = {"Forest": "#7fae7a", "Farmland": "#f1df9a", "Wetland": "#a9cfe0", "Built-up area": "#c9c9c9",
           "Tea plantation": "#b9d98a"}
ROADS = ["Market Road", "School Road", "Hill Road", "Lake Road"]
LAYERS = {"point": "point layer", "line": "line layer", "polygon": "polygon layer"}


def _rect_poly(x0: int, y0: int, w: int, h: int, cut: bool) -> list[list[float]]:
    if not cut:
        return [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]]
    # the top-left corner cut on a 2:1 slant, so no square's middle lies on the cut
    return [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0 + 2, y0 + h], [x0, y0 + h - 1]]


def area(poly: list) -> float:
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1]))) / 2


def contains(poly: list, pt: list) -> bool:
    x, y = pt
    inside = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def edge_gap(poly: list, pt: list) -> float:
    def seg(a, b):
        ax_, ay, bx, by = *a, *b
        dx, dy = bx - ax_, by - ay
        t = max(0.0, min(1.0, ((pt[0] - ax_) * dx + (pt[1] - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(pt[0] - ax_ - t * dx, pt[1] - ay - t * dy)
    return min(seg(a, b) for a, b in zip(poly, poly[1:] + poly[:1]))


def road_length(path: list) -> int:
    return sum(abs(b[0] - a[0]) + abs(b[1] - a[1]) for a, b in zip(path, path[1:]))


def unit_steps(path: list) -> set:
    """The 1 km grid edges a road runs along."""
    out = set()
    for a, b in zip(path, path[1:]):
        if a[0] == b[0]:
            out |= {(a[0], y, "v") for y in range(min(a[1], b[1]), max(a[1], b[1]))}
        else:
            out |= {(x, a[1], "h") for x in range(min(a[0], b[0]), max(a[0], b[0]))}
    return out


def _share(roads: list) -> bool:
    """Two roads running along the same stretch of grid read as one."""
    return bool(unit_steps(roads[0]["path"]) & unit_steps(roads[1]["path"]))


def _overlap(a: list, b: list) -> bool:
    ax0, ay0, aw, ah = a
    bx0, by0, bw, bh = b
    return ax0 < bx0 + bw and bx0 < ax0 + aw and ay0 < by0 + bh and by0 < ay0 + ah


def sample(rng: random.Random) -> dict:
    while True:
        kinds = rng.sample(sorted(LANDUSE), rng.choice([3, 4]))
        rects: list[list[int]] = []
        tries = 0
        while len(rects) < len(kinds) and tries < 200:
            tries += 1
            w, h = rng.randint(3, 5), rng.randint(2, 4)
            r = [rng.randint(0, W - w), rng.randint(0, H - h), w, h]
            if not any(_overlap(r, q) for q in rects):
                rects.append(r)
        if len(rects) < len(kinds):
            continue
        polys = [_rect_poly(*r, cut=rng.random() < 0.4 and r[2] >= 3 and r[3] >= 2) for r in rects]
        cells = [[x + 0.5, y + 0.5] for x in range(W) for y in range(H)]
        rng.shuffle(cells)
        schools: list[list[float]] = []
        want = rng.randint(6, 8)
        for c in cells:
            if len(schools) == want:
                break
            if all(edge_gap(pl, c) >= 0.3 for pl in polys) and all(math.dist(c, s) >= 1.4 for s in schools) \
                    and 0.5 < c[0] < W - 0.5 and 0.5 < c[1] < H - 0.5:
                schools.append(c)
        if len(schools) < 6:
            continue
        inside = [sum(contains(pl, s) for s in schools) for pl in polys]
        countable = [i for i, n in enumerate(inside) if 1 <= n <= 3]
        if not countable:
            continue
        roads = []
        for name in rng.sample(ROADS, 2):
            xa, xb = sorted(rng.sample(range(0, W + 1), 2))
            ya, yb = rng.sample(range(1, H), 2)
            path = [[xa, ya], [xb, ya], [xb, yb]] if rng.random() < 0.5 else [[xa, ya], [xa, yb], [xb, yb]]
            roads.append({"name": name, "path": path})
        lengths = [road_length(r["path"]) for r in roads]
        if lengths[0] == lengths[1] or not all(4 <= n <= 12 for n in lengths) or _share(roads):
            continue
        letters = rng.sample(["K", "L", "M", "N"], 4)
        lettered_polys = rng.sample(range(len(polys)), 2)
        school_i = rng.randrange(len(schools))
        road_i = rng.randrange(2)
        fids = list(range(len(polys)))
        rng.shuffle(fids)
        p = {"band": "LS", "district": rng.choice(DISTRICTS),
             "polygons": [{"use": k, "poly": pl, "fid": f} for k, pl, f in zip(kinds, polys, fids)],
             "schools": schools, "roads": roads,
             "river": {"top": rng.choice([1.3, 2.7, 4.4, 6.2, 8.6]), "bottom": rng.choice([1.6, 3.3, 5.7, 7.4, 8.8]),
                       "wave": rng.choice([0.5, 0.8, 1.1])},
             "letters": {letters[0]: ["point", school_i], letters[1]: ["line", road_i],
                         letters[2]: ["polygon", lettered_polys[0]], letters[3]: ["polygon", lettered_polys[1]]},
             "ask": {"type": rng.choice(letters), "count": rng.choice(countable),
                     "fid": rng.choice([letters[2], letters[3]]), "road": rng.randrange(2)}}
        if _place_labels(p) is None:
            continue
        return p


# --- label placement --------------------------------------------------------------------------------------------

def _river(p: dict, n: int = 60) -> list[tuple[float, float]]:
    r = p["river"]
    out = []
    for i in range(n + 1):
        t = i / n
        x = r["top"] + (r["bottom"] - r["top"]) * t + r["wave"] * math.sin(t * math.pi * 2)
        out.append((min(max(x, 0.0), W), H * (1 - t)))
    return out


def _place_labels(p: dict) -> dict | None:
    """Where each letter and road name sits on the map (km): clear of the schools, the roads, the river and each other;
    None if there is no room."""
    taken: list[tuple[float, float, float, float]] = []  # boxes: x0, y0, x1, y1

    def free(box, own_school=None, own_road=None) -> bool:
        x0, y0, x1, y1 = box
        if x0 < 0.05 or y0 < 0.05 or x1 > W - 0.05 or y1 > H - 0.05:
            return False
        if any(x0 < b[2] and b[0] < x1 and y0 < b[3] and b[1] < y1 for b in taken):
            return False
        for k, s in enumerate(p["schools"]):
            if k != own_school and x0 - 0.25 < s[0] < x1 + 0.25 and y0 - 0.25 < s[1] < y1 + 0.25:
                return False
        for k, r in enumerate(p["roads"]):
            if k == own_road:
                continue
            for a, b in zip(r["path"], r["path"][1:]):
                if a[0] == b[0] and x0 - 0.08 < a[0] < x1 + 0.08 and min(a[1], b[1]) < y1 and y0 < max(a[1], b[1]):
                    return False
                if a[1] == b[1] and y0 - 0.08 < a[1] < y1 + 0.08 and min(a[0], b[0]) < x1 and x0 < max(a[0], b[0]):
                    return False
        for (rx, ry) in _river(p):
            if x0 - 0.1 < rx < x1 + 0.1 and y0 - 0.1 < ry < y1 + 0.1:
                return False
        return True

    def clear_leader(x, y, ax_, ay, own_school=None, own_road=None) -> bool:
        """The leader from the feature to the letter's circle crosses nothing else."""
        for k in range(1, 10):
            t = k / 10
            px, py = ax_ + (x - ax_) * t, ay + (y - ay) * t
            if not free((px - 0.04, py - 0.04, px + 0.04, py + 0.04), own_school, own_road):
                return False
        return True

    out: dict[str, list[float]] = {}
    r = 0.3  # a letter's circle, in km
    for letter, (kind, i) in sorted(p["letters"].items()):
        school = road = None
        if kind == "point":
            school = i
            sx, sy = p["schools"][i]
            spots = [(sx + dx, sy + dy, sx, sy) for dx, dy in ((0.9, 0.0), (-0.9, 0.0), (0.0, 0.9), (0.0, -0.9),
                                                                 (0.7, 0.7), (-0.7, 0.7), (0.7, -0.7), (-0.7, -0.7))]
        elif kind == "line":
            road = i
            path = p["roads"][i]["path"]
            spots = []
            for a, b in zip(path, path[1:]):
                for t in (0.5, 0.25, 0.75):
                    mx, my = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                    if a[0] == b[0]:
                        spots += [(mx + 0.85, my, mx, my), (mx - 0.85, my, mx, my)]
                    else:
                        spots += [(mx, my + 0.85, mx, my), (mx, my - 0.85, mx, my)]
        else:
            poly = p["polygons"][i]["poly"]
            xs, ys = [v[0] for v in poly], [v[1] for v in poly]
            spots = [(x + 0.5, y + 0.5, None, None) for x in range(int(min(xs)), int(max(xs)))
                     for y in range(int(min(ys)), int(max(ys)))
                     if contains(poly, (x + 0.5, y + 0.5)) and edge_gap(poly, (x + 0.5, y + 0.5)) >= 0.35]
        for (x, y, ax_, ay) in spots:
            box = (x - r, y - r, x + r, y + r)
            if free(box) and (ax_ is None or clear_leader(x, y, ax_, ay, school, road)):
                out[letter] = [x, y] if ax_ is None else [x, y, ax_, ay]
                taken.append(box)
                if ax_ is not None:  # road names keep off the leader too
                    taken.extend((ax_ + (x - ax_) * k / 6 - 0.05, ay + (y - ay) * k / 6 - 0.05,
                                  ax_ + (x - ax_) * k / 6 + 0.05, ay + (y - ay) * k / 6 + 0.05) for k in range(1, 6))
                break
        else:
            return None
    for k, road in enumerate(p["roads"]):
        path = road["path"]
        segs = sorted(zip(path, path[1:]), key=lambda s: -(abs(s[1][0] - s[0][0]) + abs(s[1][1] - s[0][1])))
        half = len(road["name"]) * 0.085  # half the name's width, in km, at 8.5 pt
        placed = False
        for a, b in segs:
            if a[1] != b[1]:
                continue
            for t in (0.5, 0.3, 0.7):
                mx = a[0] + (b[0] - a[0]) * t
                for dy in (0.3, -0.3):
                    box = (mx - half, a[1] + dy - 0.17, mx + half, a[1] + dy + 0.17)
                    if free(box):
                        out[f"road:{k}"] = [mx, a[1] + dy]
                        taken.append(box)
                        placed = True
                        break
                if placed:
                    break
            if placed:
                break
        if not placed:
            return None
    return out


# --- drawing --------------------------------------------------------------------------------------------------

S = 0.55  # inches per km on the combined map
MX, MY = 5.0, 2.3  # the combined map's lower-left corner


def _layer(ax, p: dict, which: str, oy: float) -> None:
    """One layer of the stack, slanted, its own features only."""
    a, b, c, ox = 0.3, 0.13, 0.12, 0.3
    tf = lambda x, y: (ox + x * a + y * b, oy + y * c)  # noqa: E731
    ax.add_patch(Polygon([tf(0, 0), tf(W, 0), tf(W, H), tf(0, H)], closed=True, facecolor="white", edgecolor=INK,
                         linewidth=1.1))
    if which == "polygon":
        for pg in p["polygons"]:
            ax.add_patch(Polygon([tf(*v) for v in pg["poly"]], closed=True, facecolor=LANDUSE[pg["use"]], edgecolor=INK,
                                 linewidth=0.6))
    elif which == "line":
        for r in p["roads"]:
            pts = [tf(*v) for v in r["path"]]
            ax.plot([q[0] for q in pts], [q[1] for q in pts], color=INK, linewidth=1.4)
        pts = [tf(*v) for v in _river(p, 30)]
        ax.plot([q[0] for q in pts], [q[1] for q in pts], color="#3b7ea1", linewidth=1.2)
    else:
        for s in p["schools"]:
            x, y = tf(*s)
            ax.plot([x], [y], marker="^", color=INK, markersize=4.5, linestyle="none")
    label = {"point": "Point layer: schools", "line": "Line layer: roads and river", "polygon": "Polygon layer: land use"}
    ax.text(ox + H * b, oy + H * c + 0.13, label[which], ha="left", va="center", fontsize=9.5)


def draw(p: dict):
    spots = _place_labels(p)
    fig, ax = new_figure(11.6, 7.4)
    ax.set_position([0, 0, 1, 1])
    top = 7.1
    ax.text(0.3, top, f"{p['district']} District (an invented district): GIS layers and the map they make",
            ha="left", va="center", fontsize=12, fontweight="bold")
    # the stack
    for k, which in enumerate(("point", "line", "polygon")):
        _layer(ax, p, which, 5.4 - k * 1.3)
    ax.annotate("", xy=(MX - 0.15, MY + H * S / 2), xytext=(MX - 0.75, MY + H * S / 2),
                arrowprops={"arrowstyle": "-|>", "color": INK, "lw": 1.3})
    # the combined map
    m = lambda x, y: (MX + x * S, MY + y * S)  # noqa: E731
    ax.text(MX, MY + H * S + 0.22, "Combined map (each grid square is 1 km by 1 km)", ha="left", va="center",
            fontsize=10, fontweight="bold")
    for pg in p["polygons"]:
        ax.add_patch(Polygon([m(*v) for v in pg["poly"]], closed=True, facecolor=LANDUSE[pg["use"]], edgecolor=INK,
                             linewidth=1.0, zorder=1))
    for x in range(W + 1):
        ax.plot([m(x, 0)[0]] * 2, [MY, MY + H * S], color="#bbbbbb", linewidth=0.5, zorder=2)
    for y in range(H + 1):
        ax.plot([MX, MX + W * S], [m(0, y)[1]] * 2, color="#bbbbbb", linewidth=0.5, zorder=2)
    ax.add_patch(Rectangle((MX, MY), W * S, H * S, facecolor="none", edgecolor=INK, linewidth=1.3, zorder=5))
    riv = [m(*v) for v in _river(p)]
    ax.plot([q[0] for q in riv], [q[1] for q in riv], color="#3b7ea1", linewidth=2.0, zorder=3, gid="river")
    for k, r in enumerate(p["roads"]):
        pts = [m(*v) for v in r["path"]]
        ax.plot([q[0] for q in pts], [q[1] for q in pts], color=INK, linewidth=2.6, zorder=4, solid_capstyle="butt",
                gid=f"road:{k}")
        x, y = m(*spots[f"road:{k}"])
        ax.text(x, y, r["name"], ha="center", va="center", fontsize=8.5, zorder=6, gid=f"roadname:{k}")
    for s in p["schools"]:
        x, y = m(*s)
        ax.plot([x], [y], marker="^", color=INK, markersize=8, linestyle="none", zorder=6)
    for letter, (kind, i) in p["letters"].items():
        spot = spots[letter]
        x, y = m(*spot[:2])
        if len(spot) == 4:  # a leader from the school or the road to its letter
            fx, fy = m(*spot[2:])
            d = math.hypot(x - fx, y - fy)
            ux, uy = (x - fx) / d, (y - fy) / d
            start = 0.12 if kind == "point" else 0.0
            ax.plot([fx + ux * start, x - ux * 0.15], [fy + uy * start, y - uy * 0.15], color=INK, linewidth=1.0, zorder=7,
                    gid=f"leader:{letter}")
        ax.add_patch(Circle((x, y), 0.15, facecolor="white", edgecolor=INK, linewidth=1.1, zorder=7))
        ax.text(x, y, letter, ha="center", va="center", fontsize=9.5, fontweight="bold", zorder=8, gid=f"letter:{letter}")
    # grid numbers
    for x in range(0, W + 1, 2):
        ax.text(m(x, 0)[0], MY - 0.14, str(x), ha="center", va="center", fontsize=8)
    for y in range(0, H + 1):
        ax.text(MX - 0.14, m(0, y)[1], str(y), ha="center", va="center", fontsize=8)
    # scale bar and north arrow
    sx, sy = MX, MY - 0.55
    for k in range(3):
        ax.add_patch(Rectangle((sx + k * S, sy), S, 0.09, facecolor=INK if k % 2 == 0 else "white", edgecolor=INK,
                               linewidth=0.9))
        ax.text(sx + k * S, sy - 0.15, str(k), ha="center", va="center", fontsize=8.5)
    ax.text(sx + 3 * S, sy - 0.15, "3 km", ha="center", va="center", fontsize=8.5)
    nx, ny = MX + W * S + 0.35, MY + H * S - 0.6
    ax.annotate("", xy=(nx, ny + 0.45), xytext=(nx, ny - 0.1), arrowprops={"arrowstyle": "-|>", "color": INK, "lw": 1.5})
    ax.text(nx, ny + 0.62, "N", ha="center", va="center", fontsize=10.5, fontweight="bold")
    # the legend
    lx, ly = 0.3, 1.75
    ax.text(lx, ly, "Legend", ha="left", va="center", fontsize=10, fontweight="bold")
    items = [(k, LANDUSE[k]) for k in sorted({pg["use"] for pg in p["polygons"]})]
    for j, (name, colour) in enumerate(items):
        yy = ly - 0.35 - j * 0.3
        ax.add_patch(Rectangle((lx, yy - 0.1), 0.35, 0.2, facecolor=colour, edgecolor=INK, linewidth=0.8))
        ax.text(lx + 0.45, yy, name, ha="left", va="center", fontsize=9.5, gid=f"legend:{name}")
    lx2 = 2.3
    ax.plot([lx2], [ly - 0.35], marker="^", color=INK, markersize=8, linestyle="none")
    ax.text(lx2 + 0.2, ly - 0.35, "School", ha="left", va="center", fontsize=9.5)
    ax.plot([lx2 - 0.15, lx2 + 0.12], [ly - 0.65] * 2, color=INK, linewidth=2.6)
    ax.text(lx2 + 0.2, ly - 0.65, "Road", ha="left", va="center", fontsize=9.5)
    ax.plot([lx2 - 0.15, lx2 + 0.12], [ly - 0.95] * 2, color="#3b7ea1", linewidth=2.0)
    ax.text(lx2 + 0.2, ly - 0.95, "River", ha="left", va="center", fontsize=9.5)
    # the attribute table
    tx, ty = MX + 1.2, MY - 0.95
    ax.text(tx, ty, "Attribute table: land use layer", ha="left", va="center", fontsize=10, fontweight="bold")
    cols = [("FID", 0.6), ("Land use", 1.6), ("Area (ha)", 1.1)]
    rows = sorted(p["polygons"], key=lambda pg: pg["fid"])
    x = tx
    for head, w in cols:
        ax.add_patch(Rectangle((x, ty - 0.48), w, 0.3, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
        ax.text(x + w / 2, ty - 0.33, head, ha="center", va="center", fontsize=9.5, fontweight="bold")
        x += w
    for r, pg in enumerate(rows):
        x = tx
        yy = ty - 0.48 - (r + 1) * 0.28
        for (head, w), val in zip(cols, (pg["fid"], pg["use"], int(round(area(pg["poly"]) * 100)))):
            ax.add_patch(Rectangle((x, yy), w, 0.28, facecolor="white", edgecolor=INK, linewidth=0.9))
            ax.text(x + w / 2, yy + 0.14, str(val), ha="center", va="center", fontsize=9.5, gid=f"row:{pg['fid']}:{head}")
            x += w
    bottom = min(ty - 0.48 - len(rows) * 0.28, ly - 0.35 - len(items) * 0.3) - 0.2
    ax.set_xlim(0, 11.6)
    ax.set_ylim(bottom, top + 0.3)
    fig.set_size_inches(11.6, top + 0.3 - bottom)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ---------------------------------------------------------------------------------------------

SETTINGS = ["in an ICT lesson", "for homework", "at the GIS club", "for a class test", "on a revision card"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    ask = p["ask"]
    kind = p["letters"][ask["type"]][0]
    qs = [mcq(f"{who} studies this GIS map of {p['district']} District {rng.choice(SETTINGS)}. Which type of layer holds "
              f"the feature lettered {ask['type']}?", LAYERS[kind], [v for k, v in LAYERS.items() if k != kind], rng)]
    pg = p["polygons"][ask["count"]]
    n = sum(contains(pg["poly"], s) for s in p["schools"])
    qs.append(count(f"How many schools lie inside the {pg['use'].lower()} polygon on this map of {p['district']} District?",
                    n, "schools"))
    target = p["polygons"][p["letters"][ask["fid"]][1]]
    fids = [str(x["fid"]) for x in p["polygons"]]
    qs.append(mcq(f"Which row of the land use attribute table describes the polygon lettered {ask['fid']}? Give its FID.",
                  str(target["fid"]), [f for f in fids if f != str(target["fid"])], rng))
    road = p["roads"][ask["road"]]
    km = road_length(road["path"])
    qs.append(short(f"Using the grid and the scale bar, how long is {road['name']} on this map, in km?", km,
                    [str(km), f"{km} km", f"{km}km"]))
    return qs
