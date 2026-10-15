"""Boxes joined by lettered arrows, for the cycle diagrams (the carbon and nitrogen cycles): the geometry a family
checks before it keeps a layout (no arrow runs through a box it does not join, no two arrows cross), where each
letter goes, and the drawing.

A box is a rectangle (x0, y0, x1, y1) in data units; an arrow is a polyline from the edge of the box it leaves to
the edge of the box it enters.
"""
from __future__ import annotations

import math

from matplotlib.patches import FancyBboxPatch

from ..core import INK


def rect(cx: float, cy: float, w: float, h: float) -> tuple:
    return (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)


def centre(r) -> tuple:
    return ((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)


def edge_toward(r, toward) -> tuple:
    """Where the line from a box's centre toward a point leaves the box."""
    cx, cy = centre(r)
    dx, dy = toward[0] - cx, toward[1] - cy
    hw, hh = (r[2] - r[0]) / 2, (r[3] - r[1]) / 2
    s = min(hw / abs(dx) if dx else math.inf, hh / abs(dy) if dy else math.inf)
    return (cx + dx * s, cy + dy * s)


def straight(ra, rb) -> list:
    """From box a to box b along the line between their centres, edge to edge."""
    return [edge_toward(ra, centre(rb)), edge_toward(rb, centre(ra))]


def bezier(p0, c, p1, n: int = 28) -> list:
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1]) for t in (k / n for k in range(n + 1))]


def u_curve(p0, p1, depth: float, n: int = 32, stub: float = 0.22) -> list:
    """From p0 down, across and up into p1 (both on one level), its lowest point `depth` below them. It leaves and
    arrives by a short straight upright stub, so an arrowhead set on the last stub lies along the line (one set on a
    still-bending end sat askew beside it and read as a second head, p3w blind review)."""
    a, b = (p0[0], p0[1] - stub), (p1[0], p1[1] - stub)
    k = (depth - stub) * 4 / 3  # a cubic's middle sits three quarters of the way to its inner control points
    c0, c1 = (a[0], a[1] - k), (b[0], b[1] - k)
    mid = [((1 - t) ** 3 * a[0] + 3 * (1 - t) ** 2 * t * c0[0] + 3 * (1 - t) * t ** 2 * c1[0] + t ** 3 * b[0],
            (1 - t) ** 3 * a[1] + 3 * (1 - t) ** 2 * t * c0[1] + 3 * (1 - t) * t ** 2 * c1[1] + t ** 3 * b[1])
           for t in (j / n for j in range(n + 1))]
    return [tuple(p0)] + mid + [tuple(p1)]


def dense(pts, step: float = 0.04) -> list:
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
        out += [(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n) for k in range(n)]
    return out + [tuple(pts[-1])]


def inside(pt, r, margin: float = 0.0) -> bool:
    return r[0] - margin < pt[0] < r[2] + margin and r[1] - margin < pt[1] < r[3] + margin


def _cross(a, b, c, d) -> bool:
    def orient(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return orient(a, b, c) * orient(a, b, d) < 0 and orient(c, d, a) * orient(c, d, b) < 0


def crosses(p, q) -> bool:
    return any(_cross(a, b, c, d) for a, b in zip(p, p[1:]) for c, d in zip(q, q[1:]))


def distance(pt, pts) -> float:
    return min(math.hypot(pt[0] - x, pt[1] - y) for x, y in dense(pts, 0.03))


def clean(routes: dict, boxes: dict, gap: float = 0.12, ends: float = 0.0) -> bool:
    """No arrow runs through (or grazes) a box it does not join, and no two arrows cross; with `ends`, no two
    arrows' ends are that close (two heads side by side read as one arrow with a double head)."""
    tips = [(k, pt) for k, pts in routes.items() for pt in (pts[0], pts[-1])]
    for i, (a, u) in enumerate(tips):
        for b, v in tips[i + 1:]:
            if a != b and math.hypot(u[0] - v[0], u[1] - v[1]) <= ends:
                return False
    for (f, t), pts in routes.items():
        for k, r in boxes.items():
            if k not in (f, t) and any(inside(pt, r, gap) for pt in dense(pts)):
                return False
    keys = list(routes)
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            if crosses(routes[a], routes[b]):
                return False
    return True


def _at(pts, t: float) -> tuple:
    """The point a fraction t of the way along a polyline, and the unit direction there."""
    segs = [(p0, p1, math.hypot(p1[0] - p0[0], p1[1] - p0[1])) for p0, p1 in zip(pts, pts[1:])]
    segs = [s for s in segs if s[2] > 1e-9]
    goal = t * sum(L for _, _, L in segs)
    for p0, p1, L in segs:
        if goal <= L:
            f = goal / L
            return (p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f,
                    (p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L)
        goal -= L
    p0, p1, L = segs[-1]
    return (p1[0], p1[1], (p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L)


def place_letters(routes: dict, boxes: dict, offset: float = 0.27) -> dict:
    """Beside each arrow, near its middle, on the side with the most room: clear of the boxes, of the other arrows
    and of the letters placed already. Keys are the arrows' keys."""
    out: dict = {}
    for key, pts in routes.items():
        others = [q for k, q in routes.items() if k != key]
        best, score = None, -math.inf
        for t in (0.5, 0.42, 0.58, 0.34, 0.66, 0.28, 0.72):
            x, y, ux, uy = _at(pts, t)
            for side in (1, -1):
                at = (x - side * uy * offset, y + side * ux * offset)
                if any(inside(at, r, 0.2) for r in boxes.values()):
                    continue
                room = min([distance(at, q) for q in others] + [math.hypot(at[0] - a[0], at[1] - a[1]) - 0.1
                                                                for a in out.values()] + [1.0])
                s = min(room, 0.6) - 0.3 * abs(t - 0.5)
                if s > score:
                    best, score = at, s
        out[key] = best
    return out


def fit(fig, ax, xlim, ylim, scale: float) -> None:
    """Limits, equal scales, and a figure exactly the drawing's size at `scale` inches a unit, so a box sized in
    units always holds its words (with equal aspect a fixed figure shrank the boxes under the text)."""
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.set_size_inches(scale * (xlim[1] - xlim[0]), scale * (ylim[1] - ylim[0]))
    ax.set_position([0, 0, 1, 1])


def draw_box(ax, key: str, r, words: str, size: float = 10.5) -> None:
    ax.add_patch(FancyBboxPatch((r[0], r[1]), r[2] - r[0], r[3] - r[1], boxstyle="round,pad=0,rounding_size=0.12",
                                facecolor="white", edgecolor=INK, linewidth=1.3, zorder=2, gid=f"box:{key}"))
    ax.text(*centre(r), words, ha="center", va="center", fontsize=size, zorder=3, gid=f"label:{key}",
            linespacing=1.15)


def draw_arrow(ax, letter: str, pair, pts, at) -> None:
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color=INK, linewidth=1.4, zorder=1, gid=f"arrow:{letter}:{pair[0]}>{pair[1]}",
            solid_capstyle="butt")
    # The head lies along the arrow's last straight stretch: a straight arrow's whole length, a curve's end stub.
    back = pts[-2]
    ax.annotate("", xy=pts[-1], xytext=back, zorder=4, gid=f"head:{letter}",
                arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.4, "mutation_scale": 14,
                            "shrinkA": 0, "shrinkB": 0})
    ax.text(*at, letter, ha="center", va="center", fontsize=11.5, fontweight="bold", zorder=5, gid=f"letter:{letter}")
