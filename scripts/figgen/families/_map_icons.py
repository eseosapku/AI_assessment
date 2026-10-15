"""Simple map symbols for the Primary Social Studies maps (compass_map_p, map_key_p).

Each symbol is built from rectangles, triangles and circles, as a Primary book draws them, centred on a point and
about 0.6 of a unit across at size 1 (never more than 0.32 from its centre). The first patch drawn carries the gid,
so a test can count the symbols on a map.
"""
from __future__ import annotations

from matplotlib.patches import Circle, Polygon, Rectangle

from ..core import INK

ROOF = "#c0634a"
WALL = "#f6ead0"
WATER = "#3b82c4"
LEAF = "#5a9e4b"
TRUNK = "#7a5230"
RED = "#d32f2f"
GRASS = "#8cc36b"
WOOD = "#c9a26b"
ROAD = "#bdbdbd"


def _rect(ax, x, y, w, h, face, z, gid=None, lw=1.0, edge=INK):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=face, edgecolor=edge, linewidth=lw, zorder=z, gid=gid))


def _poly(ax, pts, face, z, gid=None, lw=1.0, edge=INK):
    ax.add_patch(Polygon(pts, closed=True, facecolor=face, edgecolor=edge, linewidth=lw, zorder=z, gid=gid))


def symbol(ax, kind: str, cx: float, cy: float, s: float = 1.0, gid: str | None = None, z: float = 3,
           part: str | None = None) -> None:
    """Draws the symbol for `kind` centred on (cx, cy). Its first patch carries `gid`; every other piece of it (patches
    and strokes) carries `part`, so a test can measure the whole symbol as drawn."""
    patches, lines = len(ax.patches), len(ax.lines)
    _symbol(ax, kind, cx, cy, s, gid, z)
    if part:
        for art in list(ax.patches)[patches:] + list(ax.lines)[lines:]:
            if art.get_gid() is None:
                art.set_gid(part)


