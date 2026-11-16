"""Charts the P6 human-geography families share (P6 geography): bar charts, grouped bars, line graphs and pie charts
drawn as a geography textbook prints them, with every value asked on a gridline, a title, axis titles with units, and
any rule a question uses printed between the title and the chart.

Every bar is a Rectangle with the gid "bar:<series>:<i>", every plotted line has the gid "line:<series>", every pie
slice is a Wedge with the gid "slice:<i>", and gridlines are drawn behind them (their gid starts "grid"), so a test can
read the drawing back.
"""
from __future__ import annotations

import math
import textwrap

from matplotlib.patches import Rectangle, Wedge

from ..core import GRID, INK, new_figure

# Fills that print apart in black and white too (light to dark), for the series and slices.
SHADES = ["#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#b07aa1", "#9c755f", "#76b7b2", "#edc948"]
HATCH = ["", "//", "..", "xx", "\\\\", "oo", "--", "++"]


def ceil_to(v: float, step: float) -> float:
    return step * math.ceil(v / step - 1e-9)


def fr(n) -> str:
    """A number as the figure prints it: thousands set apart by a space, decimals kept ("12 500", "2.5")."""
    if float(n).is_integer():
        return f"{int(n):,}".replace(",", " ")
    return f"{n}"


def head(ax, title: str, notes=()) -> None:
    """The title above the chart, and the notes (a rule, a key fact) between the title and the plot, in points from
    the plot's top so they never run into it whatever the figure's size."""
    k = len(notes)
    for i, note in enumerate(notes):
        ax.annotate(note, xy=(0.5, 1.0), xycoords="axes fraction", xytext=(0, 8 + 15 * (k - 1 - i)),
                    textcoords="offset points", ha="center", va="bottom", fontsize=9.5, gid=f"note:{i}")
    ax.annotate(title, xy=(0.5, 1.0), xycoords="axes fraction", xytext=(0, 12 + 15 * k), textcoords="offset points",
                ha="center", va="bottom", fontsize=12, fontweight="bold", gid="title")


def value_axis(ax, top: float, major: float, minor: float | None = None, label: str = "", fmt=fr,
               bottom: float = 0) -> None:
    """The value axis from `bottom` (0 unless a graph starts higher) to `top`, numbered every `major`, with a gridline
    on every `minor` (or `major`)."""
    minor = minor or major
    n = int(round((top - bottom) / minor))
    every = int(round(major / minor))
    for k in range(n + 1):
        v = bottom + k * minor
        ax.plot([ax.get_xlim()[0], ax.get_xlim()[1]], [v, v], color=GRID, linewidth=0.9 if k % every == 0 else 0.6,
                zorder=0.5, gid=f"grid:{k}")
    ticks = [bottom + k * major for k in range(int(round((top - bottom) / major)) + 1)]
    ax.set_yticks(ticks, [fmt(t) for t in ticks])
    ax.set_ylim(bottom, top)
    ax.set_ylabel(label, fontsize=10.5)
    ax.tick_params(axis="y", labelsize=9.5)


def wrap(name: str, width: int = 12) -> str:
    """A category name broken into lines of about `width` characters; a name that already holds its own line breaks
    keeps them."""
    if "\n" in name:
        return name
    return "\n".join(textwrap.wrap(name, width, break_on_hyphens=False)) or name


def bar_chart(cats, vals, *, top, major, minor=None, ylabel, xlabel="", title, notes=(), color=SHADES[0],
              size=(7.6, 4.8), wrap_at=12, bar_width=0.6):
    """One bar for each category, every bar a Rectangle with the gid "bar:0:<i>"."""
    fig, ax = new_figure(*size)
    n = len(cats)
    ax.set_xlim(-0.6, n - 0.4)
    value_axis(ax, top, major, minor, ylabel)
    for i, v in enumerate(vals):
        ax.add_patch(Rectangle((i - bar_width / 2, 0), bar_width, v, facecolor=color, edgecolor=INK, linewidth=1.0,
                               zorder=3, gid=f"bar:0:{i}"))
    ax.set_xticks(range(n), [wrap(c, wrap_at) for c in cats])
    ax.tick_params(axis="x", labelsize=9.5, length=0)
    if xlabel:
        ax.set_xlabel(xlabel, fontsize=10.5)
    head(ax, title, notes)
    return fig, ax


def grouped_bars(cats, series: dict, *, top, major, minor=None, ylabel, xlabel="", title, notes=(), size=(8.0, 5.0),
                 wrap_at=12, colors=None, legend_title=""):
    """Bars side by side in each category, one series a colour (gid "bar:<series>:<i>"), with a key above the plot's
    right corner."""
    fig, ax = new_figure(*size)
    n, m = len(cats), len(series)
    width = 0.8 / m
    ax.set_xlim(-0.6, n - 0.4)
    value_axis(ax, top, major, minor, ylabel)
    colors = colors or SHADES
    for s, (name, vals) in enumerate(series.items()):
        for i, v in enumerate(vals):
            x = i - 0.4 + width * s
            ax.add_patch(Rectangle((x + 0.03, 0), width - 0.06, v, facecolor=colors[s], edgecolor=INK, linewidth=0.9,
                                   hatch=HATCH[s], zorder=3, gid=f"bar:{s}:{i}"))
    ax.set_xticks(range(n), [wrap(c, wrap_at) for c in cats])
    ax.tick_params(axis="x", labelsize=9.5, length=0)
    if xlabel:
        ax.set_xlabel(xlabel, fontsize=10.5)
    key(fig, ax, [(name, colors[s], HATCH[s]) for s, name in enumerate(series)], legend_title)
    head(ax, title, notes)
    return fig, ax


