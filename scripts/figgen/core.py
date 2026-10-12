"""Shared pieces for drawn figures: one exam-paper style, question records, rendering.

Every family draws with matplotlib in the same plain style, so figures look
like they came from one paper, and computes its own answers from the numbers
it drew.
"""
from __future__ import annotations

import io
import random
import re
from dataclasses import dataclass, field
from fractions import Fraction

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

INK = "#111111"
# Names learners in Rwanda know, for the people in questions; twenty, so stems rarely repeat.
NAMES = ["Aline", "Eric", "Grace", "Uwase", "Mugisha", "Divine", "Kevin", "Keza", "Jean", "Ange", "Teta", "Ishimwe",
         "Nshuti", "Mutoni", "Gasana", "Ingabire", "Kalisa", "Umutoni", "Habimana", "Iradukunda"]
GRID = "#c8c8c8"
FILL = "#9aa4ad"
FILL_2 = "#d6dade"

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 11,
    "axes.edgecolor": INK,
    "axes.labelcolor": INK,
    "xtick.color": INK,
    "ytick.color": INK,
    "text.color": INK,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.linewidth": 1.0,
    "lines.linewidth": 1.6,
    "svg.fonttype": "path",
    "savefig.dpi": 150,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
})


@dataclass
class Question:
    kind: str  # "mcq" or "short"
    stem: str
    answer: str  # mcq: index of the correct option; short: the canonical answer
    options: list[str] = field(default_factory=list)
    accepted: list[str] = field(default_factory=list)
    explanation: str = ""
    tolerance: float = 0  # a reading from a curve: how far from the key is still right; 0 is exact


@dataclass
class Rendered:
    svg: str
    png: bytes


def new_figure(width: float = 6.4, height: float = 4.2):
    fig, ax = plt.subplots(figsize=(width, height))
    return fig, ax


def render(fig) -> Rendered:
    """The figure as SVG (served) and PNG (for review), then closed."""
    svg = io.StringIO()
    fig.savefig(svg, format="svg", bbox_inches="tight")
    png = io.BytesIO()
    fig.savefig(png, format="png", bbox_inches="tight")
    plt.close(fig)
    return Rendered(svg.getvalue(), png.getvalue())


def num(x) -> str:
    """A number as a student writes it: 12, 2.5, -3; no trailing zeros."""
    if isinstance(x, Fraction):
        x = float(x)
    if float(x).is_integer():
        return str(int(x))
    return f"{x:.2f}".rstrip("0").rstrip(".")


def frac(f: Fraction) -> str:
    return str(f.numerator) if f.denominator == 1 else f"{f.numerator}/{f.denominator}"


# "1 books" reads as a slip: one of a thing is singular.
SINGULAR = {"brothers and sisters": "brother or sister", "people": "person", "mangoes": "mango", "books": "book", "hours": "hour",
            "years": "year", "students": "student", "eggs": "egg", "patients": "patient", "bottles": "bottle", "trees": "tree",
            "goals": "goal", "cars": "car", "days": "day"}
_ONE = re.compile(r"(?<![\d.,/])1 (" + "|".join(sorted(SINGULAR, key=len, reverse=True)) + r")\b")


def one(stem: str) -> str:
    return _ONE.sub(lambda m: "1 " + SINGULAR[m.group(1)], stem)


def mcq(stem: str, correct: str, distractors, rng: random.Random, explanation: str = "") -> Question:
    """Four options at most, the correct one always present, no repeats."""
    seen: list[str] = []
    for d in distractors:
        if d != correct and d not in seen:
            seen.append(d)
    options = [correct, *seen[:3]]
    rng.shuffle(options)
    return Question("mcq", one(stem), str(options.index(correct)), options, [], explanation)


