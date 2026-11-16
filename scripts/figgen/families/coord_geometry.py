"""Coordinate geometry on a square grid (UP, AL): points, straight lines, a circle and an ellipse, every point that
matters at a grid crossing so its coordinates are read exactly. Nothing's coordinates are printed: they are read.

UP (Rwanda Core Mathematics S4 "Points, straight lines and circles in 2D", Cambridge Additional Mathematics
"length of a line and midpoint"):
- points: A and B joined. The length AB (a whole number or the simplest surd), the midpoint, the gradient, the
  equation of AB as ax + by = c (four offered: the gradient's sign and the constant crossed), the gradient of a line
  perpendicular to AB.
- lines: segments AB and CD. Are they parallel, perpendicular or neither; a gradient; and when neither, the acute
  angle between them from tan θ = |(m₁ − m₂)/(1 + m₁m₂)| (printed), to the nearest degree.
- circle: a circle with centre C through P. Its equation (centre signs and r against r² crossed), the radius, c in
  x² + y² + 2gx + 2fy + c = 0, whether a marked point Q is inside, on or outside, and the gradient of the tangent at P.
UP "Conics" (Rwanda Advanced Mathematics S6):
- ellipse: an ellipse centred at a grid point with its axes along gridlines. Its equation (a² and b² against a and
  b, and the denominators swapped), the length of the major axis, the foci and the eccentricity from c² = a² − b²
  and e = c/a (printed).
AL (Cambridge AS Pure 1, "the equation of a line with a given gradient through a given point"):
- line: A, B and a third point C. The line through C parallel to AB, the perpendicular bisector of AB (each four
  offered: parallel or perpendicular gradient, through the right point or the wrong one), where AB meets the y-axis,
  and the length AB.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction
from math import gcd

from matplotlib.patches import Circle

from ..core import INK, NAMES, function_axes, mcq, new_figure, short
from ._exact_up import fr, fraction_forms, simplest_surd, surd_forms, surd_text

ID = "coord_geometry"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP", "AL")
CONCEPTS = ("mathematics.distance-two-points", "mathematics.line-midpoint-problems", "mathematics.angle-between-lines",
            "mathematics.circle-elements", "mathematics.conic-ellipse", "mathematics.conic-sections",
            "mathematics.linear-equation-gradient-intercept")
# A topic whose sections the book lists is reached only where its name or a section is about points, lines,
# circles or conics in the plane.
NEEDS = r"\blines?\b|\bpoints?\b|\bcircle\b|midpoint|gradient|ellipse|conic|coordinate"
UP_AVOID = r"lines, angles and shapes|scale drawings|symmetry|3d|planes|vector|circular measure|matri"

LO, HI = -7, 7
GRADS = [Fraction(n, d) for n, d in ((1, 1), (2, 1), (3, 1), (1, 2), (1, 3), (2, 3), (3, 2))]
GRADS = GRADS + [-g for g in GRADS]
ELLIPSES = [(5, 4), (5, 3), (4, 2), (4, 3), (3, 2), (5, 2), (4, 1), (3, 1), (6, 4), (6, 3)]


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["band"] == "AL":
        return ("mathematics.linear-equation-gradient-intercept",)
    return {"points": ("mathematics.distance-two-points", "mathematics.line-midpoint-problems"),
            "lines": ("mathematics.angle-between-lines", "mathematics.line-midpoint-problems"),
            "circle": ("mathematics.circle-elements", "mathematics.distance-two-points"),
            "ellipse": ("mathematics.conic-ellipse", "mathematics.conic-sections")}[p["kind"]]


def avoid_for(p: dict) -> str:
    if p["band"] == "AL":
        return r"^(?!.*equation of a line)|matri"
    if p["kind"] == "circle":
        return UP_AVOID + "|conic"
    return UP_AVOID


def _ok(*pts, edge=6) -> bool:
    """Every point inside the grid, off both axes (clear of the axis numbers), and no two the same."""
    return (all(-edge <= x <= edge and -edge <= y <= edge and x != 0 and y != 0 for x, y in pts)
            and len({tuple(q) for q in pts}) == len(pts))


def _offset(rng: random.Random, g: Fraction | None = None, big=True) -> list[int]:
    if g is None:
        dx, dy = rng.randint(1, 8), rng.randint(1, 8)
        return [dx * rng.choice([1, -1]), dy * rng.choice([1, -1])]
    k = rng.choice([1, 2, 3] if big else [1, 2])
    s = rng.choice([1, -1])
    return [s * k * g.denominator, s * k * g.numerator]


def sample(rng: random.Random) -> dict:
    band = rng.choice(["UP", "UP", "UP", "AL"])
    p = {"band": band, "name": rng.choice(NAMES)}
    if band == "AL":
        while True:
            a = [rng.randint(-6, 6), rng.randint(-6, 6)]
            dx, dy = rng.choice([2, 4, 6, 8]) * rng.choice([1, -1]), rng.choice([2, 4, 6, 8]) * rng.choice([1, -1])
            b = [a[0] + dx, a[1] + dy]
            c = [rng.randint(-6, 6), rng.randint(-6, 6)]
            if _ok(a, b, c) and (c[0] - a[0]) * dy != (c[1] - a[1]) * dx:  # C off the line AB
                p.update(kind="line", A=a, B=b, C=c, asks=sorted(rng.sample(["parallel", "bisector", "intercept", "length"], 3)))
                return p
    kind = rng.choice(["points", "lines", "circle", "ellipse"])
    p["kind"] = kind
    if kind == "points":
        while True:
            a = [rng.randint(-6, 6), rng.randint(-6, 6)]
            d = _offset(rng)
            b = [a[0] + d[0], a[1] + d[1]]
            if _ok(a, b):
                p.update(A=a, B=b, asks=sorted(rng.sample(["length", "midpoint", "gradient", "equation", "normal"], 3)))
                return p
    if kind == "lines":
        rel = rng.choice(["parallel", "perpendicular", "neither"])
        while True:
            m1 = rng.choice(GRADS)
            if rel == "parallel":
                m2 = m1
            elif rel == "perpendicular":
                m2 = -1 / m1
            else:
                m2 = rng.choice([g for g in GRADS if g != m1 and g != -1 / m1])
                t = abs((m1 - m2) / (1 + m1 * m2)) if 1 + m1 * m2 != 0 else None
                deg = math.degrees(math.atan(t)) if t is not None else 90
                if t is None or abs(deg - round(deg)) > 0.45 or abs(deg % 1 - 0.5) < 0.1:
                    continue
            if m2 not in GRADS:
                continue
            a = [rng.randint(-6, 6), rng.randint(-6, 6)]
            d1 = _offset(rng, m1)
            b = [a[0] + d1[0], a[1] + d1[1]]
            c = [rng.randint(-6, 6), rng.randint(-6, 6)]
            d2 = _offset(rng, m2)
            dd = [c[0] + d2[0], c[1] + d2[1]]
            same_line = (c[1] - a[1]) * m1.denominator == m1.numerator * (c[0] - a[0])
            if _ok(a, b, c, dd) and not (rel == "parallel" and same_line) and _apart(a, b, c, dd):
                p.update(rel=rel, A=a, B=b, C=c, D=dd, ask=rng.choice(["AB", "CD"]))
                return p
    if kind == "circle":
        while True:
            r = rng.choice([2, 3, 4, 5, 5, 5])
            ctr = [rng.randint(-2, 2), rng.randint(-2, 2)]
            offs = [(r, 0), (-r, 0), (0, r), (0, -r)] + ([(3, 4), (4, 3), (-3, 4), (-4, 3), (3, -4), (4, -3), (-3, -4), (-4, -3)] * 2 if r == 5 else [])
            o = rng.choice(offs)
            pt = [ctr[0] + o[0], ctr[1] + o[1]]
            where = rng.choice(["inside", "on", "outside"])
            cands = []
            for x in range(-6, 7):
                for y in range(-6, 7):
                    d2 = (x - ctr[0]) ** 2 + (y - ctr[1]) ** 2
                    if [x, y] in (pt, ctr) or x == 0 or y == 0:
                        continue
                    if (where == "on" and d2 == r * r) or (where == "inside" and r * r - 3 <= d2 < r * r) or \
                            (where == "outside" and r * r < d2 <= r * r + 4):
                        cands.append([x, y])
            if ctr != [0, 0] and abs(pt[0]) <= 7 and abs(pt[1]) <= 7 and cands and pt[0] != 0 and pt[1] != 0:
                q = rng.choice(cands)
                asks = ["equation", "radius", "expanded", "position"] + (["tangent"] if o[0] and o[1] else [])
                p.update(C=ctr, r=r, P=pt, Q=q, asks=sorted(rng.sample(asks, 3)))
                return p
    while True:
        a, b = rng.choice(ELLIPSES)
        h, k = rng.randint(-2, 2), rng.randint(-2, 2)
        across = rng.random() < 0.6  # the major axis along x
        ex, ey = (a, b) if across else (b, a)
        if abs(h) + ex <= 7 and abs(k) + ey <= 7:
            p.update(centre=[h, k], a=a, b=b, across=across, asks=sorted(rng.sample(["equation", "major", "foci", "eccentricity"], 3)))
            return p


def _apart(*pts) -> bool:
    """Lettered points at least two units apart, so their letters never meet."""
    return all(math.dist(u, v) >= 2 for i, u in enumerate(pts) for v in pts[i + 1:])


# --- drawing --------------------------------------------------------------------------------------------

def _seg_dist(pt, a, b) -> float:
    (px, py), (ax_, ay), (bx, by) = pt, a, b
    dx, dy = bx - ax_, by - ay
    L = dx * dx + dy * dy
    t = 0.0 if L == 0 else max(0.0, min(1.0, ((px - ax_) * dx + (py - ay) * dy) / L))
    return math.hypot(px - ax_ - t * dx, py - ay - t * dy)


class _Places:
    """Where each point's letter goes: of 16 spots round the point, the one farthest from every line, curve, axis,
    axis number, point and letter already placed (the axis numbers sit just below the x-axis and left of the y-axis)."""

    def __init__(self, segments, points):
        self.segments = [((LO - 0.5, 0), (HI + 0.5, 0)), ((0, LO - 0.5), (0, HI + 0.5))] + list(segments)
        self.points = [tuple(q) for q in points]
        self.points += [(k, -0.35) for k in range(LO, HI + 1)] + [(-0.45, k) for k in range(LO, HI + 1)]

    def spot(self, pt, away=(1, 1)):
        n = math.hypot(*away) or 1.0
        best, score = None, -1.0
        for r in (0.6, 0.8):
            for i in range(8):
                ang = math.pi * i / 4
                x, y = pt[0] + r * math.cos(ang), pt[1] + r * math.sin(ang)
                if not (LO - 0.2 <= x <= HI + 0.2 and LO - 0.2 <= y <= HI + 0.2):
                    continue
                d = min([_seg_dist((x, y), a, b) for a, b in self.segments] +
                        [math.dist((x, y), q) for q in self.points if q != tuple(pt)] + [9.0])
                d += 0.05 * (math.cos(ang) * away[0] + math.sin(ang) * away[1]) / n - 0.1 * (r > 0.6)
                if d > score:
                    best, score = (x, y), d
        self.points.append(best)
        return best


def _label(ax, places, pt, letter, away=(1, 1)) -> None:
    """A point and its letter, at the clearest spot round it."""
    ax.plot([pt[0]], [pt[1]], "o", color=INK, markersize=6, zorder=5)
    x, y = places.spot(pt, away)
    ax.text(x, y, letter, ha="center", va="center", fontsize=12, fontweight="bold", zorder=6, gid=f"letter:{letter}",
            bbox={"boxstyle": "round,pad=0.1", "facecolor": "white", "edgecolor": "none"})


def _curve(xs, ys) -> list:
    return list(zip(zip(xs, ys), zip(xs[1:], ys[1:])))


def draw(p: dict):
    fig, ax = new_figure(6.0, 6.0)
    function_axes(ax, LO, HI, LO, HI)
    kind = p["kind"]
    if kind in ("points", "line", "lines"):
        pairs = [("A", "B")] + ([("C", "D")] if kind == "lines" else [])
        segs = [(tuple(p[u]), tuple(p[v])) for u, v in pairs]
        marks = [p[k] for k in ("A", "B", "C", "D") if k in p]
        places = _Places(segs, marks)
        for (u, v), (a, b) in zip(pairs, segs):
            ax.plot([a[0], b[0]], [a[1], b[1]], color=INK, linewidth=1.8, gid=f"segment:{u}{v}")
        for u, v in pairs:
            _label(ax, places, p[u], u, (p[u][0] - p[v][0], p[u][1] - p[v][1]))
            _label(ax, places, p[v], v, (p[v][0] - p[u][0], p[v][1] - p[u][1]))
        if kind == "line":
            _label(ax, places, p["C"], "C")
    elif kind == "circle":
        (cx, cy), r = p["C"], p["r"]
        ts = [2 * math.pi * i / 120 for i in range(121)]
        ring = _curve([cx + r * math.cos(t) for t in ts], [cy + r * math.sin(t) for t in ts])
        places = _Places(ring + [((cx, cy), tuple(p["P"]))], [p["C"], p["P"], p["Q"]])
        ax.add_patch(Circle((cx, cy), r, fill=False, edgecolor=INK, linewidth=1.8, gid="circle"))
        ax.plot([cx, p["P"][0]], [cy, p["P"][1]], color=INK, linewidth=1.0, linestyle=(0, (4, 3)), gid="radius")
        _label(ax, places, p["C"], "C")
        _label(ax, places, p["P"], "P", (p["P"][0] - cx, p["P"][1] - cy))
        _label(ax, places, p["Q"], "Q", (p["Q"][0] - cx, p["Q"][1] - cy))
    else:
        (h, k), a, b = p["centre"], p["a"], p["b"]
        ex, ey = (a, b) if p["across"] else (b, a)
        ts = [2 * math.pi * i / 400 for i in range(401)]
        ax.plot([h + ex * math.cos(t) for t in ts], [k + ey * math.sin(t) for t in ts], color=INK, linewidth=1.8,
                gid="ellipse")
        ax.plot([h], [k], "o", color=INK, markersize=4)
    for t in ax.get_xticklabels() + ax.get_yticklabels():
        t.set_fontsize(8)
    ax.set_xlabel("x", fontsize=10, loc="right")
    ax.set_ylabel("y", fontsize=10, loc="top", rotation=0)
    return fig


# --- questions ------------------------------------------------------------------------------------------

def line_text(a: int, b: int, c: int) -> str:
    """ax + by = c with whole coefficients, no common factor, x's coefficient positive: "3x − 4y = −7"."""
    g = gcd(gcd(a, b), c) or 1
    a, b, c = a // g, b // g, c // g
    if a < 0 or (a == 0 and b < 0):
        a, b, c = -a, -b, -c
    parts = []
    if a:
        parts.append({1: "x", -1: "−x"}.get(a, f"{a}x"))
    if b:
        mag = "" if abs(b) == 1 else str(abs(b))
        parts.append(f"{'+' if b > 0 else '−'} {mag}y" if parts else f"{'' if b > 0 else '−'}{mag}y")
    return f"{' '.join(parts)} = {c}".replace("-", "−")