def key(fig, ax, entries, title: str = "") -> None:
    """A key to the right of the plot: a swatch and the series' name for each entry."""
    rows = ([title] if title else []) + [e[0] for e in entries]
    for r, text in enumerate(rows):
        y = 1.0 - 0.075 * r
        if title and r == 0:
            ax.text(1.03, y, text, transform=ax.transAxes, ha="left", va="top", fontsize=9.5, fontweight="bold",
                    gid="key:title")
            continue
        name, color, hatch = entries[r - (1 if title else 0)]
        ax.add_patch(Rectangle((1.03, y - 0.045), 0.035, 0.04, transform=ax.transAxes, clip_on=False, facecolor=color,
                               edgecolor=INK, linewidth=0.8, hatch=hatch, gid=f"swatch:{name}"))
        ax.text(1.08, y - 0.025, name, transform=ax.transAxes, ha="left", va="center", fontsize=9.5, gid=f"key:{name}")


def line_chart(xs, series: dict, *, top, major, minor=None, ylabel, xlabel, title, notes=(), size=(8.0, 4.8),
               colors=None, markers=("o", "s", "^", "D"), xlabels=None, extra=None, bottom=0):
    """One line for each series through its points (gid "line:<name>"), a gridline under every x value too, so every
    point sits on a crossing of gridlines. With more than one series a key names them."""
    fig, ax = new_figure(*size)
    n = len(xs)
    ax.set_xlim(-0.5, n - 0.5)
    value_axis(ax, top, major, minor, ylabel, bottom=bottom)
    for i in range(n):
        ax.plot([i, i], [bottom, top], color=GRID, linewidth=0.6, zorder=0.5, gid=f"grid:x{i}")
    colors = colors or ["#1f5f9e", "#c0392b", "#2e7d32", "#7d3c98"]
    for s, (name, vals) in enumerate(series.items()):
        ax.plot(range(n), vals, color=colors[s], linewidth=2.0, marker=markers[s], markersize=6,
                markerfacecolor="white", markeredgewidth=1.6, zorder=4, gid=f"line:{name}")
    if extra:
        extra(ax)
    ax.set_xticks(range(n), [str(x) for x in (xlabels or xs)])
    ax.tick_params(axis="x", labelsize=9.5)
    ax.set_xlabel(xlabel, fontsize=10.5)
    if len(series) > 1:
        key(fig, ax, [(name, colors[s], "") for s, name in enumerate(series)])
    head(ax, title, notes)
    return fig, ax


def pie_chart(parts, *, title, notes=(), size=(8.0, 4.8), colors=None, show_pct=True, legend_title=""):
    """A pie chart of (name, percent) parts, drawn clockwise from 12 o'clock, each slice a Wedge with the gid
    "slice:<i>", its percentage printed in the slice when `show_pct`, and a key to the right naming every slice."""
    fig, ax = new_figure(*size)
    colors = colors or SHADES
    start = 90.0
    for i, (name, pct) in enumerate(parts):
        sweep = 360.0 * pct / 100
        w = Wedge((0, 0), 1.0, start - sweep, start, facecolor=colors[i], edgecolor=INK, linewidth=1.0,
                  hatch=HATCH[i], zorder=3, gid=f"slice:{i}")
        ax.add_patch(w)
        if show_pct:
            mid = math.radians(start - sweep / 2)
            r = 0.64 if pct >= 12 else 0.72
            ax.text(r * math.cos(mid), r * math.sin(mid), f"{fr(pct)}%", ha="center", va="center", fontsize=9.5,
                    fontweight="bold", zorder=5, gid=f"pct:{i}",
                    bbox=dict(boxstyle="round,pad=0.15", facecolor="white", edgecolor="none", alpha=0.9))
        start -= sweep
    ax.set_xlim(-1.08, 1.08)
    ax.set_ylim(-1.08, 1.08)
    ax.set_aspect("equal")
    ax.axis("off")
    rows = ([legend_title] if legend_title else []) + [p[0] for p in parts]
    for r, text in enumerate(rows):
        y = 0.93 - 0.11 * r
        if legend_title and r == 0:
            ax.text(1.06, y, text, transform=ax.transAxes, ha="left", va="center", fontsize=10, fontweight="bold",
                    gid="key:title")
            continue
        i = r - (1 if legend_title else 0)
        ax.add_patch(Rectangle((1.06, y - 0.03), 0.06, 0.06, transform=ax.transAxes, clip_on=False, facecolor=colors[i],
                               edgecolor=INK, linewidth=0.8, hatch=HATCH[i], gid=f"swatch:{i}"))
        ax.text(1.15, y, parts[i][0], transform=ax.transAxes, ha="left", va="center", fontsize=10, gid=f"key:{i}")
    head(ax, title, notes)
    return fig, ax


# --- answers: the forms a student may fairly write ----------------------------------------------------------------

def num_forms(n, *units: str) -> list[str]:
    """A number with and without its thousands set apart, bare and with each unit: "1500", "1 500", "1,500 tonnes"."""
    s = f"{n}" if not float(n).is_integer() else str(int(n))
    bases = [s]
    if float(n).is_integer() and abs(n) >= 1000:
        bases += [f"{int(n):,}", f"{int(n):,}".replace(",", " ")]
    if s.startswith("-"):
        bases += [b.replace("-", "−", 1) for b in bases]
    if s.startswith("0."):
        bases.append(s[1:])
    out = list(bases)
    for u in units:
        for b in bases:
            for f in (f"{b} {u}", f"{b}{u}"):
                if f not in out:
                    out.append(f)
    return out


def pct_forms(n) -> list[str]:
    return num_forms(n, "%", "percent", "per cent")
