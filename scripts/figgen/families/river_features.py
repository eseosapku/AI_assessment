"""River features (LS, UP), lettered and never named. Two sub-types:

- course: a sketch map of a river from its source in the upland to its mouth: a waterfall (drawn as a bar across the
  river), a gorge below it (a narrow valley between rock faces), meanders, an ox-bow lake (the old loop, cut off
  beside a straighter channel) and a delta of sand and distributaries where it enters the sea or a lake; A to E;
- meander: the plan of one meander bend with the line of a section X-Y across it, and the cross-section along X-Y
  beneath: a steep river cliff on the outer bank, the deepest, fastest-flowing water beside it, and a gentle
  slip-off slope of sand and gravel on the inner bank; P to R. The outer bank lies at X or at Y.

Which letter shows a feature (named, or by how it forms, from a fixed table a teacher would agree with); which letter
shows a feature formed by deposition (the delta, beside the waterfall and gorge only: a meander and an ox-bow lake form
by erosion and deposition both); on which bank of the meander erosion is greatest (two banks by two ends, so no option
can be picked from the others); where the river is depositing sand and gravel.
"""
from __future__ import annotations

import functools
import math
import random

from matplotlib.patches import Polygon

from ..core import INK, NAMES, Question, new_figure
from ._bio_parts import letter, letter_choice, offset, spline, tube

ID = "river_features"
KIND = "geo.section"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("river-landforms", "river-processes", "river-profile", "erosion-transport",
                                            "river-system"))
# A topic whose sections the book lists is reached only if its name or a section names rivers or their features.
NEEDS = r"\brivers?\b|meander|waterfall|ox-?bow|delta|river profile|hydrograph|drainage"
# Topics that share a river concept but teach dams, floods or water supply, not the land rivers shape.
AVOID = r"flood|multipurpose|project|dam\b|water supply|pollution|internal landform"

COURSE = ["waterfall", "gorge", "meander", "ox-bow lake", "delta"]
BEND = ["river cliff", "slip-off slope", "deepest water"]
FORM = {"waterfall": "where the river drops over a band of hard rock lying on softer rock",
        "gorge": "the narrow, steep-sided valley left as a waterfall wears back upstream",
        "ox-bow lake": "the lake left when the neck of a meander is cut through",
        "meander": "a bend whose outer bank is eroded while its inner bank gains sand"}
ARTICLE = {"waterfall": "a", "gorge": "a", "meander": "a", "ox-bow lake": "an", "delta": "a"}
BEND_ASK = {"river cliff": "the river cliff", "slip-off slope": "the slip-off slope",
            "deepest water": "the deepest and fastest-flowing water"}
WATER, LAND, UPLAND, SAND = "#9cc8ee", "#eef2df", "#e2d3b2", "#efdc9c"


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["course", "meander"])
    if kind == "course":
        letters = list("PQRST")  # from P on, so no letter matches the options' own letters A to D
        rng.shuffle(letters)
        return {"band": rng.choice(BANDS), "kind": kind, "mirror": rng.random() < 0.5,
                "water": rng.choice(["sea", "lake"]), "labels": dict(sorted(zip(letters, COURSE)))}
    letters = list("PQR")
    rng.shuffle(letters)
    return {"band": rng.choice(BANDS), "kind": kind, "outer": rng.choice(["X", "Y"]),
            "labels": dict(sorted(zip(letters, BEND)))}


# --- the course of a river (plan) ----------------------------------------------------------------------

P0, P1 = (3.25, 5.0), (7.3, 1.85)  # the meandering stretch, from the foot of the gorge to the mouth
# How far each half-wave's channel swings (radians) as it meanders.
OMEGAS, WAVES, STEPS = (1.15, 1.45, 1.5, 1.45, 1.1), 2.5, 500
COAST = [(5.95, 0.0), (6.6, 0.95), (7.3, 1.85), (8.2, 2.95), (8.9, 4.0), (10.0, 5.3)]


def _seg_dist(pt, a, b) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0.0, min(1.0, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy or 1.0)))
    return math.hypot(pt[0] - a[0] - t * dx, pt[1] - a[1] - t * dy)


def _clear(pt, line) -> float:
    return min(_seg_dist(pt, a, b) for a, b in zip(line, line[1:]))


