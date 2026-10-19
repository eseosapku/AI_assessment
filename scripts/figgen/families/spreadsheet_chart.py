"""A spreadsheet's data and the chart made from it (LS, UP; AS Level by name), of three kinds.

- parts: a data table in a spreadsheet (column letters, row numbers) beside the chart made from it, drawn as a
  spreadsheet draws it: a column, bar or line chart (one or two series, gridlines, a title, both axis titles and a
  legend) or a pie chart (a title, a legend and data labels). Four parts of a column, bar or line chart are lettered
  P to S (the chart title, the legend, the vertical axis title, the horizontal axis title); three of a pie chart (the
  chart title, the legend, a data label). One cell of the table is covered by "?". Which letter points to a named
  part; what the covered cell holds, read off the chart (a value on a gridline, or a pie's data label); which
  category has the largest value of a series (never a near tie).
- which: a table and four small column charts lettered A to D; one shows the table, one has two bars swapped, one has
  a bar two gridlines out, one shows the values in reverse order. Which chart shows the table, and which category the
  chart with one wrong bar draws wrongly.
- sort: a table of students (name, class, mark) and a Sort or a Filter box as a spreadsheet shows it (sort by a
  column, largest to smallest or A to Z; or show only one class, or marks above or below a number). Which name is in
  A2 after the sort and in which row a named student ends; how many rows the filter shows and which name it hides.

Every key is the table sorted, filtered or compared in code; every value asked is printed or on a gridline.
"""
from __future__ import annotations

import math
import random

from matplotlib.font_manager import FontProperties
from matplotlib.patches import Circle, Polygon, Rectangle, Wedge
from matplotlib.textpath import TextPath

from ..core import FILL_2, GRID, INK, NAMES, Question, new_figure, short

ID = "spreadsheet_chart"
KIND = "graph.bar"
SUBJECT = "computing"
BANDS = ("LS", "UP")
# The AS Level IT chapters named "Spreadsheets" draw the same charts from a spreadsheet's data.
ALSO_BANDS = {"UP": ("AL",)}
CHART = tuple(f"computing.{c}" for c in ("charts-graphs", "chart-labeling", "data-labels", "data-presentation",
                                         "microsoft-excel"))
SORT = tuple(f"computing.{c}" for c in ("data-manipulation", "data-analysis", "data-presentation", "microsoft-excel"))
CONCEPTS = tuple(dict.fromkeys(CHART + SORT))
# A topic whose sections the book lists is reached only if its name or a section names charts, graphs, a
# spreadsheet or worksheet, sorting or filtering, or presenting data; an AS Level topic only if its name does.
NEEDS = (r"\bcharts?\b|\bgraphs?\b|spreadsheet|worksheet|\bsort|filter|data organi[sz]ation|present(ing)? data|"
         r"excel|google sheet|data model")
# Databases sort and present data in reports; presentations, documents and graphics hold charts without a sheet.
AVOID = (r"database|access|python|flowchart|power ?point|^presentations?$|presentation software|word process|graphic|"
         r"project|\bgis\b|arcgis|mail merge|\bAI\b|artificial|algorithm|export|^data$|data management")