def _through(pt, slope: Fraction) -> tuple[int, int, int]:
    """The line through pt with this gradient, as (a, b, c) for ax + by = c."""
    a, b = slope.numerator, -slope.denominator
    return a, b, a * pt[0] + b * pt[1]


def _point(x, y) -> list[str]:
    fx, fy = Fraction(x), Fraction(y)
    out = []
    for sx in fraction_forms(fx):
        for sy in fraction_forms(fy):
            for f in (f"({sx}, {sy})", f"({sx},{sy})", f"{sx}, {sy}"):
                if f not in out:
                    out.append(f)
    return [out[0].replace("-", "−")] + out if "-" in out[0] else out


def _length(dx: int, dy: int) -> tuple[str, list[str]]:
    k, m = simplest_surd(dx * dx + dy * dy)
    forms = surd_forms(k, m)
    return forms[0], forms + [f"{f} units" for f in forms[:1]]


def _grad(a, b) -> Fraction:
    return Fraction(b[1] - a[1], b[0] - a[0])


def _points_qs(p: dict, rng: random.Random, lead: str) -> list:
    a, b = p["A"], p["B"]
    dx, dy = b[0] - a[0], b[1] - a[1]
    m = _grad(a, b)
    qs = []
    for ask in p["asks"]:
        if ask == "length":
            key, forms = _length(dx, dy)
            qs.append(short("Find the length of AB, as a whole number or a surd in its simplest form.", key, forms))
        elif ask == "midpoint":
            mx, my = Fraction(a[0] + b[0], 2), Fraction(a[1] + b[1], 2)
            forms = _point(mx, my)
            qs.append(short("Find the coordinates of the midpoint of AB.", forms[0], forms))
        elif ask == "gradient":
            qs.append(short("Find the gradient of the line AB.", fr(m), fraction_forms(m)))
        elif ask == "equation":
            la, lb, lc = _through(a, m)
            wrong_c = la * a[1] + lb * a[0]
            if wrong_c == lc:
                wrong_c = lc + la
            opts = [line_text(la, lb, lc), line_text(la, lb, wrong_c), line_text(la, -lb, lc), line_text(la, -lb, wrong_c)]
            qs.append(mcq("Which is the equation of the line through A and B?", opts[0], opts[1:], rng))
        else:
            n = -1 / m
            qs.append(short("Find the gradient of a line perpendicular to AB.", fr(n), fraction_forms(n)))
    qs[0].stem = f"{lead} {qs[0].stem}"
    return qs


