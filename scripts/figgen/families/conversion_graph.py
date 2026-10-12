"""A straight-line conversion graph between two units (LS, UP).

Each conversion's gridlines are set to its own exact ratio (8 km to 5 miles, 5 kg to 11 lb),
so every value asked for sits where two gridlines cross. No money: exchange rates go stale.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, new_figure, short

ID = "conversion_graph"
KIND = "graph.line"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("conversion-graphs", "converting-miles-kilometres", "proportion-direct-inverse"))

CONVERSIONS = {
    "km-miles": {"x": "kilometres", "y": "miles", "xu": "km", "yu": "miles", "slope": Fraction(5, 8), "offset": 0,
                 "xstep": 8, "ystep": 5, "xmax": 80},
    "kg-lb": {"x": "kilograms", "y": "pounds", "xu": "kg", "yu": "lb", "slope": Fraction(11, 5), "offset": 0,
              "xstep": 5, "ystep": 11, "xmax": 50},
    "C-F": {"x": "degrees Celsius", "y": "degrees Fahrenheit", "xu": "°C", "yu": "°F", "slope": Fraction(9, 5), "offset": 32,
            "xstep": 5, "ystep": 9, "xmax": 100},
    "litres-pints": {"x": "litres", "y": "pints", "xu": "litres", "yu": "pints", "slope": Fraction(7, 4), "offset": 0,
                     "xstep": 4, "ystep": 7, "xmax": 40},
    "cm-inches": {"x": "centimetres", "y": "inches", "xu": "cm", "yu": "inches", "slope": Fraction(2, 5), "offset": 0,
                  "xstep": 5, "ystep": 2, "xmax": 50},
}


# Five conversions only: the variety is in which unit runs along the bottom and how far.
MIN_VARIETY = 25


def sample(rng: random.Random) -> dict:
    kind = rng.choice(sorted(CONVERSIONS))
    return {"band": rng.choice(BANDS), "kind": kind, "flip": kind != "C-F" and rng.random() < 0.5, "n": rng.choice([8, 10, 12])}


def spec(p: dict) -> dict:
    """The conversion as drawn: units either way round (not °C/°F), and n grid steps along."""
    c = dict(CONVERSIONS[p["kind"]])
    if p["flip"]:
        c.update(x=c["y"], y=c["x"], xu=c["yu"], yu=c["xu"], slope=1 / c["slope"], xstep=c["ystep"], ystep=c["xstep"])
    c["xmax"] = p["n"] * c["xstep"]
    return c


def _y(conv: dict, x) -> Fraction:
    return conv["slope"] * x + conv["offset"]


def draw(p: dict):
    conv = spec(p)
    n = conv["xmax"] // conv["xstep"]
    top = _y(conv, conv["xmax"])
    fig, ax = new_figure(6.0, 5.0)
    ax.set_xticks([conv["xstep"] * i for i in range(0, n + 1, 2)])
    ax.set_xticks([conv["xstep"] * i for i in range(n + 1)], minor=True)
    rows = [conv["offset"] + conv["ystep"] * j for j in range(-(conv["offset"] // conv["ystep"]), n + 1)]
    ax.set_yticks([r for r in rows if (r - conv["offset"]) % (2 * conv["ystep"]) == 0])  # 32, 50, 68 for °F
    ax.set_yticks(rows, minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.plot([0, conv["xmax"]], [float(_y(conv, 0)), float(top)], color=INK, linewidth=1.8)
    ax.set_xlim(0, conv["xmax"])
    ax.set_ylim(0, float(top) + conv["ystep"] / 2)
    for setter, name, unit in ((ax.set_xlabel, conv["x"], conv["xu"]), (ax.set_ylabel, conv["y"], conv["yu"])):
        setter(name[0].upper() + name[1:] + ("" if unit == name else f" ({unit})"))
    ax.tick_params(labelsize=9)
    ax.set_title(f"Converting {conv['x']} and {conv['y']}" + ("" if p["kind"] == "C-F" else " (approximately)"))
    return fig


def _forms(v, unit: str) -> list[str]:
    return [f"{v} {unit}", f"{v}{unit}"]


def questions(p: dict, rng: random.Random) -> list:
    conv = spec(p)
    n = conv["xmax"] // conv["xstep"]
    i, j = rng.sample(range(1, n), 2)
    x, y_back = conv["xstep"] * i, _y(conv, conv["xstep"] * j)
    qs = [
        short(f"Use the graph to change {x} {conv['xu']} into {conv['y']}.", int(_y(conv, x)), _forms(int(_y(conv, x)), conv["yu"])),
        short(f"Use the graph to change {int(y_back)} {conv['yu']} into {conv['x']}.", conv["xstep"] * j,
              _forms(conv["xstep"] * j, conv["xu"])),
    ]
    if conv["offset"] == 0:
        # Beyond the graph: a multiple of a reading on it, as an exam asks.
        big = conv["xstep"] * rng.randint(n + 1, 3 * n)
        qs.append(short(f"The graph stops at {conv['xmax']} {conv['xu']}. Use it to change {big} {conv['xu']} into {conv['y']}.",
                        int(_y(conv, big)), _forms(int(_y(conv, big)), conv["yu"])))
    return qs