SERIES_COLOURS = ["#4472c4", "#ed7d31"]
PIE_COLOURS = ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#70ad47"]
LETTERS = "PQRS"
CONTEXTS = {
    "rain": {"title": "Rainfall in Musanze", "about": "rainfall in Musanze", "head": "Month",
             "cats": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], "one": ["Rainfall (mm)"], "two": ["2024", "2025"],
             "ytitle": "Rainfall (mm)", "step": 20, "noun": "month"},
    "clubs": {"title": "Students in school clubs", "about": "students in school clubs", "head": "Club",
              "cats": ["Football", "Music", "Science", "Art", "Debate"], "one": ["Students"], "two": ["Boys", "Girls"],
              "ytitle": "Number of students", "step": 5, "noun": "club"},
    "fruit": {"title": "Fruit sold at Kimironko market", "about": "fruit sold at Kimironko market", "head": "Day",
              "cats": ["Mon", "Tue", "Wed", "Thu", "Fri"], "one": ["Bananas"], "two": ["Bananas", "Mangoes"],
              "ytitle": "Number sold", "step": 10, "noun": "day"},
    "visitors": {"title": "Visitors to a Rubavu hotel", "about": "visitors to a Rubavu hotel", "head": "Month",
                 "cats": ["Jun", "Jul", "Aug", "Sep", "Oct"], "one": ["Visitors"], "two": ["2024", "2025"],
                 "ytitle": "Number of visitors", "step": 50, "noun": "month"},
    "travel": {"title": "How students travel to school", "about": "how students travel to school", "head": "Way",
               "cats": ["Walk", "Bus", "Moto", "Car", "Bicycle"], "one": ["Students"], "two": ["Boys", "Girls"],
               "ytitle": "Number of students", "step": 5, "noun": "way of travelling"},
}
# A pie shows the parts of one whole: students in clubs, ways to school, a week's sales.
PIE_CONTEXTS = ["clubs", "travel", "fruit"]
FULL = {"Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April", "May": "May", "Jun": "June", "Jul": "July",
        "Aug": "August", "Sep": "September", "Oct": "October", "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday",
        "Thu": "Thursday", "Fri": "Friday"}
PARTS = ["chart title", "legend", "vertical axis title", "horizontal axis title"]
PIE_PARTS = ["chart title", "legend", "data label"]
CLASSES = ["S1", "S2", "S3"]


def concepts_for(p: dict) -> tuple[str, ...]:
    return SORT if p["sub"] == "sort" else CHART


# --- sampling ---------------------------------------------------------------------------------------

def _sample_parts(rng: random.Random, band: str) -> dict:
    kind = rng.choice(["column", "column", "bar", "line", "pie"])
    ctx = rng.choice(PIE_CONTEXTS if kind == "pie" else list(CONTEXTS))
    c = CONTEXTS[ctx]
    step = c["step"]
    while True:
        n = rng.randint(4, 5)
        start = rng.randint(0, len(c["cats"]) - n)
        cats = c["cats"][start:start + n]
        names = c["one"] if kind == "pie" or rng.random() < 0.5 else c["two"]
        lo = 2 if kind == "pie" else 1
        series = [[step * rng.randint(lo, 8) for _ in cats] for _ in names]
        if kind == "line" and len(names) == 2 and any(a == b for a, b in zip(*series)):
            continue  # two lines never meet on a point, so no marker hides another
        if kind == "pie":
            total = sum(series[0])
            if min(series[0]) * 10 < total or len(set(series[0])) < len(cats):
                continue
        s = rng.randrange(len(names))
        top = sorted(series[s], reverse=True)
        if top[0] - top[1] < step:  # the largest is clear by a gridline
            continue
        cover = [rng.randrange(len(names)), rng.randrange(n)]
        parts = PIE_PARTS if kind == "pie" else PARTS
        letters = list(LETTERS[:len(parts)])
        rng.shuffle(letters)
        p = {"band": band, "sub": "parts", "kind": kind, "context": ctx, "cats": cats, "names": names,
             "series": series, "cover": cover, "most": s, "letters": dict(zip(parts, letters)),
             "ask": rng.choice(parts)}
        if kind == "pie":
            p["pointed"] = _pie_label_slice(series[0], rng)
            if p["pointed"] is None:
                continue
        return p


def _pie_angles(values: list) -> list:
    """Each slice's start and end angle, clockwise from the top, as a spreadsheet draws a pie."""
    total = sum(values)
    out, a = [], 90.0
    for v in values:
        b = a - 360.0 * v / total
        out.append((b, a))
        a = b
    return out


def _pie_label_slice(values: list, rng: random.Random):
    """A slice on the left of the pie, whose data label a letter can point to from the left."""
    left = [i for i, (b, a) in enumerate(_pie_angles(values)) if math.cos(math.radians((a + b) / 2)) < -0.85]
    return rng.choice(left) if left else None


