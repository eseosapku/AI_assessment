"""A straight curve's name kept at its own end (P4 review): the shared Board.end_label falls back to any clear spot near
the end, and on the externality and tariff diagrams it set "MSC" midway between two parallel lines and "D domestic"
beside the world-price line. Here a name goes just beyond its line's far end, or beside the line a few steps back
along it (near its other end only if there is no room at all), hugging it: of the clear spots in the nearest tier the
one whose middle is closest to the line, and only where that line is plainly the nearest one to the name, every other
line at least half as far again from its middle, and a sixth of an inch from its box.
"""
from __future__ import annotations

import math

import numpy as np

from . import _micro as g


def _gap(box, pts, ux: float, uy: float) -> float:
    """How far, in inches, the nearest of `pts` (an array of points) lies from the box (0 inside it)."""
    x0, x1, y0, y1 = box
    dx = np.maximum(np.maximum(x0 - pts[:, 0], pts[:, 0] - x1), 0.0) * ux
    dy = np.maximum(np.maximum(y0 - pts[:, 1], pts[:, 1] - y1), 0.0) * uy
    return float(np.sqrt(dx * dx + dy * dy).min()) if len(pts) else math.inf


def _reach(x: float, y: float, pts, ux: float, uy: float) -> float:
    """How far, in inches, the nearest of `pts` lies from the point (x, y)."""
    return float(np.hypot((pts[:, 0] - x) * ux, (pts[:, 1] - y) * uy).min()) if len(pts) else math.inf


def points(p0, slope, qx: int, py: int, n: int = 240) -> list[tuple[float, float]]:
    """The drawn stretch of P = p0 + slope × Q inside the grid, as points in grid steps."""
    (q0, a), (q1, b) = g.clip(p0, slope, qx, py)
    q0, a, q1, b = float(q0), float(a), float(q1), float(b)
    return [(q0 + (q1 - q0) * i / n, a + (b - a) * i / n) for i in range(n + 1)]


def name_at_end(board, text: str, p0, slope, others, size: float = 10.0, wrapped: str | None = None) -> None:
    """Names the line P = p0 + slope × Q at its far end (greater quantity), or a few steps back along it, or at last near
    its other end. `others` are the other drawn lines, each as a list of points in grid steps. A long name may be set on
    two lines (`wrapped`) where it does not fit on one."""
    line = points(p0, slope, board.qx, board.py)
    q0, q1 = line[0][0], line[-1][0]
    own = np.array(line)
    others = [np.array(o, dtype=float).reshape(-1, 2) for o in others]
    beside = [(0, 1), (0, -1), (-1, 1), (1, 1), (-1, -1), (1, -1)]
    end = [(1, 0), (1, 1), (1, -1)] + beside
    tiers = [[(q1 - back, end if back == 0 else beside) for back in (0.0, 0.4, 0.8, 1.2)],
             [(q1 - back, beside) for back in (1.6, 2.0, 2.5, 3.0)],
             [(q1 - back, beside) for back in (3.5, 4.0, 5.0, 6.0)],
             [(q0 + on, beside) for on in (0.4, 0.8, 1.2, 1.6, 2.0, 2.5, 3.0)]]
    ux, uy = board.ux, board.uy
    for words in [text] + ([wrapped] if wrapped else []):
        w, h = board._size(words, size)
        for tier in tiers:
            found = []
            for q, spots in tier:
                if not q0 <= q <= q1:
                    continue
                p = float(p0) + float(slope) * q
                for gap in (0.08, 0.15, 0.25, 0.4):
                    for sx, sy in spots:
                        cx, cy = q + sx * (gap + w / 2), p + sy * (gap + h / 2)
                        box = (cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2)
                        if not board._clear(box):
                            continue
                        mine = _reach(cx, cy, own, ux, uy)
                        far = min((_reach(cx, cy, o, ux, uy) for o in others), default=math.inf)
                        edge = min((_gap(box, o, ux, uy) for o in others), default=math.inf)
                        if far >= 1.5 * mine and edge >= 1 / 6:
                            found.append((mine, cx, cy, box))
            if found:
                _, cx, cy, box = min(found)
                board.boxes.append(box)
                board.ax.text(cx * board.dq, cy * board.dp, words, ha="center", va="center", fontsize=size,
                              fontweight="bold")
                return
    raise ValueError(f"no room for the label {text} at its line's end")
