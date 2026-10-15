"""Shared pieces of the market and firm graphs (P3y Task C): a grid whose every line is a whole step of quantity and of
price, straight curves cut where they leave it, and labels placed clear of every curve.

Everything is drawn in real units (francs and kilograms), so the axis numbers are what a student reads, while the
families work in whole grid steps and multiply by the step sizes `dq` and `dp`.
"""
from __future__ import annotations

import math
from fractions import Fraction

from ..core import GRID, INK
from .econ_tables import frw

ORD = {1: "st", 2: "nd", 3: "rd"}


def ordinal(n: int) -> str:
    """1st, 2nd, 3rd, 4th, 11th, 21st."""
    return f"{n}{'th' if 10 <= n % 100 <= 20 else ORD.get(n % 10, 'th')}"


def grid(ax, qx: int, py: int, dq, dp, xlabel: str, ylabel: str, xevery: int = 1, yevery: int = 1) -> None:
    """A gridline on every step of each axis; a number on every `xevery`-th and `yevery`-th."""
    ax.set_xticks([i * dq for i in range(0, qx + 1, xevery)])
    ax.set_xticklabels([frw(i * dq) for i in range(0, qx + 1, xevery)])
    ax.set_yticks([i * dp for i in range(0, py + 1, yevery)])
    ax.set_yticklabels([frw(i * dp) for i in range(0, py + 1, yevery)])
    ax.set_xticks([i * dq for i in range(qx + 1)], minor=True)
    ax.set_yticks([i * dp for i in range(py + 1)], minor=True)
    ax.set_xlim(0, qx * dq)
    ax.set_ylim(0, py * dp)
    ax.grid(True, which="both", color=GRID, linewidth=0.55)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=8)
    ax.tick_params(which="minor", length=0)
    ax.set_xlabel(xlabel, fontsize=10)
    ax.set_ylabel(ylabel, fontsize=10)


def clip(p0, slope, qx: int, py: int):
    """The stretch of the line P = p0 + slope × Q inside 0 <= Q <= qx, 0 <= P <= py, in steps: its two ends."""
    p0, slope = Fraction(p0), Fraction(slope)
    lo, hi = Fraction(0), Fraction(qx)
    if slope > 0:
        lo, hi = max(lo, -p0 / slope), min(hi, (py - p0) / slope)
    elif slope < 0:
        lo, hi = max(lo, (py - p0) / slope), min(hi, -p0 / slope)
    return (lo, p0 + slope * lo), (hi, p0 + slope * hi)


def dotted(ax, pts, dq, dp) -> None:
    """A dotted guide through grid points, as from an equilibrium to the axes."""
    ax.plot([float(q * dq) for q, _ in pts], [float(p * dp) for _, p in pts], color=INK, linestyle=(0, (1.5, 2.2)),
            linewidth=1.0)


def to_axes(ax, q, p, dq, dp) -> None:
    """Dotted lines from a point down to the quantity axis and across to the price axis."""
    dotted(ax, [(q, 0), (q, p), (0, p)], dq, dp)