def _lines_qs(p: dict, rng: random.Random, lead: str) -> list:
    a, b, c, d = p["A"], p["B"], p["C"], p["D"]
    m1, m2 = _grad(a, b), _grad(c, d)
    rel = {"parallel": "parallel", "perpendicular": "perpendicular", "neither": "neither parallel nor perpendicular"}[p["rel"]]
    opts = ["parallel", "perpendicular", "neither parallel nor perpendicular"]
    qs = [mcq(f"{lead} Are the lines AB and CD parallel, perpendicular or neither?", rel, [o for o in opts if o != rel], rng)]
    seg, m = (("AB", m1) if p["ask"] == "AB" else ("CD", m2))
    qs.append(short(f"Find the gradient of the line {seg}.", fr(m), fraction_forms(m)))
    if p["rel"] == "neither":
        t = abs((m1 - m2) / (1 + m1 * m2))
        deg = math.degrees(math.atan(t))
        key = str(round(deg))
        qs.append(short("Using tan θ = |(m₁ − m₂)/(1 + m₁m₂)|, find the acute angle between AB and CD, to the nearest "
                        "degree.", key, [f"{key}°", f"{key} degrees", f"{deg:.1f}", f"{deg:.1f}°"]))
    else:
        other = m2 if p["ask"] == "AB" else m1
        oseg = "CD" if p["ask"] == "AB" else "AB"
        qs.append(short(f"Find the gradient of the line {oseg}.", fr(other), fraction_forms(other)))
    return qs


