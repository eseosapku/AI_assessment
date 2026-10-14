"""An object measured against a centimetre ruler with millimetre marks (Primary, Lower Secondary).

Both ends of the object sit on millimetre marks, with dashed guide lines down to the ruler,
so its length reads exactly. At Lower Secondary it need not start at 0.
"""
from __future__ import annotations

import random

from matplotlib.patches import FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, new_figure, short

ID = "ruler"
KIND = "maths.measure"
SUBJECT = "mathematics"
BANDS = ("P", "LS")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "length-measurement", "lines-drawing-measuring", "measurement-general", "unit-conversion-length",
    "length-capacity-mass-revision",
))
AVOID = r"substituting into expressions|^introduction$|litre|capacity|kilogram|^mass|mass measurements|^angles$"  # topics that teach none of it, read section by section

# Objects the drawing looks like: a pencil, a crayon and a nail have their own shapes; the rest are
# plain strips, which a toothbrush or a key is not.
DRAWN = ["pencil", "crayon", "nail", "piece of chalk", "stick", "drinking straw", "strip of paper", "ribbon"]
OBJECTS = DRAWN


def _cm(mm: int) -> str:
    return str(mm // 10) if mm % 10 == 0 else f"{mm / 10:g}"


def _forms(mm: int) -> list[str]:
    cm = _cm(mm)
    return [cm, f"{cm} cm", f"{cm}cm", f"{mm} mm", f"{mm}mm"]


def stages(p: dict) -> tuple[int, int] | None:
    """Whole centimetres from Stage 2; parts of a centimetre, written as decimals, from Stage 4."""
    if p["band"] != "P":
        return None
    length = p["end"] - p["start"]
    return (2, 6) if length % 10 == 0 else (4, 6)  # parts of a centimetre come with decimals


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    obj = rng.choice(OBJECTS)
    if band == "P":
        start = rng.choice([0, 0, 0, 10, 20])  # from 0, or from a whole centimetre at the later stages
        # Whole centimetres first, then half centimetres, then millimetres, as the stages go.
        length = rng.choice([10 * rng.randint(2, 12), 10 * rng.randint(2, 12), 5 * rng.randint(4, 24), rng.randint(20, 120)])
    else:
        start = rng.randint(3, 40)
        length = rng.randint(25, 105)
    return {"band": band, "name": rng.choice(NAMES), "object": obj, "start": start, "end": min(150, start + length)}


def _object(ax, kind: str, x0: float, x1: float, y: float) -> None:
    """The object between x0 and x1 (cm), drawn plainly so its two ends are clear."""
    h = 0.32
    if kind in ("pencil", "crayon"):
        tip = min(1.0, (x1 - x0) * 0.2)
        ax.add_patch(Rectangle((x0, y - h / 2), x1 - x0 - tip, h, facecolor=FILL if kind == "pencil" else FILL_2,
                               edgecolor=INK, linewidth=1.2))
        ax.add_patch(Polygon([(x1 - tip, y - h / 2), (x1, y), (x1 - tip, y + h / 2)], closed=True, facecolor="white",
                             edgecolor=INK, linewidth=1.2))
    elif kind == "nail":
        ax.add_patch(Rectangle((x0, y - 0.25), 0.18, 0.5, facecolor=FILL, edgecolor=INK, linewidth=1.2))
        ax.add_patch(Polygon([(x0 + 0.18, y - 0.07), (x1 - 0.4, y - 0.07), (x1, y), (x1 - 0.4, y + 0.07), (x0 + 0.18, y + 0.07)],
                             closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.2))
    else:
        ax.add_patch(FancyBboxPatch((x0, y - h / 2), x1 - x0, h, boxstyle="round,pad=0,rounding_size=0.12",
                                    facecolor=FILL_2 if kind != "eraser" else "white", edgecolor=INK, linewidth=1.2))


def draw(p: dict):
    # Only as much ruler as the object needs, so the millimetres are as large as they can be.
    span = min(15, max(8, p["end"] // 10 + 2))
    fig, ax = new_figure(0.62 * span + 1.2, 2.4)
    ax.add_patch(Rectangle((-0.4, -1.1), span + 1.4, 1.1, facecolor="white", edgecolor=INK, linewidth=1.2))
    for mm in range(0, 10 * span + 1):
        x = mm / 10
        h = 0.45 if mm % 10 == 0 else 0.3 if mm % 5 == 0 else 0.18
        ax.plot([x, x], [0, -h], color=INK, linewidth=1.0 if mm % 10 == 0 else 0.6)
        if mm % 10 == 0:
            ax.text(x, -0.75, str(mm // 10), ha="center", va="center", fontsize=10)
    ax.text(span + 0.6, -0.75, "cm", ha="center", va="center", fontsize=10)
    x0, x1 = p["start"] / 10, p["end"] / 10
    _object(ax, p["object"], x0, x1, 0.75)
    for x in (x0, x1):
        ax.plot([x, x], [0.75, 0], color=INK, linewidth=0.8, linestyle=(0, (3, 2)))
    ax.set_xlim(-0.6, span + 1.2)
    ax.set_ylim(-1.2, 1.15)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    length, name, obj = p["end"] - p["start"], p["name"], p["object"]
    qs = [short(f"{name} measures a {obj} with a ruler. How long is it?", _cm(length), _forms(length))]
    k = rng.randint(1, max(1, (length - 1) // 10))
    diff = length - 10 * k
    qs.append(short(f"How much longer than {k} cm is {name}'s {obj}? Give your answer in centimetres.", _cm(diff), _forms(diff)))
    if p["band"] == "LS":
        qs.append(short(f"What is the length of {name}'s {obj} in millimetres?", str(length), [f"{length} mm", f"{length}mm"]))
    return qs