def _sample_which(rng: random.Random, band: str) -> dict:
    ctx = rng.choice(["rain", "fruit", "visitors"])
    c = CONTEXTS[ctx]
    step = c["step"]
    while True:
        n = rng.randint(4, 5)
        start = rng.randint(0, len(c["cats"]) - n)
        cats = c["cats"][start:start + n]
        vals = [step * rng.randint(1, 7) for _ in cats]
        if len(set(vals)) < n:  # every bar its own height, so each wrong chart shows plainly
            continue
        i, j = rng.sample(range(n), 2)
        if abs(vals[i] - vals[j]) < 2 * step:
            continue
        swapped = list(vals)
        swapped[i], swapped[j] = vals[j], vals[i]
        k = rng.randrange(n)
        off = list(vals)
        off[k] = vals[k] + rng.choice([-2, 2]) * step
        if off[k] < step:
            off[k] = vals[k] + 2 * step
        rev = vals[::-1]
        charts = [vals, swapped, off, rev]
        if len({tuple(x) for x in charts}) < 4:
            continue
        order = ["true", "swap", "off", "reverse"]
        rng.shuffle(order)
        drawn = {"true": vals, "swap": swapped, "off": off, "reverse": rev}
        return {"band": band, "sub": "which", "context": ctx, "cats": cats, "values": vals,
                "charts": [drawn[o] for o in order], "kinds": order, "wrong": k}


def _sample_sort(rng: random.Random, band: str) -> dict:
    while True:
        n = rng.randint(5, 6)
        people = rng.sample(NAMES, n)
        marks = rng.sample(range(25, 99), n)
        classes = [rng.choice(CLASSES) for _ in range(n)]
        rows = [[a, b, c] for a, b, c in zip(people, classes, marks)]
        mode = rng.choice(["sort", "sort", "filter"])
        if mode == "sort":
            by = rng.choice(["Name", "Mark"])
            way = rng.choice(["up", "down"])
            p = {"band": band, "sub": "sort", "mode": "sort", "rows": rows, "by": by, "way": way}
            after = sort_rows(p)
            # the student asked about moves, and is not the one who ends in A2: the two questions ask different facts
            moved = [r[0] for i, r in enumerate(after) if rows[i][0] != r[0] and i > 0]
            if after[0][0] == rows[0][0] or not moved:
                continue
            p["ask"] = rng.choice(moved)
            return p
        if rng.random() < 0.5:
            rule = ["Class", "=", rng.choice(classes)]
        else:
            rule = ["Mark", rng.choice([">", "<"]), rng.choice(range(30, 95, 5))]
        p = {"band": band, "sub": "sort", "mode": "filter", "rows": rows, "rule": rule}
        shown = filter_rows(p)
        if 3 <= len(shown) <= n - 1 and all(m != rule[2] for m in marks):
            hidden = [r[0] for r in rows if r not in shown]
            p["hidden"] = rng.choice(hidden)
            p["others"] = rng.sample([r[0] for r in shown], 3)
            return p


def sort_rows(p: dict) -> list:
    col = {"Name": 0, "Mark": 2}[p["by"]]
    return sorted(p["rows"], key=lambda r: r[col], reverse=p["way"] == "down")


def filter_rows(p: dict) -> list:
    field, op, v = p["rule"]
    col = {"Class": 1, "Mark": 2}[field]
    keep = {"=": lambda x: x == v, ">": lambda x: x > v, "<": lambda x: x < v}[op]
    return [r for r in p["rows"] if keep(r[col])]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["parts", "parts", "which", "sort"])
    return {"parts": _sample_parts, "which": _sample_which, "sort": _sample_sort}[sub](rng, band)


# --- drawing helpers --------------------------------------------------------------------------------

def _tw(s: str, fs: float, bold: bool = False) -> float:
    """A text's width in inches (one data unit here is one inch)."""
    return TextPath((0, 0), s, size=fs, prop=FontProperties(family="DejaVu Sans", weight="bold" if bold else "normal")
                    ).get_extents().width / 72


