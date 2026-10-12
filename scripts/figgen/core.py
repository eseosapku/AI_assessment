"""Shared pieces for drawn figures: one exam-paper style, question records, rendering.

Every family draws with matplotlib in the same plain style, so figures look
like they came from one paper, and computes its own answers from the numbers
it drew.
"""
from __future__ import annotations

import io
import random
from dataclasses import dataclass, field
from fractions import Fraction

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

INK = "#111111"
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


def mcq(stem: str, correct: str, distractors, rng: random.Random, explanation: str = "") -> Question:
    """Four options at most, the correct one always present, no repeats."""
    seen: list[str] = []
    for d in distractors:
        if d != correct and d not in seen:
            seen.append(d)
    options = [correct, *seen[:3]]
    rng.shuffle(options)
    return Question("mcq", stem, str(options.index(correct)), options, [], explanation)


def short(stem: str, answer, accepted=(), explanation: str = "") -> Question:
    """An exact short answer, with every form a student might fairly write."""
    canonical = str(answer)
    forms = [canonical]
    for a in accepted:
        if str(a) not in forms:
            forms.append(str(a))
    return Question("short", stem, canonical, [], forms, explanation)


def grid_y(ax, top: float, step: float) -> None:
    """Horizontal gridlines on every labelled step, so values read exactly."""
    ticks = [i * step for i in range(int(round(top / step)) + 1)]
    ax.set_yticks(ticks)
    ax.set_ylim(0, top)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
