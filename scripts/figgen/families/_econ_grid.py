"""Pieces the gridded economics diagrams share (P3y: ad_as, exchange_rate): straight curves that stop short of the
frame with their names just beyond their ends, as textbooks draw them, and equilibria marked with a dot, dotted lines
to both axes, and a letter set in the widest clear angle around the point (so it never sits on a curve).
"""
from __future__ import annotations

import math

from ..core import INK, curve


def line(ax, f, text: str, qend: float, xmax: float, ymax: float, style: str = "-") -> None:
    """Plots P = f(Q) from the price axis to qend (or to where it leaves the grid first) and names it at that end.
    Every length is in data units, scaled to the axes (xmax by ymax)."""
    curve(ax, f, 0, qend, 0, ymax, n=400, color=INK, linewidth=2.0, linestyle=style)
    x, y = qend, f(qend)
    if not 0 <= y <= ymax:  # it leaves through the top or the bottom first: find where
        edge = ymax if y > ymax else 0
        lo, hi = 0.0, qend
        for _ in range(60):
            mid = (lo + hi) / 2
            if (f(mid) > edge) == (f(0) > edge):
                lo = mid
            else:
                hi = mid
        x, y = lo, edge
    y = min(max(y, 0.0225 * ymax), ymax * (1 - 0.0225))
    ax.text(x + 0.01 * xmax, y, text, ha="left", va="center", fontsize=10, fontweight="bold")


def clear_angle(ax, fig, dirs, xmax: float, ymax: float) -> float:
    """The middle of the widest clear angle around a point, in degrees on the page, given the directions (in data
    units) of every line leaving it."""
    pos = ax.get_position()
    w, h = fig.get_size_inches()
    sx, sy = pos.width * w / xmax, pos.height * h / ymax  # inches per data unit across and up
    # two lines leaving the same way (a dotted line along a curve) are one direction, not a gap of nothing
    angles = sorted({round(math.degrees(math.atan2(dy * sy, dx * sx)) % 360, 6) for dx, dy in dirs})
    if len(angles) == 1:
        return (angles[0] + 180) % 360
    gaps = [((angles[(i + 1) % len(angles)] - a) % 360, a) for i, a in enumerate(angles)]
    width, at = max(gaps)
    return (at + width / 2) % 360


def mark(ax, fig, name: str, pt, dirs, xmax: float, ymax: float) -> None:
    """An equilibrium: a dot, dotted lines to both axes, and its letter clear of every line through it."""
    q, pp = pt
    ax.plot([0, q, q], [pp, pp, 0], color=INK, linestyle=":", linewidth=1.2)
    ax.plot([q], [pp], "o", color=INK, markersize=5.5, zorder=5)
    t = math.radians(clear_angle(ax, fig, list(dirs) + [(-1, 0), (0, -1)], xmax, ymax))
    ax.annotate(name, (q, pp), xytext=(15 * math.cos(t), 13 * math.sin(t)), textcoords="offset points", ha="center",
                va="center", fontsize=10.5, fontweight="bold", zorder=6)
