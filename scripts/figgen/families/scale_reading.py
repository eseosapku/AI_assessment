"""A thermometer or measuring cylinder to read. The level is always on a marked division."""
from __future__ import annotations

import random

from matplotlib.patches import Ellipse, Rectangle

from ..core import new_figure, short

ID = "scale_reading"
KIND = "instrument.reading"
SUBJECT = "science"
BANDS = ("P", "LS")

# (instrument, unit, major step, divisions between majors, lowest, highest)
INSTRUMENTS = [
    ("thermometer", "°C", 10, 5, -10, 50),
    ("thermometer", "°C", 10, 10, 0, 50),
    ("measuring cylinder", "cm³", 10, 5, 0, 100),
    ("measuring cylinder", "cm³", 20, 4, 0, 100),
]


def sample(rng: random.Random) -> dict:
    kind, unit, major, divs, lo, hi = rng.choice(INSTRUMENTS)
    minor = major / divs
    n = int((hi - lo) / minor)
    low = -(-n // 6)  # clear of the bottom sixth, where a short column is hard to read
    target = rng.randrange(low, n)
    while target % divs == 0:  # land on an unlabelled division, so the student counts divisions
        target = rng.randrange(low, n)
    value = lo + target * minor
    return {"kind": kind, "unit": unit, "major": major, "minor": minor, "lo": lo, "hi": hi, "value": value}


def draw(p: dict):
    lo, hi, minor, major = p["lo"], p["hi"], p["minor"], p["major"]
    span = hi - lo
    fig, ax = new_figure(2.6, 5.4)
    ax.set_xlim(-0.3, 2.0)
    ax.set_ylim(lo - span * 0.16, hi + span * 0.12)
    ax.axis("off")
    if p["kind"] == "thermometer":
        # A narrow glass tube on a round bulb; the liquid rises from the bulb to the reading.
        right = 0.62
        (x0, y0), (x1, y1) = ax.transData.transform([(0, 0), (1, 1)])
        w, h = 34 / (x1 - x0), 34 / (y1 - y0)  # a bulb 34 px across, round on the page
        bulb = lo - h * 0.45
        ax.add_patch(Rectangle((0.38, bulb), right - 0.38, hi - bulb, fill=False, edgecolor="#111111", linewidth=1.4))
        ax.add_patch(Ellipse((0.5, bulb), w, h, facecolor="#5f6b75", edgecolor="#111111", linewidth=1.4, zorder=3))
        ax.add_patch(Rectangle((0.44, bulb), 0.12, p["value"] - bulb, color="#5f6b75", zorder=4))
    else:
        right = 1.0
        ax.add_patch(Rectangle((0, lo), 1, span, fill=False, edgecolor="#111111", linewidth=1.4))
        ax.add_patch(Rectangle((-0.15, lo - span * 0.035), 1.3, span * 0.035, color="#111111"))  # the base
        ax.add_patch(Rectangle((0, lo), 1, p["value"] - lo, color="#9aa4ad"))
    v = lo
    while v <= hi + 1e-9:
        is_major = abs((v - lo) % major) < 1e-9 or abs((v - lo) % major - major) < 1e-9
        ax.plot([right, right + (0.25 if is_major else 0.12)], [v, v], color="#111111",
                linewidth=1.2 if is_major else 0.8)
        if is_major:
            ax.text(right + 0.35, v, f"{int(round(v))}", va="center", fontsize=10)
        v += minor
    ax.text(0.5, hi + span * 0.06, p["unit"], ha="center", fontsize=11)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    v = p["value"]
    text = str(int(v)) if float(v).is_integer() else f"{v:g}"
    unit = p["unit"]
    what = "temperature" if p["kind"] == "thermometer" else "volume of liquid"
    return [short(f"What is the {what} shown on the {p['kind']}, in {unit}?", text, [f"{text}{unit}", f"{text} {unit}"])]