class Board:
    """The curves of one graph, in grid steps, and the labels placed so far: a new label goes in the first of a few
    spots near its anchor that stays inside the frame and clear of every curve and every earlier label.

    Text is sized from the axes' inches per grid step: 11-point bold is about 0.1 inch a character wide and 0.17 inch
    tall.
    """

    def __init__(self, ax, qx: int, py: int, dq, dp):
        self.ax, self.qx, self.py, self.dq, self.dp = ax, qx, py, dq, dp
        w, h = ax.figure.get_size_inches()
        pos = ax.get_position()
        self.ux, self.uy = pos.width * w / qx, pos.height * h / py
        self.paths: list[list[tuple[float, float]]] = []
        self.boxes: list[tuple[float, float, float, float]] = []

    def line(self, p0, slope, gid: str, style: str = "-", width: float = 1.9):
        """Draws P = p0 + slope × Q across the grid, named `gid`; returns its far end (greater quantity), in steps."""
        (q0, a), (q1, b) = clip(p0, slope, self.qx, self.py)
        self.ax.plot([float(q0 * self.dq), float(q1 * self.dq)], [float(a * self.dp), float(b * self.dp)], color=INK,
                     linestyle=style, linewidth=width, gid=gid)
        n = max(2, int(float(q1 - q0) * 20))
        self.paths.append([(float(q0 + (q1 - q0) * i / n), float(a + (b - a) * i / n)) for i in range(n + 1)])
        return float(q1), float(b)

    def path(self, pts) -> None:
        """A curve drawn elsewhere, in steps, that labels must keep clear of."""
        self.paths.append([(float(x), float(y)) for x, y in pts])

    def _size(self, text: str, size: float) -> tuple[float, float]:
        lines = text.split("\n")
        w = max(len(t) for t in lines) * 0.0092 * size / self.ux + 0.1
        h = len(lines) * 0.0165 * size / self.uy + 0.1
        return w, h

    def _clear(self, box, pad: float = 0.12, space: float = 0.35) -> bool:
        x0, x1, y0, y1 = box
        if x0 < 0.05 or y0 < 0.05 or x1 > self.qx - 0.05 or y1 > self.py - 0.05:
            return False
        for path in self.paths:
            if any(x0 - pad <= x <= x1 + pad and y0 - pad <= y <= y1 + pad for x, y in path):
                return False
        return not any(x0 < b1 + space and b0 - space < x1 and y0 < c1 + space and c0 - space < y1
                       for b0, b1, c0, c1 in self.boxes)

    def label(self, text: str, q: float, p: float, size: float = 11, gap: float = 0.25, where=None, pad: float = 0.12,
              others=()) -> bool:
        """Puts `text` near the grid point (q, p): beside it, above or below, nearest first; never nearer (in inches)
        to any of `others`, other points a reader might take it for, than to its own."""
        w, h = self._size(text, size)
        spots = where or [(1, 0), (1, -1), (1, 1), (0, -1), (0, 1), (-1, -1), (-1, 1), (-1, 0)]
        for reach in (1, 1.5, 2, 2.8, 4):
            for sx, sy in spots:
                cx = q + sx * (gap * reach + w / 2)
                cy = p + sy * (gap * reach + h / 2)
                box = (cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2)
                own = ((cx - q) * self.ux) ** 2 + ((cy - p) * self.uy) ** 2
                if any(((cx - a) * self.ux) ** 2 + ((cy - b) * self.uy) ** 2 <= own * 1.4 for a, b in others):
                    continue
                if self._clear(box, pad, 0.08 if others else 0.35):
                    self.boxes.append(box)
                    self.ax.text(cx * self.dq, cy * self.dp, text, ha="center", va="center", fontsize=size,
                                 fontweight="bold")
                    return True
        return False

    def end_label(self, text: str, end: tuple[float, float], slope: float, size: float = 11, path=None) -> None:
        """A curve's name just past its far end, or beside the end on its open side (above-left of a rising curve,
        below-left of a falling one); failing room there, a little way back along it (along `path`, its drawn points,
        for a curve), still on its open side; and only then anywhere near."""
        q, p = end
        rising = slope > 0
        side = [(1, -1), (-1, 1)] if rising else [(1, 1), (-1, -1)]
        if path:
            pts = sorted(path)
            back = [pt for pt in pts[::-1] if math.dist(pt, end) <= 4.6]
            anchors = [min(back, key=lambda pt: abs(math.dist(pt, end) - d)) for d in (0.8, 1.6, 2.4, 3.2, 4.5)]
        else:
            anchors = [(q - d, p - slope * d) for d in (0.8, 1.6, 2.4, 3.2, 4.5)]
        tries = [((q, p), [(1, 0), (1, 1), (1, -1), (-1, 1) if rising else (-1, -1)])]
        tries += [(a, side) for a in anchors]
        tries += [(a, [(0, 1), (0, -1), (-1, 1), (-1, -1)]) for a in [(q, p)] + anchors]
        for (aq, ap), spots in tries:
            if self.label(text, aq, ap, size, where=spots):
                return
        raise ValueError(f"no room for the label {text}")

    def block(self, q0: float, q1: float, p0: float, p1: float) -> None:
        """Keeps labels off a rectangle of the grid (a point's dot, a printed note)."""
        self.boxes.append((q0, q1, p0, p1))
