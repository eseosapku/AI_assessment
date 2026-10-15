"""Drawing pieces the lettered biology diagrams share (P3w structures): smooth outlines, tubes for vessels and
neurones, flow arrows, and letters on leader lines that end on their part.

Every part a letter may point at is a filled patch with the gid "part:<name>" (a part drawn in two pieces, such as
the two flaps of a valve, gives both the same gid). A letter is the text "letter:<L>", and its leader the line
"leader:<L>", whose last point lies on the part. The answer tests read these gids to check every letter against the
drawing.
"""
from __future__ import annotations

import math

from matplotlib.patches import Polygon

from ..core import INK

LETTER_SIZE = 14


def spline(points, closed: bool = True, per: int = 12) -> list[list[float]]:
    """A smooth curve through the points (Catmull-Rom), as [x, y] pairs."""
    pts = [tuple(p) for p in points]
    n = len(pts)
    out: list[list[float]] = []
    segs = n if closed else n - 1
    for i in range(segs):
        p0 = pts[(i - 1) % n] if closed else pts[max(i - 1, 0)]
        p1, p2 = pts[i], pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if closed else pts[min(i + 2, n - 1)]
        for k in range(per):
            t = k / per
            out.append([0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                               + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in (0, 1)])
    if not closed:
        out.append(list(pts[-1]))
    return out


def ellipse(cx: float, cy: float, rx: float, ry: float, n: int = 60, a0: float = 0.0, a1: float = 360.0) -> list[list[float]]:
    """Points on an ellipse from angle a0 to a1 (degrees)."""
    return [[cx + rx * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cy + ry * math.sin(math.radians(a0 + (a1 - a0) * k / n))]
            for k in range(n + 1)]


def offset(path, d: float) -> list[list[float]]:
    """The polyline moved sideways by d (to its left for d > 0), keeping its corners mitred."""
    out = []
    n = len(path)
    for i in range(n):
        x, y = path[i]
        tx, ty = 0.0, 0.0
        for a, b in ((i - 1, i), (i, i + 1)):
            if 0 <= a and b < n:
                dx, dy = path[b][0] - path[a][0], path[b][1] - path[a][1]
                ln = math.hypot(dx, dy) or 1.0
                tx, ty = tx + dx / ln, ty + dy / ln
        ln = math.hypot(tx, ty) or 1.0
        out.append([x - ty / ln * d, y + tx / ln * d])
    return out


def tube(path, width: float) -> list[list[float]]:
    """The outline of a tube of the given width along a polyline: one side, then the other back."""
    return offset(path, width / 2) + offset(path, -width / 2)[::-1]


def part(ax, pts, name: str, face: str, edge: str = INK, lw: float = 1.2, z: float = 2.0) -> Polygon:
    """A filled shape a letter may point at."""
    patch = Polygon(pts, closed=True, facecolor=face, edgecolor=edge, linewidth=lw, zorder=z, gid=f"part:{name}")
    ax.add_patch(patch)
    return patch


def vessel(ax, path, width: float, name: str, face: str, z: float = 3.0, lw: float = 1.2, ends: bool = False) -> Polygon:
    """A tube drawn open-ended where it joins something: filled, with only its two sides outlined (and its ends
    too when `ends`)."""
    pts = tube(path, width)
    patch = Polygon(pts, closed=True, facecolor=face, edgecolor="none", zorder=z, gid=f"part:{name}" if name else None)
    ax.add_patch(patch)
    for side in (offset(path, width / 2), offset(path, -width / 2)):
        ax.plot([p[0] for p in side], [p[1] for p in side], color=INK, linewidth=lw, zorder=z + 0.01, solid_capstyle="butt")
    if ends:
        for i in (0, -1):
            a, b = offset(path, width / 2)[i], offset(path, -width / 2)[i]
            ax.plot([a[0], b[0]], [a[1], b[1]], color=INK, linewidth=lw, zorder=z + 0.01)
    return patch


def flow(ax, tail, head, gid: str, color: str = INK, lw: float = 1.6, z: float = 6.0) -> None:
    """A flow arrow (blood, filtrate or an impulse), its head at `head`."""
    ax.annotate("", xy=head, xytext=tail, gid=f"flow:{gid}", zorder=z,
                arrowprops=dict(arrowstyle="-|>,head_length=0.55,head_width=0.3", color=color, lw=lw, shrinkA=0, shrinkB=0))


def letter(ax, name: str, at, end, gap: float = 0.3, size: float = LETTER_SIZE, dot: bool = False) -> None:
    """The letter at `at`, and its leader from just clear of the letter to `end`, on the part (with a dot there when
    `dot`, so where it stops is plain)."""
    dx, dy = end[0] - at[0], end[1] - at[1]
    ln = math.hypot(dx, dy) or 1.0
    start = (at[0] + dx / ln * gap, at[1] + dy / ln * gap)
    ax.plot([start[0], end[0]], [start[1], end[1]], color=INK, linewidth=1.0, zorder=8, gid=f"leader:{name}")
    if dot:
        ax.plot([end[0]], [end[1]], marker="o", markersize=3.5, color=INK, zorder=8)
    ax.text(at[0], at[1], name, ha="center", va="center", fontsize=size, fontweight="bold", zorder=9, gid=f"letter:{name}")


def letters_for(parts, rng) -> dict[str, str]:
    """Letters A, B, C ... given to the parts in a random order: {letter: part}."""
    order = list(parts)
    rng.shuffle(order)
    return {chr(65 + i): name for i, name in enumerate(order)}


def letter_choice(stem: str, correct: str, distractors, n: int = 4):
    """A question answered with a letter: the correct letter and up to three wrong ones, in alphabetical order."""
    from ..core import Question, one
    options = [correct]
    for d in distractors:
        if d not in options and len(options) < n:
            options.append(d)
    options.sort()
    return Question("mcq", one(stem), str(options.index(correct)), options)
