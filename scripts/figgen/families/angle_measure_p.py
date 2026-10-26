"""Measuring and working out angles (P, Stage 4 to 6), as Cambridge Primary 6 "Angles" (measuring and drawing angles,
angles in a triangle), Rwanda P5 "Constructing Angles and Describing Angles Formed by Intersecting Lines" and P6
"Regular Polygons and Bearings" teach them.

Kinds of figure, angles drawn to size:
- protractor (Stage 4–6): a protractor with both scales laid on an angle, one arm on its zero line. What size is the
  angle? (MCQ: the other scale, and ten degrees off.)
- triangle (Stage 5–6): a triangle with two angles marked; the third marked ?.
- lines (Stage 5–6): two straight lines crossing, one angle marked; the vertically opposite or the next angle marked x.
- parallel (Stage 5–6): two parallel lines (arrow marks) cut by a third line, one angle marked; x at a corresponding,
  alternate or co-interior place.
- bearing (Stage 6): a north line at A and the line AB, the angle printed from the north (or south) line. The bearing
  of B from A, as three figures.
- regular (Stage 6): a regular polygon with one inside angle marked ?. Its size (the sum of the angles printed).
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Polygon, Wedge

from ..core import FILL_2, INK, NAMES, mcq, new_figure, short

ID = "angle_measure_p"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.constructing-angles", "mathematics.lines-angles-real-objects", "mathematics.triangle-exterior-angle",
            "mathematics.lines-drawing-measuring", "mathematics.lines-intersecting", "mathematics.regular-polygons-bearings")
# A topic whose sections the book lists is reached only if its name or a section names angles, bearings or polygons.
NEEDS = r"angle|bearing|polygon"
AVOID = r"symmetr|fraction|time|clock|area|perimeter|volume|3d|nets|coordinate|grid|shapes in the plane|movement|length"

LEADS = {"protractor": ["{n} measures an angle with a protractor.", "{n} lays a protractor on an angle.",
                        "{n} uses a protractor to measure the angle.", "{n} checks an angle with a protractor."],
         "triangle": ["{n} draws a triangle and measures two of its angles.", "{n} cuts out a paper triangle.",
                      "{n} marks two angles of a triangle.", "{n} draws a triangle with two angles shown."],
         "lines": ["{n} draws two straight lines that cross.", "{n} looks at two crossing roads on a map.",
                   "{n} marks the angles where two straight lines cross.", "{n} draws two crossing lines."],
         "parallel": ["{n} draws two parallel lines and a line across them.", "{n} looks at a road crossing two railway lines.",
                      "{n} marks the angles where a line crosses two parallel lines.",
                      "{n} draws a line across two parallel lines."],
         "bearing": ["{n} walks from A to B.", "{n} looks at the path from A to B.", "{n} flies a drone from A to B.",
                     "{n} measures the direction from A to B."],
         "regular": ["{n} draws a regular polygon.", "{n} cuts out a regular polygon.", "{n} draws a shape with equal sides "
                     "and equal angles.", "{n} makes a regular polygon from sticks."]}


def stages(p: dict) -> tuple[int, int]:
    return {"protractor": (4, 6), "bearing": (6, 6), "regular": (6, 6)}.get(p["sub"], (5, 6))


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["sub"] in ("bearing", "regular"):
        return ("mathematics.regular-polygons-bearings", "mathematics.lines-angles-real-objects")
    if p["sub"] == "protractor":
        return ("mathematics.constructing-angles", "mathematics.lines-drawing-measuring", "mathematics.lines-angles-real-objects")
    if p["sub"] == "triangle":
        return ("mathematics.triangle-exterior-angle", "mathematics.constructing-angles")
    return ("mathematics.lines-intersecting", "mathematics.lines-angles-real-objects", "mathematics.constructing-angles")


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["protractor", "protractor", "triangle", "lines", "parallel", "bearing", "regular"])
    p = {"band": "P", "sub": sub, "name": rng.choice(NAMES)}
    if sub == "protractor":
        p.update(angle=rng.choice([a for a in range(20, 165, 5) if abs(a - 90) >= 15]), base=rng.choice(["right", "left"]))
    elif sub == "triangle":
        while True:
            a, b = rng.randrange(30, 100, 5), rng.randrange(30, 100, 5)
            if 25 <= 180 - a - b and a != b:
                break
        p.update(a=a, b=b)
    elif sub == "lines":
        p.update(a=rng.choice([a for a in range(30, 155, 5) if abs(a - 90) >= 15]), where=rng.choice(["opposite", "next"]),
                 tilt=rng.randrange(0, 40, 5))
    elif sub == "parallel":
        p.update(a=rng.choice([a for a in range(35, 150, 5) if abs(a - 90) >= 15]),
                 where=rng.choice(["corresponding", "alternate", "co-interior"]), flip=rng.choice([0, 1]))
    elif sub == "bearing":
        p.update(bearing=rng.choice([b for b in range(30, 335, 5) if 30 <= b % 90 <= 60]))
    else:
        p.update(n=rng.choice([5, 6, 8, 9, 10, 12]), turn=rng.choice([0, 10, 20]))
    return p


# --- drawing ------------------------------------------------------------------------------------------------

def _pt(r, deg):
    return r * math.cos(math.radians(deg)), r * math.sin(math.radians(deg))


def _draw_protractor(p: dict):
    fig, ax = new_figure(7.0, 4.2)
    R = 3.0
    ax.add_patch(Wedge((0, 0), R, 0, 180, facecolor="#fdf6e3", edgecolor=INK, linewidth=1.6, gid="behind-protractor"))
    ax.plot([-R, R], [0, 0], color=INK, linewidth=1.4, gid="behind-base")
    for d in range(0, 181, 5):
        big = d % 10 == 0
        x0, y0 = _pt(R, d)
        x1, y1 = _pt(R - (0.28 if big else 0.15), d)
        ax.plot([x0, x1], [y0, y1], color=INK, linewidth=1.0 if big else 0.6, gid="behind-tick")
        if d % 20 == 0:
            at = 6 if d == 0 else 174 if d == 180 else d  # 0 and 180 printed just above the base line
            ox, oy = _pt(R - 0.5, at)  # the outer scale counts up from the right
            ax.text(ox, oy, str(d), ha="center", va="center", fontsize=10, gid=f"outer:{d}")
            ix, iy = _pt(R - 1.0, at)  # the inner scale counts up from the left
            ax.text(ix, iy, str(180 - d), ha="center", va="center", fontsize=10, color="#555555", gid=f"inner:{180 - d}")
    # the angle's arms: one along the zero line of the scale it is read on, one at the angle
    a = p["angle"]
    start = 0 if p["base"] == "right" else 180
    end = a if p["base"] == "right" else 180 - a
    for deg, gid in ((start, "arm:0"), (end, "arm:1")):
        # the arm runs under the protractor: drawn up to the numbers and on from the ticks, so no number is hidden
        x0, y0 = _pt(R - 1.25, deg)
        x1, y1 = _pt(R - 0.3, deg)
        x2, y2 = _pt(R + 0.6, deg)
        ax.plot([0, x0], [0, y0], color="#c0392b", linewidth=2.4, gid=f"{gid}:in")
        ax.plot([x1, x2], [y1, y2], color="#c0392b", linewidth=2.4, gid=f"{gid}:out")
    ax.plot([0], [0], "o", color=INK, markersize=5)
    ax.set_xlim(-R - 0.8, R + 0.8)
    ax.set_ylim(-0.3, R + 0.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _angle_label(ax, vertex, d0, d1, text, r=0.55, gid="angle"):
    """An arc at a vertex between two directions (degrees, anticlockwise d0 -> d1) with its label beside it."""
    lo, hi = d0, d1
    mid = math.radians((lo + hi) / 2)
    dist = max(r * 1.45, (0.12 * len(text) + 0.12) / max(math.sin(math.radians((hi - lo) / 2)), 0.05))  # a narrow angle: further out
    arc = max(r * 0.75, dist - 0.45)  # and its arc with it, so the label sits by its arc
    ax.add_patch(Arc(vertex, 2 * arc, 2 * arc, theta1=lo, theta2=hi, color=INK, linewidth=1.2, gid=f"behind-arc:{gid}"))
    ax.text(vertex[0] + dist * math.cos(mid), vertex[1] + dist * math.sin(mid), text, ha="center", va="center",
            fontsize=12, gid=gid)


def _draw_triangle(p: dict):
    fig, ax = new_figure(6.0, 4.4)
    a, b = p["a"], p["b"]
    L = 5.0
    A, B = (0.0, 0.0), (L, 0.0)
    # C where the two base angles meet
    ta, tb = math.tan(math.radians(a)), math.tan(math.radians(b))
    cx = L * tb / (ta + tb)
    C = (cx, cx * ta)
    ax.add_patch(Polygon([A, B, C], closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=2.0, gid="behind-tri"))
    _angle_label(ax, A, 0, a, f"{a}°", gid="angle:A")
    _angle_label(ax, B, 180 - b, 180, f"{b}°", gid="angle:B")
    c0 = math.degrees(math.atan2(A[1] - C[1], A[0] - C[0])) % 360
    c1 = math.degrees(math.atan2(B[1] - C[1], B[0] - C[0])) % 360
    _angle_label(ax, C, min(c0, c1), max(c0, c1), "?", r=0.5, gid="angle:C")
    ax.set_xlim(-0.6, L + 0.6)
    ax.set_ylim(-0.5, max(C[1], 1.0) + 0.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_lines(p: dict):
    fig, ax = new_figure(5.6, 4.4)
    a, t = p["a"], p["tilt"]
    d1, d2 = t, t + a  # two directions out of the crossing point; the marked angle lies between them
    for d in (d1, d2):
        x, y = _pt(2.6, d)
        ax.plot([-x, x], [-y, y], color=INK, linewidth=2.0, gid=f"behind-line:{d}")
    _angle_label(ax, (0, 0), d1, d2, f"{a}°", gid="angle:a")
    if p["where"] == "opposite":
        _angle_label(ax, (0, 0), d1 + 180, d2 + 180, "x", gid="angle:x")
    else:
        _angle_label(ax, (0, 0), d2, d1 + 180, "x", gid="angle:x")
    ax.set_xlim(-2.8, 2.8)
    ax.set_ylim(-2.75, 2.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_parallel(p: dict):
    fig, ax = new_figure(6.4, 4.6)
    a = p["a"]
    h = 1.2
    dx = 2 * h / math.tan(math.radians(a))  # from the lower crossing Q to the upper P
    P, Q = (dx / 2, h), (-dx / 2, -h)
    for y in (h, -h):
        ax.plot([-3.2, 3.2], [y, y], color=INK, linewidth=2.0, gid=f"behind-par:{y}")
        ax.plot([2.2, 2.4, 2.2], [y + 0.12, y, y - 0.12], color=INK, linewidth=1.4, gid="behind-mark")
    ext = 0.9
    ux, uy = math.cos(math.radians(a)), math.sin(math.radians(a))
    ax.plot([Q[0] - ext * ux * 1.2, P[0] + ext * ux * 1.2], [Q[1] - ext * uy * 1.2, P[1] + ext * uy * 1.2], color=INK,
            linewidth=2.0, gid="behind-trans")
    # a at the upper crossing, between the line to the left and the transversal going down (inside the parallels)
    _angle_label(ax, P, 180, 180 + a, f"{a}°", gid="angle:a")
    w = p["where"]
    if w == "corresponding":  # the same place at the lower crossing
        _angle_label(ax, Q, 180, 180 + a, "x", gid="angle:x")
    elif w == "alternate":  # inside, on the other side of the transversal (a Z)
        _angle_label(ax, Q, 0, a, "x", gid="angle:x")
    else:  # co-interior: inside, on the same side (a C)
        _angle_label(ax, Q, a, 180, "x", gid="angle:x")
    ax.set_xlim(-3.3, 3.3)
    ax.set_ylim(-h - 1.3, h + 1.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def bearing_given(b: int) -> tuple[str, int]:
    """The printed angle: from north clockwise for a bearing under 90; from the south line for 90 to 270 (each side);
    from north anticlockwise above 270."""
    if b < 90:
        return "N", b
    if b < 180:
        return "S", 180 - b
    if b < 270:
        return "S", b - 180
    return "N", 360 - b


def _draw_bearing(p: dict):
    fig, ax = new_figure(5.6, 5.6)
    b = p["bearing"]
    A = (0.0, 0.0)
    d = 90 - b  # matplotlib direction of AB
    Bx, By = _pt(2.6, d)
    ax.annotate("", xy=(0, 2.0), xytext=(0, 0), arrowprops={"arrowstyle": "-|>", "color": INK, "lw": 1.6})
    ax.plot([0, 0], [0, 2.0], alpha=0, gid="behind-north")
    ax.text(0, 2.25, "N", ha="center", va="center", fontsize=14, fontweight="bold", gid="N")
    ax.plot([0, 0], [0, -2.0], color=INK, linewidth=1.0, linestyle=(0, (4, 3)), gid="behind-south")
    ax.plot([0, Bx], [0, By], color=INK, linewidth=2.0, gid="behind-AB")
    ax.plot([0, Bx], [0, By], "o", color=INK, markersize=6)
    ax.text(-0.3 if Bx > 0 else 0.3, -0.25, "A", ha="center", va="center", fontsize=13, fontweight="bold", gid="A")
    ax.text(Bx + 0.3 * math.cos(math.radians(d)), By + 0.3 * math.sin(math.radians(d)), "B", ha="center", va="center",
            fontsize=13, fontweight="bold", gid="B")
    ref, ang = bearing_given(b)
    if ref == "N":
        lo, hi = (90 - ang, 90) if b < 90 else (90, 90 + ang)
    else:
        lo, hi = (270, 270 + ang) if b < 180 else (270 - ang, 270)
    _angle_label(ax, A, lo, hi, f"{ang}°", r=0.6, gid="angle:b")
    ax.set_xlim(-3.2, 3.2)
    ax.set_ylim(-3.0, 2.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_regular(p: dict):
    fig, ax = new_figure(4.6, 4.6)
    n = p["n"]
    start = 90 + 180 / n + p["turn"]
    pts = [_pt(1.8, start + 360 * k / n) for k in range(n)]
    ax.add_patch(Polygon(pts, closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=2.0, gid="behind-poly"))
    v, prev, nxt = pts[0], pts[-1], pts[1]
    d0 = math.degrees(math.atan2(prev[1] - v[1], prev[0] - v[0])) % 360
    d1 = math.degrees(math.atan2(nxt[1] - v[1], nxt[0] - v[0])) % 360
    lo, hi = sorted((d0, d1))
    if hi - lo > 180:
        lo, hi = hi, lo + 360
    _angle_label(ax, v, lo, hi, "?", r=0.45, gid="angle:q")
    ax.text(0, -2.25, f"angles inside add up to {(n - 2) * 180}°", ha="center", va="center", fontsize=11, gid="sum")
    ax.set_xlim(-2.4, 2.4)
    ax.set_ylim(-2.55, 2.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"protractor": _draw_protractor, "triangle": _draw_triangle, "lines": _draw_lines, "parallel": _draw_parallel,
            "bearing": _draw_bearing, "regular": _draw_regular}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def _deg(v: int) -> list[str]:
    return [str(v), f"{v}°", f"{v} degrees", f"{v}degrees"]


def questions(p: dict, rng: random.Random) -> list:
    sub, name = p["sub"], p["name"]
    lead = rng.choice(LEADS[sub]).format(n=name)
    if sub == "protractor":
        a = p["angle"]
        opts = [f"{a}°", f"{180 - a}°", f"{a + 10}°", f"{170 - a}°"]
        return [mcq(f"{lead} What size is the angle between the two red arms?", opts[0], opts[1:], rng)]
    if sub == "triangle":
        v = 180 - p["a"] - p["b"]
        return [short(f"{lead} The angles of a triangle add up to 180°. What size is the angle marked ?", str(v), _deg(v))]
    if sub == "lines":
        v = p["a"] if p["where"] == "opposite" else 180 - p["a"]
        return [short(f"{lead} What size is the angle marked x?", str(v), _deg(v))]
    if sub == "parallel":
        v = 180 - p["a"] if p["where"] == "co-interior" else p["a"]
        return [short(f"{lead} What size is the angle marked x?", str(v), _deg(v))]
    if sub == "bearing":
        b = p["bearing"]
        key = f"{b:03d}°"
        return [short(f"{lead} Bearings are measured clockwise from north. What is the bearing of B from A?", key,
                      [key, f"{b:03d}", f"{b}°", str(b), f"{b:03d} degrees", f"{b} degrees"])]
    n = p["n"]
    v = (n - 2) * 180 // n
    return [short(f"{lead} What size is each angle inside it?", str(v), _deg(v))]