def _meanders():
    """A sine-generated channel (its direction swings as a sine of the distance along it, as real meanders do), fitted
    from P0 to P1; an ox-bow lake beside it, a horseshoe whose open side faces the channel across a strip of land
    (the old loop the river cut off at its neck), set where it clears the channel, the coast and the upland; and the
    meander loop that is lettered. Returns the channel, the ox-bow lake, and that loop."""
    pts, x, y = [(0.0, 0.0)], 0.0, 0.0
    for k in range(STEPS):
        t = (k + 0.5) / STEPS
        a = OMEGAS[min(4, int(t * 5))] * math.sin(2 * math.pi * WAVES * t)
        x, y = x + math.cos(a) / STEPS, y + math.sin(a) / STEPS
        pts.append((x, y))
    z0, z1 = complex(*pts[0]), complex(*pts[-1])
    m = complex(P1[0] - P0[0], P1[1] - P0[1]) / (z1 - z0)
    path = [(P0[0] + ((complex(*q) - z0) * m).real, P0[1] + ((complex(*q) - z0) * m).imag) for q in pts]
    i_of = lambda t: int(round(t * STEPS))  # noqa: E731
    loop = path[i_of(0.2):i_of(0.4) + 1]
    # the ox-bow lake: the horseshoe whose two ends come closest to the channel (cut off from it by a strip of
    # land), its middle well clear of the channel, the coast and the map's edge
    best = None
    for t in [0.46 + 0.02 * k for k in range(24)]:
        i = i_of(t)
        (ax0, ay0), (bx0, by0) = path[i - 3], path[i + 3]
        ln = math.hypot(bx0 - ax0, by0 - ay0)
        for side in (1, -1):
            nx, ny = -(by0 - ay0) / ln * side, (bx0 - ax0) / ln * side
            R, gap, open_ = 0.4, 0.27, math.radians(40)
            cx, cy = path[i][0] + nx * (gap + R * 0.78), path[i][1] + ny * (gap + R * 0.78)
            back = math.atan2(-ny, -nx)
            arc = [(cx + R * math.cos(back + open_ + (2 * math.pi - 2 * open_) * k / 40),
                    cy + R * math.sin(back + open_ + (2 * math.pi - 2 * open_) * k / 40)) for k in range(41)]
            if min(min(x, y, 10 - x, 7.4 - y) for x, y in arc) < 0.3 or min(_clear(q, COAST) for q in arc) < 0.35:
                continue
            if min(_clear(q, path) for q in arc[6:-6]) < 0.35:
                continue
            ends = max(_clear(arc[0], path), _clear(arc[-1], path))
            if best is None or ends < best[0]:
                best = (ends, arc)
    return path, best[1], loop


@functools.lru_cache(maxsize=1)
def _course_geometry():
    """The river's course, the same for every figure (computed once): the upper course, the gorge, the meanders, the
    ox-bow lake and the lettered loop."""
    upper = spline([(0.8, 6.95), (1.25, 6.6), (1.75, 6.32), (2.3, 5.95)], closed=False, per=10)
    gorge = [(2.3, 5.95), (2.78, 5.47), (3.25, 5.0)]
    middle, oxbow, loop = _meanders()
    return upper, gorge, middle, oxbow, loop


def _apex(pts):
    """The point of a loop furthest from the straight line joining its ends, and the unit direction out to it."""
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    ln = math.hypot(x1 - x0, y1 - y0)
    nx, ny = -(y1 - y0) / ln, (x1 - x0) / ln
    far = max(pts, key=lambda q: abs((q[0] - x0) * nx + (q[1] - y0) * ny))
    side = 1 if (far[0] - x0) * nx + (far[1] - y0) * ny > 0 else -1
    return far, (nx * side, ny * side)


def _width(i: int, n: int) -> float:
    return 0.1 + 0.08 * i / n


