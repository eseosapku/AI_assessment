"""A ledger account kept for a whole year (P3y): Dr and Cr sides (or Receipts and Payments), each with Date, Details
and Frw columns, entries dated across the months, and room left at the foot to balance it. Notes the account needs
(a rent a month, what is owing at the year end) are printed under it. Not a family itself."""
from __future__ import annotations

from ..core import GRID, INK
from ._accounts import SHORT_MONTHS, frw, page, rule
from .econ_tables import fit

X0, ROW, DATE_W, AMT_W = 0.12, 0.28, 0.66, 1.0


def ledger(title: str, debits: list, credits: list, *, year: int | None = None, sides=("Dr", "Cr"), notes=(),
           blank_rows: int = 2, subtitle: str | None = None):
    """A T account. With a year, entries are [month, day, details, amount] and dated; without, [details, amount]. The
    month is printed where it changes on a side, as a ledger writes it ("Mar 31", then "31"). A subtitle (the
    period of a receipts and payments account) goes under the title, and the sides' names then on a line of their own."""
    dated = year is not None
    details = [e[-2] for e in debits + credits]
    det_w = fit(*details, "Details", size=10, bold=False, least=1.9, pad=0.25)
    cols = (DATE_W, det_w, AMT_W) if dated else (det_w, AMT_W)
    side = sum(cols)
    rows = max(len(debits), len(credits)) + blank_rows + (1 if dated else 0)
    width = 2 * X0 + 2 * side
    note_h = 0.28 * len(notes) + (0.14 if notes else 0)
    head = 0.42 if subtitle is None else 1.0  # from the top line of text to the T
    height = (rows + 1) * ROW + head + 0.2 + note_h + 0.08
    fig, ax = page(width, height)
    xc = X0 + side
    top = height - 0.12
    ax.text(width / 2, top, title, ha="center", va="top", fontsize=12, fontweight="bold")
    sides_y = top
    if subtitle is not None:
        ax.text(width / 2, top - 0.3, subtitle, ha="center", va="top", fontsize=10.5)
        sides_y = top - 0.64
    ax.text(X0, sides_y, sides[0], ha="left", va="top", fontsize=11, fontweight="bold")
    ax.text(width - X0, sides_y, sides[1], ha="right", va="top", fontsize=11, fontweight="bold")
    t_line = top - head
    bottom = t_line - (rows + 1) * ROW
    for side_x in (X0, xc):
        x = side_x
        for w in cols[:-1]:
            x += w
            ax.plot([x, x], [t_line, bottom], color=GRID, linewidth=0.8)
        y = t_line - ROW / 2
        if dated:
            ax.text(side_x + 0.06, y, "Date", ha="left", va="center", fontsize=9.5, fontweight="bold")
            ax.text(side_x + 0.06, y - ROW, str(year), ha="left", va="center", fontsize=10)
        ax.text(side_x + (DATE_W if dated else 0) + 0.08, y, "Details", ha="left", va="center", fontsize=9.5,
                fontweight="bold")
        ax.text(side_x + side - 0.08, y, "Frw", ha="right", va="center", fontsize=9.5, fontweight="bold")
    rule(ax, X0, width - X0, t_line - ROW, width=0.6, colour="#666666")
    first = 2.5 if dated else 1.5
    for side_x, entries in ((X0, debits), (xc, credits)):
        month = None
        for i, entry in enumerate(entries):
            y = t_line - (i + first) * ROW
            if dated:
                mon, day = entry[0], entry[1]
                ax.text(side_x + 0.06, y, f"{SHORT_MONTHS[mon - 1]} {day}" if mon != month else str(day), ha="left",
                        va="center", fontsize=10)
                month = mon
            amount = entry[-1]
            ax.text(side_x + (DATE_W if dated else 0) + 0.08, y, entry[-2], ha="left", va="center", fontsize=10)
            ax.text(side_x + side - 0.08, y, amount if isinstance(amount, str) else frw(amount), ha="right",
                    va="center", fontsize=10.5 if amount == "?" else 10, fontweight="bold" if amount == "?" else "normal")
    # the T itself
    ax.plot([X0, width - X0], [t_line, t_line], color=INK, linewidth=1.8, solid_capstyle="butt")
    ax.plot([xc, xc], [t_line, bottom], color=INK, linewidth=1.8, solid_capstyle="butt")
    for i, note in enumerate(notes):
        ax.text(X0, bottom - 0.3 - i * 0.28, note, ha="left", va="center", fontsize=10)
    return fig