def _symbol(ax, kind: str, cx: float, cy: float, s: float, gid: str | None, z: float) -> None:
    def X(d):
        return cx + d * s

    def Y(d):
        return cy + d * s

    if kind == "school":  # a house with a pitched roof and a flag
        _rect(ax, X(-0.22), Y(-0.26), 0.44 * s, 0.26 * s, WALL, z, gid)
        _poly(ax, [(X(-0.28), Y(0.0)), (X(0.28), Y(0.0)), (X(0.0), Y(0.16))], ROOF, z + 0.1)
        _rect(ax, X(-0.05), Y(-0.26), 0.1 * s, 0.14 * s, INK, z + 0.1, lw=0.6)
        ax.plot([X(0.0), X(0.0)], [Y(0.16), Y(0.31)], color=INK, linewidth=1.0, zorder=z + 0.1)
        _poly(ax, [(X(0.0), Y(0.31)), (X(0.14), Y(0.27)), (X(0.0), Y(0.23))], "#2e7d32", z + 0.2, lw=0.6)
    elif kind == "church":  # a narrow house with a tall roof and a cross on top
        _rect(ax, X(-0.16), Y(-0.27), 0.32 * s, 0.25 * s, WALL, z, gid)
        _poly(ax, [(X(-0.2), Y(-0.02)), (X(0.2), Y(-0.02)), (X(0.0), Y(0.14))], ROOF, z + 0.1)
        _rect(ax, X(-0.045), Y(-0.27), 0.09 * s, 0.14 * s, INK, z + 0.1, lw=0.6)
        ax.plot([X(0.0), X(0.0)], [Y(0.14), Y(0.32)], color=INK, linewidth=1.6, zorder=z + 0.2)
        ax.plot([X(-0.07), X(0.07)], [Y(0.255), Y(0.255)], color=INK, linewidth=1.6, zorder=z + 0.2)
    elif kind == "market":  # a stall: a counter under a striped awning
        _rect(ax, X(-0.27), Y(-0.27), 0.54 * s, 0.16 * s, WOOD, z, gid)
        for dx in (-0.22, 0.22):
            ax.plot([X(dx), X(dx)], [Y(-0.11), Y(0.08)], color=INK, linewidth=1.2, zorder=z)
        edges = [-0.3, -0.15, 0.0, 0.15, 0.3]
        for k, (a, b) in enumerate(zip(edges, edges[1:])):
            _poly(ax, [(X(a), Y(0.08)), (X(b), Y(0.08)), (X(b * 0.8), Y(0.26)), (X(a * 0.8), Y(0.26))],
                  RED if k % 2 == 0 else "white", z + 0.1, lw=0.8)
        for dx in (-0.1, 0.0, 0.1):  # fruit on the counter
            ax.add_patch(Circle((X(dx), Y(-0.07)), 0.04 * s, facecolor="#f2a33a", edgecolor=INK, linewidth=0.6,
                                zorder=z + 0.1))
    elif kind in ("hospital", "health centre"):  # a white square with a red cross
        _rect(ax, X(-0.25), Y(-0.25), 0.5 * s, 0.5 * s, "white", z, gid, lw=1.2)
        _rect(ax, X(-0.06), Y(-0.19), 0.12 * s, 0.38 * s, RED, z + 0.1, edge=RED)
        _rect(ax, X(-0.19), Y(-0.06), 0.38 * s, 0.12 * s, RED, z + 0.1, edge=RED)
    elif kind == "sector office":  # a two-storey office with windows and a flag
        _rect(ax, X(-0.26), Y(-0.27), 0.52 * s, 0.4 * s, "#dfe7ef", z, gid)
        for wx in (-0.18, -0.04, 0.1):
            for wy in (-0.04, -0.17):
                _rect(ax, X(wx), Y(wy), 0.08 * s, 0.08 * s, "#7fa7c9", z + 0.1, lw=0.6)
        ax.plot([X(0.0), X(0.0)], [Y(0.13), Y(0.31)], color=INK, linewidth=1.0, zorder=z + 0.1)
        _poly(ax, [(X(0.0), Y(0.31)), (X(0.15), Y(0.31)), (X(0.15), Y(0.21)), (X(0.0), Y(0.21))], "#2e86c1", z + 0.2,
              lw=0.6)
    elif kind == "bank":  # columns under a triangular roof
        _rect(ax, X(-0.27), Y(-0.27), 0.54 * s, 0.07 * s, "#d9d9d9", z, gid)
        for dx in (-0.2, -0.07, 0.06, 0.19):
            _rect(ax, X(dx - 0.025), Y(-0.2), 0.05 * s, 0.26 * s, "white", z + 0.1, lw=0.7)
        _rect(ax, X(-0.27), Y(0.06), 0.54 * s, 0.05 * s, "#d9d9d9", z + 0.1)
        _poly(ax, [(X(-0.29), Y(0.11)), (X(0.29), Y(0.11)), (X(0.0), Y(0.28))], "#d9d9d9", z + 0.1)
    elif kind == "football field":  # a green pitch with a halfway line and centre circle
        _rect(ax, X(-0.3), Y(-0.21), 0.6 * s, 0.42 * s, GRASS, z, gid, lw=1.2)
        ax.plot([X(0.0), X(0.0)], [Y(-0.21), Y(0.21)], color="white", linewidth=1.2, zorder=z + 0.1)
        ax.add_patch(Circle((X(0.0), Y(0.0)), 0.08 * s, facecolor="none", edgecolor="white", linewidth=1.2,
                            zorder=z + 0.1))
    elif kind == "water tap":  # a post with a tap and a falling drop
        _rect(ax, X(-0.2), Y(-0.27), 0.08 * s, 0.45 * s, "#9e9e9e", z, gid)
        _rect(ax, X(-0.12), Y(0.1), 0.26 * s, 0.08 * s, "#9e9e9e", z + 0.1)
        _rect(ax, X(0.06), Y(0.0), 0.08 * s, 0.1 * s, "#9e9e9e", z + 0.1)
        ax.add_patch(Circle((X(0.0), Y(0.23)), 0.05 * s, facecolor="#9e9e9e", edgecolor=INK, linewidth=0.8, zorder=z + 0.1))
        ax.add_patch(Circle((X(0.1), Y(-0.17)), 0.055 * s, facecolor=WATER, edgecolor=INK, linewidth=0.6, zorder=z + 0.1))
        _poly(ax, [(X(0.05), Y(-0.15)), (X(0.15), Y(-0.15)), (X(0.1), Y(-0.06))], WATER, z + 0.1, lw=0.0, edge=WATER)
    elif kind == "forest":  # a tree
        ax.add_patch(Circle((X(0.0), Y(0.06)), 0.21 * s, facecolor=LEAF, edgecolor=INK, linewidth=1.0, zorder=z + 0.1,
                            gid=gid))
        _rect(ax, X(-0.045), Y(-0.27), 0.09 * s, 0.14 * s, TRUNK, z)
    else:
        raise ValueError(kind)
