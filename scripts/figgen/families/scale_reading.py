"""A thermometer or measuring cylinder to read. The level is always on a marked division."""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

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
    target = rng.randrange(1, n)
    while target % divs == 0:  # land on an unlabelled division, so the student counts divisions
        target = rng.randrange(1, n)
    value = lo + target * minor
    return {"kind": kind, "unit": unit, "major": major, "minor": minor, "lo": lo, "hi": hi, "value": value}


def draw(p: dict):
    lo, hi, minor, major = p["lo"], p["hi"], p["minor"], p["major"]
    fig, ax = new_figure(2.6, 5.4)
    ax.add_patch(Rectangle((0, lo), 1, hi - lo, fill=False, edgecolor="#111111", linewidth=1.4))
    ax.add_patch(Rectangle((0.3 if p["kind"] == "thermometer" else 0, lo), 0.4 if p["kind"] == "thermometer" else 1,
                           p["value"] - lo, color="#9aa4ad"))
    v = lo
    while v <= hi + 1e-9:
        is_major = abs((v - lo) % major) < 1e-9 or abs((v - lo) % major - major) < 1e-9
        ax.plot([1, 1.25 if is_major else 1.12], [v, v], color="#111111", linewidth=1.2 if is_major else 0.8)
        if is_major:
            ax.text(1.35, v, f"{int(round(v))}", va="center", fontsize=10)
        v += minor
    ax.text(0.5, hi + (hi - lo) * 0.06, p["unit"], ha="center", fontsize=11)
    ax.set_xlim(-0.3, 2.0)
    ax.set_ylim(lo - (hi - lo) * 0.05, hi + (hi - lo) * 0.12)
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    v = p["value"]
    text = str(int(v)) if float(v).is_integer() else f"{v:g}"
    unit = p["unit"]
    what = "temperature" if p["kind"] == "thermometer" else "volume of liquid"
    return [short(f"What is the {what} shown on the {p['kind']}, in {unit}?", text, [f"{text}{unit}", f"{text} {unit}"])]