def short(stem: str, answer, accepted=(), explanation: str = "", tolerance: float = 0) -> Question:
    """An exact short answer, with every form a student might fairly write."""
    canonical = str(answer)
    forms = [canonical]
    for a in accepted:
        if str(a) not in forms:
            forms.append(str(a))
    # "8.0" to 1 decimal place is also the whole number 8, and a student may write it so.
    for f in list(forms):
        m = re.fullmatch(r"(-?\d+)\.0(\D*)", f)
        if m and m.group(1) + m.group(2) not in forms:
            forms.append(m.group(1) + m.group(2))
    # "55kg" for "55 kg": students drop the space before a unit symbol.
    for f in list(forms):
        m = re.fullmatch(r"(-?[\d.,/]+) (cm|mm|m|km|kg|g|cm²|cm2|m²|m2|cm³|cm3|m³|m3|°C)", f)
        if m and m.group(1) + m.group(2) not in forms:
            forms.append(m.group(1) + m.group(2))
    return Question("short", one(stem), canonical, [], forms, explanation, tolerance)


def label_spot(poly, centre_first: bool = True) -> tuple[float, float]:
    """Where to print a label inside a polygon on a coordinate grid: the middle of a grid square
    inside it, as far from the axes (and their numbers) as it can be, near the middle of the shape."""
    from matplotlib.path import Path
    path = Path(poly)
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    cells = [(x + 0.5, y + 0.5) for x in range(int(min(xs)) - 1, int(max(xs)) + 1) for y in range(int(min(ys)) - 1, int(max(ys)) + 1)
             if path.contains_point((x + 0.5, y + 0.5))]
    if not cells:
        return cx, cy
    clear = [c for c in cells if min(abs(c[0]), abs(c[1])) >= 1.5] or [c for c in cells if min(abs(c[0]), abs(c[1])) >= 1] or cells
    return min(clear, key=lambda c: (c[0] - cx) ** 2 + (c[1] - cy) ** 2)


def count(stem: str, n: int, *nouns: str, explanation: str = "") -> Question:
    """A count, accepted bare or with its noun ("15", "15 eggs", and "1 egg" for one)."""
    forms = []
    for noun in nouns:
        forms.append(f"{n} {noun}")
        if n == 1 and noun.endswith("s"):
            forms.append(f"{n} {noun[:-1]}")
    return short(stem, n, forms, explanation)


def money(n: int) -> list[str]:
    """An amount of Rwandan francs in every form a student may fairly write: "1500", "1,500", "1 500",
    with or without "Frw", "RWF" or "francs". The bare number first, as the key."""
    bases = [str(n)] + ([f"{n:,}", f"{n:,}".replace(",", " ")] if n >= 1000 else [])
    forms = []
    for suffix in ("", " Frw", "Frw", " RWF", "RWF", " francs"):
        for b in bases:
            if b + suffix not in forms:
                forms.append(b + suffix)
    return forms


def infinite(lines):
    """Marks lines that stand for whole straight lines (a graph of y = mx + c, a boundary, a tangent):
    they are drawn to the frame's edge and cut there on purpose."""
    for ln in lines:
        ln.figgen_infinite = True
    return lines


def function_axes(ax, x0: int, x1: int, y0: int, y1: int, ystep: int = 1, xstep: int = 1) -> None:
    """The coordinate grid the function graphs share: axes through the origin, a gridline on every
    unit so each lattice point reads exactly, numbers every `xstep` and `ystep`."""
    ax.set_xticks([x for x in range(x0, x1 + 1) if x % xstep == 0])
    ax.set_yticks([y for y in range(y0, y1 + 1) if y % ystep == 0])
    ax.set_xticks(range(x0, x1 + 1), minor=True)
    ax.set_yticks(range(y0, y1 + 1), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    for s in ("left", "bottom"):
        ax.spines[s].set_position("zero")
    ax.set_xlim(x0 - 0.5, x1 + 0.5)
    ax.set_ylim(y0 - 0.5, y1 + 0.5)
    ax.tick_params(labelsize=8)


def grid_y(ax, top: float, step: float) -> None:
    """Horizontal gridlines on every labelled step, so values read exactly."""
    ticks = [i * step for i in range(int(round(top / step)) + 1)]
    ax.set_yticks(ticks)
    ax.set_ylim(0, top)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