def _draw_course(ax, p: dict) -> None:
    flip = (lambda pts: [(10 - x, y) for x, y in pts]) if p["mirror"] else (lambda pts: [tuple(q) for q in pts])
    fx = (lambda x: 10 - x) if p["mirror"] else (lambda x: x)
    upper, gorge, middle, oxbow, loop = _course_geometry()
    # land, upland and the water the river flows into
    ax.add_patch(Polygon(flip([(0, 0), (10, 0), (10, 7.4), (0, 7.4)]), closed=True, facecolor=LAND, edgecolor="none",
                         zorder=0.1))
    rim = spline([(0, 4.35), (1.4, 4.6), (2.6, 4.45), (3.6, 4.9), (4.0, 6.0), (3.6, 7.4), (0, 7.4)], per=8)
    rim = [(min(10.0, max(0.0, x)), min(7.4, max(0.0, y))) for x, y in rim]  # the curve's overshoot kept on the map
    ax.add_patch(Polygon(flip(rim), closed=True, facecolor=UPLAND, edgecolor="none", zorder=0.2, gid="upland"))
    coast = COAST
    ax.add_patch(Polygon(flip(coast + [(10, 0)]), closed=True, facecolor=WATER, edgecolor="none", zorder=0.3, gid="water"))
    ax.plot(*zip(*flip(coast)), color=INK, linewidth=1.0, zorder=0.4, gid="coast")
    ax.text(fx(1.0), 4.85, "Upland", ha="center", va="center", fontsize=10, style="italic", zorder=1)
    ax.text(fx(8.9), 0.8, p["water"].capitalize(), ha="center", va="center", fontsize=11, style="italic", zorder=1)
    # the delta: a lobe of sand pushed out into the water, cut by distributaries
    mouth = (7.3, 1.85)
    fan = spline([(6.75, 1.0), (7.5, 0.75), (8.35, 1.15), (8.65, 1.9), (8.35, 2.65), (7.75, 2.8)], closed=False, per=8)
    ax.add_patch(Polygon(flip([(6.75, 1.0)] + fan + [(7.75, 2.8)]), closed=True, facecolor=SAND, edgecolor=INK,
                         linewidth=0.8, zorder=0.6, gid="part:delta"))
    for end in ((7.45, 0.85), (8.25, 1.25), (8.6, 2.05), (8.15, 2.7)):
        ctrl = ((mouth[0] + end[0]) / 2 + 0.08, (mouth[1] + end[1]) / 2 - 0.05)
        pts = [((1 - t) ** 2 * mouth[0] + 2 * (1 - t) * t * ctrl[0] + t * t * end[0],
                (1 - t) ** 2 * mouth[1] + 2 * (1 - t) * t * ctrl[1] + t * t * end[1]) for t in (k / 12 for k in range(13))]
        ax.plot(*zip(*flip(pts)), color="#2a6bb8", linewidth=1.2, zorder=0.7, gid="distributary")
    # the river: upper course, gorge, meanders, as one channel widening downstream
    path = upper + gorge[1:] + middle[1:]
    n = len(path)
    left = [offset(path, _width(i, n) / 2)[i] for i in range(n)]
    right = [offset(path, -_width(i, n) / 2)[i] for i in range(n)]
    ax.add_patch(Polygon(flip(left + right[::-1]), closed=True, facecolor=WATER, edgecolor="#2a6bb8", linewidth=1.0,
                         zorder=2, gid="river"))
    # the gorge: steep rock faces close on both sides, hatched like a cliff on a sketch map
    gpath = [(2.32, 5.93), (2.78, 5.47), (3.2, 5.05)]
    band = tube(gpath, 0.62)
    ax.add_patch(Polygon(flip(band), closed=True, facecolor="#bfa985", edgecolor="none", zorder=1.5, gid="part:gorge"))
    for side in (0.31, -0.31):
        edge = offset(gpath, side)
        inner = offset(gpath, side * 0.35)
        for k in range(7):
            t = k / 6
            a = (edge[0][0] + (edge[-1][0] - edge[0][0]) * t, edge[0][1] + (edge[-1][1] - edge[0][1]) * t)
            b = (inner[0][0] + (inner[-1][0] - inner[0][0]) * t, inner[0][1] + (inner[-1][1] - inner[0][1]) * t)
            ax.plot(*zip(*flip([a, b])), color="#5a4630", linewidth=1.0, zorder=1.6)
    # the waterfall: a bar across the river at the head of the gorge
    wx, wy = 2.3, 5.95
    ux, uy = 0.707, -0.707
    bar = [(wx - uy * 0.2 - ux * 0.05, wy + ux * 0.2 - uy * 0.05), (wx - uy * 0.2 + ux * 0.05, wy + ux * 0.2 + uy * 0.05),
           (wx + uy * 0.2 + ux * 0.05, wy - ux * 0.2 + uy * 0.05), (wx + uy * 0.2 - ux * 0.05, wy - ux * 0.2 - uy * 0.05)]
    ax.add_patch(Polygon(flip(bar), closed=True, facecolor="#ffffff", edgecolor=INK, linewidth=1.2, zorder=3,
                         gid="part:waterfall"))
    # the ox-bow lake, cut off beside the channel, and one meander loop picked out for its letter
    ax.add_patch(Polygon(flip(tube(oxbow, 0.17)), closed=True, facecolor=WATER, edgecolor="#2a6bb8", linewidth=1.0,
                         zorder=2, gid="part:ox-bow lake"))
    i0 = path.index(min(path, key=lambda q: math.dist(q, loop[len(loop) // 2])))
    ax.add_patch(Polygon(flip(tube(loop, _width(i0, n))), closed=True, facecolor=WATER, edgecolor="none", zorder=2.1,
                         gid="part:meander"))
    # flow arrows: one in the upper course, one on the meanders
    for a, b in ((upper[8], upper[13]), (middle[60], middle[75])):
        (ax0, ay0), (bx0, by0) = flip([a, b])
        ax.annotate("", xy=(bx0, by0), xytext=(ax0, ay0), zorder=4, gid="flow",
                    arrowprops=dict(arrowstyle="-|>,head_length=0.45,head_width=0.22", color=INK, lw=1.0,
                                    shrinkA=0, shrinkB=0))
    # letters, each in clear space, its leader ending on its feature
    apex, n1 = _apex(loop)
    old, n2 = _apex(oxbow)
    oxbow_at = _clear_spot(old, n2, middle)
    slots = {"waterfall": ((3.3, 6.75), (2.3, 5.95)),
             "gorge": ((1.75, 5.3), (2.62, 5.38)),
             "meander": ((apex[0] + n1[0] * 0.9, apex[1] + n1[1] * 0.9), apex),
             "ox-bow lake": (oxbow_at, old),
             "delta": ((8.95, 2.9), (8.2, 2.25))}
    for L, name in p["labels"].items():
        at, end = slots[name]
        letter(ax, L, flip([at])[0], flip([end])[0], gap=0.28, size=14)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 7.4)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(f"Sketch map of a river from its source to the {p['water']}", fontsize=11)
    _key(ax, flip)


def _clear_spot(end, out, channel):
    """Where a letter goes for a feature at `end`: 0.9 out from it, turning from the outward direction until the spot
    is on the map and clear of the channel and the coast (on the map's lower edge the outward way fell off it)."""
    for turn in (0, 40, -40, 80, -80, 120, -120, 160, -160):
        a = math.radians(turn)
        dx, dy = out[0] * math.cos(a) - out[1] * math.sin(a), out[0] * math.sin(a) + out[1] * math.cos(a)
        at = (end[0] + 0.9 * dx, end[1] + 0.9 * dy)
        if 0.45 <= at[0] <= 9.55 and 0.45 <= at[1] <= 6.95 and _clear(at, channel) > 0.45 and _clear(at, COAST) > 0.4:
            return at
    raise ValueError("no clear spot for a letter")


def _key(ax, flip) -> None:
    """A key to the map's symbols, in the open land of the lower corner: the waterfall's bar, the hatched rock faces
    of a steep valley, and sand and mud (P3z review: the bar and the hatching were unexplained)."""
    x0, y0, x1, y1 = 0.3, 0.3, 3.6, 2.2
    ax.add_patch(Polygon(flip([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]), closed=True, facecolor="white", edgecolor=INK,
                         linewidth=0.9, zorder=3, gid="key-box"))
    left = min(flip([(x0, 0), (x1, 0)]))[0]
    ax.text(left + 0.2, y1 - 0.12, "Key", ha="left", va="top", fontsize=10, fontweight="bold", zorder=3.2, gid="key-head")
    rows = [1.45, 0.98, 0.52]
    sx = left + 0.25
    # the waterfall: a bar across a stretch of river
    y = rows[0]
    ax.add_patch(Polygon([(sx, y - 0.06), (sx + 0.7, y - 0.06), (sx + 0.7, y + 0.06), (sx, y + 0.06)], closed=True,
                         facecolor=WATER, edgecolor="#2a6bb8", linewidth=0.8, zorder=3.1))
    ax.add_patch(Polygon([(sx + 0.3, y - 0.17), (sx + 0.4, y - 0.17), (sx + 0.4, y + 0.17), (sx + 0.3, y + 0.17)],
                         closed=True, facecolor="white", edgecolor=INK, linewidth=1.0, zorder=3.15))
    ax.text(sx + 0.95, y, "waterfall", ha="left", va="center", fontsize=9.5, zorder=3.2, gid="key")
    # steep rock faces: the hatched band
    y = rows[1]
    ax.add_patch(Polygon([(sx, y - 0.13), (sx + 0.7, y - 0.13), (sx + 0.7, y + 0.13), (sx, y + 0.13)], closed=True,
                         facecolor="#bfa985", edgecolor="none", zorder=3.1))
    for k in range(5):
        xx = sx + 0.07 + k * 0.14
        ax.plot([xx, xx], [y + 0.13, y + 0.02], color="#5a4630", linewidth=1.0, zorder=3.15)
    ax.text(sx + 0.95, y, "steep rock faces", ha="left", va="center", fontsize=9.5, zorder=3.2, gid="key")
    # sand and mud
    y = rows[2]
    ax.add_patch(Polygon([(sx, y - 0.12), (sx + 0.7, y - 0.12), (sx + 0.7, y + 0.12), (sx, y + 0.12)], closed=True,
                         facecolor=SAND, edgecolor="#8a7440", linewidth=0.8, zorder=3.1))
    ax.text(sx + 0.95, y, "sand and mud", ha="left", va="center", fontsize=9.5, zorder=3.2, gid="key")


# --- a meander bend: plan and cross-section ------------------------------------------------------------

# The cross-section with the outer bank on the left: the ground's surface from X to Y.
SECTION = [(0.8, 2.7), (2.9, 2.7), (3.15, 0.9), (3.45, 0.55), (4.3, 0.75), (5.5, 1.45), (6.6, 2.1), (7.4, 2.25), (8.8, 2.25)]
LEVEL = 1.85


def _surface_y(x: float) -> float:
    x = min(SECTION[-1][0], max(SECTION[0][0], x))
    for (x0, y0), (x1, y1) in zip(SECTION, SECTION[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    raise ValueError(x)


def _crossing_x(x0: float, x1: float, level: float) -> float:
    lo, hi = x0, x1
    f = lambda x: _surface_y(x) - level  # noqa: E731
    for _ in range(60):
        mid = (lo + hi) / 2
        if (f(lo) > 0) == (f(mid) > 0):
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _draw_meander(ax, p: dict) -> None:
    flipx = p["outer"] == "Y"  # the cross-section runs X to Y left to right: the cliff is at the outer end
    fx = (lambda x: 9.6 - x) if flipx else (lambda x: x)
    flip = lambda pts: [(fx(x), y) for x, y in pts]  # noqa: E731
    # the cross-section, beneath
    ground = SECTION + [(8.8, 0.0), (0.8, 0.0)]
    ax.add_patch(Polygon(flip(ground), closed=True, facecolor="#c8a77c", edgecolor=INK, linewidth=1.2, zorder=1,
                         gid="ground"))
    left_bank = _crossing_x(2.9, 3.15, LEVEL)
    right_bank = _crossing_x(5.5, 6.6, LEVEL)
    xs = [left_bank] + [x for x, _ in SECTION if left_bank < x < right_bank] + [right_bank]
    deep_end = 4.15
    deep = [(x, _surface_y(x)) for x in xs if x <= deep_end] + [(deep_end, _surface_y(deep_end))]
    shallow = [(deep_end, _surface_y(deep_end))] + [(x, _surface_y(x)) for x in xs if x > deep_end]
    ax.add_patch(Polygon(flip(deep + shallow[1:] + [(right_bank, LEVEL), (left_bank, LEVEL)]), closed=True,
                         facecolor=WATER, edgecolor="none", zorder=2, gid="water"))
    # the deep water by the outer bank, drawn over the rest in the same colour with no edge, so no seam shows
    ax.add_patch(Polygon(flip(deep + [(deep_end, LEVEL), (left_bank, LEVEL)]), closed=True, facecolor=WATER,
                         edgecolor="none", antialiased=False, zorder=2.05, gid="part:deepest water"))
    ax.plot(*zip(*flip([(left_bank, LEVEL), (right_bank, LEVEL)])), color="#2a6bb8", linewidth=1.2, zorder=2.5,
            gid="water-surface")
    # the slip-off slope: a layer of sand and gravel on the gentle inner bank
    top = [(x, _surface_y(x)) for x in [4.0 + 0.1 * k for k in range(30)]]
    under = [(x, y - 0.22) for x, y in top]
    ax.add_patch(Polygon(flip(top + under[::-1]), closed=True, facecolor=SAND, edgecolor="#8a7440", linewidth=0.6,
                         zorder=1.5, gid="part:slip-off slope"))
    rng = random.Random(7)
    dots = [(x, _surface_y(x) - rng.uniform(0.05, 0.17)) for x in [4.05 + 0.055 * k for k in range(52)]]
    ax.scatter(*zip(*flip(dots)), s=3, color="#6b5a30", zorder=1.6, linewidths=0)
    # the river cliff: the steep outer bank, its face hatched
    ax.add_patch(Polygon(flip([(2.45, 2.7), (2.9, 2.7), (3.15, 0.9), (2.7, 0.9)]), closed=True, facecolor="#b79466",
                         edgecolor="none", zorder=1.2, gid="part:river cliff"))
    ax.plot(*zip(*flip(SECTION)), color=INK, linewidth=1.4, zorder=3, gid="surface")
    for end, name in ((0.8, "X"), (8.8, "Y")):  # X at the left, Y at the right, whichever bank is the outer one
        ax.text(end, _surface_y(fx(end)) + 0.3, name, ha="center", va="bottom", fontsize=12, fontweight="bold",
                zorder=4, gid="section-end")
    slots = {"river cliff": ((1.75, 3.65), (2.82, 2.25)), "deepest water": ((4.35, 3.45), (3.6, 1.05)),
             "slip-off slope": ((7.0, 3.35), (6.3, 1.82))}
    for L, name in p["labels"].items():
        at, end = slots[name]
        letter(ax, L, (fx(at[0]), at[1]), (fx(end[0]), end[1]), gap=0.26, size=14)
    ax.text(4.8, -0.35, "Cross-section along X–Y", ha="center", va="top", fontsize=10.5)
    # the plan of the bend, above
    cx, cy0, rx, ry = 4.8, 5.05, 2.7, 2.15
    centre = [(cx + rx * math.cos(math.radians(a)), cy0 + ry * math.sin(math.radians(a))) for a in range(185, -6, -5)]
    outer_edge = offset(centre, 0.3)
    inner_edge = offset(centre, -0.3)
    bar = [(cx + (rx - 0.3) * math.cos(math.radians(a)), cy0 + (ry - 0.3) * math.sin(math.radians(a)))
           for a in range(140, 39, -5)]
    bar_in = [(cx + (rx - 1.0) * math.cos(math.radians(a)), cy0 + (ry - 0.85) * math.sin(math.radians(a)))
              for a in range(40, 141, 5)]
    ax.add_patch(Polygon(bar + bar_in, closed=True, facecolor=SAND, edgecolor="none", zorder=1.4, gid="point-bar"))
    ax.add_patch(Polygon(outer_edge + inner_edge[::-1], closed=True, facecolor=WATER, edgecolor="none", zorder=1.5,
                         gid="channel"))
    for edge in (outer_edge, inner_edge):
        ax.plot(*zip(*edge), color="#2a6bb8", linewidth=1.2, zorder=1.6, gid="bank")
    for k0, k1 in ((5, 8), (30, 33)):
        ax.annotate("", xy=centre[k1], xytext=centre[k0], zorder=4, gid="flow",
                    arrowprops=dict(arrowstyle="-|>,head_length=0.45,head_width=0.22", color=INK, lw=1.0,
                                    shrinkA=0, shrinkB=0))
    top_y, bottom_y = cy0 + ry + 0.75, cy0 + ry - 0.95
    ax.plot([cx, cx], [bottom_y, top_y], color=INK, linewidth=1.1, linestyle=(0, (4, 3)), zorder=3, gid="section-line")
    outer_name = p["outer"]
    inner_name = "Y" if outer_name == "X" else "X"
    ax.text(cx, top_y + 0.1, outer_name, ha="center", va="bottom", fontsize=12, fontweight="bold", zorder=4,
            gid="plan-end")
    ax.text(cx, bottom_y - 0.1, inner_name, ha="center", va="top", fontsize=12, fontweight="bold", zorder=4,
            gid="plan-end")
    ax.text(0.9, 7.85, "Plan of a meander", ha="left", va="center", fontsize=10.5)
    ax.set_xlim(0.2, 9.4)
    ax.set_ylim(-0.75, 8.2)
    ax.set_aspect("equal")
    ax.axis("off")


def draw(p: dict):
    if p["kind"] == "course":
        fig, ax = new_figure(7.4, 5.9)
        _draw_course(ax, p)
    else:
        fig, ax = new_figure(6.4, 6.6)
        _draw_meander(ax, p)
    return fig


# --- questions --------------------------------------------------------------------------------------

COURSE_INTROS = ["{name} drew this sketch map of a river's course {setting}.",
                 "{name} copied this map of a river from source to mouth {setting}.",
                 "{name} labelled the features of a river on this sketch map {setting}.",
                 "{name} is revising river features from this sketch map {setting}."]
BEND_INTROS = ["{name} drew a meander and a cross-section along the line X–Y {setting}.",
               "{name} sketched the plan of a meander and its cross-section {setting}.",
               "{name} measured a meander bend and drew this plan and cross-section {setting}.",
               "{name} copied this diagram of a meander bend {setting}."]
SETTINGS = ["for a geography lesson", "for homework", "for a revision poster", "after a field trip to the Nyabarongo",
            "at the geography club in Huye", "after a lesson on the rivers of Africa", "while revising in Musanze",
            "for a class display in Kigali"]


def _course_questions(p, rng, intro):
    labels = p["labels"]
    at = {v: k for k, v in labels.items()}
    first, second = rng.sample(["waterfall", "gorge", "meander", "ox-bow lake"], 2)
    others = lambda key: [k for k in sorted(labels) if k != key]  # noqa: E731
    near = {"waterfall": ["gorge"], "gorge": ["waterfall"], "meander": ["ox-bow lake"], "ox-bow lake": ["meander"]}
    qs = [letter_choice(f"{intro} Which letter shows {ARTICLE[first]} {first}?", at[first],
                        [at[x] for x in near[first]] + rng.sample(others(at[first]), 4))]
    qs.append(letter_choice(f"Which letter shows {FORM[second]}?", at[second],
                            [at[x] for x in near[second]] + rng.sample(others(at[second]), 4)))
    # the delta, asked by where it forms (P3z review: "formed by deposition" let a meander or an ox-bow lake be argued)
    qs.append(letter_choice(f"Which letter shows the feature built where the river drops its sediment as it enters the "
                            f"{p['water']}?", at["delta"], [at[x] for x in ("waterfall", "gorge", "meander")]))
    return qs


def _bend_questions(p, rng, intro):
    labels = p["labels"]
    at = {v: k for k, v in labels.items()}
    ask = rng.choice(["river cliff", "deepest water"])
    qs = [letter_choice(f"{intro} Which letter shows {BEND_ASK[ask]}?", at[ask], sorted(labels))]
    outer = p["outer"]
    inner = "Y" if outer == "X" else "X"
    options = [f"The outer bank, at {outer}", f"The inner bank, at {inner}", f"The outer bank, at {inner}",
               f"The inner bank, at {outer}"]
    rng.shuffle(options)
    qs.append(Question("mcq", "On which bank of the meander is erosion greatest?",
                       str(options.index(f"The outer bank, at {outer}")), options))
    qs.append(letter_choice("Which letter shows where the river is depositing sand and gravel?", at["slip-off slope"],
                            sorted(labels)))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    intros = COURSE_INTROS if p["kind"] == "course" else BEND_INTROS
    intro = rng.choice(intros).format(name=rng.choice(NAMES), setting=rng.choice(SETTINGS))
    return (_course_questions if p["kind"] == "course" else _bend_questions)(p, rng, intro)
