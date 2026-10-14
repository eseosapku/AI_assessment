"""Tables as the economics families draw them (P3p): a shaded header row, every cell ruled, numbers set right so
their thousands line up, and francs written with a space for thousands ("12 500"). One data unit is one inch, so
a figure sized to its table prints every table at the same type size.
"""
from __future__ import annotations

from functools import lru_cache

from matplotlib.patches import Rectangle

from ..core import INK, new_figure

HEAD = "#d9dee3"
SIDE = {"l": "left", "r": "right", "c": "center"}


@lru_cache(maxsize=4096)
def _inches(line: str, size: float, bold: bool) -> float:
    """How wide a line of text prints, in inches, from the font's own metrics."""
    from matplotlib.font_manager import FontProperties
    from matplotlib.textpath import TextToPath
    prop = FontProperties(family="DejaVu Sans", weight="bold" if bold else "normal", size=size)
    return TextToPath().get_text_width_height_descent(line, prop, ismath=False)[0] / 72


def fit(*texts: str, size: float = 10, bold: bool = True, least: float = 0.0, pad: float = 0.3) -> float:
    """The width in inches a column needs for its widest line of text (headers are bold), padded, and at least `least`."""
    lines = [ln for t in texts for ln in str(t).split("\n")]
    return max([least] + [_inches(ln, size, bold) + pad for ln in lines])


def frw(n) -> str:
    """A whole number of francs as printed: 950, 12 500, 1 250 000."""
    return f"{int(n):,}".replace(",", " ")


def table(ax, headers, rows, widths, top: float = 0.0, rh: float = 0.36, hh: float = 0.56, align=None,
          fontsize: float = 10, x0: float = 0.0, shade_first: bool = False) -> float:
    """A ruled table whose top-left corner is (x0, top); returns its bottom edge. `align` is one of l, c, r a column."""
    xs, x = [], x0
    for w in widths:
        xs.append(x)
        x += w
    align = align or ["c"] * len(widths)
    for j, h in enumerate(headers):
        ax.add_patch(Rectangle((xs[j], top - hh), widths[j], hh, facecolor=HEAD, edgecolor=INK, linewidth=1.0))
        ax.text(xs[j] + widths[j] / 2, top - hh / 2, h, ha="center", va="center", fontsize=fontsize, fontweight="bold",
                linespacing=1.15)
    y = top - hh
    for row in rows:
        y -= rh
        for j, v in enumerate(row):
            first = shade_first and j == 0
            ax.add_patch(Rectangle((xs[j], y), widths[j], rh, facecolor="#f2f3f4" if first else "white", edgecolor=INK,
                                   linewidth=0.9))
            a = align[j]
            tx = xs[j] + (0.12 if a == "l" else widths[j] - 0.12 if a == "r" else widths[j] / 2)
            ax.text(tx, y + rh / 2, str(v), ha=SIDE[a], va="center", fontsize=fontsize)
    return y


def titled_table(title: str, heads, rows, align, notes=(), least: float = 1.2):
    """A bold title, any lines of notes under it (a price), then the table: each column as wide as its widest text,
    and the table centred under a title wider than it."""
    rows = [[str(v) for v in r] for r in rows]
    widths = [fit(h, *(r[j] for r in rows), least=least) for j, h in enumerate(heads)]
    width = max([sum(widths), fit(title, size=10.5, pad=0.2)] + [fit(n, size=10.5, bold=False, pad=0.2) for n in notes])
    head = 0.36 * (1 + len(notes)) + 0.05
    fig, ax = sheet(width, head + 0.56 + 0.36 * len(rows))
    ax.text(width / 2, -0.17, title, ha="center", va="center", fontsize=10.5, fontweight="bold")
    for i, note in enumerate(notes):
        ax.text(width / 2, -0.17 - 0.36 * (i + 1), note, ha="center", va="center", fontsize=10.5)
    table(ax, heads, rows, widths, top=-head, align=align, x0=(width - sum(widths)) / 2)
    return fig


def sheet(width: float, height: float):
    """A figure and blank axes sized to a table of `width` by `height` inches, with a margin."""
    fig, ax = new_figure(width + 0.2, height + 0.2)
    ax.set_position([0, 0, 1, 1])  # the axes fill the figure, so one data unit is one inch
    ax.set_xlim(-0.1, width + 0.1)
    ax.set_ylim(-height - 0.1, 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig, ax