def _circle_text(cx: int, cy: int, rhs: int) -> str:
    def part(v, letter):
        return f"{letter}²" if v == 0 else f"({letter} − {v})²" if v > 0 else f"({letter} + {-v})²"
    return f"{part(cx, 'x')} + {part(cy, 'y')} = {rhs}"


def _circle_qs(p: dict, rng: random.Random, lead: str) -> list:
    (cx, cy), r, (px, py), (qx, qy) = p["C"], p["r"], p["P"], p["Q"]
    qs = []
    for ask in p["asks"]:
        if ask == "equation":
            opts = [_circle_text(cx, cy, r * r), _circle_text(-cx, -cy, r * r), _circle_text(cx, cy, r),
                    _circle_text(-cx, -cy, r)]
            qs.append(mcq("The circle has centre C and passes through P. Which is its equation?", opts[0], opts[1:], rng))
        elif ask == "radius":
            qs.append(short("What is the radius of the circle with centre C through P?", str(r), [f"{r} units"]))
        elif ask == "expanded":
            c = cx * cx + cy * cy - r * r
            qs.append(short("The circle with centre C through P has equation x² + y² + 2gx + 2fy + c = 0. Find c.",
                            str(c).replace("-", "−"), fraction_forms(Fraction(c)) + [f"c = {c}"]))
        elif ask == "position":
            d2 = (qx - cx) ** 2 + (qy - cy) ** 2
            key = "inside the circle" if d2 < r * r else "on the circle" if d2 == r * r else "outside the circle"
            opts = ["inside the circle", "on the circle", "outside the circle"]
            qs.append(mcq("Work it out from the coordinates: is the point Q inside the circle, on it, or outside it?", key,
                          [o for o in opts if o != key], rng))
        else:
            g = Fraction(-(px - cx), py - cy)
            qs.append(short("Find the gradient of the tangent to the circle at P.", fr(g), fraction_forms(g)))
    qs[0].stem = f"{lead} {qs[0].stem}"
    return qs