def _arrow(ax, x0, y0, x1, y1, gid=None):
    """A leader from a letter to the part it names, with a small head at the part."""
    ax.plot([x0, x1], [y0, y1], color=INK, linewidth=1.1, gid=gid)
    d = math.hypot(x1 - x0, y1 - y0) or 1
    ux, uy = (x1 - x0) / d, (y1 - y0) / d
    h = 0.12
    ax.add_patch(Polygon([(x1, y1), (x1 - h * ux + 0.05 * uy, y1 - h * uy - 0.05 * ux),
                          (x1 - h * ux - 0.05 * uy, y1 - h * uy + 0.05 * ux)], closed=True, facecolor=INK, edgecolor=INK))


def _letter(ax, x, y, letter, gid=None):
    ax.add_patch(Circle((x, y), 0.2, facecolor="white", edgecolor=INK, linewidth=1.3))
    ax.text(x, y, letter, ha="center", va="center", fontsize=11, fontweight="bold", gid=gid)


def _sheet(ax, x0, ytop, header: list, rows: list, widths: list, covered=None, rh=0.45, arrows=False):
    """A spreadsheet range from A1: column letters across the top, row numbers down the left."""
    xs, x = [], x0 + 0.45
    for w in widths:
        xs.append(x)
        x += w
    ax.add_patch(Rectangle((x0, ytop - rh), 0.45, rh, facecolor="#d9dee3", edgecolor="#777777", linewidth=0.8))
    for c, (cx, w) in enumerate(zip(xs, widths)):
        ax.add_patch(Rectangle((cx, ytop - rh), w, rh, facecolor="#d9dee3", edgecolor="#777777", linewidth=0.8))
        ax.text(cx + w / 2, ytop - rh / 2, "ABCD"[c], ha="center", va="center", fontsize=10, fontweight="bold")
    for r, row in enumerate([header] + rows):
        y = ytop - (r + 2) * rh
        ax.add_patch(Rectangle((x0, y), 0.45, rh, facecolor="#d9dee3", edgecolor="#777777", linewidth=0.8))
        ax.text(x0 + 0.225, y + rh / 2, str(r + 1), ha="center", va="center", fontsize=10, fontweight="bold")
        for c, (cx, w) in enumerate(zip(xs, widths)):
            hidden = covered is not None and (r, c) == covered
            ax.add_patch(Rectangle((cx, y), w, rh, facecolor="#fff6cc" if hidden else "white", edgecolor="#999999",
                                   linewidth=0.8))
            v = "?" if hidden else row[c]
            if r == 0:
                ax.text(cx + 0.08, y + rh / 2, str(v), ha="left", va="center", fontsize=10, fontweight="bold")
                if arrows:  # a filter's drop-down button
                    bx = cx + w - 0.3
                    ax.add_patch(Rectangle((bx, y + 0.07), 0.24, rh - 0.14, facecolor="#eeeeee", edgecolor="#777777",
                                           linewidth=0.7))
                    ax.add_patch(Polygon([(bx + 0.05, y + rh / 2 + 0.05), (bx + 0.19, y + rh / 2 + 0.05),
                                          (bx + 0.12, y + rh / 2 - 0.06)], closed=True, facecolor=INK, edgecolor=INK))
            elif isinstance(v, int):
                ax.text(cx + w - 0.08, y + rh / 2, str(v), ha="right", va="center", fontsize=10)
            else:
                ax.text(cx + (w / 2 if hidden else 0.08), y + rh / 2, str(v), ha="center" if hidden else "left",
                        va="center", fontsize=10, fontweight="bold" if hidden else "normal")
    return x, ytop - (len(rows) + 2) * rh