def _ellipse_text(h: int, k: int, dx, dy) -> str:
    def part(v, letter):
        return f"{letter}²" if v == 0 else f"({letter} − {v})²" if v > 0 else f"({letter} + {-v})²"
    return f"{part(h, 'x')}/{dx} + {part(k, 'y')}/{dy} = 1"


def _ellipse_qs(p: dict, rng: random.Random, lead: str) -> list:
    (h, k), a, b = p["centre"], p["a"], p["b"]
    ex, ey = (a, b) if p["across"] else (b, a)
    c2 = a * a - b * b
    ck, cm = simplest_surd(c2)
    qs = []
    for ask in p["asks"]:
        if ask == "equation":
            opts = [_ellipse_text(h, k, ex * ex, ey * ey), _ellipse_text(h, k, ey * ey, ex * ex), _ellipse_text(h, k, ex, ey),
                    _ellipse_text(h, k, ey, ex)]
            qs.append(mcq("Which is the equation of the ellipse in the graph?", opts[0], opts[1:], rng))
        elif ask == "major":
            qs.append(short("What is the length of the major axis of the ellipse?", str(2 * a), [f"{2 * a} units"]))
        elif ask == "foci":
            if cm == 1:
                f1, f2 = ((h - ck, k), (h + ck, k)) if p["across"] else ((h, k - ck), (h, k + ck))
                key = f"({f1[0]}, {f1[1]}) and ({f2[0]}, {f2[1]})".replace("-", "−")
                plain = key.replace("−", "-")
                rev = f"({f2[0]}, {f2[1]}) and ({f1[0]}, {f1[1]})"
                qs.append(short("Using c² = a² − b², find the coordinates of the two foci of the ellipse.", key,
                                [plain, rev, rev.replace("-", "−"), plain.replace(", ", ","), rev.replace(", ", ",")]))
            else:
                key = surd_text(ck, cm)
                qs.append(short("Using c² = a² − b², find c, the distance from the centre of the ellipse to a focus, as a "
                                "surd.", key, surd_forms(ck, cm)))
        else:
            if cm == 1:
                e = Fraction(ck, a)
                qs.append(short("Using c² = a² − b² and e = c/a, find the eccentricity of the ellipse.", fr(e), fraction_forms(e)))
            else:
                g = gcd(ck, a)
                top = surd_text(ck // g, cm)
                key = f"{top}/{a // g}"
                vals = [key, key.replace("√", "sqrt"), f"{surd_text(ck // g, cm).replace('√', 'sqrt(')}{')'}/{a // g}",
                        f"{math.sqrt(c2) / a:.3f}", f"{math.sqrt(c2) / a:.2f}"]
                qs.append(short("Using c² = a² − b² and e = c/a, find the eccentricity of the ellipse, as a surd.", key, vals))
    qs[0].stem = f"{lead} {qs[0].stem}"
    return qs


def _line_qs(p: dict, rng: random.Random, lead: str) -> list:
    a, b, c = p["A"], p["B"], p["C"]
    m = _grad(a, b)
    n = -1 / m
    mid = [Fraction(a[0] + b[0], 2), Fraction(a[1] + b[1], 2)]
    qs = []
    for ask in p["asks"]:
        if ask == "parallel":
            opts = [line_text(*_through(c, m)), line_text(*_through(c, n)), line_text(*_through(a, m)),
                    line_text(*_through(a, n))]
            qs.append(mcq("Find the equation of the line through C that is parallel to AB.", opts[0], opts[1:], rng))
        elif ask == "bisector":
            ia = [int(v) for v in mid]
            # The slips: AB's own gradient (that line is AB itself), or the perpendicular drawn through A or B.
            opts = [line_text(*_through(ia, n)), line_text(*_through(ia, m)), line_text(*_through(a, n)),
                    line_text(*_through(b, n))]
            qs.append(mcq("Find the equation of the perpendicular bisector of AB.", opts[0], opts[1:], rng))
        elif ask == "intercept":
            y0 = a[1] - m * a[0]
            forms = _point(0, y0)
            qs.append(short("The line AB, extended, crosses the y-axis. Find the coordinates of that point.", forms[0],
                            forms + [f"y = {f}" for f in fraction_forms(y0)]))
        else:
            key, forms = _length(b[0] - a[0], b[1] - a[1])
            qs.append(short("Find the length of AB, as a whole number or a surd in its simplest form.", key, forms))
    qs[0].stem = f"{lead} {qs[0].stem}"
    return qs


def questions(p: dict, rng: random.Random) -> list:
    name = p["name"]
    kind = p["kind"]
    lead = rng.choice({
        "points": [f"{name} marks the points A and B on a grid.", f"{name} joins two grid points, A and B.",
                   f"{name} draws a straight line from A to B on a grid."],
        "lines": [f"{name} draws the line segments AB and CD on a grid.", f"{name} joins A to B and C to D on a grid."],
        "circle": [f"{name} draws a circle on a grid and marks the points C, P and Q.",
                   f"{name} marks a point Q near a circle drawn on a grid."],
        "ellipse": [f"{name} draws an ellipse whose axes lie along gridlines.",
                    f"{name} sketches an ellipse on a grid, its axes along gridlines."],
        "line": [f"{name} marks the points A, B and C on a grid.", f"{name} joins A and B on a grid and marks a third point C."],
    }[kind])
    if kind == "points":
        return _points_qs(p, rng, lead)
    if kind == "lines":
        return _lines_qs(p, rng, lead)
    if kind == "circle":
        return _circle_qs(p, rng, lead)
    if kind == "ellipse":
        return _ellipse_qs(p, rng, lead)
    return _line_qs(p, rng, lead)