def _top(values: list, step: int) -> int:
    return step * (max(values) // step + 1)


# --- drawing: parts ---------------------------------------------------------------------------------

def _draw_parts(p: dict):
    c = CONTEXTS[p["context"]]
    cats, names, series, kind = p["cats"], p["names"], p["series"], p["kind"]
    s_cov, c_cov = p["cover"]
    header = [c["head"]] + names
    rows = [[cat] + [series[s][i] for s in range(len(names))] for i, cat in enumerate(cats)]
    widths = [1.3] + [max(1.15, _tw(nm, 10, True) + 0.3) for nm in names]
    CH = 5.0
    tab_w = 0.45 + sum(widths)
    CX0, CW = tab_w + 0.45, 6.7
    W, H = CX0 + CW + 0.1, CH + 0.1
    fig, ax = new_figure(W + 0.1, H + 0.1)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.set_xlim(-0.1, W)
    ax.set_ylim(-0.1, H)
    ax.set_aspect("equal")
    ax.axis("off")
    _, tab_bottom = _sheet(ax, 0, CH, header, rows, widths, covered=(c_cov + 1, s_cov + 1))
    ax.text(0, tab_bottom - 0.3, "? = a value that is covered", ha="left", va="center", fontsize=9.5)
    # the chart object
    ax.add_patch(Rectangle((CX0, 0), CW, CH, facecolor="white", edgecolor="#888888", linewidth=1.0))
    letters = p["letters"]
    title = c["title"]
    tcx, ty = CX0 + CW / 2 - 0.4, CH - 0.38
    ax.text(tcx, ty, title, ha="center", va="center", fontsize=11.5, fontweight="bold", gid="part:chart title")
    tr = tcx + _tw(title, 11.5, True) / 2
    _arrow(ax, tr + 0.5, ty, tr + 0.08, ty)
    _letter(ax, tr + 0.7, ty, letters["chart title"])
    # the legend, at the right
    entries = cats if kind == "pie" else names
    LW = 1.35
    LX0 = CX0 + CW - LW - 0.15
    ly_mid = 2.3
    lh = 0.36 * len(entries) + 0.16
    ly0 = ly_mid - lh / 2
    ax.add_patch(Rectangle((LX0, ly0), LW, lh, facecolor="white", edgecolor="#888888", linewidth=0.8))
    for i, e in enumerate(entries):
        ey = ly0 + lh - 0.08 - 0.36 * (i + 0.5)
        colour = PIE_COLOURS[i] if kind == "pie" else SERIES_COLOURS[i]
        ax.add_patch(Rectangle((LX0 + 0.12, ey - 0.09), 0.18, 0.18, facecolor=colour, edgecolor=INK, linewidth=0.6))
        ax.text(LX0 + 0.4, ey, e, ha="left", va="center", fontsize=9.5)
    _arrow(ax, LX0 + LW / 2, ly0 + lh + 0.32, LX0 + LW / 2, ly0 + lh + 0.06)
    _letter(ax, LX0 + LW / 2, ly0 + lh + 0.52, letters["legend"])
    if kind == "pie":
        _draw_pie(ax, p, CX0, LX0)
        return fig
    # the plot area
    bar = kind == "bar"
    PX0 = CX0 + (1.85 if bar else 1.05)
    PX1 = LX0 - 0.3
    PY0, PY1 = 1.1, CH - 0.95
    step = c["step"]
    top = _top([v for s in series for v in s], step)
    vtitle, htitle = (c["head"], c["ytitle"]) if bar else (c["ytitle"], c["head"])
    n = len(cats)

    def val(v):  # a value's place along the value axis
        return (PX0 + (PX1 - PX0) * v / top) if bar else (PY0 + (PY1 - PY0) * v / top)

    for g in range(0, top + 1, step):
        if bar:
            ax.plot([val(g)] * 2, [PY0, PY1], color=GRID, linewidth=0.8, zorder=1)
            ax.text(val(g), PY0 - 0.2, str(g), ha="center", va="center", fontsize=8.5)
        else:
            ax.plot([PX0, PX1], [val(g)] * 2, color=GRID, linewidth=0.8, zorder=1)
            ax.text(PX0 - 0.08, val(g), str(g), ha="right", va="center", fontsize=8.5)
    ax.plot([PX0, PX0], [PY0, PY1] if bar else [PY0, PY0], color=INK, linewidth=1.0)
    ax.plot([PX0, PX1] if not bar else [PX0, PX0], [PY0, PY0], color=INK, linewidth=1.0)
    span = (PY1 - PY0) if bar else (PX1 - PX0)
    slot = span / n
    k = len(names)
    for i, cat in enumerate(cats):
        mid = (PY1 - slot * (i + 0.5)) if bar else (PX0 + slot * (i + 0.5))
        if bar:
            ax.text(PX0 - 0.08, mid, cat, ha="right", va="center", fontsize=8.5)
        else:
            ax.text(mid, PY0 - 0.2, cat, ha="center", va="center", fontsize=8.5)
        if kind == "line":
            continue
        bw = slot * 0.7 / k
        for s in range(k):
            off = mid - slot * 0.35 + bw * s
            v = series[s][i]
            if bar:
                ax.add_patch(Rectangle((PX0, off), val(v) - PX0, bw, facecolor=SERIES_COLOURS[s], edgecolor=INK,
                                       linewidth=0.6, zorder=2))
            else:
                ax.add_patch(Rectangle((off, PY0), bw, val(v) - PY0, facecolor=SERIES_COLOURS[s], edgecolor=INK,
                                       linewidth=0.6, zorder=2))
    if kind == "line":
        for s in range(k):
            xs = [PX0 + slot * (i + 0.5) for i in range(n)]
            ys = [val(v) for v in series[s]]
            ax.plot(xs, ys, color=SERIES_COLOURS[s], linewidth=2.0, marker="os"[s], markersize=6, zorder=3)
    # axis titles and their letters
    vx, vy = CX0 + 0.3, (PY0 + PY1) / 2
    ax.text(vx, vy, vtitle, ha="center", va="center", rotation=90, fontsize=9.5, gid="part:vertical axis title")
    vbot = vy - _tw(vtitle, 9.5) / 2
    _arrow(ax, vx, vbot - 0.42, vx, vbot - 0.07)
    _letter(ax, vx, vbot - 0.62, letters["vertical axis title"])
    hx, hy = (PX0 + PX1) / 2, 0.38
    ax.text(hx, hy, htitle, ha="center", va="center", fontsize=9.5, gid="part:horizontal axis title")
    hr = hx + _tw(htitle, 9.5) / 2
    _arrow(ax, hr + 0.45, hy, hr + 0.07, hy)
    _letter(ax, hr + 0.65, hy, letters["horizontal axis title"])
    return fig


def _draw_pie(ax, p, CX0, LX0):
    values = p["series"][0]
    cx, cy, r = (CX0 + LX0) / 2 + 0.25, 2.3, 1.45
    for i, (b, a) in enumerate(_pie_angles(values)):
        ax.add_patch(Wedge((cx, cy), r, b, a, facecolor=PIE_COLOURS[i], edgecolor="white", linewidth=1.2))
        m = math.radians((a + b) / 2)
        lx, ly = cx + 0.68 * r * math.cos(m), cy + 0.68 * r * math.sin(m)
        ax.text(lx, ly, str(values[i]), ha="center", va="center", fontsize=10, fontweight="bold", color="white"
                if i in (0, 1) else INK, gid=f"label:{i}")
    i = p["pointed"]
    b, a = _pie_angles(values)[i]
    m = math.radians((a + b) / 2)
    lx, ly = cx + 0.68 * r * math.cos(m), cy + 0.68 * r * math.sin(m)
    ex, ey = cx + 1.32 * r * math.cos(m), cy + 1.32 * r * math.sin(m)
    _arrow(ax, ex - 0.2 * math.cos(m), ey - 0.2 * math.sin(m), lx + 0.3 * math.cos(m), ly + 0.3 * math.sin(m))
    _letter(ax, ex, ey, p["letters"]["data label"])


# --- drawing: which ---------------------------------------------------------------------------------

def _mini(ax, x, y, cats, values, top, step, label):
    w, h = 3.3, 2.5
    ax.add_patch(Rectangle((x, y), w, h, facecolor="white", edgecolor="#888888", linewidth=0.9))
    ax.text(x + 0.1, y + h - 0.2, f"Chart {label}", ha="left", va="center", fontsize=11, fontweight="bold")
    px0, px1, py0, py1 = x + 0.6, x + w - 0.15, y + 0.42, y + h - 0.45
    for g in range(0, top + 1, step):
        yy = py0 + (py1 - py0) * g / top
        ax.plot([px0, px1], [yy, yy], color=GRID, linewidth=0.7, zorder=1)
        ax.text(px0 - 0.06, yy, str(g), ha="right", va="center", fontsize=8)
    ax.plot([px0, px1], [py0, py0], color=INK, linewidth=1.0)
    slot = (px1 - px0) / len(cats)
    for i, (cat, v) in enumerate(zip(cats, values)):
        mid = px0 + slot * (i + 0.5)
        ax.add_patch(Rectangle((mid - slot * 0.3, py0), slot * 0.6, (py1 - py0) * v / top, facecolor=SERIES_COLOURS[0],
                               edgecolor=INK, linewidth=0.6, zorder=2))
        ax.text(mid, py0 - 0.18, cat, ha="center", va="center", fontsize=8)


def _draw_which(p: dict):
    c = CONTEXTS[p["context"]]
    step = c["step"]
    header = [c["head"]] + c["one"]
    rows = [[cat, v] for cat, v in zip(p["cats"], p["values"])]
    widths = [1.15, 1.45]
    tab_w = 0.45 + sum(widths)
    X0 = tab_w + 0.45
    W, H = X0 + 2 * 3.3 + 0.3, 2 * 2.5 + 0.3 + 0.6
    fig, ax = new_figure(W + 0.2, H + 0.2)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.set_xlim(-0.1, W + 0.1)
    ax.set_ylim(-0.1, H + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.text(0, H - 0.25, c["title"], ha="left", va="center", fontsize=11, fontweight="bold")
    _sheet(ax, 0, H - 0.55, header, rows, widths)
    top = _top([v for ch in p["charts"] for v in ch], step)
    for i, (vals, label) in enumerate(zip(p["charts"], "ABCD")):
        col, row = i % 2, i // 2
        _mini(ax, X0 + col * 3.6, (1 - row) * 2.8, p["cats"], vals, top, step, label)
    return fig


# --- drawing: sort and filter -----------------------------------------------------------------------

def _draw_sort(p: dict):
    rows = p["rows"]
    widths = [1.6, 1.0, 1.0]
    tab_w = 0.45 + sum(widths)
    DX = tab_w + 0.5
    DW = 4.2
    W, H = DX + DW + 0.1, 0.45 * (len(rows) + 2) + 0.2
    fig, ax = new_figure(W + 0.2, H + 0.2)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.set_xlim(-0.1, W + 0.1)
    ax.set_ylim(-0.1, H + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    _sheet(ax, 0, H, ["Name", "Class", "Mark"], rows, widths, arrows=p["mode"] == "filter")
    # the dialog box
    lines = dialog_lines(p)
    dh = 0.7 + 0.45 * len(lines)
    dy = H - dh
    ax.add_patch(Rectangle((DX, dy), DW, dh, facecolor="white", edgecolor=INK, linewidth=1.1))
    ax.add_patch(Rectangle((DX, H - 0.45), DW, 0.45, facecolor=FILL_2, edgecolor=INK, linewidth=1.1))
    ax.text(DX + 0.12, H - 0.225, "Sort" if p["mode"] == "sort" else "Filter", ha="left", va="center", fontsize=10.5,
            fontweight="bold")
    for i, (k, v) in enumerate(lines):
        yy = H - 0.45 - 0.35 - 0.45 * i
        ax.text(DX + 0.15, yy, k, ha="left", va="center", fontsize=10)
        ax.add_patch(Rectangle((DX + 1.75, yy - 0.17), DW - 1.9, 0.34, facecolor="white", edgecolor="#777777",
                               linewidth=0.8))
        ax.text(DX + 1.85, yy, v, ha="left", va="center", fontsize=10)
    return fig


def dialog_lines(p: dict) -> list:
    if p["mode"] == "sort":
        order = {("Name", "up"): "A to Z", ("Name", "down"): "Z to A", ("Mark", "up"): "Smallest to Largest",
                 ("Mark", "down"): "Largest to Smallest"}[(p["by"], p["way"])]
        return [("Sort by", f"Column {'A' if p['by'] == 'Name' else 'C'} ({p['by']})"), ("Sort on", "Cell values"),
                ("Order", order)]
    field, op, v = p["rule"]
    if field == "Class":
        return [("Column", "B (Class)"), ("Show rows", f"equals {v}")]
    return [("Column", "C (Mark)"), ("Show rows", f"is {'greater' if op == '>' else 'less'} than {v}")]


def draw(p: dict):
    return {"parts": _draw_parts, "which": _draw_which, "sort": _draw_sort}[p["sub"]](p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in an ICT lesson", "for a class report", "for homework", "at the computer club", "for the school notice board",
            "for a project on Rwanda"]


def _cat_forms(cat: str) -> list:
    forms = [cat, cat.lower()]
    if cat in FULL:
        forms += [FULL[cat], FULL[cat].lower()]
    return forms


def _letters_q(stem: str, key: str, letters: list) -> Question:
    options = sorted(letters)
    return Question("mcq", stem, str(options.index(key)), options)


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["sub"] == "parts":
        c = CONTEXTS[p["context"]]
        cats, names, series = p["cats"], p["names"], p["series"]
        s_cov, c_cov = p["cover"]
        ref = f"{'BC'[s_cov]}{c_cov + 2}"
        v = series[s_cov][c_cov]
        s = p["most"]
        most = cats[max(range(len(cats)), key=lambda i: series[s][i])]
        sname = names[s]
        what = {"pie": "pie chart", "column": "column chart", "bar": "bar chart", "line": "line graph"}[p["kind"]]
        part = p["ask"]
        return [_letters_q(f"{who} made this {what} from the spreadsheet {setting}. Which letter points to the "
                           f"{part}?", p["letters"][part], list(p["letters"].values())),
                short(f"In the spreadsheet beside the {what} of {c['about']}, cell {ref} is covered. "
                      f"Read the chart: what number is in cell {ref}?", v, [str(v)]),
                short(f"In the {what} of {c['about']}, which {c['noun']} has the largest value for {sname}?",
                      most, _cat_forms(most))]
    if p["sub"] == "which":
        c = CONTEXTS[p["context"]]
        key = "ABCD"[p["kinds"].index("true")]
        off = "ABCD"[p["kinds"].index("off")]
        cat = p["cats"][p["wrong"]]
        return [_letters_q(f"{who} drew four charts of {c['about']} {setting}. Which chart shows the data in "
                           f"the spreadsheet correctly?", key, list("ABCD")),
                short(f"Chart {off} of {c['about']} has one bar drawn at the wrong height. Which {c['noun']} "
                      f"is it?", cat, _cat_forms(cat))]
    rows = p["rows"]
    if p["mode"] == "sort":
        after = sort_rows(p)
        name = p["ask"]
        row = next(i for i, r in enumerate(after) if r[0] == name) + 2
        return [short(f"{who} sorts this sheet {setting} with the settings shown, keeping each row together. Which "
                      f"name will be in cell A2 after the sort?", after[0][0], [after[0][0]]),
                short(f"After the sort shown, in which row of the sheet will {name} be?", row, [str(row), f"row {row}"])]
    shown = filter_rows(p)
    options = [p["hidden"]] + p["others"]
    rng.shuffle(options)
    return [short(f"{who} applies the filter shown to this sheet {setting}. How many rows of student data will still "
                  f"show?", len(shown), [str(len(shown)), f"{len(shown)} rows"]),
            Question("mcq", "When the filter shown is applied, which of these students will be hidden?",
                     str(options.index(p["hidden"])), options)]
